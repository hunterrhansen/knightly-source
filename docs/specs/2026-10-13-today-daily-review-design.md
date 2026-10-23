# Today: the daily review

Implemented. Today leads with a short daily lesson, ten practice items that keep
the streak, then offers the rest of the day (game review, every position due,
puzzles) under **Keep going**. Mockups: the
[Knightly Today page canvas](https://claude.ai/artifact/FFd73CrbRqL9Lq2pb6M1FH)
(Ready, Between steps, Returning, Done, Streak at risk).
Proposed: this page becomes the Watch tab
([The watch story](2026-10-18-watch-story-design.md#watch-home)).

## Outcome and principles

The page answers "what do I do now?" with one primary action. The model is
Duolingo's: a small daily goal, a visible streak, a short win after each step
and an honest stopping point.

- **One lesson, not a menu.** Before the streak is safe, Today shows one card
  with the lesson's progress and one primary button. The game review waits
  beside it as a quiet "Also today" row.
- **Small and finishable.** The lesson is `GOAL` (10) items, about five minutes.
  The rest of the day is optional and shown only after it, as **Keep going**.
- **Easy bar for the streak.** Finishing the lesson keeps the streak;
  reviewing a game keeps it only on a day with no lesson (a new game's slips
  join the lesson, per [the path home](2026-10-19-path-home-design.md#a-new-game-leads-the-watch)). Clearing the whole plan earns nothing extra; it is there for
  learners who want more.
- **The board is calm, the rewards are loud.** Gold is for earned streak moons:
  the medal on Done and each done day in the streak calendar. Beyond those, gold
  appears once per view. Wrong answers stay firm, not harsh (design system).
- **Honest.** Every number comes from the backend. No invented stats, no fake
  urgency, no penalties beyond losing the streak. "You can stop here" is always true.

## The daily lesson

The lesson is the day's minimum: tonight's watch, `GOAL` (10) items answered today in
[the watch's mix](2026-10-19-path-home-design.md#what-a-watch-holds-decided-2026-10-22)
(two look first, four on the post's idea, two mixed review, two from your games),
counting first answers to positions, threat questions, "Your move" items and puzzles.
With puzzles stored it is always ten; without them it is every position there is, and
with none there is no lesson and a waiting game review is the day's main action.
`today.lesson {done, total}` and the deck's `lesson` report it.

`/practice?mode=lesson` (`GET /api/deck?mode=lesson`, the default) serves the watch item
by item and stops serving when the lesson is done; its header reads **Daily lesson** and
its end beat **Lesson complete**, with Streak extended when it was. It grades through the
normal answer paths. More practice is an extra watch, in the same mix.

## The daily plan ("Keep going")

The backend builds the plan for the user's day; the client never composes it.

| Step | Source | Present when | Complete when |
| --- | --- | --- | --- |
| Review your game | `/api/home` `today.game` (newest unreviewed analysed game) | A game qualifies | Finish review saves (`POST /api/games/{id}/review`) |
| Revisit positions | `/api/deck` queue (FSRS due cards plus the pace's new positions; see [daily amount](2026-10-11-daily-practice-design.md)) | Cards are due | Today's queue is empty (`today.done == today.total`) |
| Puzzles | `/api/puzzles/*`, theme = most-missed tactic | Puzzles available | `done_today >= SESSION` (5) |

- **Keep going** runs the steps in that order; absent steps are omitted, not shown
  disabled. Each unfinished step row also opens that step directly (positions and
  puzzles both open practice, which serves due positions before puzzles);
  finishing a step then continues to the first unfinished one. With no steps and
  no lesson the page shows the existing empty/processing states.
- Key moments missed or assisted in step 1 are added to the deck by the existing
  grading path and appear in step 2 the same day (the count updates: "9 positions,
  includes the one you just missed").
- Step 3's theme and share ("31% of misses") come from `today.puzzles.theme/share`;
  omit the share line when null.
- The estimate is a client constant (lesson item or position ≈ 30 s, puzzle ≈ 45 s,
  game ≈ 4 min), rounded to whole minutes and labelled "about".

## Screens

All Today states live in `src/features/today/`; steps reuse the existing review,
practice and puzzle screens.

The Today tab is now the Watch tab's path home: its layout (the path,
tonight's node card, the kept night and the first night's nodes) follows
[the path home](2026-10-19-path-home-design.md), which replaces the Ready,
Returning, At risk and Done layouts in item 1 below. "Also today" and "Keep
going" became the extra watch node (for now the rest of today's practice from
the wall), and the deck card moved to All stats. Between steps (item 2) and
the rest are unchanged.

1. **Ready.** Brand header with streak pill (moon + count) and settings. A
   streak hero with Done's structure: in the gold medal's place an empty dashed
   socket with an outline moon (today's moon is missing), eyebrow
   "Today's lesson · about N min", "N nights in a row" ("Start your streak" with
   none; "Start a new streak" after one lapsed, with "Your best is N nights."),
   "Today's moon is still missing. N to go, your past mistakes first. Finish it
   to make it N+1 nights" (with no streak, no "missing" line and "start a
   streak"), and **Start lesson**. With no
   lesson the game keeps the streak (**Review your game**). Then the streak
   calendar (this week, Sun–Sat or Mon–Sun per Appearance: done, today, freeze
   used, upcoming; opens into the month).
   An "Also today" card offers the waiting game review as a row. Below: the deck
   card. Every streak state stacks the same way: hero, week, one plan card
   ("Also today" before the lesson, "Keep going" after), the deck card, and on Done
   a Tomorrow card. Each card leads with an eyebrow. The deck card ("Your deck",
   N positions, a ring like the lesson's ring around the moon: long-term green,
   learning blue, new the bare track, with the long-term count in the middle and
   a legend beside it; "N positions moved to long-term memory today" with an up
   arrow when any did; and the small-deck note) is the only deck view. Step rows
   mark a count of what is left, a small board for the game, a check when
   finished.
   Today scrolls only when its
   content is taller than the space between the header and tab bar (no iOS bounce
   when it fits); small phones and large text still scroll.
2. **Between steps** (Keep going, inside the session, full screen, no tabs). ✕
   (saves and exits) and a segmented progress bar, one segment per step. A short
   result (`kn-pop` check, "Game reviewed", the step's saved marks), "Up next: …",
   **Continue**, and "Stop here, progress is saved". The last step goes to Today.
3. **Returning partway.** The lesson is started: the socket turns solid inside a
   green ring filled to the lesson's progress, eyebrow "done of total done",
   and **Continue lesson**.
4. **Done** (the streak is safe today). The moon medal, tonight's phase (see
   Moon phases), or on a milestone night (7, 30, 100, 365) the milestone medal
   (`MilestoneMedal`: the full moon set in a gold medal on ribbons), hanging in
   a disc of night sky with twinkling stars (it replaced a gold halo that read
   as daylight around a night object), with `kn-bounce-in` and
   "N nights in a row" (confetti only when the streak reaches a milestone: 7, 30,
   100 or 365 nights), "Today's lesson is done. You can stop here." Streak calendar,
   then **Keep going**: the plan's steps (finished ones checked, unfinished ones
   open their step, the next one ringed with the only `kn-beacon`) and a secondary
   **Keep going** button for the next unfinished step, or "Everything's done for
   today." with **Learn N more new positions** in the same card once today's
   queue is finished. Then the deck card and Tomorrow: the hero's empty socket,
   small, with "Night N+1 is waiting", the due count and the reminder toggle. Done is a state of Today, shown again on later
   visits that day.
5. **Streak at risk** (streak > 0, lesson not started, within the reminder window
   before day end). The same hero with a gold dashed socket and gold moon, gold
   "N hours left today" (today's day in the calendar is a gold dashed socket
   too), "N nights in a row", "Today's moon is still missing.
   N to go, the positions closest to slipping first" and **Save my streak**,
   which opens the lesson; then only the calendar.

Implemented in `src/features/today/`: `todayState` derives the state from
`today` (via `api.dailyReview`, cached as `daily-review`) and import progress, with
Ready, Returning, At risk (last `AT_RISK_HOURS` = 4 hours of the user's day), Done
(`streak.safe_today`), Rest, New, Analyzing, Loading and Error. The main button
opens the lesson (`/practice?mode=lesson`) or, with none, the game review;
`today-samples.ts` feeds Storybook and the shell lab through the same logic.

Keep going opens each step directly: the game review, or tonight's watch. The `/daily`
between-steps screen and the separate daily practice session were removed on 2026-10-22;
the watch is the one practice session (kept per account scope under the `lesson` mode),
showing `lesson` progress and ending when the server reports it done. On web, a reload
keeps `?mode=lesson` and `?mode=extra` through the sign-in return-route allowlist.

Motion (shared `celebration-motion.tsx`, Reanimated, durations from `tokens.motion`): the
current step's node has a soft ring pulsing outward every `hint` (the beacon); Done's gold medal
drops and bounces in over `celebrate`; and when `isStreakMilestone` (7, 30, 100,
365) holds, a deterministic burst of 32 confetti pieces falls from the medal for
two `celebrate` beats, then unmounts. Done replays it on each visit that day.
Every effect ignores touches and is hidden from assistive technology. Under
reduced motion (`useSystemReducedMotion`) each entrance shows its final frame,
the beacon is not drawn and confetti does not render.

Existing states remain: loading, error/retry, new account (connect games),
importing/analyzing, content error, saving/uncertain progress, and nothing due
(a quiet Done variant with the streak unchanged and no medal).

## Streaks and freezes

- A **streak day** is a user-local day on which the lesson was done or a game was
  reviewed. A day with no plan (nothing due, no game, no puzzles) neither breaks
  nor extends the streak. Days before the lesson (migration 0015) keep the rule
  they were recorded under: any finished step or save-my-streak counted.
- **Freezes** apply automatically to a missed day. The user holds at most 2;
  one is earned per 7 consecutive streak days. No purchases. A frozen day shows
  dashed in the streak calendar and does not add to the count.
- The backend owns the streak (`daily.py`); the client only displays it. Each
  write that can finish a step (deck answer, puzzle answer, Finish review) records
  that day's finished lesson (`goal`) and steps in `daily_activity`, and Today's summary records the
  plan size, so a day with an empty plan reads as rest. A step never un-finishes
  within its day; neither does the lesson. The streak, best and freezes are recomputed from that history,
  oldest first, on every read: deterministic, so freeze use needs no separate
  storage. A freeze is only spent while a streak is running. Week states are
  `done | frozen | rest | missed | none` (before the first activity) for past days,
  `today` and `upcoming`. Streak milestones (7, 30, 100, 365) trigger the Done
  confetti.
- **Moon phases.** The streak moon waxes through a weekly cycle: night N of a
  streak (N ≥ 1) shows phase `((N − 1) mod 7) + 1`, so nights 7, 14, 21… are
  full moons and night 8 starts a new crescent. A streak of 0 shows the new
  moon (phase 0). Frozen days add no night, so the cycle carries on across
  them. The art is `MoonPhase` (`src/components/ui`; see the
  [art style lock](../art-style-lock.md#lock-record)) and the rule is
  `moonPhaseForNight` (pure, beside it). The backend numbers each done day's
  night (`night`, below), so the calendar never guesses where a run it can't
  see began. Shown in: the streak pill (the current count's phase), Done's
  medal (tonight's phase), each done day in the streak calendar and Progress's
  four-week grid (that day's night; a done day without one, from an older
  backend, shows the full moon), and the session-end streak beat. The
  missing-moon sockets (Ready, Returning, At risk, Tomorrow) keep the outline
  moon.
- **Streak calendar.** Today and the streak popover show `StreakCalendar`
  (`src/components/ui`) in place of the old week strip: arrows or a sideways
  swipe change the week, and dragging down or pressing its handle opens the
  month (arrows then change the month). It never moves past today's week or
  month. Its days echo the streak hero: a done day is that night's moon
  phase, like the medal, and today (until it counts) is the same grey
  dashed socket as the hero's missing moon. `TodayStreakCalendar` (Today feature) seeds the current week from the
  summary's `streak.week` and fetches earlier days for the range on screen from
  `/api/streak/days` (below), clamped to today; days still loading show blank
  (`none`), never missed. History is not persisted with the account cache.
  Signed-in screens provide the fetch through `LiveStreakHistory`; Storybook and
  previews show only the summary's week.
- **Week start.** Weeks start on Sunday by default; Appearance's "Week starts
  on" (`weekStart` device preference) switches the calendar's columns, weeks,
  month grid and "This week"/"Last week" titles to Monday. The backend's
  `streak.week` stays Monday-first, so a Sunday-first week's first day comes
  from `/api/streak/days`: `TodayStreakCalendar` fetches it with the range on
  screen, and `useSessionEnd` fetches it for the session's streak beat
  (blank until it loads).

## Memory

The memory card and Done's "moved to long-term" line use deck stats already
computed by `deck.stats`: `mastered` (FSRS stability ≥ `MASTERED_DAYS`, 60) is
"long-term", plus `learning` and `new`. "Moved to long-term today"
(`memory.mastered_today`) counts positions whose graded answer today took FSRS
stability from below to at least `MASTERED_DAYS`: card reviews store stability
before and after each graded answer (migration 0011). Reviews from before that
migration never count. Done shows the line only when the count is above zero.

## Sync card

Removed from the Watch tab's home: the sidebar's account
row shows the status, and **Sync now** stays in Settings → daily update. As
built before:

Once games are connected and the first analysis is done, Today ended with a
**From your games** card. It shows the same status as the sidebar's account row
(coloured dot and label), with what the run did ("3 new games · 3 analyzed") or
the step in progress, and a secondary **Sync now** button that queues
`/api/update/run`, disabled while a run was queued or running.

## Reminders

One daily local notification (`expo-notifications`, iOS and Android only; web
has no reminders in this release) at a user-chosen local time. Off until the user
opts in; the default time is 20:00. [Your watch](2026-10-18-watch-time-anchor-design.md)
replaces the time choice, schedule, copy and identifiers below with the learner's
watch time and anchor and a back-off window; opt-in, rescheduling, account scope
and the push entitlement rules here still apply.

- **Opt-in.** Done's Tomorrow card has a "Remind me at 8:00 PM" switch; Settings →
  Reminders (iOS menu picker, Android choice list; the row is hidden on web) offers
  Off, 8:00, 12:00, 18:00, 19:00, 20:00, 21:00 or 22:00. Turning it on asks for
  notification permission (Android creates the "Daily reminders" channel first so
  Android 13 can prompt); nothing asks at launch. A refusal leaves it off with
  "Notifications are off for Knightly" and an Open Settings link.
- **Schedule** (`planReminders` in `reminder-schedule.ts`, pure). Today's
  reminder is scheduled for the chosen time when it is still ahead, the review
  covers that moment (`now` and the reminder are before `day_ends_at`), the streak
  is not `safe_today` and the plan has an unfinished step (no reminder on rest
  days). Tomorrow's is always scheduled with the neutral "Your daily review is
  ready." because its state is unknown. Without a current review (not loaded,
  failed, or from an earlier day) today's falls back to the neutral line.
- **Copy** uses real numbers: "Your 12-night streak is waiting. Today's lesson
  keeps it: 10 to go." ("Reviewing your game keeps it." with no lesson). With no
  streak: "Today's lesson is ready. Finish it to start a streak."
- **Rescheduling.** `DailyReminders` (mounted with `TimezoneSync` for signed-in
  sessions) observes `daily-review` while reminders are on and replaces both
  scheduled notifications whenever the review or the choice changes, so answers,
  finished reviews and time-zone changes cancel today's once the streak is safe.
  Native calls run one at a time; latest plan wins.
- **Account scope.** The choice is the `daily-reminder` account item
  (`scope.cache.item`), cleared with the account. Sign-out (or a session switch)
  cancels the scheduled reminders, and a signed-out launch cancels them again.
  Only Knightly's two reminder identifiers are touched.
- No push entitlement: local notifications need none. Expo applies
  `expo-notifications`' plugin automatically and it adds `aps-environment`, which
  the App Store profile (no Push capability) rejects, so `app.config.ts` removes it
  (`withoutPushEntitlement`). Remote push would need the capability added first. The Android
  notification icon is the app icon until a monochrome icon is added.

Device checks (not covered by Jest or exports): the iOS/Android permission prompt
on opt-in only, delivery at the chosen time, cancellation after a step is done,
no delivery after sign-out, Android 13 prompt and inexact delivery without the
exact-alarm permission, and DST/time-zone travel.

## Backend work required

`/api/home` and `/api/deck` already supply the game, due counts, puzzle session
and memory stats. Missing:

1. **User-local day.** Implemented: `PUT /api/settings/timezone` stores the
   user's IANA zone (per-user `timezone` setting; `GET /api/settings` returns it
   with the resulting `day`). Deck, puzzle and review day counts, card due dates,
   `server_day` and `expected_day` checks use it; without one they keep the
   server's zone. `TimezoneSync` (Today feature, mounted for signed-in sessions)
   sends the device zone (`Intl` resolved zone) at session start and on return to
   the foreground when it changed, once per zone per session; a failed save retries
   on the next foreground and a zone the server rejects (422) is not resent. Deck,
   streak-days, overview and patterns queries refresh only after acknowledgement.
   Native Hermes zone reporting and travel across zones are device checks.
2. **Daily summary.** Implemented: `/api/home` `today` adds `day`, `day_ends_at`
   (UTC), `plan` (present steps in order: `{kind: game|positions|puzzles, done}`,
   positions and puzzles with `count`/`total`), `streak {count, best, freezes,
   safe_today, week: [{date, state, night}]}`, `memory {total, mastered, learning, new,
   mastered_today}` and `tomorrow_due`.
   Streak calendar history: implemented `GET /api/streak/days?from=YYYY-MM-DD&to=YYYY-MM-DD`
   returns `{days: [{date, state, night}]}` for the signed-in user, with the
   week's states. `night` is a done day's night number in its streak (1-based,
   frozen days skipped) and `null` for any other state; `streak.week` entries
   carry it too.
   The range is inclusive, at most 42 days and may not end after the user's today;
   invalid, reversed or oversized ranges return 422. The week and this history read
   the same oldest-first replay of `daily_activity`, so they agree on freezes.
3. **Streak storage.** Implemented: migration 0009 `daily_activity` (per-user,
   row-level security, included in data export and deletion cascade).
4. **Daily lesson.** Implemented: `GET /api/deck?mode=lesson`, `today.lesson` and
   the deck's `lesson` (see The daily lesson); migration 0015 adds
   `daily_activity.goal` and carries earlier days over. The threat answer endpoint
   records the day too, since its questions are lesson items.

Validate every new field with explicit Zod schemas at the API boundary, as for
the deck endpoints.

## Ownership and state

- `src/features/today/` owns the Today state machine and the daily-session
  orchestrator (step order, interstitials, resume). It calls the review, practice
  and puzzle features only through their registered public APIs.
- Review, practice and puzzles keep owning grading, submission guards and save
  recovery. The orchestrator advances only after a step's save is acknowledged;
  an uncertain save keeps the session blocked exactly as in those specs.
- Session position is in-memory per account session; Today reconstructs
  completion from `/api/home` after relaunch. Saved work is never lost by leaving.
- Day rollover mid-session follows the existing 409 handling: refresh the plan
  and return to Today.
- Today's query is invalidated after each acknowledged step save.

## Navigation

On iOS and Android the Today header shows the brand lockup with the streak pill
(`TodayStreakBadge`) at the top left; its accessible label includes freezes. The
content then starts with the streak calendar, without a separate streak line. Web has
no Today header, so the pill and a short note ("Streak safe for today" or "N
nights in a row") stay above the review. The pill is a button (`StreakButton`;
its name gives the streak, whether today is safe and the freezes held) that opens
the streak popover: the streak calendar (shared with Today), current
streak, best streak, freezes held and "A freeze covers a missed day; you earn one
every 7 days, up to 2." with a Done button. It opens as a popover under the
pill on every platform (`StreakPopover`): the page stays put behind a light
dim, and a tap outside, Done or the system back closes it. Session screens are
full screen with ✕, per the design system's "lessons are not places".

## Acceptance and verification

- Logic tests: lesson/plan derivation from home data, Done once the streak is safe,
  orchestrator advancing only on acknowledged saves, uncertain-save blocking,
  day-rollover reset, at-risk window selection.
- Backend tests: user-local day boundaries across time zones and DST, streak and
  freeze accounting (gap, freeze, no-plan day), lesson size and ordering, the
  lesson keeping the streak with positions left, summary schema.
- Storybook stories for each Today state; inspect 320 px width and
  large text. One browser smoke path stays: startup reaches Today.
- Native reminder delivery, permission prompt and haptics are manual checks.

## Open

- Whether puzzles count toward completing the day for users without a puzzle
  rating yet (currently: yes, if `available`).
- Streak sheet design and milestone copy.
