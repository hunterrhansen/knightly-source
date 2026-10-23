# The path home: every watch on one path

Accepted direction (2026-10-19). Build step 1 (the path home from today's
data) is built in `src/features/today` (`path-model.ts`, `path-view.tsx`,
`node-card.tsx`), and step 2's server-built extra watches open from the
extra watch node (`/practice?mode=extra`, `backend/src/knightly/extra.py`);
step 3 (the schedule ahead, exact history and first-star progress,
`backend/src/knightly/path.py`) is built and needs the backend deployed: until
then the app falls back to unlabelled nights after tomorrow and nights spread
between known dates.
The node card is a sheet over the path rather than a popover anchored to the
node. The journey is the whole app: there is no tab bar, Games and Progress
open as modals from tiles on the path ([One screen, no tab
bar](#one-screen-no-tab-bar)), built and needing a native rebuild. Not yet
checked on a phone, with large text or with VoiceOver. Replaces the Watch page in
[the watch story](2026-10-18-watch-story-design.md#watch-home) and moves its
[map of nights](2026-10-18-watch-story-design.md#progress-the-map-of-nights)
to the home. Slip states, stars, ranks, the lesson seen from the wall,
raiders, Games and the board rules stay as that spec has them. Mockup: the
[Knightly watch wireframes canvas](https://claude.ai/artifact/Rsk54ip1jvUBAkpsWV7iHi)
("The path home").

## Why

The nightly watch works: it is short, packaged, and ends with a reward. Going
further does not. **More practice** opens the plain daily plan, so continuing
feels like leaving the story for a feature list. Continuing should always feel
like another watch. Duolingo's home path is the reference: one path, the next
lesson always one tap away, each lesson the same packaged experience.

**Superseded on 2026-10-20 by [the curriculum](2026-10-20-curriculum-wards-design.md):**
the path's nodes become wards, and the map of nights moves to Progress beside the
streak. The rule below -- never order the path by topic -- was correct while there was
no course; now there is one, and a path of due dates shows the learner the scheduler's
bookkeeping instead of what they are learning. A ward clears on retention (`deck.holds`),
so spaced repetition measures progress through the course rather than competing with it.
Everything else here stands: tonight's composition, slip states, stars, ranks, the wall,
raiders and the board rules.

The watch story rejected a lesson path because Knightly has no fixed course and
a path of lesson nodes would invent one. This path doesn't. Duolingo's path is a
course with review sprinkled in; Knightly's is the reverse: **the learner's own
spaced-repetition schedule laid out as a road**, with tonight as "you are
here", the coming returns ahead, and ranks as the milestones. The path is
ordered by time and the schedule, never by topic.

## Principles (kept and sharpened)

- **Spaced repetition is the engine.** Each night's node holds what the review
  schedule (FSRS) says is due, exactly as the lesson does today. Nothing on the
  path (sections, themes, extra watches) reorders, gates or replaces it.

- **Every watch is the same experience:** the lesson from the wall, raiders,
  the end-of-watch beat ("N raids turned back"), results. An extra watch is not
  a lesser screen.
- **A clear end each night.** The first watch of the night keeps the streak and
  the moon and ends with "Night 13 kept · 5 in a row · Good night, knight. You
  can stop here." Extra watches are offered, never pushed and never capped: no
  reminders, no streak pressure, no countdowns.
- **Night numbers are all time; the streak is "in a row".** A night's number
  counts every night kept, all time (the Nth night kept is night N; before
  tonight is kept, tonight is the next). Nodes, cards and the kept moment say
  "Night 13". The streak never takes a night's number: it always reads "N in
  a row" beside it ("Night 13 · 5 in a row"); the streak pill keeps its bare
  count. The app takes the number from the path (`/api/journey`'s
  `nights.total`), else `/api/home`'s `streak.nights_total`, else (older
  servers) the streak.
- **Climb on improvement only.** No XP and nothing for volume. Stars come from
  moves that stop slipping (11+ days); extra watches earn them only that way.
  What an extra watch gives back tonight is the watch's own beat: raids turned
  back, moves held, and the path advancing.
- **Art serves the path.** The night landscape is the path's background; the
  wall scene is the node card and the lesson's frame.

## Home: the path

The app opens on the path (still called Watch), scrolled so the current node
sits in the lower middle of the screen.

1. **Top bar:** the streak pill (moon and nights in a row; opens the existing
   streak popover with This week), the rank chip ("Squire II · ★ 23"; opens
   Progress) and the avatar (opens Account).
2. **Section banner,** pinned while its nodes are on screen. A section is a
   rank: the stretch of path between two castles. "Section 3 · Squire II" and
   "10 more moves to stop slipping" (stars to the next rank). A section ends
   only when enough moves pass the 11-day bar, which only the schedule can
   produce. Its subtitle describes, never decides: "Mostly missed threats
   lately" from the lesson's focus (`today.focus`), else "Your past mistakes".
   Drawn as a night-sky (navy) card, so green stays for tonight and the
   nights kept, in two short lines like Duolingo's unit banner (the section and rank
   as a caps eyebrow, the stars to go as its title); the subtitle is read out
   with them but not drawn, to keep the path in view.
   Before the first star the first section is Page.
3. **The path:** a winding column of nodes over the night landscape, newest at
   the top.
   - **Kept nights:** green nodes with that night's moon phase; milestone
     nights (7, 30, 66, 100) carry the medal.
   - **Extra watches kept:** smaller green nodes between the nights.
   - **Tonight's node:** the only beacon, with the knight beside it. Ringed
     with the lesson's progress while it is under way.
   - **After tonight is kept:** tonight turns green with its moon and the next
     node lights as an **extra watch** with a soft glow and no beacon; the
     knight moves beside it.
   - **Ahead: the schedule.** Grey nodes for the coming nights, each labelled
     with what returns then: "Tomorrow · 32 due", "Thu · Nf5 comes back",
     "Sat · Qd4's last check" (a held move whose next Good answer would pass
     the 11-day bar). Up to a week ahead, then faint nodes. The spacing is
     something to see and look forward to, not a hidden algorithm.
   - **Rank castles** stand beside the path as on today's map: reached ones
     with a flag and date, the next with "N ★ to go", placed by stars, never a
     promise of a date.
4. **Side tiles** on the path's left edge, under the banner, as Duolingo's:
   **Games** (the board glyph, badged with the new games that have moves that
   slipped) and **Progress** (a star). Each opens its modal.

### The node card

Tapping a node opens its card as the platform's own sheet over the path
(the home stack's `node` screen, `/node?key=` or `?castle=`: an iOS form sheet
or Android bottom sheet sized to the card, with the system grabber). On the web
it is a dialog over the dimmed path (`node-dialog.web.tsx`, a `transparentModal`
route): centred and up to 480 points wide from 768 points, docked to the bottom
below that; the backdrop, Escape, its ✕ and Back close it. The card's hero runs edge to edge to the
sheet's top:

- **Tonight (before):** the wall scene in tonight's state as the card's
  header, "Tonight's watch · about 4 min", the headline ("3 moves slipped past
  you yesterday"), up to three move rows (the existing row: board, label,
  "vs kd_88 · yesterday", chip), and **Start watch** (Continue watch, or gold
  **Save my streak** at risk). The anchor line under it. When a newly
  analysed game leads the watch, the card is that game's (see
  [A new game leads the watch](#a-new-game-leads-the-watch)).
- **Extra watch:** the same card, eyebrow "Extra watch · about 4 min", the
  rows it will hold, and **Start** as a secondary-styled button.
- **A kept night or extra watch:** what it held ("5 moves held · 1 stopped
  slipping · A star relit"), read-only.
- **Tomorrow:** "Night 6 · tomorrow after dinner", "N moves due" and the
  reminder switch (today's Tomorrow card).
- **A night ahead:** the moves scheduled to return that night (label, "vs
  kd_88", how many times held so far) and which of them could stop slipping.
- **A kept night:** where each of its moves stands now (held, back {weekday},
  stopped slipping).
- **A castle:** the rank, its emblem, stars needed or the date reached.

Swipe the sheet down (or tap outside it) to close it; an action closes it
before it leaves. Start opens the lesson from the wall.

### A new game leads the watch

Game review folds into the watch. When a newly analysed game has slips never
answered (`deck.lead_game`: the newest game played in the last three days
with one), they lead tonight's lesson, ahead of the most forgotten due moves,
and tonight's card is that game's:

1. "Your game vs kd_88 last night" (today, last night, on {weekday}).
2. "2 moves slipped past you. They join tonight's watch." ("A move … It
   joins …" for one).
3. Its slip rows (up to three), then "+ N moves you're keeping hold of" (the
   rest of the lesson).
4. **Start watch** (Continue watch, Save my streak as usual), then a
   **Replay the whole game** text link to the existing review
   (`/review/{id}`).

**The watch keeps the night.** When a lesson exists, only finishing it keeps
the night and the streak; a game review keeps the night only on a day with
no lesson, when the review is the watch ("Review your game"). So an extra
watch is never locked behind an unfinished lesson after a game review. The
server owns this (`daily.steps_done`'s `game_keeps`, stored as
`daily_activity.game`; no migration). Days kept by a game review before this
change stay kept.

### After a watch

The lesson ends with the end-of-watch beat and results, then returns to the
path, which takes one step (about two seconds, `path-step.tsx`): it opens on
the node just kept, which pops with a spreading ring; the road fills up to
the next node as the knight hops along it and the path scrolls with him; the
next node, small and dim until then, springs up lit. A step waits until home
is on screen, plays once, and starts only from a node that was on the path
and not yet done (a journey loading late never fakes one). Reduced motion
skips it: the path simply opens on the next node. After the night's first watch, the session end also shows "Night N
kept · You can stop here" (the existing kept celebration; medal on milestones;
the night rule) before returning.

### First night

The path's first nodes are **Connect your games** (done), **Finding moves that
slipped** (beacon, "12 of 20 games checked"; its card offers **Try a puzzle
while you wait**) and **Your first watch** (lights once the lesson exists;
**Start first watch**). The watch time is still asked after the first watch.

## What a watch holds (decided 2026-10-22)

Every watch, the nightly one and each extra one, is ten items, and each item has
a job (`mix.SLOTS` in `backend/src/knightly/mix.py`). The mix follows the core-20%
audit of what moves a 400–1500 player:

| Job | Items | Served from |
| --- | --- | --- |
| **Look first** | 2 | A threat, allows, vision or calm question from the learner's own games (`drill.py`) |
| **Tonight's idea** | 4 | The current post's puzzles, announced ("At the <place>"). A post taught from the learner's own games (the Gatehouse's vision drill) serves those first, then its practice themes (easy loose-piece puzzles); a post with neither falls back to the weakest themes, unannounced |
| **Mixed review** | 2 | One earlier post's idea served unannounced (`mode: review`, "Mixed review"), and one "Your move" |
| **From your games** | 2 | A review card due tonight, the most likely forgotten first; else the family puzzle owed to a position first met tonight |

The order is look, idea, games, idea, review, look, idea, games, review, idea, so
no job comes twice running. Every look-first question (and a card's threat step) is
labelled **Safety check · Threats / Captures / Their reply** in the app, and the
Gatehouse's knight line names the routine: checks, captures and threats, theirs and
yours, before every move. Every practice badge (Safety check, At the <place>, Mixed review,
Same idea, Rated N) is a button: tapping it explains it in the coach's bubble until the next
item or a second tap, so the board never moves (`badge-copy.ts`). A slot with nothing to serve takes the next job that
has something (games, review, look, then tonight's idea), so a learner with no
games yet still gets a full watch of puzzles. With puzzles stored a watch is always
ten items; without them it is every position there is.

Reviews due beyond the nightly watch's two slots wait for an extra watch or the
next night; nothing reorders the schedule.

### Lesson intros (issue #326)

Before a post's practice, each of its lessons is introduced once, in Steps order, the
way a Steps trainer teaches: the knight's line explains (bubble titled with the lesson),
"Watch from the wall" plays the lesson's easiest position out, and "Your turn on watch"
gives a guided first try with a moment to think before the piece is marked. The try is
judged in the app and never saved, so it never counts toward holding the lesson. The
deck carries `intro` on the item tonight's idea fills (`intros.py`); the app shows it in
the same frame (the board never moves) and posts `/api/lessons/{key}/introduced` when it
is finished or skipped. A lesson row on a reached post's card replays it
(`/lesson-intro?key=`). The words live in `lesson-intro-copy.ts`.

## What an extra watch holds

As many extra watches as the learner wants, each ten items in the same mix. Its
games slots take, in order: cards due tonight that the nightly watch had no room
for (none was answered tonight, so none is an early second review), the family
puzzle owed, **new slips** not yet in a lesson (newest games first), then
**family puzzles for held moves**, closest to the 11-day bar first, since solving
one is what lets such a move stop slipping. Nothing answered tonight comes back.

## Testing out of a post (issue #325)

The current post's card offers **Test out of this post**: the post's exam, as Steps has one
per step. It is twelve positions from the post's lessons at the post's own level
(`challenge.py`), with the badge "The post's test". Ten right clears the post for good (the
card then says "Cleared by its test"), unless a lesson's games say not yet, since the games
have the last word. Fewer right changes nothing and the post goes on as before. The test
never keeps the night, so its end has no streak beat, only "Post cleared" or "Not this time"
with the score and any castle reached. When the puzzle rating is well above the post's level
(`suggest_test_out`), the card offers it first: "Your puzzles say you may be past this post."

## One screen, no tab bar

The journey is the whole app. There is no tab bar; the path (the `(main)`
group's `index`, still named Watch) is the root, and everything else opens
over it:

| From the path | Opens | Presentation |
| --- | --- | --- |
| Streak pill | Streak popover (This week) | As before |
| Rank chip, Progress tile | `/progress` | Modal |
| Games tile | `/games`; a game at `/games/{id}` inside it | Modal |
| Avatar | `/account` | Modal |
| A node | `/node?key=` | Sheet (as before) |

**Modals** are Account's presentation: on iOS `presentation: 'modal'`, the
system's full-height sheet with the same native toolbar ✕ at the top right of
its root and swipe down to close; on Android and the web, a pushed page (the
web page's Back closes it). Each modal has its own stack
(`src/features/shell/modal-stack*`): links inside it push there (a game from
the Games list, Progress's hidden positions), and links out of it (a lesson,
Accounts & sync, Games from a Progress row, Keep watch tonight) close it
first so they open over the path. While a game's review shows inside Games,
the sheet's swipe-down is off, so dragging a piece never closes it; its own
close and Back still work. **Replay the whole game** from tonight's card and
the daily plan's game review keep the full-screen `/review/{id}`.

The web has no sidebar or bottom tabs any more: the path draws the streak
pill, rank chip and avatar in its own top bar and the same tiles. The Account
page lists its settings at every width (the sidebar's Settings gear is gone).
Old links still land: `/games`, `/progress` and `/review/{id}` open as above;
`/progress/stats` is gone (All stats is part of Progress).

Removed: the native tab navigator and its icons (`assets/navigation/*.png`),
the web `AppShell` sidebar and bottom tabs with its sync status line, the
`/navigation-preview` development tabs and **Explore navigation** link (the
shell lab shows the home with sample data), and `/progress/stats`.

## Progress

One scrolling sheet, with All stats folded in (no separate page), in this
order. Each section keeps its existing data and component
(`src/features/progress`: `progress-view.tsx`, `progress-sections.tsx`):

1. **Your rank:** the emblem, "Page · ★ 2", and the stars to the next rank;
   the "Your first star" card while there are none.
2. **Is it working?** Blunders per game a → b (last 30 days against the 30
   before), the rating chart with its range chips, Last 4 weeks.
3. **Nights:** nights kept all time, in a row, the best run and freezes held.
4. **Your game:** Game skills (the skill shape), each skill's numbers, In your
   games, Tactics (solved on the first try, with training), Clock, Openings.
5. **Your memory:** **Your moves** (the ring: on watch, held, stopped
   slipping, from `/api/journey`'s `moves`; an older server shows the deck by
   memory stage) with hidden positions, and **Coming up** (the next 7 days of
   reviews).

The map left Progress for the home path.

## Moves and removals

| Today | Becomes |
| --- | --- |
| Watch page (hero, tonight card, kept view) | The path and tonight's node card |
| Kept results card | The kept node's card and the session end |
| Tomorrow night card and reminder switch | Tomorrow's node card |
| This week calendar | The streak popover under the pill |
| Extra practice card / More practice (`/daily`) | Extra watch nodes; `/daily` was removed on 2026-10-22 |
| Progress map of nights | The home path |
| Tab bar (Watch, Games, Progress) and web sidebar | The path with Games and Progress tiles and modals |
| All stats (`/progress/stats`) | Progress's one sheet |
| The game review as its own step | Tonight's watch card, led by the new game's slips |

## Backend and API

- **Extra watches** (built, `backend/src/knightly/extra.py`): `POST /api/lesson/extra`
  starts tonight's next extra watch (or resumes the open one) and returns it as
  a lesson deck; `GET /api/deck?mode=extra` continues it. Both carry
  `extra: {done, total, kept}` (`kept`: extra watches finished tonight, this one
  once done) and `results`/`puzzle_results` of that watch only; `today.extra_kept`
  in `/api/home` gives the path its small nodes for tonight. It is filled per
  [What an extra watch holds](#what-an-extra-watch-holds), with the family
  puzzle owed to a position first answered tonight served right after it, as in
  the nightly lesson. Answers grade and save as today (the server re-grades),
  and a family puzzle solved for a held move counts as that move's family. It
  opens only once tonight's lesson is finished (409 before), so it never marks
  the night kept or touches the streak; with no puzzles stored it ends early
  where it runs dry. The app opens it at `/practice?mode=extra`
  (`EXTRA_WATCH_HREF` from `src/features/practice/practice-api.ts`), in the
  watch's frame with the end-of-watch beat and results but never the streak's
  beats. No migration: the open watch is one per-user setting.
- **The schedule ahead** (built, `backend/src/knightly/path.py`): `/api/journey`'s
  `ahead` is the next seven days from tomorrow, each with the moves due that
  day by their FSRS due date (overdue ones are tonight's) and up to three of
  them (label, SAN, opponent, board, answers held in a row) with `last_check`:
  whether a Good answer when it comes due would carry it past the 11-day bar
  (and its tactic family is solved). Last checks lead each day, then the
  longest held. The path labels a night ahead "Sat · Qd4's last check",
  "Fri · Nf5 comes back", "Mon · 4 due" or "Sun · nothing due"; tomorrow keeps
  `tomorrow_due` and adds its last check.
- **The path's history** (built): `/api/journey`'s `history.nights` is every
  kept night's date, oldest first (the Nth is night N), with what its watch
  held (first answers right and wrong, less those its extra watches held, and
  stars earned), and `history.extra` every finished extra watch with what it
  held. Finished extra watches are logged once in the `extra_watch_log`
  setting (no migration); those finished before it existed are not on the
  path. Stars, castles and extra watches stand on their real nights.
  `GET /api/journey/night?date=` is a kept night's card: its moves and where
  each stands now (held and back {day}, on watch, stopped slipping).
- **Progress toward the first star** (built): `/api/journey`'s `first_star`,
  while there is no star, is the held move closest to the bar: its stability
  against 11 days and whether it also needs a family puzzle. Progress's
  "Your first star" card shows it as a bar.
- **A new game leading the watch** (built, `deck.lead_game`): `deck.queue`
  sorts the lead game's new slips first among new cards (so the pace keeps
  room for them) and `deck.lesson_queue` serves them before due ones.
  `/api/home`'s `today.tonight.game` is `{id, opponent, played_at, slipped}`
  (its new slips in the lesson) or null, and `tonight.cards` are then only its
  slips; `remaining` is the rest of the lesson.
- **The one screen's data** (built): `/api/home`'s `today.new_games_slipped`
  (new games, as `new_games`, with a move that slipped: the Games tile's
  badge) and `/api/journey`'s `moves: {on_watch, held, stopped}` (every move
  in the deck by `watch.state_of`: Progress's Your moves).
- **Compatibility:** the new fields are additions; an older app ignores them,
  and the app treats them as optional so it still works against an older
  server.

## Build order

1. **Path home** from today's data: the path, tonight's node card, kept and
   tomorrow cards, castles; Progress without the map. Built.
2. **Extra watches** on the server and the extra node card. Built
   (`/practice?mode=extra`).
3. **The schedule ahead** on the path, **exact history** in `/api/journey`,
   and first-star progress. Built (`backend/src/knightly/path.py`); needs the
   backend deployed.
4. **Night numbers, game review in the watch, one screen.** Built (this
   page's sections above); needs the backend deployed and a native rebuild.

## Decided

- Extra watches are not capped per night (as Duolingo).
- Rank names stay as they are (`watch.RANKS`); since 2026-10-22 ranks come only from posts cleared (a castle every third post), and stars are a count, not a route to rank.

## Tests

- The node a learner sees as current: tonight before it is kept, the next extra
  watch after, the first-night nodes before any night is kept.
- Only the night's first watch keeps the streak; an extra watch never does.
- Night labels: the kept moment and nodes say the all-time night, the streak
  only "N in a row" (`today-state.test.ts`, `today-screen.test.tsx`).
- A new game's slips lead the lesson and tonight's card, with Replay the
  whole game (`test_watch.py`, `tonight.test.ts`, `today-screen.test.tsx`);
  a game review does not keep the night when a lesson exists, and does with
  none (`test_daily.py`).
- The side tiles open Games (with its badge) and Progress
  (`today-screen.test.tsx`); Progress's sections in order with Nights and Your
  moves (`progress-view.test.tsx`); the moves tally and the badge count
  (`test_watch.py`); remembered routes after sign-in (`destinations.test.ts`,
  `return-route.test.ts`). Presentation (sheet, ✕, swipe) is checked on
  devices, not in Jest.
- Extra watch composition order and that it repeats no card due tonight.
- Nodes ahead list the moves the schedule actually has due on those days, and
  a section ends only at a rank's star threshold.
- The board never moves in an extra watch, as in the nightly one.
