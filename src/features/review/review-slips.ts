import type { GameDetail } from '../../lib/api/review-contract';

// "What slipped past you" on a game's screen (watch story spec, "Games"):
// one row per review card in move order, with a four-segment track from on
// watch through held to stopped slipping, and a chip saying what's next.

type SlipRowTone = 'watch' | 'held' | 'stopped';
export type SlipRow = {
  ply: number;
  title: string;
  reason: string | null;
  /** Track segments lit, of four: on watch 1, held 2–3, stopped slipping 4. */
  lit: number;
  tone: SlipRowTone;
  chip: string;
  /** The track for screen readers ("Held, 2 of 4"). */
  progress: string;
};

/** A local day (YYYY-MM-DD) as whole days since the epoch. */
function dayNumber(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/** The local calendar day of `now`, as the server writes due days. */
export function localDay(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A future due day: the weekday within a week, then the date. */
function laterDay(due: string, today: string) {
  const [y, m, d] = due.split('-').map(Number);
  const date = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(
    undefined,
    dayNumber(due) - dayNumber(today) < 7
      ? { weekday: 'long' }
      : { month: 'short', day: 'numeric' },
  );
}

/** The game's slips as rows, or undefined from servers without `deck_cards`.
 * The chip says "Tonight" once a card is due (or never answered), otherwise
 * how far a held card has got, or the day an unheld one comes back. */
export function slipRows(
  game: Pick<GameDetail, 'deck_cards' | 'plies'>,
  today: string,
): SlipRow[] | undefined {
  if (!game.deck_cards) return undefined;
  return [...game.deck_cards]
    .sort((a, b) => a.ply - b.ply)
    .map((card): SlipRow => {
      const move = game.plies[card.ply - 1];
      const title = move ? `${card.label} · ${move.san}` : card.label;
      const reason =
        card.reason ?? (move?.best_san ? `Best was ${move.best_san}.` : null);
      const base = { ply: card.ply, title, reason };
      if (card.state === 'stopped')
        return {
          ...base,
          lit: 4,
          tone: 'stopped',
          chip: 'Stopped slipping',
          progress: 'Stopped slipping',
        };
      const due = !card.due || dayNumber(card.due) <= dayNumber(today);
      if (card.state === 'held') {
        const lit = Math.min(Math.max(card.held, 1), 2) + 1;
        return {
          ...base,
          lit,
          tone: 'held',
          chip: due ? 'Tonight' : `Held ${lit} of 4`,
          progress: `Held, ${lit} of 4`,
        };
      }
      return {
        ...base,
        lit: 1,
        tone: 'watch',
        chip: due || !card.due ? 'Tonight' : laterDay(card.due, today),
        progress: 'On your watch, 1 of 4',
      };
    });
}
