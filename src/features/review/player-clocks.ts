import type { GameDetail } from '../../lib/api/review-contract';

type Clocks = { white: number | null; black: number | null };

/** Seconds each side starts with, from a PGN TimeControl such as "600+5";
 * null for daily ("1/259200") or unknown controls. */
export function startClock(timeControl: string | null | undefined) {
  const base = timeControl?.match(/^(\d+)(?:\+\d+)?$/)?.[1];
  return base ? Number(base) : null;
}

/** Each side's clock with `played` plies on the board, as Chess.com shows a
 * game's clocks while stepping through it: the time left after that side's
 * latest move, or the starting time before its first. Null when the game
 * recorded no clocks. */
export function clocksAt(
  game: Pick<GameDetail, 'plies' | 'time_control'>,
  played: number,
): Clocks | undefined {
  if (!game.plies.some((ply) => ply.clock_left != null)) return undefined;
  const start = startClock(game.time_control);
  const latest = (color: 'white' | 'black') => {
    for (let i = Math.min(played, game.plies.length) - 1; i >= 0; i--) {
      const ply = game.plies[i];
      if (ply?.color === color) return ply.clock_left ?? null;
    }
    return start;
  };
  return { white: latest('white'), black: latest('black') };
}

/** "4:58", "1:02:03"; under 20 seconds with tenths, "0:09.8", as Chess.com. */
export function formatClock(seconds: number) {
  const s = Math.max(0, seconds);
  if (s < 20) {
    const tenths = Math.floor(s * 10) / 10;
    return `0:${tenths.toFixed(1).padStart(4, '0')}`;
  }
  const whole = Math.floor(s);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const sec = String(whole % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
