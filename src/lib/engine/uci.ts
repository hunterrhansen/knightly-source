/** How the controller reaches one engine process: raw UCI lines in and out. */
export interface UciTransport {
  start(
    onLines: (lines: readonly string[]) => void,
    onError: (message: string) => void,
  ): Promise<void>;
  send(command: string): void;
}

/** A score from the side to move's point of view, as UCI reports it. */
type Score = Readonly<{ type: 'cp' | 'mate'; value: number }>;
export type EngineLine = Readonly<{
  multipv: number;
  depth: number;
  score: Score;
  pv: readonly string[];
  nodes?: number;
  nps?: number;
}>;
/** When the search stops: the first of these reached, as `go` combines them. */
type SearchLimit = Readonly<{
  depth?: number;
  movetime?: number;
  nodes?: number;
}>;
type SearchRequest = Readonly<{
  fen: string;
  moves?: readonly string[];
  multipv?: number;
  limit: SearchLimit;
  onUpdate?: (lines: readonly EngineLine[]) => void;
}>;
type SearchResult = Readonly<{
  bestmove: string | null;
  lines: readonly EngineLine[];
}>;
export type EngineOptions = Readonly<{ threads?: number; hash?: number }>;

export interface UciEngine {
  /** Resolves with the engine's `id name` once it accepts searches. */
  ready(): Promise<string>;
  /**
   * Runs one search. A newer search or an abort supersedes it: the engine is
   * stopped and the superseded promise rejects with an `AbortError`, so a late
   * `bestmove` can never be mistaken for the newer position's result.
   */
  search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResult>;
}

/** Parses an `info` line that carries a principal variation, else undefined. */
function parseInfo(line: string): EngineLine | undefined {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'info') return undefined;
  let depth: number | undefined;
  let multipv = 1;
  let score: Score | undefined;
  let nodes: number | undefined;
  let nps: number | undefined;
  for (let i = 1; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'depth':
        depth = Number(tokens[++i]);
        break;
      case 'multipv':
        multipv = Number(tokens[++i]);
        break;
      case 'nodes':
        nodes = Number(tokens[++i]);
        break;
      case 'nps':
        nps = Number(tokens[++i]);
        break;
      case 'score': {
        const type = tokens[++i];
        const value = Number(tokens[++i]);
        // Bounds come from an aspiration window that failed; the exact score follows.
        if (tokens[i + 1] === 'lowerbound' || tokens[i + 1] === 'upperbound')
          return undefined;
        if (type === 'cp' || type === 'mate') score = { type, value };
        break;
      }
      case 'pv': {
        const pv = tokens.slice(i + 1);
        if (depth === undefined || !score || pv.length === 0) return undefined;
        return {
          multipv,
          depth,
          score,
          pv,
          ...(nodes === undefined ? {} : { nodes }),
          ...(nps === undefined ? {} : { nps }),
        };
      }
      case 'string':
        return undefined;
    }
  }
  return undefined;
}

function abortError(): Error {
  const error = new Error('The search was superseded.');
  error.name = 'AbortError';
  return error;
}

type Job = {
  request: SearchRequest;
  lines: EngineLine[];
  settled: boolean;
  stopping: boolean;
  resolve: (result: SearchResult) => void;
  reject: (error: Error) => void;
  release: () => void;
};

/**
 * Drives one engine with at most one search in flight. `go` is only sent after
 * the previous search's `bestmove`, which is the engine's acknowledgement that
 * it has stopped.
 */
export function createUciEngine(
  transport: UciTransport,
  options: EngineOptions = {},
): UciEngine {
  let name = 'Unknown engine';
  let started: Promise<string> | undefined;
  let failure: Error | undefined;
  let waiting: { token: string; resolve: () => void }[] = [];
  let current: Job | undefined;
  let next: Job | undefined;
  let multipv = 1;

  function settle(job: Job, outcome: SearchResult | Error) {
    if (job.settled) return;
    job.settled = true;
    job.release();
    if (outcome instanceof Error) job.reject(outcome);
    else job.resolve(outcome);
  }

  function expect(token: string) {
    return new Promise<void>((resolve) => waiting.push({ token, resolve }));
  }

  function fail(message: string) {
    failure = new Error(message);
    if (current) settle(current, failure);
    if (next) settle(next, failure);
    current = undefined;
    next = undefined;
  }

  function receive(lines: readonly string[]) {
    for (const line of lines) {
      if (line.startsWith('id name ')) name = line.slice(8);
      const token = line.trim();
      const match = waiting.find((entry) => entry.token === token);
      if (match) {
        waiting = waiting.filter((entry) => entry !== match);
        match.resolve();
      }
      if (!current) continue;
      if (line.startsWith('info ')) {
        const info = current.stopping ? undefined : parseInfo(line);
        if (!info) continue;
        current.lines[info.multipv - 1] = info;
        current.request.onUpdate?.(current.lines.filter(Boolean));
      } else if (line.startsWith('bestmove')) {
        const job = current;
        current = undefined;
        const move = line.split(/\s+/)[1];
        settle(job, {
          bestmove: move && move !== '(none)' ? move : null,
          lines: job.lines.filter(Boolean),
        });
        pump();
      }
    }
  }

  function ready(): Promise<string> {
    started ??= (async () => {
      await transport.start(receive, fail);
      const uciok = expect('uciok');
      transport.send('uci');
      await uciok;
      if (options.threads)
        transport.send(`setoption name Threads value ${options.threads}`);
      if (options.hash)
        transport.send(`setoption name Hash value ${options.hash}`);
      const readyok = expect('readyok');
      transport.send('isready');
      await readyok;
      return name;
    })();
    return started;
  }

  function pump() {
    if (current || !next || failure) return;
    const job = next;
    next = undefined;
    current = job;
    const { fen, moves, limit } = job.request;
    const wanted = Math.max(1, job.request.multipv ?? 1);
    if (wanted !== multipv) {
      multipv = wanted;
      transport.send(`setoption name MultiPV value ${wanted}`);
    }
    transport.send(
      `position fen ${fen}${moves?.length ? ` moves ${moves.join(' ')}` : ''}`,
    );
    const go = Object.entries(limit)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key} ${value}`);
    transport.send(`go ${go.join(' ')}`);
  }

  function stopCurrent() {
    if (current && !current.stopping) {
      current.stopping = true;
      transport.send('stop');
    }
  }

  return {
    ready,
    search(request, signal) {
      return new Promise<SearchResult>((resolve, reject) => {
        if (failure) return reject(failure);
        if (signal?.aborted) return reject(abortError());
        const job: Job = {
          request,
          lines: [],
          settled: false,
          stopping: false,
          resolve,
          reject,
          release: () => signal?.removeEventListener('abort', cancel),
        };
        function cancel() {
          if (next === job) next = undefined;
          if (current === job) stopCurrent();
          settle(job, abortError());
        }
        signal?.addEventListener('abort', cancel, { once: true });
        if (next) settle(next, abortError());
        next = job;
        if (current) {
          settle(current, abortError());
          stopCurrent();
        }
        ready().then(pump, (error: Error) => settle(job, error));
      });
    },
  };
}
