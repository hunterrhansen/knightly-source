import type { Square } from 'chess.js';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { castlingDropTarget, legalMoves } from '../move';
import { parsePosition } from '../position';
import { createAttemptGate } from './attempt-gate';
import type {
  BoardProps,
  InputSource,
  MoveAttempt,
  MoveVariant,
  Promotion,
} from './board.types';
import {
  type InteractionAction,
  type InteractionState,
  interactionReducer,
} from './interaction';
import { resolvePresentation } from './transition';

let nextAttempt = 0;
export function useBoardInput(
  props: BoardProps,
  options: Readonly<{
    /**
     * Each attempt reaches the owner after the board has shown it, and this
     * many ms later for a piece still sliding, so the owner's re-render cannot
     * stutter the slide (Lichess also updates the page after the piece moves).
     */
    deliverAfter?: (attempt: MoveAttempt) => number;
  }> = {},
) {
  const [state, dispatch] = useReducer(interactionReducer, { phase: 'idle' });
  const [message, setMessage] = useState<string | undefined>();
  const [illegalAttempts, setIllegalAttempts] = useState(0);
  const eligibleMoves = useMemo(() => {
    const policy = props.policy;
    if (policy.mode !== 'movable') return [];
    const position = parsePosition(props.position.fen);
    if (!position.ok) return [];
    const pieces = new Map(
      position.value.pieces.map((piece) => [piece.square, piece]),
    );
    const legal = legalMoves(props.position.fen);
    return policy.moves.filter((move) => {
      const piece = pieces.get(move.from);
      return (
        !!piece &&
        policy.sides.includes(piece.color) &&
        legal.some(
          (candidate) =>
            candidate.from === move.from &&
            candidate.to === move.to &&
            candidate.promotion === move.promotion,
        )
      );
    });
  }, [props.position.fen, props.policy]);
  const current = useRef({
    props,
    eligibleMoves,
    state: { phase: 'idle' } as InteractionState,
    gate: createAttemptGate(props.position.id),
    consumerError: false,
    promotionSource: 'activation' as InputSource,
    revision: 0,
    /** The attempt being awaited, for boards that show it at once. */
    submitted: undefined as MoveAttempt | undefined,
    /** A deferred attempt not yet handed to the owner. */
    outgoing: undefined as MoveAttempt | undefined,
  });
  const mouseSelection = useRef<{ origin?: Square } | undefined>(undefined);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const change = useCallback((action: InteractionAction) => {
    current.current.revision += 1;
    current.current.state = interactionReducer(current.current.state, action);
    dispatch(action);
  }, []);
  useLayoutEffect(() => {
    const previous = current.current.props;
    current.current.props = props;
    current.current.eligibleMoves = eligibleMoves;
    // Consume originating feedback before replacing the gate's position identity.
    if (
      !current.current.consumerError &&
      props.feedback &&
      current.current.gate.settle(props.feedback)
    ) {
      change({ type: 'clear' });
      setMessage(undefined);
    }
    if (previous.position.id !== props.position.id) {
      mouseSelection.current = undefined;
      current.current.gate.reset(props.position.id);
      current.current.consumerError = false;
      change({ type: 'clear' });
      setMessage(undefined);
    } else if (
      previous.orientation !== props.orientation &&
      current.current.state.phase === 'dragging'
    ) {
      change({ type: 'clear' });
      setMessage(undefined);
    }
  }, [props, eligibleMoves, change]);
  const isCurrent = () =>
    mounted.current &&
    props.position.id === current.current.props.position.id &&
    props.orientation === current.current.props.orientation;
  const variants = (origin: Square): readonly MoveVariant[] => {
    const latest = current.current.props;
    const resolved = resolvePresentation(latest);
    if (
      !resolved.ok ||
      latest.policy.mode !== 'movable' ||
      current.current.state.phase === 'awaiting' ||
      !resolved.submissionEnabled
    )
      return [];
    return current.current.eligibleMoves.filter((move) => move.from === origin);
  };
  // Like Lichess and Chess.com, a piece the player could move on this turn
  // selects even when pinned or blocked; it shows no dots.
  const ownPiece = (square: Square) => {
    const latest = current.current.props;
    const resolved = resolvePresentation(latest);
    if (
      !resolved.ok ||
      latest.policy.mode !== 'movable' ||
      current.current.state.phase === 'awaiting'
    )
      return false;
    const parsed = parsePosition(latest.position.fen, {
      skipValidation: true,
    });
    if (!parsed.ok) return false;
    const piece = parsed.value.pieces.find((item) => item.square === square);
    if (!piece || !latest.policy.sides.includes(piece.color)) return false;
    return resolved.submissionEnabled && parsed.value.turn === piece.color;
  };
  const submit = (move: MoveVariant, source: InputSource) => {
    const latest = current.current.props;
    if (
      !isCurrent() ||
      !variants(move.from).some(
        (candidate) =>
          candidate.to === move.to && candidate.promotion === move.promotion,
      )
    )
      return;
    const attempt: MoveAttempt = {
      ...move,
      source,
      positionId: latest.position.id,
      attemptId: `board-attempt-${++nextAttempt}`,
    };
    if (!current.current.gate.claim(attempt)) return;
    current.current.submitted = attempt;
    change({
      type: 'await',
      positionId: attempt.positionId,
      attemptId: attempt.attemptId,
    });
    setMessage('Move submitted. Waiting for the result.');
    current.current.outgoing = attempt;
  };
  function deliver(attempt: MoveAttempt) {
    const latest = current.current.props;
    try {
      latest.onAttempt(attempt);
    } catch {
      current.current.consumerError = true;
      setMessage(
        'The move handler failed. Reset the position to retry safely.',
      );
    }
  }
  // Attempts leave once their awaiting state is on screen, and a sliding move
  // once its piece has landed.
  useEffect(() => {
    const attempt = current.current.outgoing;
    if (!attempt) return;
    current.current.outgoing = undefined;
    const send = () => {
      if (
        mounted.current &&
        attempt.positionId === current.current.props.position.id &&
        current.current.state.phase === 'awaiting' &&
        current.current.submitted?.attemptId === attempt.attemptId
      )
        deliver(attempt);
    };
    const wait = options.deliverAfter?.(attempt) ?? 0;
    if (!wait) {
      send();
      return;
    }
    // Not cleared on re-render: the attempt must still reach the owner.
    setTimeout(send, wait);
  });
  const destination = (
    origin: Square,
    requested: Square,
    source: InputSource,
  ) => {
    // Dragging the king onto its own rook castles toward that rook.
    const target =
      (source === 'drag' &&
        castlingDropTarget(
          current.current.props.position.fen,
          origin,
          requested,
        )) ||
      requested;
    const options = variants(origin).filter((move) => move.to === target);
    if (!options.length) {
      setIllegalAttempts((count) => count + 1);
      change(
        source === 'activation'
          ? { type: 'clear' }
          : { type: 'select', origin },
      );
      setMessage('That destination is not a legal eligible move.');
      return;
    }
    if (options.some((move) => move.promotion)) {
      current.current.promotionSource = source;
      change({
        type: 'promote',
        origin,
        destination: target,
        positionId: current.current.props.position.id,
        variants: options,
      });
      setMessage('Choose a piece for promotion.');
    } else if (options[0]) submit(options[0], source);
  };
  const activate = (square: Square, source: InputSource) => {
    if (!isCurrent()) return;
    const interaction = current.current.state;
    if (
      interaction.phase === 'awaiting' ||
      interaction.phase === 'promotion' ||
      interaction.phase === 'dragging'
    )
      return;
    if (interaction.phase === 'selected' && interaction.origin === square) {
      change({ type: 'clear' });
      setMessage(undefined);
      return;
    }
    if (variants(square).length || ownPiece(square)) {
      change({ type: 'select', origin: square });
      setMessage(`Selected ${square}. Choose a destination.`);
      return;
    }
    if (interaction.phase === 'selected')
      destination(interaction.origin, square, source);
    else setMessage(`Square ${square}. No movable piece selected.`);
  };
  const beginDrag = (square: Square) => {
    if (
      !isCurrent() ||
      current.current.state.phase === 'promotion' ||
      !variants(square).length
    )
      return;
    change({
      type: 'drag',
      origin: square,
      positionId: current.current.props.position.id,
    });
    setMessage(undefined);
  };
  const finishDrag = (square: Square | null) => {
    const interaction = current.current.state;
    if (
      !isCurrent() ||
      interaction.phase !== 'dragging' ||
      interaction.positionId !== current.current.props.position.id
    )
      return;
    if (square === null || square === interaction.origin) {
      change({ type: 'clear' });
      setMessage('Drag cancelled.');
      return;
    }
    destination(interaction.origin, square, 'drag');
  };
  const choosePromotion = (piece: Promotion) => {
    const interaction = current.current.state;
    if (
      !isCurrent() ||
      interaction.phase !== 'promotion' ||
      interaction.positionId !== current.current.props.position.id
    )
      return;
    const move = interaction.variants.find(
      (variant) => variant.promotion === piece,
    );
    if (move) submit(move, current.current.promotionSource);
  };
  const cancel = () => {
    if (!isCurrent()) return;
    if (current.current.state.phase === 'awaiting') return;
    const promotion = current.current.state.phase === 'promotion';
    change({ type: 'clear' });
    setMessage(promotion ? 'Promotion cancelled.' : 'Selection cancelled.');
  };
  const cancelDrag = () => {
    if (isCurrent() && current.current.state.phase === 'dragging') {
      change({ type: 'clear' });
      setMessage(undefined);
    }
  };
  const restoreMouseSelection = () => {
    const previous = mouseSelection.current;
    mouseSelection.current = undefined;
    if (previous && isCurrent() && current.current.state.phase === 'dragging') {
      change(
        previous.origin
          ? { type: 'select', origin: previous.origin }
          : { type: 'clear' },
      );
      setMessage(undefined);
    }
  };
  return {
    state,
    /** The move being awaited, while awaiting. */
    submitted:
      state.phase === 'awaiting' &&
      current.current.submitted?.attemptId === state.attemptId
        ? current.current.submitted
        : undefined,
    eligibleMoves,
    /** Increments for each refused destination, for feedback such as sound. */
    illegalAttempts,
    revision: current.current.revision,
    message,
    consumerError: current.current.consumerError,
    activate,
    beginDrag,
    beginMouseDrag: (square: Square) => {
      if (
        !isCurrent() ||
        !variants(square).length ||
        current.current.state.phase === 'promotion'
      )
        return false;
      const previous = current.current.state;
      mouseSelection.current = {
        origin: previous.phase === 'selected' ? previous.origin : undefined,
      };
      beginDrag(square);
      return current.current.state.phase === 'dragging';
    },
    finishMouseDrag: (square: Square | null, click: boolean) => {
      if (!isCurrent()) return;
      if (click) {
        restoreMouseSelection();
        if (square) activate(square, 'activation');
      } else {
        mouseSelection.current = undefined;
        finishDrag(square);
      }
    },
    cancelMouseDrag: restoreMouseSelection,
    finishDrag,
    choosePromotion,
    cancel,
    cancelDrag,
    prepareDrawing: () => {
      if (
        !isCurrent() ||
        current.current.state.phase === 'promotion' ||
        current.current.state.phase === 'dragging'
      )
        return false;
      if (current.current.state.phase === 'selected') {
        change({ type: 'clear' });
        setMessage(undefined);
      }
      return true;
    },
  };
}
