import type { Square } from 'chess.js';
import type { MoveVariant } from './board.types';

export type InteractionState =
  | { phase: 'idle' }
  | { phase: 'selected'; origin: Square }
  | { phase: 'dragging'; origin: Square; positionId: string }
  | {
      phase: 'promotion';
      origin: Square;
      destination: Square;
      positionId: string;
      variants: readonly MoveVariant[];
    }
  | { phase: 'awaiting'; attemptId: string; positionId: string };
export type InteractionAction =
  | { type: 'select'; origin: Square }
  | { type: 'drag'; origin: Square; positionId: string }
  | {
      type: 'promote';
      origin: Square;
      destination: Square;
      positionId: string;
      variants: readonly MoveVariant[];
    }
  | { type: 'await'; attemptId: string; positionId: string }
  | { type: 'clear' };
export function interactionReducer(
  _state: InteractionState,
  action: InteractionAction,
): InteractionState {
  switch (action.type) {
    case 'select':
      return { phase: 'selected', origin: action.origin };
    case 'drag':
      return {
        phase: 'dragging',
        origin: action.origin,
        positionId: action.positionId,
      };
    case 'promote':
      return {
        phase: 'promotion',
        origin: action.origin,
        destination: action.destination,
        positionId: action.positionId,
        variants: action.variants,
      };
    case 'await':
      return {
        phase: 'awaiting',
        attemptId: action.attemptId,
        positionId: action.positionId,
      };
    case 'clear':
      return { phase: 'idle' };
  }
}
