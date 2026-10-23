import type { Square } from 'chess.js';
import { useEffect, useId, useRef, useState } from 'react';
import { squareAt } from '../coordinates';
import { createAnnouncementGate } from './announcements';
import type { BoardAccessibilityProps } from './board.types';
import { keyboardDestination } from './keyboard';

const navigation = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);
export function BoardAccessibility(
  props: BoardAccessibilityProps,
): React.JSX.Element {
  const [active, setActive] = useState<Square>(() =>
    squareAt(0, props.orientation),
  );
  const [focused, setFocused] = useState<Square>();
  const cells = useRef(new Map<Square, HTMLTableCellElement>());
  const consumedFocus = useRef<number | undefined>(undefined);
  const instructions = useId();
  const statusElement = useId();
  const gate = useRef(createAnnouncementGate());
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (gate.current.claim(props.statusId, props.statusReplaySafe))
      setAnnouncement(props.status);
  }, [props.statusId, props.status, props.statusReplaySafe]);
  useEffect(() => {
    if (
      props.focusRequest &&
      !props.hidden &&
      consumedFocus.current !== props.focusRequest.id
    ) {
      consumedFocus.current = props.focusRequest.id;
      setActive(props.focusRequest.square);
      cells.current
        .get(props.focusRequest.square)
        ?.focus({ preventScroll: true });
    }
  }, [props.focusRequest, props.hidden]);
  return (
    <>
      <table
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: APG interactive table grid requires the explicit grid role.
        role="grid"
        aria-label={props.label}
        aria-describedby={instructions}
        aria-rowcount={8}
        aria-colcount={8}
        inert={props.hidden}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          height: '100%',
          borderSpacing: 0,
          width: '100%',
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(undefined);
        }}
      >
        <tbody style={{ display: 'contents' }}>
          {Array.from({ length: 8 }, (_, row) => (
            <tr
              key={squareAt(row * 8, props.orientation)[1]}
              style={{ display: 'flex', flex: 1 }}
            >
              {Array.from({ length: 8 }, (_, column) => {
                const square = squareAt(row * 8 + column, props.orientation);
                return (
                  <td
                    key={square}
                    ref={(node) => {
                      if (node) cells.current.set(square, node);
                      else cells.current.delete(square);
                    }}
                    // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: Focusable board cells participate in the interactive grid.
                    role="gridcell"
                    aria-label={props.labels.get(square)}
                    aria-selected={props.selected === square}
                    aria-rowindex={row + 1}
                    aria-colindex={column + 1}
                    tabIndex={!props.hidden && active === square ? 0 : -1}
                    style={{
                      display: 'flex',
                      flex: 1,
                      minWidth: 0,
                      padding: 0,
                      outline: 'none',
                    }}
                    onFocus={() => {
                      setActive(square);
                      setFocused(keyboardModality ? square : undefined);
                    }}
                    onKeyDown={(event) => {
                      setFocused(square);
                      if (event.altKey || event.metaKey) return;
                      if (event.repeat && ['Enter', ' '].includes(event.key)) {
                        event.preventDefault();
                        return;
                      }
                      if (navigation.has(event.key)) {
                        event.preventDefault();
                        const next = keyboardDestination(
                          square,
                          event.key,
                          props.orientation,
                          event.ctrlKey,
                        );
                        setActive(next);
                        cells.current.get(next)?.focus({ preventScroll: true });
                      } else if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        props.onActivate(square, 'keyboard');
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        props.onCancel();
                      }
                    }}
                  >
                    {props.renderSquare(square, focused === square)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <span id={instructions} style={hiddenStyle}>
        Use arrow keys to explore squares. Home and End move across a row;
        Control Home and End move to board corners. Enter or Space selects a
        piece or destination. Escape cancels selection. Tab leaves the board.
      </span>
      <span
        id={statusElement}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={hiddenStyle}
      >
        {announcement}
      </span>
    </>
  );
}
// The board focuses cells in code after pointer input, which browsers report
// as :focus-visible. Track the last input kind so only keyboard use shows a ring.
let keyboardModality = true;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    () => {
      keyboardModality = true;
    },
    true,
  );
  window.addEventListener(
    'pointerdown',
    () => {
      keyboardModality = false;
    },
    true,
  );
}
const hiddenStyle = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const;
