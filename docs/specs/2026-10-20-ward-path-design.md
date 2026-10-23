# The ward path: eighteen posts on the walk to the keep

Accepted (2026-10-20). Build steps 1 to 3 are built in `src/features/today`
(`ward-copy.ts`, `ward-path.ts`, `ward-cards.tsx`, `track-glyph.tsx`; Storybook's
"Today/Path home" On the wards stories), checked in the browser only: not yet on
a phone, with large text or with VoiceOver. The design for build step 6 of
[the curriculum](2026-10-20-curriculum-wards-design.md), whose wards are live on
`/api/journey` (`wards`) and `/api/deck` (`ward`): what the home path looks like once its sections are curriculum units, what each
unit is called, and the story beats that carry a learner through them. Units,
lessons, tracks, modes and the clearing rule are that spec's. This one adds only
what the learner sees. It amends [the path home](2026-10-19-path-home-design.md)
(sections, nodes, castles) and [the watch story](2026-10-18-watch-story-design.md)
(ranks). Tonight's watch, extra watches, the node sheet, the one screen,
the wall and raiders, and the board rules stay as they are. Mockup: the
[ward path wireframes canvas](https://claude.ai/artifact/XmeL1oqChbAyLCV4VDDPYx).

## Decisions (user, 2026-10-20)

1. **Curriculum units are sections and watches are nodes** (revised
   2026-10-21; lessons were the nodes first). A unit clears on retention and
   can stay current for one to three weeks. Lesson nodes still sat unchanged on
   a night of reviews, so each watch kept since the post was reached is a node:
   tonight's is lit, tomorrow's waits above, and every watch kept is a step the
   knight walks. The post clears when its lessons are held, however many
   watches that takes, so the path never promises "3 of 5". The lessons are in
   the post's card (the banner's About), and the beacon's lesson names tonight's
   node. Four of every watch's ten items are the post's puzzles (the watch's
   mix, [path home](2026-10-19-path-home-design.md#what-a-watch-holds-decided-2026-10-22)),
   so each step teaches the post however many reviews are due.

   **The whole walk is drawn** (decided 2026-10-21), Duolingo-style: every
   post up to the keep, each with its lessons as locked grey nodes (fixed,
   unlike the watches it will take), the rank castles as stops on the road and
   the three wards' gates. A post behind keeps the watches kept while it was
   current under its marker, so the road stays one winding walk; nights kept
   before the walk began are counted below it.
2. **Ranks are tied to the path.** One ladder instead of two. A rank castle
   stands after every third post, and walking past it is the rank-up. Stars
   still come only from moves that stopped slipping. They stay the reward for
   each of those moves, but they no longer decide rank.
3. **The place name leads.** A post is titled by its place ("The
   Portcullis"), with its plain topic directly under it ("The pin"). This amends
   the direction's rule that the story never labels anything the learner has to
   decode. The plain topic appears beside the place everywhere: banner, card,
   session end and the accessibility label. Lessons, verdicts and slip states
   stay plain.
4. **The castle is a real one** (user, the same day). A real castle has one
   to three wards, so the learner walks **three wards, Outer, Middle and Inner,
   then the Keep**, as Windsor still has its Lower, Middle and Upper Wards. The
   curriculum's eighteen units are **posts** within them: a watchman's post is
   where he stands his watch. Every post is a real part of a castle, and the lore
   is real history, or labelled as legend.

**Words.** In code a curriculum unit stays a `Ward` (`curriculum.WARDS`). On
screen it is a **post**; **ward** means only the three courtyards. "Post 6 of
18" and "the Outer Ward" never mean the same thing.

## The story

The watch stays a vigil on the wall. The wards give it a direction:

> You start at the gatehouse as a page. Every post on the walls has a trick the
> raiders use there. Hold it, and the knight walks you further in, through the
> Outer, Middle and Inner Wards, all the way to the keep.

The walk goes from the gate inward. Each place is chosen so the place itself is
a hook for its idea: the portcullis pins, the postern is a hidden door, the
courtyard is a square. The knight introduces each post in one line that explains
the idea through the place.

There are no new characters, no maps to collect and no building. The story still
never gates a review, unlocks anything or shows a post the learner hasn't earned
as if it were theirs. The keep is the long-term goal, as the full sky is.

## The eighteen posts

Curriculum keys and plain topics are `curriculum.WARDS`. Places and knight lines
are approved (2026-10-20).

| # | Ward | Place | Topic (plain) | The knight's line | Rank |
| --- | --- | --- | --- | --- | --- |
| 1 | Outer | The Gatehouse | What the board is saying | "Every watch starts here. Before anything else: what's attacked, and what's guarding it?" | Page |
| 2 | Outer | The Drawbridge | Mate in one | "One pull of the chain and the gate is shut. Find the one move." | Page |
| 3 | Outer | The Armoury | Pieces left loose | "Somebody always leaves a sword lying about. Count who guards what." | Page |
| | | *Castle: Squire I* | | | |
| 4 | Outer | The Lists | The double attack | "Where knights tilt. One charge, two targets, and they can only save one." | Squire I |
| 5 | Outer | The Turret Stair | Mate in two | "Two steps up and you're at the top." | Squire I |
| 6 | Outer | The Portcullis | The pin | "Once it drops, nothing behind it moves." | Squire I |
| | | *Castle: Squire II · the Middle Ward* | | | |
| 7 | Middle | The Guardroom | Removing the defender | "Deal with the guard first. Then whatever he was guarding." | Squire II |
| 8 | Middle | The Postern | The discovered attack | "A little door in the wall. Step aside and whatever's behind you strikes." | Squire II |
| 9 | Middle | The Watchtower | Seeing mate coming | "From up here you see them coming. Look at their move before you play yours." | Squire II |
| | | *Castle: Squire III* | | | |
| 10 | Middle | The Barbican | The in-between move | "There's a gap between the outer gate and the inner one. There's often a move in it too." | Squire III |
| 11 | Middle | The Smithy | Pawn endings | "Once the pieces are gone, it's the pawns' work, one hammer stroke at a time." | Squire III |
| 12 | Middle | The Gate Towers | Discovered and double check | "Two towers, one shout. A king can't answer both." | Squire III |
| | | *Castle: Knight I · the Inner Ward* | | | |
| 13 | Inner | The Stocks | Attacking a pinned piece | "A piece in the stocks can't run. Pile on." | Knight I |
| 14 | Inner | The Kitchens | X-ray and skewer | "The cook's spit goes through the first thing and into the one behind." | Knight I |
| 15 | Inner | The Courtyard | The square of the pawn | "Draw the square. If the king's inside it, the pawn won't make it." | Knight I |
| | | *Castle: Knight II* | | | |
| 16 | Inner | The Chapel | Mating patterns | "The same shapes in every window. Learn them and you'll see them in your games." | Knight II |
| 17 | Inner | The Mews | Trapping a piece | "A falcon with no room to fly is caught." | Knight II |
| 18 | Inner | The Great Hall | Luring and interference | "Court tricks: pull a piece where you want it, or get in another's way." | Knight II |
| | | *Castle: Knight III* | | | |

### Beyond the walls (decided 2026-10-23)

The walk goes on through the rest of the Steps Method in its own order
(`curriculum.WARDS` 19–47, plan approved 2026-10-23): **Part II, the Keep**,
floor by floor from the Forebuilding to the Keep Roof (posts 19–32: the rest of
Steps 3 and 3+, then 4 and 4+); **Part III, the March**, riding the border
towers from the Crossing to the Last Tower (33–43: Steps 5 and 5+); and
**Part IV, the Citadel**, a castle of one's own (44–47: Step 6). It stays a
vigil. Each part's first post opens with a rule across the road ("THE KEEP",
"THE MARCH", "THE CITADEL"). The places and the knight's lines are in
`src/features/today/ward-copy.ts`, and their history notes are sourced under
"From the old books". Ranks go on a castle every third post: Knight III after post 18, Knight
Banneret I–III, Captain of the Watch I–III, Warden of the March I–III, and
Castellan when the last post is held (names are placeholders). Each new tier
has its own emblem, the knight's gold-rimmed crowned shield with its own field
and device: a square banner (Banneret), a watch lantern (Captain), a border
tower (Warden), and a keep over crossed keys (Castellan, without pips). Positional lessons (mini plans, weak pawns,
open files…) are introduced and show "Coming soon" until drills exist.

The ward boundaries fall on rank castles: the Portcullis is the gate into the
Middle Ward (Squire II) and the Gate Towers into the Inner Ward (Knight I). The
ranks keep their names and keys (`watch.RANKS`), and since 2026-10-22 posts are
the only way to a rank: stars count moves that stopped slipping. Knight III's
castle stands after post 18, at the door of the Keep.

On the path a rule across the road names the ward it enters ("MIDDLE WARD"),
between the last post of one ward and the first of the next, as Duolingo
divides its units. The banner carries an About button (the post's glyph) that
opens the current post's card, and tonight's node wears a "TONIGHT" tag, as in
the wireframe.

## The lore

Real history, used sparingly. It lives in copy and art, never in a label, and
nothing has to be read to play. Every line is sourced below.

### The watch

| Lore | Where it shows |
| --- | --- |
| **Watch and ward.** The Statute of Winchester (1285) set the duty: towns shut their gates from sunset to sunrise and kept a watch on them. The watch was kept by night, the ward by day. | The one-sentence setup and the first night: the app's name and its wards come from the same phrase |
| **The round.** The walkway along the top of the wall was the *chemin de ronde*, the path the watch walked on its rounds. | Story copy for the path ("your round tonight"); the product label stays "path" |
| **Curfew,** from *couvre-feu*, "cover the fire": the evening bell that told a town to bank its hearths. | The watch-time reminder's voice ("Curfew's at 9. The wall's waiting.") |
| **"All's well."** The watchman's call on his round. | The kept-night beat, once per night |
| **Page, squire, knight.** A page served from about seven, a squire from about fourteen, and was knighted at about twenty-one. | The rank emblems' captions in Progress |

### From the old books

Each post carries one short note, at most two sentences, shown on its arrival
card under the knight's line and on its node cards. It is optional reading, never
a quiz. Every note was checked against the source beside it (posts 1–18 on
2026-10-20, posts 19–47 on 2026-10-23) and lives in `src/features/today/ward-copy.ts`.
The copy for 1–18 is approved; 19–47 awaits review in its PR.

| # | Note | Source |
| --- | --- | --- |
| 1 | Under the Statute of Winchester (1285), town gates were shut from sunset to sunrise and a watch kept on them. | [statutes.org.uk](https://statutes.org.uk/site/the-statutes/thirteenth-century/1285-13-edward-1-the-statute-of-winchester/) |
| 2 | Checkmate most likely comes from the Persian *shāh māt*: the king is helpless. | [Etymonline, "checkmate"](https://www.etymonline.com/word/checkmate) (Barnhart; "the king is dead" is the disputed reading) |
| 3 | Around 1100, Petrus Alfonsi listed chess among the seven skills a knight should learn, with riding, swimming, archery, boxing, hawking and verse. | *Disciplina clericalis*, Hilka–Söderhjelm Latin text: "equitare, natare, sagittare, cestibus certare, aucupare, scaccis ludere, versificari" ([archive.org](https://archive.org/stream/disciplinaclericalishillat/disciplinaclericalishillat_djvu.txt)) |
| 4 | The knight has moved the same way since chess began in India, some 1,500 years ago. | [Chess Variant Pages, knight](https://www.chessvariants.com/piececlopedia.dir/knight.html) (not "the only piece": the rook kept its move too) |
| 5 | Medieval problem books such as *Bonus Socius*, from the late 1200s, collected positions to solve: the oldest kind of chess study. | [Wikipedia, Bonus Socius](https://en.wikipedia.org/wiki/Bonus_Socius); Morgan Library copy MS M.108, c. 1290–1300 |
| 6 | A portcullis dropped down grooves in the gate passage, and a winch in the room above raised it again. | [Wikipedia, Portcullis](https://en.wikipedia.org/wiki/Portcullis) (Bodiam, Goodrich) |
| 7 | The rooks of the Lewis Chessmen, carved in the 1100s, are warders: guards on foot with sword and shield. | [The Met, *The Game of Kings*](https://www.metmuseum.org/press-releases/the-game-of-kings-medieval-ivory-chessmen-from-the-isle-of-lewis-2011-exhibitions); [Wikipedia, Lewis chessmen](https://en.wikipedia.org/wiki/Lewis_chessmen) |
| 8 | A postern, or sally port, let defenders slip out and strike where the enemy wasn't looking. | [Wikipedia, Postern](https://en.wikipedia.org/wiki/Postern); [Sally port](https://en.wikipedia.org/wiki/Sally_port) |
| 9 | Watch and ward: the watch was kept by night, the ward by day. | [Etymonline, "night-watch"](https://www.etymonline.com/word/night-watch); Webster's 1913, "watch" |
| 10 | A barbican guarded the approach to a gate, so attackers who broke through were caught before the next one. | [Wikipedia, Barbican](https://en.wikipedia.org/wiki/Barbican) |
| 11 | In Jacobus de Cessolis's book on chess (around 1300), each pawn was a tradesman, among them the farmer, the smith, the merchant and the physician. | [University of Chicago, *Le Jeu des échecs moralisé*](https://roseandchess.lib.uchicago.edu/chess.html) (the full list varies between copies) |
| 12 | *Check* comes from *shāh*, "king": the warning that the king is attacked. | [Etymonline, "check"](https://www.etymonline.com/word/checkmate) |
| 13 | William Caxton's *The Game and Playe of the Chesse*, printed in Bruges around 1474, was one of the first books printed in English. | [Project Gutenberg edition](https://gutenberg.org/files/10672/10672-h/10672-h.htm) (usually counted second, after his *Recuyell*) |
| 14 | The rook was the *rukh* of Persian chess, a chariot in the Indian game before it. Europe turned it into a tower. | [Wikipedia, Rook](https://en.wikipedia.org/wiki/Rook_(chess)); [Etymonline, "rook"](https://www.etymonline.com/word/rook) (*rukh*'s own meaning is disputed, so the note doesn't translate it) |
| 15 | The chequered board gave the Exchequer its name: royal accounts were counted on a chequered cloth. | [Wikipedia, Exchequer](https://en.wikipedia.org/wiki/Exchequer); [Etymonline](https://www.etymonline.com/word/exchequer) |
| 16 | A legend from early Arabic chess books: staked on her husband's game, Dilaram cried, "Sacrifice your two rooks, not me!" He did, and mated. | [Chess Variant Pages, Dilaram's problem](https://www.chessvariants.org/mansubat.dir/mans01.html); Murray, *A History of Chess* |
| 17 | A mew was the cage where a hawk was kept while it moulted. Hawking, like chess, was a knightly skill. | [Etymonline, "mews"](https://www.etymonline.com/word/Mews); Petrus Alfonsi (note 3) |
| 18 | The queen began as the *fers*, a counsellor who moved one square diagonally. Her modern move first appears in Valencia, around 1475. | [Wikipedia, Ferz](https://en.wikipedia.org/wiki/Ferz); [*Scachs d'amor*](https://en.wikipedia.org/wiki/Scachs_d%27amor) |
| Keep | The keep, or donjon, was the last and strongest refuge of a castle. | [Britannica, Keep](https://www.britannica.com/print/article/314145) |
| 19 | At Rochester the stair to the keep's door crossed a drawbridge into a forebuilding, which guarded the entrance. | [Wikipedia, Rochester Castle](https://en.wikipedia.org/wiki/Rochester_Castle); [English Heritage, description](https://english-heritage.org.uk/visit/places/rochester-castle/history/description) |
| 20 | Norman keeps were usually entered on the first floor, up an outside stair, not at ground level. | [Wikipedia, Rochester Castle](https://en.wikipedia.org/wiki/Rochester_Castle) ("traditionally built with an entrance at first-floor level"); [English Heritage, description](https://english-heritage.org.uk/visit/places/rochester-castle/history/description) |
| 21 | In Rochester's keep, the grand rooms stood above storerooms in the basement. | [English Heritage, description](https://english-heritage.org.uk/visit/places/rochester-castle/history/description) |
| 22 | Rochester's well shaft rose inside the keep's cross wall, with a well-head on every floor. | [Wikipedia, Rochester Castle](https://en.wikipedia.org/wiki/Rochester_Castle); [English Heritage, description](https://english-heritage.org.uk/visit/places/rochester-castle/history/description) (the spine wall "contains the shaft of the keep's well") |
| 23 | Hedingham's keep, built around 1140, has walls about 3.4 metres thick at the base, with small chambers inside them. | [Wikipedia, Hedingham Castle](https://en.wikipedia.org/wiki/Hedingham_Castle); [Historic England, list entry 1122959](https://historicengland.org.uk/listing/the-list/list-entry/1122959) ("gallery and small chambers within the wall thickness") |
| 24 | Rochester's keep has a gallery running inside the thickness of its outer walls at second-floor level. | [English Heritage, description](https://english-heritage.org.uk/visit/places/rochester-castle/history/description) |
| 25 | Before castling, the king could leap two squares on his first move. Europe played it as early as the 1200s. | [Wikipedia, Castling](https://en.wikipedia.org/wiki/Castling) (the king's leap) |
| 26 | The solar was the family's private room, usually upstairs. Its name may come from the Latin for "sun", or for "alone". | [Wikipedia, Solar (room)](https://en.wikipedia.org/wiki/Solar_(room)) (both origins given as possible) |
| 27 | In medieval Arabic chess you could also win by baring the king: taking every piece he had left. | [Wikipedia, Shatranj](https://en.wikipedia.org/wiki/Shatranj) (a draw in most places if he could take the last piece straight back) |
| 28 | The ivory "Charlemagne chessmen" lay in the treasury of Saint-Denis by the 1200s. Charlemagne is legend: they were carved centuries after him. | [Wikipedia, Charlemagne chessmen](https://en.wikipedia.org/wiki/Charlemagne_chessmen) (11th century, now in the BnF's Cabinet des Médailles; the link to Charlemagne first appears in 1625) |
| 29 | A tocsin was an alarm bell. The word comes from Old Occitan for "strike the bell". | [Wikipedia, Tocsin](https://en.wikipedia.org/wiki/Tocsin); [Wiktionary, tocsin](https://en.wiktionary.org/wiki/tocsin) (*tocasenh*: *tocar* + *senh*) |
| 30 | From about 1600 to 1800, English players counted stalemate as a loss for the player who gave it. | [Wikipedia, Stalemate](https://en.wikipedia.org/wiki/Stalemate) (history; after Murray) |
| 31 | In 1215 King John's miners brought down a corner turret of Rochester's keep, burning the fat of 40 pigs under its props. | [English Heritage, history of Rochester Castle](https://www.english-heritage.org.uk/visit/places/rochester-castle/history/) (the south-east turret; rebuilt semicircular) |
| 32 | Lucena's book, printed in Salamanca around 1497, is the oldest printed chess book to survive. It holds 150 positions to solve. | [Wikipedia, Luis Ramírez de Lucena](https://en.wikipedia.org/wiki/Luis_Ram%C3%ADrez_de_Lucena) |
| 33 | *March* comes from Old French *marche*, "boundary": a march was the land along a border. | [Wiktionary, march](https://en.wiktionary.org/wiki/march) (Etymology 2) |
| 34 | In October 1597 a border meeting at the west ford of Norham ended in a gunfight across the Tweed at dusk. | [Wikipedia, Norham Castle](https://en.wikipedia.org/wiki/Norham_Castle) |
| 35 | A Scottish act of 1455 set the border's fires: one bale burning warned the English were coming; two together, that they were coming indeed. | Act of 1455 (12 Jas. II), quoted in the Oxford English Dictionary, "bale" n.2 ([wehd.com](https://wehd.com/7/Bale_sb2.html)): "Ane Baile, is warning of their cumminge … twa bailes togidder at anis, they are cumming in deed"; [DSL, "bale"](https://dsl.ac.uk/entry/dost00052289) |
| 36 | In 1249 twelve knights, six English and six Scots, met on the border to write down its laws. | [Wikipedia, March law](https://en.wikipedia.org/wiki/March_law_(Anglo-Scottish_border)) |
| 37 | Pontage was a toll for building or mending a bridge, granted by the king for a set term. | [Wikipedia, Pontage](https://en.wikipedia.org/wiki/Pontage) (by letters patent) |
| 38 | Old Sarum was an Iron Age hillfort from about 400 BC. The Normans built their castle in the middle of it. | [English Heritage, history of Old Sarum](https://www.english-heritage.org.uk/visit/places/old-sarum/history/) ("a motte was thrown up in the centre of the hillfort") |
| 39 | The Lucena position isn't in Lucena's book. Its earliest known discussion is Salvio's, in 1634. | [Wikipedia, Lucena position](https://en.wikipedia.org/wiki/Lucena_position) (*Il Puttino*) |
| 40 | Hadrian's Wall had a milecastle about every Roman mile, each with a gate north and a gate south. | [Wikipedia, Milecastle](https://en.wikipedia.org/wiki/Milecastle) |
| 41 | Pele towers were small fortified towers built along the Anglo-Scottish border, where families took refuge from raids. | [Wikipedia, Peel tower](https://en.wikipedia.org/wiki/Peel_tower) |
| 42 | The bishop began as the alfil, an elephant that leapt two squares diagonally. It could reach only an eighth of the board. | [Wikipedia, Alfil](https://en.wikipedia.org/wiki/Alfil_(chess)) |
| 43 | *Zugzwang* is German for "compulsion to move". Its earliest known use in English is Lasker's, in 1905. | [Wikipedia, Zugzwang](https://en.wikipedia.org/wiki/Zugzwang) (after Edward Winter) |
| 44 | *Citadel* comes from the Italian *cittadella*, "little city". | [Wiktionary, citadel](https://en.wiktionary.org/wiki/citadel) |
| 45 | Beaumaris was ringed by defences inside defences: a moat with its own dock, and outer walls with 300 arrow loops. | [Cadw, Beaumaris Castle](https://cadw.gov.wales/visit/places-to-visit/beaumaris-castle) ("four concentric rings of formidable defences") |
| 46 | The English named the bishop for its mitre-shaped top. The French call it the *fou*, the jester; the Germans, the runner. | [Wikipedia, Bishop (chess)](https://en.wikipedia.org/wiki/Bishop_(chess)) |
| 47 | A castellan was the governor of a castle. In England the same office was called the constable. | [Wikipedia, Castellan](https://en.wikipedia.org/wiki/Castellan) |

The watch's own lore above is sourced the same way: watch and ward and the
gates from the Statute of Winchester and Webster's 1913; the *chemin de ronde*
from [Wikipedia](https://en.wikipedia.org/wiki/Chemin_de_ronde); curfew from
[Etymonline](https://www.etymonline.com/word/curfew); page, squire and knight at
about 7, 14 and 21 from [Wikipedia, Page](https://en.wikipedia.org/wiki/Page_(servant))
(typical ages, not fixed ones). "All's well" is the watchman's call of tradition,
used as copy rather than claimed as history.

## Place art

Built (2026-10-21), drawn in code in the kit's glossy cel like the star shard
and the moon (`src/components/kit/art/post-landmark-art.ts`, the kit's
`landmarks` and `skylines`). Each post's landmark rises behind the battlements
of the watch scene, right of the knight, on its node cards: tonight's, a
lesson's and a post's (`WatchHero`'s `post`). The distant skyline behind the
hills shows how deep the walk has gone: open country in the Outer Ward, the
castle's rooftops in the Middle Ward, the keep looming in the Inner Ward. The
Keep has a landmark of its own for when posts beyond 18 exist. A post without a
landmark shows the wall alone. Reviewed in Storybook (Today/Watch hero, Post
landmarks); not yet on a phone.

## Practice names the post

`/api/deck` says why it served what it serves (`mode`, after the Steps
Method's workbook variants). A puzzle served as `taught` (the current post's
idea, at your target rating) is labelled with its post ("At the Lists") and
prompted with the lesson it most likely teaches, the post's first teachable
lesson not yet held ("Double attack with the king in it: find it for white."),
so practice reads as the path's lesson rather than a random puzzle. `volume`
keeps its existing label (a family puzzle is "Same idea"); `defend` is the
threat question and `unannounced` is "Your move", both unchanged. A review card
(`mode` null) is the learner's own position and names nothing. Built
(`practice-screen.tsx`, `ward-path.ts`'s `taughtAt`); an older server omits
`mode` and the puzzle shows its rating as before.

## Posts reached and ranks

The server derives ward state on every read, so a post can un-clear when a
card lapses. Ranks and moments need a record that only moves forward
(decided 2026-10-20): a per-user setting `wards_reached`, like `RANKS_SETTING`
and with no migration, holding each post's first-entered and first-cleared
date. A rank is reached when every non-blocked post before its castle has
been cleared once. Built (`wards.record`, `wards.post_ranks`, read by `watch._ranks`;
`/api/journey` records before it ranks, so a castle reached shows in the same
response). Castellan is reached when the last post is held.

**Every post is walked** (decided 2026-10-21). Only evidence from after a post
is reached counts toward it (the record's `entered_at`, stamped the moment the
post becomes current), so history never skips one: on launch day 325 earlier
puzzle solves cleared six posts at once. A lesson the learner's own games
already hold needs one fresh solve instead of three. A post once cleared stays
cleared, so evidence ageing out never walks anyone back. A strong player still
moves quickly, a night or two per post.

Ranks reached stay reached (`RANKS_SETTING`). A learner whose star rank is
above their post's rank keeps it, and the castle shows the earlier date. The
rank chip becomes "Squire I · Post 6" (an older server: "Squire I · ★ 23" as
today). Stars stay on the chip's popover and in Progress.

## Contract

**Live:** `/api/journey`'s `wards` is all eighteen in order, each
`{key, name, index, state, lessons: [{key, name, track, step, held, solves,
teachable}]}` with `state` `cleared`/`current`/`ahead`/`blocked` and exactly one
`current`; `/api/deck`'s `ward` is the current one. `step` is the Steps Method's
numbering, kept for provenance and never shown.

**The app owns the story copy** (`src/features/today/ward-copy.ts`): place,
ward (outer/middle/inner), knight's line and note, keyed by the ward `key`. The
server's `name` is the plain topic and the fallback for a key the app doesn't
know, so a renamed or added ward still renders. Rank castles also come from the
app's table until the server sends ranks by post. Place art is keyed the same
way, with the generic wall scene as the fallback.

**From `wards_reached`:** each ward's `entered_on` and `cleared_on` (the app
shows "cleared Sep 30" on a post behind and uses it to keep a re-cleared post
from celebrating twice), and `/api/journey`'s and `/api/home`'s ranks reached by
posts, so a castle never un-reaches. The app finds moments itself, so there is
no server `moments` list.

## Build order

1. **Ward copy and track glyphs** in the app, keyed by ward key.
2. **The path with posts** from `/api/journey`'s `wards`, with sample data in
   the shell lab: the banner, lesson nodes, castles, collapsed posts behind,
   blocked and coming-soon states. Uses the existing renderer
   (`src/features/today/path-view.tsx`).
3. **Node cards,** with the schedule ahead moving onto tonight's and
   tomorrow's cards; the night map moves to Progress.
4. **Posts reached** on the server, then dates, ranks by post and moments.
5. **Place art,** 18 scenes plus the keep and the three wards' grounds,
   through the watch kit. Until they
   exist, the wall scene with the place name stands in.

## Open

- **The Gatehouse has no drills.** It stays blocked, and every learner
  starts at the Drawbridge, until board-vision drills of our own exist.
- **Pawn endings and the square of the pawn** draw the same drills in the
  corpus. If the curriculum merges units 11 and 15, the Smithy takes both and
  the Courtyard's slot goes to another unit.

## Tests

- A lesson node's state: ahead, under way (solves of three), held, coming soon
  for `teachable: false`, never ticked.
- A blocked post is never drawn as cleared or current, wherever it falls.
- The beacon stands on the current post's first teachable, unheld lesson; after the watch is kept it becomes the
  extra watch node on the same lesson.
- Banner and node accessibility labels read the place and the plain topic
  together, at large text.
- Each moment shows once and in order (lesson held, post cleared, rank
  reached), and never mid-session.
- A rank reached by stars is never lost when post ranks are lower.
- Contract parsing with every new field absent: the path falls back to
  today's.
