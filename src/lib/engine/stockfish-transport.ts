import { KnightlyStockfish } from 'knightly-stockfish';
import type { UciTransport } from './uci';

/** Stockfish 19 with Lichess's small net, compiled into the app (iOS and
 * Android) as the local `knightly-stockfish` Expo module. */
export function stockfishTransport(): UciTransport {
  return {
    // Checked on start, so a build without the module rejects `ready()`
    // instead of throwing where the engine is merely created.
    async start(onLines) {
      if (!KnightlyStockfish)
        throw new Error('This build does not include the engine.');
      KnightlyStockfish.addListener('onLines', (event) => onLines(event.lines));
      KnightlyStockfish.start();
    },
    send(command) {
      KnightlyStockfish?.send(command);
    },
  };
}
