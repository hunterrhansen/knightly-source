import type { UciTransport } from './uci';

// scripts/prepare-engine-web.mjs copies stockfish.js 19's lite single-threaded
// build here; the worker finds stockfish.wasm beside its script.
const script = '/stockfish/stockfish.js';

/** Stockfish 19 Lite in a web worker, as Chess.com's analysis board runs it.
 * Single-threaded, so the page needs no cross-origin isolation. */
export function stockfishTransport(): UciTransport {
  let worker: Worker | undefined;
  return {
    async start(onLines, onError) {
      if (typeof Worker === 'undefined')
        throw new Error('This browser cannot run the engine.');
      worker = new Worker(script);
      worker.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') onLines(event.data.split('\n'));
      };
      worker.onerror = (event) => {
        event.preventDefault();
        onError(event.message || 'The engine stopped.');
      };
    },
    send(command) {
      worker?.postMessage(command);
    },
  };
}
