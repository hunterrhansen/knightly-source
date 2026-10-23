import { createUciEngine, type UciTransport } from './uci';

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

/** Answers the handshake like Stockfish and records every other command. */
function fakeEngine() {
  const sent: string[] = [];
  let emit: (lines: readonly string[]) => void = () => {};
  const transport: UciTransport = {
    async start(onLines) {
      emit = onLines;
    },
    send(command) {
      sent.push(command);
      if (command === 'uci') emit(['id name Stockfish 19', 'uciok']);
      if (command === 'isready') emit(['readyok']);
    },
  };
  return { transport, sent, output: (...lines: string[]) => emit(lines) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('UCI engine', () => {
  it('reports every principal variation with its exact score', async () => {
    const fake = fakeEngine();
    const engine = createUciEngine(fake.transport);
    const search = engine.search({
      fen: start,
      multipv: 2,
      limit: { depth: 12 },
    });
    await settle();
    expect(fake.sent).toEqual(
      expect.arrayContaining([
        'setoption name MultiPV value 2',
        `position fen ${start}`,
        'go depth 12',
      ]),
    );
    fake.output(
      'info depth 12 seldepth 16 multipv 1 score cp 35 nodes 9000 nps 450000 pv e2e4 e7e5',
      'info depth 12 seldepth 15 multipv 2 score cp 120 upperbound nodes 9100 pv d2d4',
      'info depth 12 seldepth 15 multipv 2 score mate -3 nodes 9200 pv a2a3 e7e5',
      'bestmove e2e4 ponder e7e5',
    );
    await expect(search).resolves.toEqual({
      bestmove: 'e2e4',
      lines: [
        expect.objectContaining({
          multipv: 1,
          score: { type: 'cp', value: 35 },
          pv: ['e2e4', 'e7e5'],
        }),
        expect.objectContaining({
          multipv: 2,
          score: { type: 'mate', value: -3 },
          pv: ['a2a3', 'e7e5'],
        }),
      ],
    });
  });

  it('never gives a superseded search result to the newer position', async () => {
    const fake = fakeEngine();
    const engine = createUciEngine(fake.transport);
    const first = engine.search({ fen: start, limit: { depth: 20 } });
    await settle();
    const second = engine.search({ fen: afterE4, limit: { depth: 20 } });

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(fake.sent.at(-1)).toBe('stop');
    // The old search's output arrives before the engine acknowledges the stop.
    fake.output(
      'info depth 9 multipv 1 score cp 30 nodes 10 pv e2e4',
      'bestmove e2e4',
    );
    await settle();
    expect(fake.sent.slice(-2)).toEqual([
      `position fen ${afterE4}`,
      'go depth 20',
    ]);

    fake.output(
      'info depth 9 multipv 1 score cp -25 nodes 10 pv e7e5',
      'bestmove e7e5',
    );
    await expect(second).resolves.toMatchObject({ bestmove: 'e7e5' });
  });

  it('stops the engine when a search is cancelled', async () => {
    const fake = fakeEngine();
    const engine = createUciEngine(fake.transport);
    const controller = new AbortController();
    const search = engine.search(
      { fen: start, limit: { movetime: 5000 } },
      controller.signal,
    );
    await settle();
    controller.abort();
    await expect(search).rejects.toMatchObject({ name: 'AbortError' });
    expect(fake.sent.at(-1)).toBe('stop');
  });

  it('stops at whichever limit comes first, depth or time', async () => {
    const fake = fakeEngine();
    const engine = createUciEngine(fake.transport);
    const search = engine.search({
      fen: start,
      moves: ['e2e4'],
      limit: { depth: 22, movetime: 5000 },
    });
    await settle();
    expect(fake.sent.slice(-2)).toEqual([
      `position fen ${start} moves e2e4`,
      'go depth 22 movetime 5000',
    ]);
    fake.output('bestmove e7e5');
    await expect(search).resolves.toMatchObject({ bestmove: 'e7e5' });
  });
});
