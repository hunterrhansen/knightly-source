import { stockfishTransport } from './stockfish-transport';
import { createUciEngine, type UciEngine } from './uci';

let engine: UciEngine | undefined;

/** The app's one Stockfish, started on first use: one thread and a small
 * hash, so a side line's search stays light on phones and laptops. */
export function getStockfish(): UciEngine {
  engine ??= createUciEngine(stockfishTransport(), { threads: 1, hash: 16 });
  return engine;
}

export type { EngineLine } from './uci';
