import * as Haptics from 'expo-haptics';

// Haptics are a nicety: unsupported platforms and failures are ignored.
const quietly = (run: () => Promise<void>) => {
  run().catch(() => {});
};

/**
 * A raised button pressed down: a soft tap on touch-down, as the face drops
 * onto its ledge, like the press feel in Duolingo and Chess.com.
 */
export function pressHaptic() {
  quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
}

/** A control press or a step through the moves. */
export function tapHaptic() {
  quietly(() => Haptics.selectionAsync());
}

// One answer can set off several haptics at once: the answer itself, the
// lesson finishing, a run reaching a new tier. Those in the same tick play
// once, as the strongest, and none follows within 100 ms (art direction:
// never two haptics within 100 ms).
type Moment = 'light' | 'success' | 'error';
const strength: Record<Moment, number> = { light: 0, success: 1, error: 1 };
const MOMENT_GAP = 100;
let pending: Moment | undefined;
let playedAt = Number.NEGATIVE_INFINITY;

function playMoment() {
  const moment = pending;
  pending = undefined;
  if (!moment) return;
  playedAt = Date.now();
  if (moment === 'light') lightHaptic();
  else
    quietly(() =>
      Haptics.notificationAsync(
        moment === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ),
    );
}

/** Feedback for the moment an answer lands: the answer, or what it completed. */
export function momentHaptic(moment: Moment) {
  if (Date.now() - playedAt < MOMENT_GAP) return;
  if (pending === undefined) queueMicrotask(playMoment);
  if (pending === undefined || strength[moment] > strength[pending])
    pending = moment;
}

/** A practice answer was right or wrong. */
export function answerHaptic(correct: boolean) {
  momentHaptic(correct ? 'success' : 'error');
}

/** A milestone inside a lesson, such as a run reaching gold or flame. */
export function lightHaptic() {
  quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** A lesson finished: the last segment of the bar landed. */
export function successHaptic() {
  quietly(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

/** A lesson star shard landing in the points counter: a crisp, small tick. */
export function coinHaptic() {
  quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
}

/** The run bonus coin landing in the counter: a firmer knock. */
export function bonusHaptic() {
  quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}
