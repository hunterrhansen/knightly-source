/** Pattern points (practice rewards design, "Pattern points"): earned,
 * predictable and never taken away. Session-only: not saved or sent. */

/** How an answer was reached. */
export type AnswerOutcome =
  /** Correct on the first try, without a hint or the solution. */
  | 'clean'
  /** Correct with a hint or on a second go. */
  | 'helped'
  /** Missed, or the solution was shown. */
  | 'none';

/** Points one answer earned, and the moment they show. */
export type PointsAward = Readonly<{
  /** Changes for every award, so each one animates once. */
  id: string;
  base: number;
  /** The run bonus paid on reaching 5 or 10 in a row. */
  bonus: number;
  /** The square the solving move landed on, where the shard takes off. */
  square?: string;
}>;

const BASE = { clean: 10, helped: 5, none: 0 } as const;

/** Points for one answer; `combo` is the run including this answer. */
export function pointsFor(outcome: AnswerOutcome, combo: number) {
  const bonus =
    outcome === 'clean' && combo === 5
      ? 10
      : outcome === 'clean' && combo === 10
        ? 20
        : 0;
  return { base: BASE[outcome], bonus };
}

/** The square a UCI move lands on ("e2e4" → "e4"); none for a shown answer. */
export function landingSquare(uci: string | undefined) {
  return uci && /^[a-h][1-8][a-h][1-8]/.test(uci) ? uci.slice(2, 4) : undefined;
}

/** What a session's points were made of, for the results beat. */
export type PointsSummary = Readonly<{
  firstTries: number;
  helped: number;
  runBonus: number;
  /** +20 when every answer of at least five was a first try. */
  perfect: number;
  total: number;
}>;

const PERFECT_BONUS = 20;
const PERFECT_MIN = 5;

/** The results beat's breakdown rows, leaving out empty ones. */
export function breakdownRows(summary: PointsSummary) {
  return [
    summary.firstTries && {
      label: `${summary.firstTries} ${summary.firstTries === 1 ? 'first try' : 'first tries'}`,
      value: `+${summary.firstTries * BASE.clean}`,
    },
    summary.helped && {
      label: `${summary.helped} with help`,
      value: `+${summary.helped * BASE.helped}`,
    },
    summary.runBonus && { label: 'Run bonus', value: `+${summary.runBonus}` },
    summary.perfect && {
      label: 'Perfect session',
      value: `+${summary.perfect}`,
    },
  ].filter((row): row is { label: string; value: string } => !!row);
}

/** A session's points, one award per position, so a re-judged answer replaces
 * its award rather than adding a second one. */
export class PointsLedger {
  private awards = new Map<string, { base: number; bonus: number }>();
  private sequence = 0;
  /** Records `positionId`'s points; returns the award to show, or undefined
   * when nothing changed (nothing earned, or the same award again). */
  record(
    positionId: string,
    earned: { base: number; bonus: number },
    square?: string,
  ): PointsAward | undefined {
    const value = earned.base + earned.bonus;
    const before = this.awards.get(positionId);
    this.awards.set(positionId, { base: earned.base, bonus: earned.bonus });
    if (!value || (before && before.base + before.bonus === value))
      return undefined;
    this.sequence += 1;
    return {
      id: `${positionId}:${this.sequence}`,
      base: earned.base,
      bonus: earned.bonus,
      ...(square ? { square } : {}),
    };
  }
  /** Points earned during the session (the perfect bonus is paid at the end). */
  get total() {
    let sum = 0;
    for (const award of this.awards.values()) sum += award.base + award.bonus;
    return sum;
  }
  summary(): PointsSummary {
    let firstTries = 0;
    let helped = 0;
    let runBonus = 0;
    for (const award of this.awards.values()) {
      if (award.base === BASE.clean) firstTries += 1;
      else if (award.base === BASE.helped) helped += 1;
      runBonus += award.bonus;
    }
    const answered = this.awards.size;
    const perfect =
      answered >= PERFECT_MIN && firstTries === answered ? PERFECT_BONUS : 0;
    return {
      firstTries,
      helped,
      runBonus,
      perfect,
      total: this.total + perfect,
    };
  }
}
