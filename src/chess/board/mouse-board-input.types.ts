import type { RefObject } from 'react';
import type { View } from 'react-native';
export type MouseBoardInputOptions = {
  board: RefObject<View | null>;
  enabled: boolean;
  context: string;
  callbacks: {
    down: (x: number, y: number) => void;
    move: (x: number, y: number) => void;
    up: (x: number, y: number, click: boolean) => void;
    cancel: () => void;
    /** Whether a piece is under (x, y): web shows the grab hand. */
    grabbable: (x: number, y: number) => boolean;
  };
};
