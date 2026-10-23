# Current status and remaining work

What is implemented, what still needs checking and what is planned for removal.
Local checks and bundling do not establish a release. Specs hold behavior; this
page holds only state and open gates.

## Implemented and deployed

The backend runs in staging and production (same `ghcr.io/hunterrhansen/knightly-backend`
image, production only after a successful staging deploy; see [deployment](deploy.md)).
The Expo app ships to iPhone through TestFlight `beta` builds against the
production API ([README Phone builds](../README.md#phone-builds)). Both
`knightlychess.app` and staging serve the Expo web export; production switched from
the original frontend on October 20, 2026, which still runs unrouted for rollback
([deployment](deploy.md#rolling-back-the-web-cutover)).

- **Foundation** ([spec](specs/2026-10-10-app-foundation-design.md)): universal
  Expo app, Clerk sign-in on web and iOS, session-scoped API/Query
  infrastructure, account-isolated returning-launch cache (24-hour snapshots,
  cleared on sign-out or identity change).
- **Navigation and settings** ([spec](specs/2026-10-12-knightly-navigation-design.md)):
  one screen with no tab bar: the path is the root,
  its header carries the streak pill, rank chip and avatar, and side tiles
  open **Games** (badged with new games that slipped) and **Progress** as
  modals like Account (iOS sheet with the ✕ and swipe down, except Games,
  which opens full screen so its board keeps its size and closes only with the
  ✕; pages on Android and the web, which has no sidebar any more); a game
  opens inside the Games modal. iOS Account modal with SwiftUI settings forms, pickers, sheets and inputs; linked accounts, daily update, analysis
  depth, export and identity-verified deletion.
- **Chess.com import and Games** ([import](chesscom-import.md), [spec](specs/2026-10-12-games-design.md)):
  lookup, confirmed import, status, and a searchable, filterable, date-grouped
  library with paging.
- **Today daily review** ([spec](specs/2026-10-13-today-daily-review-design.md)):
  user-local review day, streaks with freezes, the 10-item daily lesson that keeps
  the streak, local daily reminders, streak popover and motion.
- **The path home** ([spec](specs/2026-10-19-path-home-design.md), build
  step 1): the app (Watch, titled "Tonight" from 17:00) opens on the path: the streak pill and rank chip (opens Progress) over
  the pinned section banner ("Section N · {rank}", "N more moves to stop
  slipping", the focus as its subtitle), then the winding path over the night
  sky from `/api/journey`: kept nights with their moon (the medal on
  milestones), rank castles beside the path, tonight's node (beacon, knight,
  the lesson's progress ring) and tomorrow's grey node ("Tomorrow · N due").
  Build step 3: the week ahead labelled
  from the cards' FSRS due dates ("Sat · Qd4's last check", "Fri · Nf5 comes
  back"), kept nights, stars, castles and small extra-watch nodes on their
  real nights, and the first star's progress on Progress (`/api/journey`'s
  `ahead`, `history` and `first_star`; `/api/journey/night`). Tapping a node opens
  its card in a sheet: tonight's wall scene and
  watch card (up to three moves from `today.tonight`, Start/Continue watch or
  gold Save my streak, the anchor line), the kept night's results, tomorrow's
  due count and reminder switch, a night ahead's returning moves, a kept
  night's or extra watch's counts and a kept night's moves now, a castle's
  rank and stars. Once kept, tonight
  turns green, a dismissible "Night 13 kept · 5 in a row" shows (night
  numbers count every night kept, all time; the streak reads only "N in a
  row"), and the next node lights as an **Extra watch**. The extra
  watch's card opens a server-built extra watch (`/practice?mode=extra`: new
  slips, then family puzzles for held moves, then weak-theme puzzles; never a
  card due tonight, never the streak), unlocked once tonight's lesson is done.
  Game review is folded into the watch: a newly analysed game's new slips lead tonight's lesson and its
  card ("Your game vs kd_88 last night", its slip rows, Start watch, Replay
  the whole game), and a game review keeps the night only on a day with no
  lesson. The first
  night's path is Connect your games, Finding moves that slipped ("12 of 20
  games checked") and Your first watch. The Watch page's hero, This week card,
  kept view and Extra practice card are gone (the streak popover keeps This
  week). The wall lesson's plaque names the piece whose move led to the
  position ("kd_88's bishop") in its fixed slot; the deck ring is in All
  stats.
- **The ward path** ([spec](specs/2026-10-20-ward-path-design.md)): the path is
  the walk through the eighteen posts to the Keep. Each post is a section
  under its place name and plain topic; the current post is its watches, one
  node per watch kept since the post was reached (tonight's lit with a TONIGHT
  tag, tomorrow's above), and the post's lessons are in its card (the
  banner's About button opens it). Every post ahead is drawn to the Keep with
  its lessons as locked nodes; rank castles every third post are stops on the
  road; a rule across the road names each ward it enters; posts behind keep
  their watches, and nights kept before the walk are counted below. Keeping a
  watch is a step: the node pops, the road fills and the knight hops to the
  next node (skipped with reduced motion). Nodes are Duolingo-sized (56 pt,
  the current one 72 pt, on 96 pt rows); on the web a node's card opens as a
  dialog over the path. Place art for the posts and the Keep is in the watch
  kit and the old-books notes are sourced. Open: approval of the place names
  and copy.
- **Curriculum wards** ([spec](specs/2026-10-20-curriculum-wards-design.md)):
  eighteen wards on the Steps Method's ordering decide what practice serves,
  which is also what makes the 42 corpus themes outside `patterns.THEMES`
  reachable. Puzzle difficulty is anchored to the learner (`puzzles.ability`,
  an Elo seeded from `standing.rating`, served `EASIER_BY` 241 points easier
  for an 80% success rate). The Lichess corpus is stratified by rating band
  (100,215 puzzles, under 900 from 15,878 to 20,383; rebuildable from
  `lichess_db_puzzle.csv.zst` in about 15 seconds). Drills ask what the
  learner's own move allowed (`allows`), ward 1's lessons are served by a
  drill built from the learner's own games (`vision`), and every serving names
  its practice mode (`mode` on `GET /api/deck`). Every post is walked: a
  lesson counts only solves since its post was reached (`entered_at`), one the
  learner's games already hold needs one fresh solve, and a cleared post stays
  cleared. Every watch, nightly or extra, is ten items in a fixed mix (`mix.py`,
  [decided 2026-10-22](specs/2026-10-19-path-home-design.md#what-a-watch-holds-decided-2026-10-22)):
  two look first (threat, allows, vision or calm questions), four on the post's
  idea, two mixed review (an earlier post's idea unannounced, and "Your move"),
  two from the learner's games. Extra watches are unlimited; their games slots
  take the reviews the nightly watch had no room for, then new slips and family
  puzzles for held moves. At the Gatehouse the idea slots serve the learner's
  own vision drill, then easy loose-piece puzzles (never counted as holding it),
  and every look-first question is labelled **Safety check** in the app. A
  lesson is held at the Steps Method's bar (36 answered, 10 of the last 12
  right), passed lessons come back for spaced review, puzzles ask for the depth
  of their Steps step, and lessons carry Steps' names
  ([decided 2026-10-23](specs/2026-10-20-curriculum-wards-design.md#following-the-steps-method-decided-2026-10-23)).
  Not yet seen on a phone. Open: the
  seed crosses rating scales (a Chess.com rapid 917 measured a Lichess puzzle
  ability of 1544, on one account); the Elo corrects it within about 20
  answers, but nobody has measured that on more accounts.
- **Games in the watch story** ([story](specs/2026-10-18-watch-story-design.md#games)):
  the Last 7 days summary card (hidden until a game in it is analysed), the
  **All / Slipped / Clean** scope (`/api/games?slips=`; review status moved into
  Filters), row status by slip state, and on a game's screen **What slipped
  past you** (track and chip per card), **Keep watch tonight** while the watch
  isn't kept and **Replay the game**.
- **Watch story data** ([spec](specs/2026-10-18-watch-story-design.md#backend-and-api)):
  stars (`cards.mastered_at`, migration 0025), ranks and night milestones
  (`/api/home` `journey`, `/api/journey`) and `streak.nights_total`. Ranks
  come only from posts (a castle after posts 3, 6, 9, 12 and 15; decided
  2026-10-22); stars are a count and no longer promote. Night milestones are 7,
  30, 100 and 365. The lesson deck's `results` gain each card's
  `due`, `stopped` and (for stopped ones) `label` for the kept results.
  A move stops slipping (and earns its star) at 11 days' stability
  (`watch.STOPPED_DAYS`, about two days of Good answers), not the deck's 60-day
  long-term memory; with `today.memory.stopped_today` for the relit star.
  `stamp_stars` backfills stars for cards already past 11 days, dated from
  history, on each `/api/home` or `/api/journey` read.
- **Progress** ([path home](specs/2026-10-19-path-home-design.md#progress)):
  one scrolling modal with All stats folded in: Your rank (and the "Your first
  star" card while there are none), Is it working? (blunders per game a → b,
  the rating, Last 4 weeks), Nights, Your game and Your memory (Your moves,
  Coming up). The map of nights moved to the home path. The
  rank-up beat follows a session that reaches a new rank. Train a tactic and
  Replay missed were removed (2026-10-22).
- **Your watch** ([spec](specs/2026-10-18-watch-time-anchor-design.md)): the
  learner's watch time and "After I …" anchor (`/watch`, the **Same time
  tomorrow?** beat after the first watch, tomorrow's node card's "Choose a time for tomorrow",
  Settings → Your watch), synced per account; reminders at that time only when
  the watch isn't kept, titled with the anchor, rotating wording, daily for a
  week of silence, then Mondays to day 30, then none.
- **Daily practice** ([spec](specs/2026-10-11-daily-practice-design.md)):
  real deck/answer/hint endpoints, multi-move forcing lines, server-graded Lichess
  puzzles, separate new/review limits with a pace setting, and:
  [instant practice](specs/2026-10-15-instant-practice-design.md) (solutions
  served with positions, background saves),
  [answer feedback](specs/2026-10-14-answer-feedback-design.md),
  [coaching explanations](specs/2026-10-15-coaching-explanations-design.md),
  threat questions and mistake layers ([safety-habit training](specs/2026-10-16-safety-habit-training-design.md)),
  and [blunder causes](specs/2026-10-16-blunder-causes-design.md) with **Why?**
  candidate moves.
- **Weakness model** ([spec](specs/2026-10-17-weakness-model-design.md), steps 1
  and 4; step 5 below): `patterns.tag_chances` stores the motif of every clear chance
  (`moves.chance_motif`, migrations 0021/0022) and `patterns.chance_rates` counts
  finds and misses, with `analyze.only_move` as the mate-aware test (also used by
  `deck.clear_best` and `unannounced.kind_of`). `patterns.weakness` shrinks each
  rate toward the overall one (`PRIOR_CHANCES`), and `deck.queue` orders new
  positions and `puzzles.idea_puzzle` picks a fallback theme by it. The habit term
  orders layers by `game_trend`'s cost (`game_trend.day_trend`). Step 1 is deployed
  and backfilled in production (`sha-3530419`, October 18, 2026). Production rates are in
  the spec. The habit order was recorded here as noise-dominated on a 0.2 win% margin;
  **that reading was an artifact of the window and the clock**, and
  `backend/scripts/baseline.py` separates them (production, October 20, 2026, last 40
  games): safety costs 12.4 win% a game against tactics' 8.4, and excluding
  `moves.time_trouble` moves takes tactics to 4.8 while safety barely moves, at 11.3 --
  a 2.4x gap. Tactical misses are disproportionately clock artifacts; safety failures are
  not. Still open: cost carries no shrinkage, and this is one account.

  The same run settles three things the frozen figures above got wrong. Clear chances
  taken are improving (70% over the last 80 games, 75% over 40, 81% over 20, time trouble
  excluded) and `hangingPiece` is 31 of 34 at 91%, so it is not the weakness. Positional
  mistakes are 19-23% of recent ones rather than the 30% quoted from a wider window. And
  the clock pollutes less than feared: 9-13% of mistakes and only 52 of 1,402 live cards
  (4%). Worth keeping: **in time trouble the learner took 0 of 6 clear chances**, in every
  window.
- **Motif tagging, scored** (`patterns.evaluate`, `knightly tagging`): the stored
  Lichess puzzles are a labelled test set, so the tagger that names your mistakes can
  be measured instead of guessed at. Scored on 110,698 positions it agreed with
  Lichess **50,780 times (52% of what it named); it now agrees 75,207 times (77%)**.
  Four changes, each re-scored: `in_line` returns the line's most decisive tactic
  rather than its first (+5,067), a back-rank mate needs the king shut in by its own
  pieces (+7,134, precision 0.27 to 0.74), `DEEP_PLIES` 6 to 10 so longer mates are
  seen (+5,346, mate recall 0.78 to 0.88), and `promotion`, `enPassant` and
  `advancedPawn` are named (all precision 1.00). `capturingDefender` was written and
  dropped: at 0.24 precision it added 570 agreements and 4,261 confident mislabels,
  and a wrong specific tag is worse than none when the tag routes practice.
`trappedPiece` was added next and kept at
  0.60 precision (+986). `deflection` and `intermezzo` were both written and rejected
  on the same evidence: deflection scores 0.11 from the move and 0.11 from the line
  (it needs to know the opponent's best alternative, which geometry cannot see), and
  intermezzo 0.26 alone. Measuring them was the point; shipping them would have
  traded trustworthy tags for coverage.
  **`hangingPiece` is still only 0.17 precise** on 12,921 firings; its errors are
  mostly real captures inside puzzles whose point is `trappedPiece`, `deflection` or
  `intermezzo`, none of which we detect, so its rate is not yet evidence about the
  learner. Raising its material bar does not help (tested at a rook and a queen).
- **The tactical gate** ([tactic recognition](specs/2026-10-18-tactic-recognition-design.md)):
  an unnamed mistake is now `positional` when there was no tactic to find and `other` only
  when there was one we could not name (`patterns.tactical`, no migration -- new values in
  `moves.pattern`). It never overrides a motif the rules found, and asks a different question
  per kind: a `miss` on whether one move of yours stood out, a mistake or blunder on whether
  `layers` found the reply concrete. `layers.settle` now runs before `patterns.deepen` so the
  layer exists when the gate reads it. On production's 2,592 rated mistakes: 1,481 named
  (57%), 775 positional (30%), **336 real gaps (13%)** -- the untagged third was mostly
  positions with no tactic in them.
- **Card families** ([weakness model](specs/2026-10-17-weakness-model-design.md)
  step 5): a review card's tactic practised in other positions. The Lichess corpus is
  stocked by 49 themes instead of 7 (`puzzles.KEEP_THEMES`), and after a position you
  meet for the first time today, practice serves a puzzle carrying the same tactic,
  labelled "Same idea" (migration 0023, `puzzle.family`). Mastery now needs the
  schedule **and** a solved family member, so a long interval alone no longer counts
  as knowing the idea; cards with no nameable tactic keep resting on the schedule.
  Expect the mastered count to fall, by design. Both environments hold the
  stratified 49-theme import (below).
- **Game review** ([spec](specs/2026-10-11-game-review-design.md)): summary with
  win graph and accuracy, move-by-move review with clocks and taken pieces, key-moment lessons,
  engine lines, All moves and explicit saved completion.
- **Session-end beats** ([spec](specs/2026-10-14-session-end-beats-design.md)):
  results, streak-extended, rank-up and long-term memory beats after
  practice, puzzles, the daily lesson and review. The daily lesson (the watch)
  first ends over the wall ([kit stage 7](specs/2026-10-18-watch-kit-design.md#build-plan-for-the-core-of-the-watch)):
  the lantern brightens a step per held move and "N raids turned back" lands
  over the shut gate (skipped when nothing held).
- **Progress's sections** ([spec](specs/2026-10-11-progress-design.md)): the
  rating line with its change, the last four weeks (nights practiced, blunders
  per game and the moon grid), a five-axis skill shape with one training action
  (locked until the backend sends `skill_shape`), then game skills, tactic bars,
  clock and openings, over 30 days, 90 days or all time.
- **Board** ([spec](specs/2026-10-10-universal-chessboard-design.md)): tap, drag
  and keyboard input, promotion, drawings, reduced motion, board/piece/sound
  preferences (Classic cburnett pieces by default). The
  [layered native renderer](specs/2026-10-15-layered-board-design.md) draws
  native pieces (stage 4).
  [Board feel](specs/2026-10-10-universal-chessboard-design.md#board-feel)
  (#87): the Calm board colour with its own markers and capture tint, a larger
  lift for Arcade and Dynamic, and move/capture sound variants.
- **Operations**: each environment has its own Postgres 17 on the VM since
  October 20, 2026, about 23:55 UTC ([the database lives on the VM](technology-decisions.md#the-database-lives-on-the-vm)),
  moved with `deploy/move-database.sh` with every table's row count identical;
  `/api/home` for the 740-game account went from 6.4 s to 0.33 s. A nightly
  timer (03:30 UTC) dumps production and copies it to R2; the first one from the
  VM's own database (`knightly-2026-10-21T0330Z.dump`) exited successfully on
  October 21 (`backup.sh` stops on a failed upload). Dumps taken by hand as
  `knightly` cannot read `backup.env` and stay on the VM. Checksum-verified
  isolated restores; deployment keys, environments and rollback images are
  retained.

## What runs where

Checked on the VM on October 23, 2026.

- **Backend:** staging and production both run `sha-aac022f` (main after
  #349, October 23: the Steps-style lesson intros, #326, and the back rank
  folded into Mate in two). Before it, `sha-25e3c95` (main after
  #346, the Steps Method curriculum; deployed October 23 around 13:27 UTC).
  Before it, `sha-91bff6b` (main after #338) brought the core-20% watch mix (#330, migration 0031; production dump
  `knightly-2026-10-23T0216Z.dump` taken first), the Gatehouse safety check
  (#333), basic endgames (#337) and the redo-round removal (#335). The 1,500
  endgame drills are loaded in both (`knightly endgames`; staging's
  square-of-the-pawn and pawn-endings lessons serve them).
  Images are built on the VM and deployed by hand while
  [GitHub Actions is blocked](runtime-verification.md#ci-and-pre-push), so they
  are not in ghcr and a rebuilt VM cannot re-pull them. A deploy from a commit
  older than `8024db2` would drop the `db` service: deploy from current `main` only.
- **Web:** staging and production serve Expo exports of main `aac022f`,
  each built for its own host (uploaded October 23 around 13:27 UTC; the previous
  exports kept beside them as `expo-web.before-<epoch>`). Both bundles carry the
  review's legal-move dots (#343) and the **Live engine in reviews** setting
  (#344), and serve `/stockfish/stockfish.wasm` as `application/wasm`. Production
  answers HTTP 200 with `/api/health` ok; its console and signed-in use of the
  walk on the web are unchecked. The original
  frontend (`legacy-web`) still runs unrouted for rollback
  ([deployment](deploy.md#rolling-back-the-web-cutover)).
- **iPhone:** TestFlight `beta` build 65 (standalone, production API) is from
  main `aac022f` (through #349, the lesson intros), uploaded October 23; source
  published as
  [knightly-source@ios-build-65](https://github.com/hunterrhansen/knightly-source/tree/ios-build-65).
  Build 64 is from
  main `25e3c95` (through #346), uploaded October 23, with the Steps bar's
  progress text; source published as
  [knightly-source@ios-build-64](https://github.com/hunterrhansen/knightly-source/tree/ios-build-64).
  Build 63 (`2ad269f`, through #344) was build 62 plus legal-move
  dots on review positions (#343) and the optional **Live engine in reviews**
  setting (#344). Its source is published as
  [knightly-source@ios-build-63](https://github.com/hunterrhansen/knightly-source/tree/ios-build-63).
  Build 62 (`f06db78`) was the first with on-device Stockfish (#336); on it a
  review side line played and evaluated on the user's iPhone, and on build 63
  the user checked the dots and the live engine setting. Build 61
  (`91bff6b`) carried #338; builds 58 and earlier break against this backend.
  **None of the ward path, the walk, the new watch mix, the safety-check labels,
  the endgame drills, the tappable badges, the Steps bar or the lesson intros
  has been seen on a phone.** Keeping a watch on build 65 is the open gate.
- **Production learner data:** #309 reset production's posts-reached record to
  the Gatehouse so every post is walked; the record before the walk is kept as
  the setting `wards_reached_before_walk`.

**Rollback notes.** Migrations 0025–0027 are additive. 0028 and 0029 each add
one value to `threat_cards`'s kind check (`allows`, `vision`) and carry their
reverse statement; rolling back past either needs that kind's rows deleted
first. 0030 (`threat_cards.answer_set`) is additive; widened answer sets stay
after a rollback, which only accepts more answers. 0031 drops the unused bot-play columns
(`games.bot_hints`, `bot_takebacks`, `spotted_found`, `spotted_asked`): not additive, but no
image since 0017 reads them; its comment has the reverse. 0024 (boolean flag columns) is not additive: rolling back past it needs
the reverse statements in the migration's comment. Re-grading (`analyze
--reclassify` and `patterns --retag`, last run after `sha-00ee89b`) rewrites
stored grades; an image rollback does not restore them, only a dump does.
Kept for rollback: the database-move dumps (`move-2026-10-20T2349Z.dump`
staging, `move-2026-10-20T2354Z.dump` production, on the VM), the pre-0024
dump (`production/pre-0024-2026-10-18T0330Z.dump` in R2 and
`/opt/knightly/pre-0024/` on the VM) and the Supabase projects, named in each
`.env` as `KNIGHTLY_SUPABASE_URL`. Delete the Supabase projects only on purpose.

## Open checks

Android runtime is deferred for every item; exports only prove bundling.
Earlier user-reported accessibility passes do not certify later changes.

### Phone and native runtime (iOS)

- Dark only: after the next native build (`userInterfaceStyle: 'dark'` needs
  one), the app, its SwiftUI settings, sheets and pickers stay dark with the
  phone in Light appearance; a device that saved Light or System before keeps
  its other display choices. Web is checked with a light browser scheme.
- Today: streak popover from the header item (anchored under the pill, closes on a tap outside); motion and reduced motion; reminder
  permission, delivery and cancellation once the streak is safe and after
  sign-out; Today not bouncing when it fits; the full daily flow and the daily
  lesson through "Lesson complete" against the live API; portrait lock on rotation.
- Your watch: notification delivery on a phone at the watch time (iOS and
  Android), with the anchor title and rotating body; none on a day the watch is
  kept; the Monday-only back-off and the stop after 30 silent days (shift the
  device clock); the permission prompt from `/watch` only after the save; old
  `today`/`tomorrow` reminders cleared on upgrade; `/watch` layout with the
  keyboard and large text.
- Path home: on a phone (iOS and Android) with large text, VoiceOver and
  reduced motion (no lantern flicker or beacon pulse): the path opening with
  the current node in the lower middle, the section
  banner and section words wrapping at large text, node and castle labels read
  aloud, the node sheet scrolling at large text and closing on a tap outside;
  the Games and Progress tiles at large text and with VoiceOver; the Games,
  Progress and Account modals (sheet, ✕, swipe down; a game's board drags
  never closing Games) after a new native build without the tab navigator;
  the first night's nodes and
  "N of M games checked" on a fresh account; tonight turning green and the
  extra watch lighting after a real watch; an extra watch
  (`/practice?mode=extra`) from the wall and back; kept results' "back
  {weekday}" and "{label} stopped slipping" against the deployed backend; the
  wall plaque naming the game's piece at large text; the move rows against the
  live API's `today.tonight`; Same time tomorrow? after a first watch on a
  fresh account (time preselected, Not now asked again from night 3,
  permission only after the save).
- Ward path (build 56): the path opening on tonight's node; the step after
  keeping a watch (pop, road fill, knight hop) and with reduced motion; the
  whole walk scrolling to the Keep, locked lesson nodes, castles and ward rules
  at large text and with VoiceOver; post markers clear of the side tiles; a
  watch's last three items serving the current post; Games full screen,
  closing only with the ✕.
- Streak calendar: week swipe and drag-down to the month on a device, on Today
  and inside the streak popover.
- Practice: instant practice, coaching explanations, threat questions and blunder
  causes on a device; a real multi-move card and puzzle with reload of saved
  marks; iOS reply animation and step buttons; the Daily practice pace control.
- Review: a signed-in review of a real analysed game (not yet run live after the
  answer-feedback changes); iOS layout, safe-area placement,
  gestures and the native share sheet.
- Review wide layout and keyboard shortcuts ([spec](specs/2026-10-11-game-review-design.md#wide-layout)):
  checked on the web against a local API only, not yet on staging (needs a web
  export); an iPad in landscape (takes the wide layout), large text, VoiceOver
  on the move list and the loading screen, still a narrow column before the
  board layout appears.
- Session-end beats: motion timing, reduced motion, 320 pt phones, Share sheet;
  the watch's end over the wall (lantern steps, caption over the gate, the
  calmer version after 21:00) on a phone with large text and reduced motion;
  the rank-up after a real game review that crosses a rank.
- Reward cues (points, beats): haptic and coin sound landing
  on the same frame as their sparkles on iOS and Android; silent switch and
  the sounds setting.
- Progress: real-account sections, ranges, and filtered Games opening over
  the path from Progress's rows on a phone; native chart scrub versus page scroll; large text.
- Board: layered renderer release check on a phone (first-frame draw on mount,
  drag feeling immediate, VoiceOver, both piece sets, large text);
  board feel on a phone (Calm, Knightly black pieces on
  Calm, the 1.18 lift on edge squares, sound variety); held arrow-drag and arrow visuals; native sound and
  silent-switch behavior; frame rate and input latency.
- Account and settings: real authenticated linked-account entry and mutations,
  ZIP export sharing, disposable-account deletion including busy-sheet dismissal;
  physical-phone rendering of the SwiftUI settings and Account modal; the real
  signed-in header; physical-device import; the installed app icon.
- Launch: native splash to launch-screen hand-off after a fresh native build,
  moon pulse and Reduce Motion, and the offline Retry connection screen.
- Caching: real-account cold relaunch, foreground refresh and sign-out cache
  removal on a phone.
- Games: live-account library and review return; the Slipped/Clean scope and
  summary card against a deployed backend; the iOS segmented scope picker, the
  Review status row in the native Filters sheet, and the game screen's two
  pinned buttons on a 320 pt phone and with large text.
- Shared layout components (Screen, ScreenContent, ScreenHeader, ListItem,
  Card): native keyboard, safe area, orientation and system large text.
- Native hardware keyboards.

### Accessibility

Spoken VoiceOver and large text across Today, practice (verdict sheet, causes,
threat questions), review, session-end announcements, Progress, settings, sign-in
and navigation; Reduce Motion, orientation and RTL on settings. Spoken
accessibility stays manual.

### Integration and release

- Move grading parity ([spec](specs/2026-10-20-move-grading-parity-design.md#check-before-shipping)):
  deployed and re-graded on staging and production (`sha-00ee89b`). Still open:
  the labelled reference set of ten games and tuning `K_BY_RATING`,
  `MISS_EDGE`, `MISS_RETURN` and `GREAT_GAP` against it; re-run `analyze
  --reclassify` and `patterns --retag` after any change.
- The schedule ahead, exact history and first-star progress
  ([path home step 3](specs/2026-10-19-path-home-design.md#backend-and-api)):
  deployed in `sha-9f35ff8` (no migration; `/api/journey` gains `ahead`,
  `history` and `first_star`, and `GET /api/journey/night` is new). Check
  on a phone against a real account: the week's labels against the cards' due
  dates, a last check passing the 11-day bar after a Good answer, kept nights
  and stars on their real dates, a kept night's card ("where they stand now"),
  an extra watch's small node after it finishes, and Progress's first-star bar.
  Extra watches finished before the deploy are not on the path.
- Extra watches ([path home step 2](specs/2026-10-19-path-home-design.md#backend-and-api)):
  deployed in `sha-bc6adf9`. Check on a phone after keeping a night: an extra
  watch from the wall, its end-of-watch beat and results with no streak beat, a
  held move's family puzzle relighting its star, and a night kept only by game
  review (the endpoint answers 409 until tonight's lesson is done). Open
  decision: a cap on extra watches a night (none today).
- Moon phases: verified on staging web on October 18, 2026. After a lesson,
  `/api/streak/days` returned night 1, and the streak beat, Done's medal, the
  week and Progress's grid showed its crescent. Still open: production (it
  lacks the `night` field, so done days show the full moon) and a phone check.
- The lesson from the wall (watch kit stage 4, the daily lesson's frame):
  checked in Storybook web only, at 390 × 844 and 320 × 568, wide web, and
  with the text-size reservations at 1.6×; the board's top and size stayed
  constant through a whole practice session. Check on a phone: native large
  text and frame rate with the scene layers (the kit's performance budget).
- Raiders at the treeline (watch kit stage 6, the daily lesson's wall view):
  checked headless in Storybook web at 390 × 844 and 320 × 568, with reduced
  motion and with the text-size reservations at 1.6×; each answer type, a
  capture and the raid captain reacted as specified and the board's top and
  size stayed constant. The captain shows only on cards with a known threat
  and a multi-move line. Check on a phone: native large text and frame rate
  with a full army at the treeline.
- Reward kit: the shooting-star run
  bonus, the milestone medal (7, 30, 100, 365 nights) and the shard on the
  Points stat were checked in Storybook only, since staging's account can't
  reach them today. Check them on a phone. The settings gear, the outlined line icons, the shooting
  star's sparkle trail and the milestone medal's landing swing were checked in
  Storybook web only; check them on a phone too.
- Web layout: the card overlap is fixed on staging (verified signed in on
  October 18, 2026: Today's expanded month and Progress). On a phone, check the
  cards still rise in on Today and Progress.
- Identity: hosted-auth callback cancellation, live account switching,
  provider/network failure and full import completion; native staging
  sign-in/callback/session recovery.
- Release performance: gestures and motion on representative hardware with
  release builds.
- Hosted CI and security: review hosted CI duration and reassess dependency
  advisories before release. Branch protection is unavailable on this plan; the
  accepted policy is to run the gates before merging
  ([runtime checks](runtime-verification.md#ci-and-pre-push)).
- Distribution: App Store release and recovery paths; Sentry is unconfigured.
  Production web sign-in, import, review, practice and progress need a check in
  desktop Safari, Chrome, Firefox and Edge on the live site.
- Privacy copy needs completion before release.
- Backups: no recovery test has restored data into a hosted database.

## Known limits and planned removals

- Once the Expo web app has held up in production, retire the original web image
  (`legacy-web`, running unrouted for rollback) and archive the original repository
  ([deployment](deploy.md)).
- Layered board stage 5 moves the tapped-move slide into the piece atlas and
  deletes the overlay's sliding piece.
- Legal-move dots on the Sage, Brown, Green and Blue boards measure 2.2–2.8:1,
  below the 3:1 non-text minimum; only Calm has its own marker colours.
- The committed `assets/audio/game-end.wav` no longer matches
  `npm run sounds:generate`; regenerate it and listen before committing.
- Reminders do not see web activity and reset after sign-out.
- Games has no mistake-layer filter. Grade maps rebuild once as cards come up.
- Native hardware arrow keys are unsupported in practice step-through.
- Later work: puzzle rating/streaks, daily puzzle and timed modes; durable
  unfinished-review recovery; side-line evaluation with on-device Stockfish
  ([line exploration](specs/2026-10-22-line-exploration-design.md): the web
  engine is deployed; the iOS/Android module is built but unchecked on a device
  and Android is unbuilt, with each app build's public GPL source release due
  before it ships); a default Progress range;
  the skill-profile six-score/peer contract and
  allocation/composite timing scores.
- The hosted API's CORS policy does not allow localhost origins; use the
  [local backend](foundation-development-environment.md) for browser checks.

Use the [runtime guide](runtime-verification.md) and
[local setup](foundation-development-environment.md) to run checks.
