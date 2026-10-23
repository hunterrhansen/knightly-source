import { pieceNames } from '../position';
import type { BoardProps } from './board.types';
import type { InteractionState } from './interaction';

export function boardStatus(
  props: BoardProps,
  state: InteractionState,
  message: string | undefined,
  turn: string,
  revision = 0,
): { id: string; text: string; replaySafe?: boolean } {
  const prefix = props.position.id;
  const feedback = props.feedback;
  if (state.phase === 'awaiting') {
    const correlated =
      feedback?.positionId === state.positionId &&
      feedback.attemptId === state.attemptId;
    return {
      id: `${prefix}:${state.attemptId}:${correlated ? feedback.outcome : (message ?? 'awaiting')}`,
      text: correlated
        ? feedback.message
        : (message ?? 'Waiting for the result.'),
    };
  }
  if (state.phase === 'promotion')
    return {
      id: `${prefix}:promotion:${state.origin}:${state.destination}:${revision}`,
      text: `Choose promotion piece. Available: ${[...new Set(state.variants.map((move) => move.promotion).filter((piece) => piece !== undefined))].map((piece) => pieceNames[piece]).join(', ')}. Cancel to return to the pawn.`,
    };
  if (message)
    return {
      id: `${prefix}:interaction:${revision}:${message}`,
      text: message,
    };
  if (feedback?.positionId === prefix)
    return {
      id: `${prefix}:${feedback.attemptId}:${feedback.outcome}`,
      text: `${props.presentation.preview ? 'Attempted position. ' : ''}${feedback.message}`,
    };
  const move = props.presentation.lastMove;
  const transition = props.presentation.transition;
  const moveText = move
    ? `Move from ${move.from} to ${move.to}${move.promotion ? `, promotes to ${pieceNames[move.promotion]}` : ''}. `
    : '';
  return {
    id: `${prefix}:position:${props.orientation}:${transition?.id ?? ''}`,
    replaySafe: false,
    text: `${transition?.reason === 'opponent' ? 'Opponent move. ' : ''}${moveText}${turn === 'w' ? 'White' : 'Black'} to move. ${props.orientation === 'w' ? 'White' : 'Black'} at bottom.`,
  };
}
