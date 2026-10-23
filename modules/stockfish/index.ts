import { requireOptionalNativeModule } from 'expo';

type KnightlyStockfish = {
  start(): void;
  send(command: string): void;
  addListener(
    event: 'onLines',
    listener: (event: { lines: string[] }) => void,
  ): { remove(): void };
};

/** The engine compiled into the app, or null in a build without it. */
export const KnightlyStockfish =
  requireOptionalNativeModule<KnightlyStockfish>('KnightlyStockfish');
