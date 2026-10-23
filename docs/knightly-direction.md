# Knightly direction

Accepted. The premise that product, art, motion, copy and engineering decisions
follow. [Art and motion direction](art-direction.md) turns it into an
illustration and motion brief, and [art style lock](art-style-lock.md) into
image prompts.

## Premise

**Every night, a short watch.** Knightly is a daily ritual: a short watch with
a knight companion, spent on the learner's *own* games, drilling the moves that
slipped past them until they stop slipping.

Night is the brand, not the rule. The watch works at any hour and the app is
never worse in daytime, but evening is its home.

## The main thing

The product is the improvement path: a prescribed plan that drills a learner's
own mistakes at the right intervals (see the
[weakness model](specs/2026-10-17-weakness-model-design.md)). Story, art,
motion and rewards support it and never compete with it.

An art, story or feature idea earns its place only if it does at least one of
these:

1. **Brings people back.** It makes the habit rewarding and the streak worth
   keeping.
2. **Makes feedback clearer.** It helps someone understand right, wrong or why
   faster.
3. **Makes progress visible.** It shows someone that they are improving.

Fun for its own sake (lore, cosmetics, collecting systems, decorative scenes)
waits until the path is strong. Art work runs alongside learning work and never
displaces it; the weakness model stays the top product priority.

## Story

**Now: the night watch.** The story is mostly the companion and the ritual. The
knight carries a lantern. They are warm and a little dramatic, devoted to the
learner's streak, encouraging rather than guilt-tripping. One sentence of setup;
personality does the rest:

> Every night, you and the knight keep watch on the castle wall. The moves that
> got past you in your games will try again. Spot them first.

**The wall.** A night watch was never about fighting; the job was spotting
danger before it reached the gate. That is the tactics habit: seeing the threat
before you play the move. The raiders are the opponent's real pieces from the
learner's games ("kd_88's bishop on b2"), so the story needs no invented
enemies or lore: the threat is the tactic. Safety training's "what do they
threaten?" is the lookout's question.

- **A vigil, not a battle.** Lantern light, a quiet glow, shadows of pieces at
  the treeline. No combat, gore, alarms or shaking screens; many watches happen
  in bed (see Night and in bed).
- **The wall shows real progress only.** A sealed gap and its star come from a
  move that stopped slipping. No building, upgrading or collecting walls,
  banners or castles.
- **Product words stay plain.** UI keeps "slipped", "held" and "stopped
  slipping"; the story flavours headlines, coach lines and art, never labels a
  learner must decode.

**Later: relight the sky.** Each weakness the learner masters relights a star.
Each skill mastered completes a constellation shaped like a chess piece. The
long-term goal is a full sky. This needs per-skill progress from the weakness
model, so it waits for that.

| Story | Product |
| --- | --- |
| The watch on the castle wall | The daily session |
| Moves that slipped past you (raids that got past the wall) | The learner's mistakes |
| Raiders | The opponent's pieces in the learner's own positions |
| A raid spotted and turned back | A right answer |
| A gap in the wall sealed | A move that stopped slipping (held across nights, 11+ days) |
| Stars and constellations | Per-skill progress |
| Moon phases | The streak: new on day 0, full on day 7 (`MoonPhase`, drawn; not yet in the streak UI) |
| Star shards | Points, one per solved move: pieces of the sky being relit |
| Squire to knight | Improvement and rating |
| The lantern knight | The coach mascot |

## References

| Reference | Take | Leave |
| --- | --- | --- |
| Duolingo (primary) | Flat, friendly, rounded look; habit mechanics; a mascot whose personality carries the story | The owl, its red gems and chest shapes, its fonts and sounds; guilt-tripping |
| Clash of Clans / Clash Royale | Motion and reward feel: springs, squash, anticipation, one-beat impacts; your progress as the story | Pre-rendered 3D art, game-studio assets |
| Animal Crossing, Pokémon Sleep | A gentle daily ritual tied to real time; a payoff when you come back | Real-time gating that punishes missing a day |
| Stardew Valley, Sky: Children of the Light | A visible long-term goal built from small daily pieces; progress written into the sky | Lore and world-building |
| Hollow Knight | Tone carried by art, not text; a small, brave, recognisable knight silhouette | Its melancholy |
| Chess.com | Board feel and chess feature behaviour | Its visual style and assets |

Never use another product's art, sounds or fonts, or upload them as AI
references (see [asset licenses](../assets/licenses/README.md)).

## Art style

- 2D glossy cel: a bold warm outline, two-tone cel shading, one white highlight
  and an edge light, light from the top left, on chunky toy proportions.
- The points reward is a **star shard** (decided 2026-10-18), not a gem: every
  solved move earns a piece of the sky, tying routine practice to relighting it.
  It is a chunky four-point twinkle, locked in
  [art style lock](art-style-lock.md#lock-record).
- Lantern gold and starlight as accents. Brand green stays; a navy night palette
  is a separate, deferred brand decision.
- AI images anchor on Knightly's own art (pieces, brand mark, moon), never on
  other games' art.
- Every asset is judged on the dark page, at its real sizes. Knightly is dark
  only (decided 2026-10-18), so there is no daytime version.

## Tone

- Cosy and encouraging, like a storybook that is also a game. Not dark fantasy.
- Celebrations are calm in the evening: they glow and chime rather than blast.
  Motion never blocks learning.
- Night copy is light: "Tonight's watch" in the evening, "Today's watch" by day,
  and "Good night, knight" once per moment, not on every screen.

## Habit, reward and night principles

These come from a research pass on 2026-10-18. Evidence strength is in brackets:
strong (replicated or meta-analysis), moderate (one study or large company data),
weak (press or blog). They are product principles, not yet implemented behaviour.

**Habit**

- **Cue over clock (accepted).** The learner picks both when and after what:
  their watch time and an anchor routine, in the habit-stacking form from
  *Atomic Habits*: "After I [current habit], I will keep my watch" (for example
  "after dinner" or "once I'm in bed"). The anchor is shown back to them in
  reminders and on Today. If-then plans like this have a medium-to-large effect
  on follow-through [strong].
- **Plan for two months.** Habits take a median of about 59–66 days to become
  automatic, with a wide range [moderate]. One missed day barely slows that,
  and the copy says so.
- **Evening is a brand choice.** In the one small study that compared them, a
  morning habit became automatic faster than a bedtime one [moderate]. The
  learner chooses; evening is only the default.

**Streak (the moon)**

- **Small minimum.** One solved review keeps the moon. Stars measure depth
  separately. When Duolingo split the streak from the daily goal, retention and
  active streaks rose [moderate].
- **Calendar day plus grace.** Count by the learner's local day, with a grace
  window past midnight for night owls.
- **Protect it.** Earned freezes and a short repair window. Being able to repair
  a broken streak softens the drop in engagement [moderate].
- **After a break, a new moon.** Never "you broke it". Offer a fresh goal and a
  gentle warm-up, timed to a landmark (a Monday, a new month, a new moon). Fresh
  starts raise goal pursuit [strong]; "get back on track" messages tend to fail
  [moderate].

**Rewards**

- **Per move: brief and informational.** Feedback that tells the learner
  something supports intrinsic motivation; expected tangible rewards can
  undermine it [strong].
- **End of session: the main payoff**, with a small variable bonus. Uncertain
  rewards draw more effort than certain ones [moderate].
- **Big celebrations: milestones only.** There is no evidence on celebration
  intensity, so keep restraint.
- **Reward the hard thing.** Stars come from retrieving positions the learner
  failed before, and from finishing. Nothing for speed, volume or skipping. Tired
  people pick easy work [moderate]; rewards must not push them toward it.

**Reminders**

- **At most one a day,** at the learner's chosen cue time, and only if the watch
  isn't done. 39% of people turn notifications off when there are too many
  [moderate].
- **Rotate the wording** to keep it novel; Duolingo's template rotation raised
  new-user retention [moderate]. Keep it encouraging: the knight never guilts.
- **Back off** after about a week of silence; stop after about a month.

**Night and in bed**

- **Many sessions will be in bed.** Most adults use a screen in the hour before
  bed, and young adults usually use a phone [moderate, data dated].
- **Calm, not exciting.** Exciting games and entertainment in bed are linked to
  later and worse sleep; calm, thoughtful play is not [moderate]. After about
  9 pm local time, rewards soften: quieter sound, haptics carry more, no looping
  or escalating animation.
- **A clear end.** A watch lasts about 3–5 minutes and ends with a "done, good
  night" screen. No endless "one more" loop at night.
- **Review at night, new challenges by day.** Chess accuracy drops through the
  day [moderate]. At night, serve spaced reviews of known mistakes; offer deeper
  new work in daytime.
- **Be honest about sleep.** Studying shortly before sleep helps memory
  [moderate–strong], which fits recalling your own past mistakes. It is not
  proven for calculation skill. Blue light adds only about 3 minutes to falling
  asleep and Night Shift showed no benefit, so never market dark mode as sleep
  friendly [moderate].
- **Dark but readable.** Use a warm, dim night palette with high piece contrast,
  not pure black, and keep a light board available; dark text on light reads
  better for most eyes [moderate].
- **One hand, portrait.** Keep controls in thumb reach, with large tap targets
  for tap-to-move and drag as an alternative.

Unanswered by the research: recent in-bed phone figures, hourly usage for
Duolingo or the chess sites, Duolingo's own streak-freeze results, haptics
versus sound in bed, and chess-specific sleep studies. Knightly's own session
times are the best next evidence.

Key sources:
[Gollwitzer and Sheeran 2006](https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f),
[Fournier 2017](https://pubmed.ncbi.nlm.nih.gov/28650196/),
[Duolingo streak changes](https://blog.duolingo.com/improving-the-streak),
[broken streaks (Silverman and Barasch)](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions),
[fresh start effect](https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf),
[Deci, Koestner and Ryan 1999](https://leeds-faculty.colorado.edu/dahe7472/deci%201999.pdf),
[Duolingo notification bandit](https://research.duolingo.com/papers/yancey.kdd20.pdf),
[YouGov on notifications](https://business.yougov.com/content/36287-how-consumers-feel-about-push-notifications-2021),
[screens before bed (NSF poll)](https://pubmed.ncbi.nlm.nih.gov/24340291/),
[in-bed phone use and sleep](https://pmc.ncbi.nlm.nih.gov/articles/PMC9643910/),
[gaming and sleep review](https://uwe-repository.worktribe.com/output/12889279/video-gaming-and-sleep-in-adults-a-systematic-review),
[sleep after learning (Payne 2012)](https://doi.org/10.1371/journal.pone.0033079),
[chess accuracy by time of day](https://ri.conicet.gov.ar/handle/11336/66003).

## Engineering implications

- Dark only: there is no light theme, and every asset and screen is checked on
  the dark page ([decision](technology-decisions.md#dark-only-theme)).
- After their first watch the learner picks a watch time (the time they kept it
  preselected) and an anchor routine; both are editable in settings (proposed in
  [Your watch](specs/2026-10-18-watch-time-anchor-design.md#asking-for-the-watch)). Reminders fire at that time
  only if the watch isn't done, quote the anchor, and time-aware copy follows
  the chosen time.
- Assets stay light: SVG or PNG at @1x/@2x/@3x; animation is code-driven
  motion on layered SVG (no animation runtime).
- Reduced motion shows the end state; sound and haptics still fire.
- Constellations depend on per-skill estimates from the weakness model.

## Later

Written down on 2026-10-18 to take on after the reward kit; neither is started.

- **Constellations (relight the sky).** Each skill the learner masters completes
  a constellation shaped like a chess piece, built from the stars of the
  weaknesses fixed along the way; the long-term goal is a full sky. Blocked on
  per-skill progress from the
  [weakness model](specs/2026-10-17-weakness-model-design.md). Needs: a spec for
  what "mastered" means per skill, a sky view (likely on Progress), constellation
  art in the shard's glossy cel, and a relighting moment that follows the reward
  juice checklist.
- **Knight mascot.** Replace the code-drawn stand-in (`KnightMascot`) with an
  original character: a lantern-carrying knight on night watch, warm and a
  little dramatic, encouraging rather than guilt-tripping, in six moods (idle,
  thinking, cheer, encourage, sleepy, celebrate). Best commissioned from an
  artist (AI and code handle a consistent character worst). The brief is the
  locked art: the board-tile logo, the star shard, the moon phases and the
  reference PNGs in `assets/reward-art/references/`; deliverables per
  [art direction](art-direction.md#deliverables-and-acceptance).

## Open decisions

1. **Story wording** above: approve or edit before it reaches app copy.
2. **When people practise.** Check saved session times by local hour. A
   late-evening cluster suggests in-bed use and supports leaning into night.
3. **Asset pipeline.** Recraft for the style lock now; a trained Scenario model
   for volume once the style is locked.
