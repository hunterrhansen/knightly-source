# Your watch: time and anchor

Accepted and implemented. [Asking for the watch](#asking-for-the-watch)
(proposed 2026-10-18) is built and replaces the Today card. Implements "Cue over clock (accepted)" from the Knightly direction
(not yet on `main`): the learner picks when
they keep their watch and what it follows, in the habit-stacking form "After I
[current habit], I will keep my watch". Reminders use both. This extends the
reminders in [Today](2026-10-13-today-daily-review-design.md#reminders); the
streak, freezes and day boundaries there are unchanged.

## Why

If-then plans tied to an existing routine improve follow-through far more than a
clock time alone. Too many notifications make people turn them off, and guilt
copy fails. So: one reminder a day at most, only when the watch isn't kept,
in the learner's own words, with varied encouraging wording, backing off when
the learner goes quiet.

## Data model (backend)

The watch is a per-user setting (existing `settings` key/value table, row-level
security, export and deletion already cover it; no migration):

- `watch` setting: `{time: "HH:MM", anchor: str, set_on: "YYYY-MM-DD"}`.
  - `time`: local wall-clock time in the user's zone, 00:00–23:45 in 15-minute
    steps.
  - `anchor`: the habit after "After I", trimmed, 2–60 characters, one line
    (for example `finish dinner`). Stored without the "After I" prefix.
  - `set_on`: the user's local day when it was last saved (server-set). Saving
    again is a fresh start for back-off.
- Unset until the learner chooses. It syncs across their devices.

Whether reminders are on stays on the device (`daily-reminder` account item),
because notification permission is per device.

## API contract

- `PUT /api/settings/watch` `{time, anchor}` → `{time, anchor, set_on}`. 422 for
  a time off the 15-minute grid or an anchor outside 2–60 characters or with a
  line break.
- `GET /api/settings` adds `watch: {time, anchor, set_on} | null`.
- `/api/home` `today` adds `watch` (same shape, or null) and
  `streak.last_kept`: the latest local day on or before today that counted for
  the streak (`done`), or null. Reminders count silence from it.

Zod schemas validate the new fields at the API boundary; the OpenAPI snapshot
and generated contract update together.

## Onboarding and settings UI

**Your watch** (`/watch`, full screen with ✕, all platforms; owned by the Today
feature):

1. "When will you keep your watch?" A choice of times: 7:00, 8:00, 12:00, 13:00,
   17:00, 18:00, 19:00, **20:00 (preselected)**, 21:00, 22:00, 23:00, labelled in
   the device's 12/24-hour style. An existing watch preselects its own time.
2. "After I …" A text field completing "After I ___, I will keep my watch."
   with three tappable suggestions that follow the chosen time (morning: pour my
   coffee, finish breakfast, get to my desk; midday: finish lunch, take a break,
   get home; evening: finish dinner, brush my teeth, get into bed). A leading
   "after I" typed by the learner is dropped. Required.
3. On iOS and Android, "Remind me" (switch, on by default the first time):
   "One reminder at this time, only on days you haven't kept your watch."
4. **Keep my watch** saves (`PUT /api/settings/watch`). Only after the save is
   acknowledged, a "Remind me" that is on asks for notification permission (the
   same opt-in path as today; a refusal leaves reminders off and says so). Then
   back to where it was opened from. A failed save keeps the screen with an error
   and Retry; nothing is half-saved.

Where it appears:

- **Onboarding.** The same form is asked for at the end of the first watch
  (see [Asking for the watch](#asking-for-the-watch)); the home path has no
  setup card.
- **Settings → Your watch** row: "8:00 PM · After I finish dinner", opens
  `/watch`. **Reminders** becomes Off / On (the time is the watch's).
- **Done's Tomorrow card** shows "After I finish dinner, I will keep my watch."
  and the switch reads "Remind me at 8:00 PM".

## Asking for the watch

Proposed (2026-10-18) and built: `src/features/today/watch-ask*.ts(x)`, the
`watch` beat in `SessionBeats`. Replaces Today's "Set your watch" card. The
learner is asked once they have kept a watch, not when they first open the app.

### Why after the first watch

- **Duolingo asks the cheap question first and the commitment after a
  success.** Before the first lesson it only asks for a daily time target; after
  the lesson come results, "practise every day", "you're on a 1-day streak", then
  an optional streak goal with **Commit to my goal**, and only then sign-up
  [weak: third-party teardowns of the first-run screens]. Renaming that button
  from Continue to "Commit to my goal" was a significant win, offering an easier
  goal to people who decline helped a lot, and introducing several streak ideas
  early made results worse [moderate: Duolingo's retention lead, company-reported,
  no effect sizes].
- **Plans stick when the goal is already wanted.** If-then plans have a
  medium-to-large effect on follow-through (d = 0.65) [strong], and they work best
  when the person already holds the goal. Right after "Night 1 kept" the learner
  knows what a watch is and has just felt one take a few minutes; on first open
  "a few minutes with your own mistakes" is abstract.
- **Notification permission after value.** Asking after a first success gets
  more opt-ins than asking at launch, and iOS shows its system prompt only once
  [weak: vendor guidance]. Remind me already asks only after an acknowledged save.
- **People come back around when they last practised.** Duolingo stopped letting
  learners choose a reminder time and reminds 23.5 hours after the last session,
  because plans change [moderate, company-reported]. Knightly keeps cue over clock
  but starts from the time the learner actually kept their first watch.

### When it appears

- **Trigger.** At the end of a session whose
  [Streak extended](2026-10-14-session-end-beats-design.md#streak-extended) beat
  showed, while `today.watch` is null and the ask is due (below). It is the next
  beat after Streak extended; Long-term memory and the session's exit follow as
  before.
- **First ask.** The first streak-extending session after sign-up, which is
  normally the first watch. Existing accounts without a watch get their first ask
  after their next watch.
- **Not now.** Skipping records the skip and continues the beats. It is asked
  once more, at the end of the first watch that brings the streak to 3 or more
  nights, at least two nights after the skip. After a second skip it is never
  asked again; Settings → Your watch and Done's Tomorrow card still open it.
- **State.** Skips are a device account item (`watch-ask`: `{skips,
  last_skipped}`), like `daily-reminder`: no migration or API change. A new
  device may ask once more; a saved watch syncs and stops every ask.
- **Not asked:** while signed out, in a session that didn't extend the streak,
  when a watch exists, or when the streak reads were unknown or failed (no
  Streak extended beat).

### The ask

The same Your watch screen and save path as Settings (`/watch`), presented as a
beat: it fades in over the session end (`pop` timing), full screen, with no ✕.
Under reduced motion it appears without the fade.

- **Title** "Same time tomorrow?" and the coach line "You kept tonight's watch at
  8:40 PM. Tie tomorrow's to something you already do and it sticks." ("today's"
  for watches kept before 17:00.)
- **Time** preselects the time the watch was kept, rounded to the nearest 15
  minutes, as its own chip ahead of the standard times (the screen already shows
  a saved time that isn't in the list). The standard times stay for anyone who
  wants another.
- **After I …** and its suggestions as in Settings, following the chosen time.
- **Remind me** (iOS and Android) on by default; permission is asked only after
  the save is acknowledged, as now. Web shows no switch.
- **Keep my watch** saves and continues the beats; a failed save keeps the beat
  with the error and Retry. **Not now** is a quiet text button under it, with no
  loss or guilt wording. Only one idea on this screen: no freezes, milestones or
  streak goals.

Done's Tomorrow card, while no watch is set, shows a quiet "Choose a time for
tomorrow" link to `/watch` in place of the anchor sentence. Today has no watch
card.

### Tests for the ask

- When it is due (pure): first streak-extending session with no watch; not
  without a Streak extended beat, with a watch, after a second skip, or within
  two nights of a skip; again once the streak reaches 3 after one skip.
- Time preselect (pure): rounds to the nearest 15 minutes, ties later, across
  midnight.
- The beat: Keep my watch saves and continues; Not now records a skip and
  continues without saving; a failed save stays with Retry; permission only after
  an acknowledged save with Remind me on.

## Reminder rules

`planReminders` (pure, device time) decides what to schedule; `DailyReminders`
replaces the schedule whenever the review, the watch or the switch changes, as
now. Notifications are scheduled ahead for the whole back-off window, so they
still follow these rules if the app isn't opened.

- **Time:** the watch time each local day (legacy device time, then 20:00, while
  no watch is set).
- **Only if not kept:** today's reminder is scheduled only when the review covers
  it and the streak is not `safe_today` and the plan has an unfinished step
  (unchanged). Future days are scheduled optimistically; keeping a watch reloads
  the review and the reschedule drops that day's.
- **Silence and back-off:** silence starts at the later of `streak.last_kept` and
  `watch.set_on`. For day *d*, *n* = days since that start.
  - *n* 1–7: every day.
  - *n* 8–30: Mondays only, with fresh-start wording (a new week is a landmark).
  - *n* > 30: none, until a watch is kept or the watch is saved again.
  - That is at most about 11 scheduled notifications, under iOS's 64 limit.
- **Wording:** title "After I {anchor}" (none without an anchor). The body
  rotates by local date through encouraging lines, so consecutive days differ;
  "tonight" for watch times from 17:00, otherwise "today". Today's reminder,
  when the review is known, keeps the real-number line ("Your 12-night streak is
  waiting. Today's lesson keeps it: 10 to go."). No guilt, no "you broke it".
- **Identifiers:** `knightly.daily-reminder.YYYY-MM-DD`; cancelling removes every
  scheduled notification with the `knightly.daily-reminder.` prefix (which also
  clears the old `today`/`tomorrow` ones). Sign-out still cancels them.

## Tests

- Backend: watch validation (grid, length, line break), `set_on` from the user's
  zone, settings and home fields, `last_kept` with a missed and a frozen day.
- `planReminders`: no reminder today once the streak is safe or on a rest day;
  daily for days 1–7 of silence, Mondays only for 8–30, none after; saving the
  watch restarts the window; consecutive days' bodies differ; anchor in the title.
- `/watch`: saves time and trimmed anchor, asks permission only after an
  acknowledged save with Remind me on, keeps the screen on a failed save.
- The ask: see [Tests for the ask](#tests-for-the-ask).

## Device checks

Listed in [current status](../status.md#phone-and-native-runtime-ios).
