# The watch story: Watch, Games and Progress

Proposed (2026-10-18). Rebuilds the three main tabs around one story, the
[Knightly direction](../knightly-direction.md)'s premise: every night, a short
watch over the moves that slipped past you in your own games, until they stop
slipping. Today, Games and Progress each work, but none of them says how
they connect. Mockups: the
[Knightly watch wireframes canvas](https://claude.ai/artifact/Rsk54ip1jvUBAkpsWV7iHi)
(the loop, three Watch states, Games, a game, the rank-up beat, the gameplay
styles compared, and the combined design this spec follows; sample data
throughout).

Since 2026-10-19 there are no tabs: the "Tab" column below is where each
step now lives over [one screen](2026-10-19-path-home-design.md#one-screen-no-tab-bar)
(Watch is the path; Games and Progress are modals from its tiles), and a new
game's review is folded into tonight's watch.

When accepted, this replaces the layouts in
[Today](2026-10-13-today-daily-review-design.md#screens),
[Games](2026-10-12-games-design.md#layout-and-navigation) and
[Progress](2026-10-11-progress-design.md#sections). Their data rules, streaks,
freezes, lesson, deck, filters and recovery stay as they are.

## The story

| Step | What the learner sees | Tab |
| --- | --- | --- |
| 1. You play | Chess.com games sync in | Games |
| 2. Moves slip past you | The blunders and missed threats in those games | Games |
| 3. Tonight's watch | 3–5 minutes on exactly those moves | Watch |
| 4. They stop slipping | A move holds across nights (11+ days): a star | Progress |
| 5. You blunder less | Fewer slips per game; rating follows | Progress |

Each tab tells one step in the same words: **slipped**, **on your watch**,
**held** and **stopped slipping**. A mistake moves through those states in
order, and the learner can see it on every tab.

| State | Meaning (existing data) |
| --- | --- |
| Slipped | A mistake in an analysed game that became a deck card (`cards (game_id, ply)`) |
| On your watch | A card that is new, or whose last answer failed |
| Held | A card whose last answer was solved, not yet stopped slipping |
| Stopped slipping | A card that holds for 11+ days (`watch.stopped`: FSRS stability ≥ `watch.STOPPED_DAYS` = 11, plus its family puzzle where one exists) |

Stopped slipping is the watch story's own bar, deliberately shorter than the
deck's long-term memory (`deck.is_mastered`, 60 days), which still drives the
memory counts, the long-term ring and the Long-term memory beat. With FSRS
defaults a move answered Good on two separate days reaches about 11 days'
stability on its second answer, so a first star comes about two days in
rather than about two months.

## Principles

- **One job per tab.** Watch answers "what do I do tonight?", Games "where
  did it slip?", and Progress "is it working?". No tab repeats another's card.
- **Show the learner's own moves.** Show the actual move, opponent and date
  ("Nf5 hung your knight · vs kd_88 · yesterday") instead of a count of
  positions. Seeing their own moves is what makes the watch feel personal.
- **Climb on improvement only.** Ranks, stars and milestones come from moves
  that stopped slipping. Nothing is earned for streak length, volume or speed.
- **A clear end.** The night's first watch ends with "You can stop here";
  going further is offered as another watch, never pushed
  ([the path home](2026-10-19-path-home-design.md)).
- Duolingo's habit model (a small daily goal, a visible streak, a path with
  "you are here") and Chess.com's earned puzzle ranks are the references.
  The [path home](2026-10-19-path-home-design.md) follows Duolingo's lesson
  path with nodes built from the learner's own slipped moves, not a course.

## Navigation

The tabs become **Watch · Games · Progress**. The Today tab is renamed Watch
(label, accessible name and web sidebar). Its glyph becomes the moon in place
of the castle (new PNGs per the
[navigation design](2026-10-12-knightly-navigation-design.md#native-tabs-ios-and-android)).
The route group `(today)` and the Today feature folder keep their names. The
header title follows the direction's copy: "Tonight" from 17:00, "Today"
before.

## Watch (home)

Replaced by [the path home](2026-10-19-path-home-design.md) (built, step 1):
the page below became the path and tonight's node card. Kept for the cards'
words and rules, which the node cards reuse; the hero, This week and Extra
practice cards are gone.

Every state shows the header with the streak pill (moon and count) and the
avatar, then at most two cards, then the tab bar. "Also today", "Keep going"
and the deck card leave this page (see [What moves where](#what-moves-where)).

**Before the watch** (Ready, Returning, At risk):

1. **Tonight's watch card.** The knight (the `KnightMascot` stand-in until the
   commissioned mascot), an eyebrow "Tonight's watch · about N min", then a
   headline. The headline names new slips when the lesson has any: "3 moves
   slipped past you yesterday" (the games' local day, or "this week"). With
   none, it reads "10 moves you're keeping hold of". Then a coach line, up to
   three move rows, "+ N more you're keeping hold of", the primary button and
   the anchor line ("After I finish dinner · 8:00 PM", from
   [Your watch](2026-10-18-watch-time-anchor-design.md)).
   - **Move row:** a small board of the position, the move's label (its blunder
     cause or tactic from [blunder causes](2026-10-16-blunder-causes-design.md),
     else "Your move 14"), "vs {opponent} · {day}", and a chip: **New** (never
     answered), **2nd look** (answered wrong before) or **Almost held** (one
     Good answer from stopping slipping).
   - **Button:** **Start watch** (Ready), **Continue watch** (Returning, with
     the lesson's progress ring around the knight) or **Save my streak**
     (At risk, gold, "N hours left tonight").
   - With no lesson, a waiting game review is the watch ("Review your game",
     as now).
2. **This week:** the existing `StreakCalendar`, eyebrow
   "This week · N nights in a row".

**Kept** (Done):

1. A night-sky disc with tonight's moon (`reward.moon` at the streak night's
   phase; the milestone medal instead on 7, 30, 100 and 365), "Night N kept"
   (N all time, per [night numbers](2026-10-19-path-home-design.md#principles-kept-and-sharpened);
   the streak as "N in a row") and "Good night, knight. You can stop here." The disc drops in, or fades in
   after 21:00. Confetti only on milestones, and never after 21:00 local time
   (the direction's night rule): the medal glows instead.
2. **Tonight's watch** results: "N held", "N slipped again · back {weekday}"
   (the earliest next due day among them: "tomorrow", the weekday within the
   week, else the date), and, when any did, "{label} stopped slipping. A star
   relit · N to {next rank}" ("Fork and 2 more…" for several; unnamed when
   only a puzzle completed the card). These come from the lesson deck's
   `results` (`due`, `stopped`, `label`), `today.memory.stopped_today` and
   `/api/home` `journey`; the hero's relit star shows when `stopped_today` is
   above zero. Both use the 11-day bar, so a line and its star come together.
3. **Tomorrow night:** the anchor sentence, "N moves due" and the reminder
   switch (the existing Tomorrow card).
4. **Extra practice:** last, a card shaped like the watch's but plainly
   second: a muted "Extra practice" eyebrow, "Want to keep going?", "Optional
   · {what the rest of the plan holds}", and a secondary **More practice**
   button that starts an extra watch. No moves of the learner's own and nothing
   on the wall.

**First night** (New, Analyzing): the coach card ("Every night, a short
watch…") and a three-node path: **Connect your games** (done), **Finding moves
that slipped** (ringed with the beacon, "12 of 20 games checked") and **Your
first watch**. While analysis runs, the secondary button reads
**Try a puzzle while you wait**. The node becomes **Start first watch** once
the lesson exists and no night has been kept (`streak.nights_total` is 0),
with **Start first watch** as the one button; "12 of 20 games checked" is the
import's analysed games against its target. The watch time is asked after the
first watch, as
[Asking for the watch](2026-10-18-watch-time-anchor-design.md#asking-for-the-watch)
already proposes.

## Games

Same library, filters, search, pagination and recovery as
[Games](2026-10-12-games-design.md). Changed:

Built (2026-10-18); the scope's server filter awaits a backend deploy.

- **Summary card** at the top: "Last 7 days · N games", "N moves slipped past
  you" ("Nothing slipped past you" at none), and three chips: N on your watch,
  N held, N stopped slipping. It is hidden while no game in the period is
  analysed (`week.analysed` is 0) and with servers that send no `week`.
- **Scope** becomes **All / Slipped / Clean** (games with slips, analysed
  games with none; games still being analysed are in All only), filtered on
  the server (`/api/games?slips=slipped|clean`) so paging and totals stay
  right. Review status (Any / To review / Reviewed) moves into Filters as its
  own row and removable chip.
- **Row status** shows the game's slips by the earliest state any is in: "3 on
  watch" (sky), else "2 held" (green), else "1 stopped slipping" (gold),
  **Clean** (analysed, no slips), or "Checking for slips…" while analysis is
  pending. The row's accessible label keeps the review status. Servers that
  send no `slips` keep the old Review / ✓ / Replay status.
- **A game** (`/review/[gameId]` entry, the existing summary): win graph,
  players, accuracy and the move tally, then **What slipped past you**, one
  row per deck card in move order ("Nothing slipped past you in this game."
  when there are none). Each row shows the move label and SAN ("Fork · Nf5"),
  the one-line reason (else "Best was …"), a four-segment track and a chip.
  The track lights one sky segment on watch, two or three green while held (one
  plus the right answers in a row, up to two), and all four gold once stopped
  slipping. The chip reads "Stopped slipping", else "Tonight" when the card is
  due (or never answered), else "Held N of 4" for a held card or the weekday
  (then the date) an unheld one comes back. Then **Keep watch tonight**
  (primary, to `/practice?mode=lesson`, only while the lesson has moves left
  and `streak.safe_today` is false) and **Replay the
  game**, which opens the existing review and lesson. Servers that send no
  `deck_cards` keep the old **Start review** button.

## Progress: the map of nights

The map moved to the home tab as [the path home](2026-10-19-path-home-design.md)
(built, step 1); Progress keeps the rank chip, the first star card, the proof
row and All stats. The map's rules below (placement, castles, dimmed stars)
are the path's.

Progress is a saga map, after Candy Crush's level map: a winding path of nights
through the night landscape, with the learner's rank as castles along it. The
approved [Progress](2026-10-11-progress-design.md) sections move one tap away.

1. **Header:** "Progress" and a rank chip ("Squire II · ★ 23").
2. **The map,** scrolled to tonight. Kept nights are green nodes below, tonight
   is ringed with the page's only beacon and the knight stands beside it, and
   the next nights are grey above. Rank castles stand beside the path: past
   ranks with a green flag and the date reached, the next rank labelled with
   the post that reaches it, later ranks faint. Since 2026-10-22 a castle is
   reached by clearing posts (the [ward path](2026-10-20-ward-path-design.md)),
   never by stars or nights. Night milestones (7, 30, 100, 365) are small moon
   markers on the path.
3. **Proof:** one row, "Blunders per game 2.1 → 1.4" (this period against the
   one before, from `/api/overview` `kpis` and `previous_kpis`), opening All
   stats.
4. **All stats** (`/progress/stats`) gains the approved main page's Rating
   line, Last 4 weeks and Your game skill shape above its current lists.
   Nothing is removed.

Built (Oct 18, 2026) from `GET /api/journey`, now drawn by the home path (`src/features/today/journey-map.ts`):

- The map is its own 420-point scroll inside the page, opened with tonight at
  60% of its height; six grey nights above tonight and up to 120 kept nights
  below (older ones are one "N nights kept before these" line). The knight
  (`character.knight` lookout) stands beside tonight. Once tonight's watch is
  kept, tonight is the last kept node, green under its ring.
- `/api/journey` dates only the first night (Page), the milestones reached and
  tonight, so a past castle or star is placed on the night its date falls on
  by spreading the nights kept evenly between those known dates (exact for an
  unbroken run). A lapsed star is drawn dimmed on its night; the chip's count
  and every reached castle stay.
- Castles stand at their posts on the ward path (superseding the star-paced
  castle this map first drew).
- With no star yet, a "Your first star" card under the map says what a star is
  (a move held across nights, for 11 days or more), that the first can come
  within a few nights, and how many positions are on their way
  (`today.memory.learning`).
- Castles and emblems are kit roles (`map.castle`, `reward.rankEmblem.*`).

### Stars and ranks

- **A star** is a card's first stop slipping (11+ days' stability, plus its
  family puzzle where one exists). The count is all-time and never falls. A
  card that lapses goes back on the watch, and the map shows its star dimmed
  until the card holds for 11 days again. That way the claim "stopped
  slipping" stays honest without taking progress away.
- **Ranks:** Page (from the first watch), then Squire I–III and Knight I–III
  at the castles after posts 3, 6, 9, 12 and 15 (Knight III at the Keep).
  Decided 2026-10-22: posts are the only route to rank; stars count moves that
  stopped slipping and no longer promote. A rank is never lost, including ones
  reached under the old star thresholds.
- **Rank up** is a session-end beat. It shows when a session clears the post
  that reaches a castle, between Streak extended and Long-term memory,
  and replaces that session's Long-term memory beat. It shows the emblem
  dropping in on the night-sky disc, "New rank", the rank name, "N moves from
  your own games have stopped slipping since your first watch", the last three
  that did (move label, opponent, nights held) and "Next: {rank} after post N",
  with **Continue**. Gold sparkle and the `reward` cue; no confetti after
  21:00; reduced motion shows the end frame. Built after practice and game
  review ([Rank up](2026-10-14-session-end-beats-design.md#rank-up)) with no confetti
  at any hour; each of the last three shows its label, move and the day it was
  earned, since `/api/journey` stars carry no opponent or nights held.
- **Later: constellations.** Once the
  [weakness model](2026-10-17-weakness-model-design.md) gives per-skill
  estimates, the map gains the direction's sky: each skill mastered completes
  a constellation. Ranks stay the spine.

## The wall: art through the watch

The direction's [castle-wall watch](../knightly-direction.md#story) is the art
layer. Each piece passes the direction's main-thing filter: it brings people back,
makes feedback clearer or makes progress visible. Anything that passes none of
them waits.

| Where | Art | Why it earns its place |
| --- | --- | --- |
| Watch, before | Full-bleed wall scene behind the header: the knight on the battlements, lantern raised, piece shadows at the treeline, tonight's moon | Brings people back: the post is waiting |
| Watch, kept | The same scene, gate shut, knight dozing, lantern low, any star relit tonight brighter | Brings people back; shows progress |
| Watch, first night | The knight arriving at an empty post | Sets up the story in one picture |
| During the watch | Looking out from the wall (below) | Clearer feedback; the board stays full width |
| Session end (built) | Before Results: "N raids turned back" over the gate; the lantern brightens per held move ([session-end beats](2026-10-14-session-end-beats-design.md#the-watchs-end)) | Clearer feedback; the main payoff is at the end |
| Progress | The map of nights; a sealed gap relights its star | Makes progress visible |

- **Every asset is a kit role.** Sprites, scenes, effects, sounds and story
  copy are addressed by role in one manifest so they can be swapped without
  touching screens; the [watch kit](2026-10-18-watch-kit-design.md) defines it
  and the build order.
- **Scenes are layered SVG** in the glossy-cel style
  ([art direction](../art-direction.md)), dark only like the app. State changes swap or animate layers (lantern, gate, knight pose,
  stars), so one scene serves every state.
- **Motion:** a slow lantern flicker is the only loop, and it is off under
  reduced motion. After 21:00, scene changes cross-fade instead of bouncing.
- **The board stays calm.** Board feedback (flash, badge, arrows) is unchanged;
  the scene reacts only after the verdict lands and never delays the next
  position.
- **Until the mascot is commissioned,** scenes use the `KnightMascot` stand-in
  and silhouettes. The wall and the gate can be made now from the locked
  palette.

### During the watch: looking out from the wall

The lesson screen turns the camera to look out from the battlements, after
Clash Royale's portrait arena: far at the top, the board as the field in the
middle, near at the bottom. Practice and the lesson keep their logic, grading,
hints and session-end beats; only the frame changes.

- **Far:** night sky and the treeline behind the lesson's top bar (✕,
  progress, star shards). The opponent's pieces from the position wait at the
  treeline as **piece characters**: the board's own piece shapes with eyes, so
  each type is recognisable. A plaque names the game ("kd_88's bishop"):
  always the piece whose move led to the position, never the piece behind the
  threat, so it gives no hint of the answer; puzzles have none. It sits in the
  plaque's fixed slot. (The raid captain's own plaque is unchanged.)
- **Middle: the board, full width,** edge to edge on phones (the same width as
  today's lesson), flat and top-down, with a straight top edge (the
  treeline's fringe over it was dropped, 2026-10-19). The far band's sky and
  stars run up under the status bar, with 48 points more sky over the
  treeline on phones at least 740 points tall. The field darkens slightly toward both edges, so it reads as ground
  outside the wall without a frame taking width.
- **Near:** the battlements, with the knight behind them (profile, facing the
  board, lantern raised) and a parchment coach bubble. Hint and Show the
  threat are stone buttons on the wall; the verdict sheet rises over the wall
  as today's sheet does.
- **Captures knock characters out.** When a move captures, that piece's
  character at the treeline is knocked over ("Out!") and leaves. On a right
  answer without a capture the raiders fall back into the trees; on a wrong one
  they edge forward, then reset when the board rewinds.
- **Raid captain on lines.** In a multi-move line only, the piece that starts
  the threat is the captain: a crown on its character (never on the board,
  which stays as it is) and a health bar on its plaque with one segment per
  move of the line. Without a known threat there is no captain. Each right move lands a
  hit; a wrong move shows the answer and the line carries on, so the learner
  never loses health.
- **The board and pieces** are the learner's own from Appearance, unchanged
  (see The board).
- **Not used:** boosters and any currency for hints; a side-scrolling camera
  inside the lesson (the Watch page keeps the side-scrolling wall); timers.

### The board

The board looks and feels as it does everywhere else in the app (decided
2026-10-18: keep it simple). It keeps the learner's piece set and board
colours from Appearance and today's feedback: the correct flash and check
badge, the star shard flying to the counter, the default landing and the
existing sounds. The story lives around the board (the wall, the raiders, the
knight), not on it.

A richer "board juice" catalogue (lantern sparks, tactic light, knockouts, a
lantern run, a finale) was explored on the canvas and is parked until it can
be judged in motion. The board lab's Watch wall and the
[watch kit](2026-10-18-watch-kit-design.md)'s recipes keep that prototype, off
in real lessons.

- **Still a chess board.** Squares, coordinates and their colours never move or
  change, and nothing loops on the board.
- **The board never moves.** Its position and size stay fixed for the whole
  watch: nothing above it changes height (the top bar, the scene and any
  plaque keep fixed sizes; the run label is an overlay), coach and caption text
  sits below the board or in space reserved for its longest form, and verdicts,
  praise and effects are overlays. A layout that would push the board, even by
  a line of text, is a bug.

## What moves where

| Was | Now |
| --- | --- |
| Today "Also today" / "Keep going" | Watch Kept's **Extra practice** card (an extra watch) |
| Today deck card ring | All stats |
| Today Tomorrow card | Unchanged, on Watch Kept |
| Games "To review / Reviewed" scope | Filters (Review status row and chip) |
| Games row "Review" / "✓ accuracy" / "Replay" | Slip status; review status stays in the accessible label |
| A game's **Start review** / **Review again** | **Keep watch tonight** and **Replay the game** |
| Progress Rating, Last 4 weeks, Your game | Top of All stats |

## Backend and API

Existing (no change): card source `game_id`/`ply`, lesson cards with `san`,
`opponent`, `played_at` and `pattern` (`/api/deck?mode=lesson`), all-time
long-term count (`today.memory.mastered`), `mastered_today`, the game detail's
`deck_plies`, `kpis`/`previous_kpis`, and streak days.

New:

- **`/api/home` `today.tonight`**, the watch preview (`today.watch` is
  already the watch setting): `{slipped_recent, cards: [{game_id,
  ply, san, label, opponent, played_at, chip, color, fen}] (≤ 3, in lesson
  order), remaining}`; `slipped_recent` counts never-answered positions in
  tonight's lesson from the last 7 days of games, and `remaining` the lesson's
  items beyond the rows. This saves Watch a second request for the lesson.
- **`/api/games` items** gain `slips: {on_watch, held, stopped}` (null until
  analysed), and the response gains `week: {games, analysed, slipped,
  on_watch, held, stopped}` for the summary card. The `slips=slipped|clean`
  query parameter is the Games scope (unanalysed games match neither).
- **`/api/games/{id}`** gains `deck_cards` beside `deck_plies` (kept as plain
  plies for older app builds): each card's state, next due day, label,
  one-line reason and held count (right answers in a row).
- **Stars:** a nullable `cards.mastered_at`, set the first time `watch.stopped`
  becomes true, backfilled from `card_reviews.stability_after` (`stamp_stars`
  runs on every `/api/home` and `/api/journey` read and dates each star from
  history, so cards already past 11 days get their stars on the first read). `/api/home`
  gains `journey: {stars, rank, next_rank, next_post, rank_reached_on}`, and
  `GET /api/journey` returns the map (each rank's post, reached dates, dimmed
  stars and night milestones at 7, 30, 100 and 365).
- **Nights kept, all time:** `streak.nights_total`, for the milestone markers.
- **Kept results:** the lesson deck's `results` gain each card's `due`
  (next due day), `stopped` (stopped slipping today) and, for stopped ones
  only, `label`; `today.memory` gains `stopped_today`, the day's count.

Zod schemas, the OpenAPI snapshot and the generated contract update together
(`update-api-contract`).

## Open decisions

1. **Rank names.** Page, Squire and Knight follow the direction's "squire to
   knight". Confirm the names; the tiers follow the castles.
2. **Game review as a streak keeper.** Decided (2026-10-19): the watch (the
   lesson) is the only keeper when a lesson exists; a game review keeps the
   night only on a day with no lesson. A newly analysed game's slips lead
   tonight's watch instead
   ([the path home](2026-10-19-path-home-design.md#a-new-game-leads-the-watch)).
3. **Tab label.** Decided: "Watch", though there is no tab bar any more
   ([one screen](2026-10-19-path-home-design.md#one-screen-no-tab-bar)).

## Tests (when built)

- Card state mapping (pure): new and failed-last count as on watch; solved and
  not stopped (under 11 days) count as held; 11+ days counts as stopped slipping; a lapse
  dims a star without lowering the count or the rank.
- The headline (pure): names new slips by the games' day, otherwise the
  keeping-hold line; no lesson falls back to the game review.
- Rank-up beat: shown only when the session reaches a new rank
  (practice or game review); replaces Long-term memory; no confetti after 21:00.
- The watch's end (built): raids turned back are tonight's held moves; the
  wall beat leads Results only when one held; kept shows the moon disc except
  on milestone nights.
- Games (built): Slipped and Clean scopes (backend `test_watch.py` for the
  server filter, `games-view.test.tsx` for the control and
  `progress-contract.test.ts` for the request), row status by state and the
  summary card hidden with nothing analysed (`games-presentation.test.ts`), and
  a game's slip rows, track and chips (`review-slips.test.ts`).
- Watch scene (pure): a capture maps to the captured piece's character; the
  captain is the threat's starting piece and its health equals the line's
  moves; a wrong move never lowers anything of the learner's.
- Backend: `mastered_at` set once and backfilled, `slips` per game,
  `nights_total`, and journey thresholds and dates.
