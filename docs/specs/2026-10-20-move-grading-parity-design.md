# Move grades that match what players see on Chess.com

Implemented in the backend (2026-10-20), not deployed; production re-grading
waits on the reference set and the deck-change review below. Three changes to how `backend/src/knightly/analyze.py`
and `brilliance.py` label moves, so a game reviewed in Knightly and on
Chess.com reads the same where it matters: rating-matched severity, a
narrower Miss and Great allowed in any position. The engine, its depth, the
accuracy score, Brilliant's sacrifice test and the opening book are unchanged.

## Why

Side by side on one real game (local game 81, gghansen vs FobbyBischer89,
2026-10-20, 100 moves) about 30 grades differed. Most of them came from three
rules, not from the engine:

| Cause | Moves in that game |
| --- | --- |
| Severity: one fixed win% curve for every rating | We call 14. O-O-O, 16. Qf3, 25…Kh7, 36. Na4 blunders (drops 21–26); Chess.com calls them mistakes. We flag seven inaccuracies and four mistakes Chess.com leaves unmarked. |
| Miss fires on any back-and-forth | Seven misses in moves 39–45; Chess.com has none there. Chess.com's two misses (14…Re8, 22. Qxg5) are one we share and one we call a blunder. |
| Great excluded when the mover is worse or takes material | 20. Qg3 (White −2.3), 36…Rc2 (Black slightly worse) and 23. gxf3 (a recapture) are only-moves Chess.com calls Great and we call Best. |

The rest were engine disagreements at different depth (43. Bf3, 43…Rd2), a
book line we lack (5…h6) and Brilliant on 26. Bxh5; those stay out of scope.

A learner who checks our review against Chess.com and sees "blunder" where
Chess.com says "mistake" trusts both less. Grades also feed practice: `deck.py`
ranks blunders first (`WEAKEST`), patterns tag mistakes, misses and
blunders, and the welcome and game-facts counts read them. So this changes
what becomes a card, not only labels.

## What Chess.com publishes

From [How are moves classified?](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-and-etc)
(read 2026-10-20):

- An expected-points model gives "a player's winning chances based on their
  rating and the engine evaluation" (0–1). Labels are the expected points a
  move loses: Excellent up to 0.02, Good 0.05, Inaccuracy 0.10, Mistake 0.20,
  Blunder above. The bands do not change with rating; the curve that turns an
  evaluation into expected points does.
- What counts as winning, equal or losing "varies according to the player's
  rating", and they are "more generous in what we call a Great Move for new
  players".
- Miss: you "fail to capitalize on your opponent's mistake".
- Great: moves "critical to the outcome of the game", such as turning a losing
  position into an equal one.

The curve itself is not published. Ours must be fitted, not copied.

## 1. Rating-matched severity

Today `win_pct(cp)` is Lichess's logistic curve,
`50 + 50·(2/(1 + e^(−0.00368208·cp)) − 1)`, for everyone. Keep its shape and
make the slope depend on the mover's rating: `k(rating)` in place of the
constant. Lower ratings get a flatter curve (the same engine loss costs fewer
points, since weaker players convert advantages less reliably); at about
2000 it approaches today's value.

- **Fitting `k`.** `backend/scripts/fit-win-curve.py` fits expected score
  against evaluation (the position after each move, mover's side) per 100-point
  band of the mover's Chess.com rating, by maximum likelihood, with a 90%
  interval clustered by player side. Sources: our analysed games, plus rapid
  games with `[%eval]` from Lichess's open database (the script extracts only
  ratings, result, time control and evals). The table is constants in
  `analyze.py` (`K_BY_RATING`), linear between points and flat outside. No
  runtime fitting.
- **Lichess → Chess.com ratings.** Lichess rapid ratings are mapped to
  Chess.com rapid through [ChessGoals' rating comparison](https://chessgoals.com/rating-comparison/)
  (updated July 2026; players active on both sites, Lichess rating deviation
  under 150): each row of its Chess.com blitz pivot pairs Chess.com rapid
  (N = 10,156) with Lichess rapid (N = 1,066). The gap shrinks with strength:
  Lichess 1290 ≈ Chess.com 815 (−475), 1615 ≈ 1255 (−360), 1905 ≈ 1655 (−250),
  2165 ≈ 1995 (−170). Below Lichess 1290 the map is extrapolated, so bands
  under Chess.com 500 aren't used. The table is `LICHESS_TO_CHESSCOM` in the
  script.
- **Current fit** (2026-10-20): Lichess's September 2026 rated games, the first
  400 MB of the file (1.23 million games, 124,673 with evals, about 93,000
  rapid player sides), plus the local corpus (153 sides, 78 games). Selected
  bands (Chess.com rating):

  | Band | Sides | k | 90% interval | vs Lichess |
  | --- | --- | --- | --- | --- |
  | 500 | 3,701 | 0.00209 | 0.00200–0.00219 | 0.57× |
  | 800 | 5,053 | 0.00242 | 0.00233–0.00251 | 0.66× |
  | 900 | 4,936 | 0.00262 | 0.00252–0.00271 | 0.71× |
  | 1000 | 5,879 | 0.00256 | 0.00247–0.00265 | 0.70× |
  | 1200 | 5,525 | 0.00277 | 0.00267–0.00288 | 0.75× |
  | 1500 | 4,411 | 0.00290 | 0.00277–0.00303 | 0.79× |
  | 1800 | 2,665 | 0.00326 | 0.00308–0.00343 | 0.88× |
  | 2000 | 1,467 | 0.00355 | 0.00329–0.00382 | 0.97× |
  | 2200 | 508 | 0.00387 | 0.00337–0.00438 | 1.05× |

  A weighted straight line through the 500–2200 bands,
  `k = 0.001732 + 7.96e-7 × rating`, is the table: 0.00217 at 550 (flat
  below), rising to Lichess's 0.00368 at about 2450 (flat above). Our own games
  alone fit flatter (800: 0.00122, 900: 0.00152, intervals reaching 0.0020),
  but from 153 sides. Eval'd Lichess games are the ones someone asked to have
  analysed, which may not be typical.
- **Whose rating.** The mover's rating in that game (`games.white_elo` /
  `black_elo`); unknown ratings (over-the-board imports) use 1500's slope.
- **Thresholds.** `THRESHOLDS` (20/10/5/2 win% points) stay: they already are
  Chess.com's bands on a 0–100 scale.
- **What uses it.** Only classification. `win_pct_before/after` stored on
  `moves` become the rating-matched values, so everything reading labels
  agrees; **accuracy** keeps Lichess's fixed curve and formula (a separate
  column computed from the fixed curve), so accuracy history stays comparable
  across the change.

## 2. A narrower Miss

Today: Miss when the opponent's previous move lost at least `MISS_DROP` (10)
and yours loses at least 10 too. In a scramble every error after an error is
a Miss, and Miss outranks the move's own size (41…f6 lost 33 points, a
blunder by size, and we called it a Miss).

New rule, matching "failed to capitalize": a move is a Miss when all of these
hold, on the rating-matched curve:

1. The opponent's previous move was a mistake or blunder (lost ≥ 10).
2. That error handed you something real: your best move would have left you
   at least `MISS_EDGE` (proposed 60%) to win.
3. Your move gives most of it back: you end within `MISS_RETURN` (proposed 5
   points) of where you stood before their error, or worse.
4. The previous move was not itself a Miss (no chains of Misses).

The move must also lose at least `MISS_RETURN` itself, so a Miss is never a
near-best move. Otherwise the move keeps its size label. Severity still shows: the move card
reports its drop, and deck ranking treats Miss as it does today. Patterns'
`miss` tagging (`patterns.py`) reads the label and keeps its meaning.

## 3. Great in any position

Today (`brilliance._mattered` plus `is_great`): not when the mover is worse
afterwards (`cp_after < 0`), not when grabbing free material, and the
second-best move must cost `GREAT_GAP` (10) points.

New rule:

- Drop the `cp_after < 0` exclusion. Great is about the move being the only
  one, and holding a lost-looking position is exactly what Chess.com praises.
- Replace "free material" with "obvious". A capture is obvious when another
  legal move takes the same piece (judged from the board: the second-best move
  itself isn't stored), when it takes straight back what the opponent's last
  move took (22…Nxg5, 40…Kxe6 and 10.Qxf4 in game 81, Best on Chess.com), or
  when it takes a piece that is en prise and didn't get there by capturing.
  Taking back as the only move after an in-between move (23.gxf3) stays eligible.
- Brilliant keeps the `cp_after < 0` exclusion; only Great drops it.
- Keep: not when the second-best move is still completely winning
  (`WINNING_CP`), not getting out of check, not a queen promotion.
- Rating generosity: `GREAT_GAP` scales with rating, 8 points below 1200, 10
  to 1800, 12 above (calibrated in the check below).

## Re-grading saved games

`knightly analyze --reclassify` re-grades every analysed move with no engine:
it recomputes `win_pct_before/after` from `eval_before/after` (mates are stored
as ±(10000 − N) there) and the game's ratings, classifies, and refreshes
`game_analysis` counts. Accuracy is left as stored. Run it per environment after deploy
(`--user` before the subcommand on the VM). Then re-run `patterns --retag`,
since tags read labels. Expect fewer blunders and more mistakes in Progress and
the deck order to shift; announce nothing, as the Same-idea mastery change did
not.

## Check before shipping

Where it stands (2026-10-20):

- **Game 81.** Of the nine labels the table above names, the old rules matched
  one (14…Re8); the new ones match six (36.Na4, 25…Kh7, 14…Re8, 20.Qg3,
  23.gxf3, 36…Rc2). Still apart: 14.O-O-O and 16.Qf3 lose just over 20 points
  on the fitted curve (blunder; Chess.com mistake), and 22.Qxg5 (mistake;
  Chess.com Miss) follows an inaccuracy, so rule 1 can't see it. Of the seven
  Misses the old rule found in moves 39–45, two remain: 44.Ra6 and 45.Rd1
  follow 43…Rd2 and 44…Rd6, which our engine scores as mistakes (43…Rd2 is an
  engine-depth disagreement). The game is a test fixture
  (`backend/tests/fixtures/graded-game.json`); its five disagreements are
  strict expected failures. Tuning `k`, `MISS_EDGE`, `MISS_RETURN` and
  `GREAT_GAP` waits for the reference set.
- **Local corpus drift** (80 games, 4,973 moves; yours / all): miss 123→42 /
  248→92, mistake 99→121 / 209→241, blunder 95→101 / 176→188, great 41→50 /
  81→118, excellent 762→800 / 1454→1543, good 314→331 / 668→691, inaccuracy
  191→189 / 403→403. Misses that no longer qualify fall back to their size
  label. Deck-eligible plies (your mistakes, misses and blunders with a clear
  best move): 171 → 145, none added; 26 Misses that stay become mistakes or
  blunders, which changes their rank. Accuracy is unchanged.
- **Open for production:** the counts below and the deck change.

1. **A labelled reference set.** At least ten of the user's games with both
   apps' labels, captured read-only from Chess.com's review (game 81's flagged
   moves are in the table above; its full list was shared as screenshots). Store the transcriptions
   as a test fixture with the stored evals, not the PGNs' personal data beyond
   moves.
2. **Agreement.** Report per-label agreement before and after on that set.
   Target: Blunder/Mistake/Inaccuracy agree on at least 80% of moves either
   app flags, Miss and Great on at least 70%. Tune `k`, `MISS_EDGE`,
   `MISS_RETURN` and `GREAT_GAP` on half the set and report on the other half.
3. **Corpus drift.** Before/after counts per label over all production
   analysed games, and how many deck-eligible plies change; review the size of
   the deck change before re-grading production.
4. **Tests.** Unit tests in `backend/tests` for the curve (monotonic in rating,
   equals today's at the top band), each Miss condition and each Great change,
   with expectations from the reference labels, not computed by the code under
   test.

## Open questions

- Whether Chess.com's curve also uses the opponent's rating. Fit with the
  mover's alone first and check whether residuals depend on the opponent.
- Whether to show "by your rating" anywhere. Proposed: no; the label is the
  label.
