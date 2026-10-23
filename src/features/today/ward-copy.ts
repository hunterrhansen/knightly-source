// The story copy for the curriculum's posts (docs/specs/2026-10-20-ward-path-design.md,
// "The eighteen posts" and "The lore"). The server sends each post's key and
// its plain topic; the place, the ward it stands in, the knight's line and its
// note from the old books are the app's, keyed by that key. A key the app
// doesn't know still renders, by its plain topic.

/** The castle's three wards, walked from the gate inward; then the keep, floor
 * by floor; the march, riding the border towers; and a citadel of one's own. */
type Bailey = 'outer' | 'middle' | 'inner' | 'keep' | 'march' | 'citadel';

const BAILEY_NAMES: Record<Bailey, string> = {
  outer: 'Outer Ward',
  middle: 'Middle Ward',
  inner: 'Inner Ward',
  keep: 'The Keep',
  march: 'The March',
  citadel: 'The Citadel',
};

type PostCopy = {
  place: string;
  bailey: Bailey;
  /** The knight introduces the post in one line, through the place. */
  line: string;
  /** One short note of real history (or labelled legend), each sourced in the
   * spec's "From the old books"; null until one is sourced. */
  lore: string | null;
};

const POST_COPY: Readonly<Record<string, PostCopy>> = {
  'board-vision': {
    place: 'The Gatehouse',
    bailey: 'outer',
    line: 'Every watch starts here, with the safety check. Before you move: checks, captures and threats, theirs and yours.',
    lore: 'Under the Statute of Winchester (1285), town gates were shut from sunset to sunrise and a watch kept on them.',
  },
  'mate-in-one': {
    place: 'The Drawbridge',
    bailey: 'outer',
    line: 'One pull of the chain and the gate is shut. Find the one move.',
    lore: 'Checkmate most likely comes from the Persian shāh māt: the king is helpless.',
  },
  'loose-pieces': {
    place: 'The Armoury',
    bailey: 'outer',
    line: 'Somebody always leaves a sword lying about. Count who guards what.',
    lore: 'Around 1100, Petrus Alfonsi listed chess among the seven skills a knight should learn, with riding, swimming, archery, boxing, hawking and verse.',
  },
  'double-attack': {
    place: 'The Lists',
    bailey: 'outer',
    line: 'Where knights tilt. One charge, two targets, and they can only save one.',
    lore: 'The knight has moved the same way since chess began in India, some 1,500 years ago.',
  },
  'mate-in-two': {
    place: 'The Turret Stair',
    bailey: 'outer',
    line: 'Two steps up and you’re at the top.',
    lore: 'Medieval problem books such as Bonus Socius, from the late 1200s, collected positions to solve: the oldest kind of chess study.',
  },
  'the-pin': {
    place: 'The Portcullis',
    bailey: 'outer',
    line: 'Once it drops, nothing behind it moves.',
    lore: 'A portcullis dropped down grooves in the gate passage, and a winch in the room above raised it again.',
  },
  'remove-the-defender': {
    place: 'The Guardroom',
    bailey: 'middle',
    line: 'Deal with the guard first. Then whatever he was guarding.',
    lore: 'The rooks of the Lewis Chessmen, carved in the 1100s, are warders: guards on foot with sword and shield.',
  },
  'discovered-attack': {
    place: 'The Postern',
    bailey: 'middle',
    line: 'A little door in the wall. Step aside and whatever’s behind you strikes.',
    lore: 'A postern, or sally port, let defenders slip out and strike where the enemy wasn’t looking.',
  },
  'defending-mate': {
    place: 'The Watchtower',
    bailey: 'middle',
    line: 'From up here you see them coming. Look at their move before you play yours.',
    lore: 'Watch and ward: the watch was kept by night, the ward by day.',
  },
  'in-between': {
    place: 'The Barbican',
    bailey: 'middle',
    line: 'There’s a gap between the outer gate and the inner one. There’s often a move in it too.',
    lore: 'A barbican guarded the approach to a gate, so attackers who broke through were caught before the next one.',
  },
  'pawn-endings': {
    place: 'The Smithy',
    bailey: 'middle',
    line: 'Once the pieces are gone, it’s the pawns’ work, one hammer stroke at a time.',
    lore: 'In Jacobus de Cessolis’s book on chess (around 1300), each pawn was a tradesman, among them the farmer, the smith, the merchant and the physician.',
  },
  'double-check': {
    place: 'The Gate Towers',
    bailey: 'middle',
    line: 'Two towers, one shout. A king can’t answer both.',
    lore: 'Check comes from shāh, “king”: the warning that the king is attacked.',
  },
  'pinned-pieces': {
    place: 'The Stocks',
    bailey: 'inner',
    line: 'A piece in the stocks can’t run. Pile on.',
    lore: 'William Caxton’s The Game and Playe of the Chesse, printed in Bruges around 1474, was one of the first books printed in English.',
  },
  'x-ray': {
    place: 'The Kitchens',
    bailey: 'inner',
    line: 'The cook’s spit goes through the first thing and into the one behind.',
    lore: 'The rook was the rukh of Persian chess, a chariot in the Indian game before it. Europe turned it into a tower.',
  },
  'square-of-the-pawn': {
    place: 'The Courtyard',
    bailey: 'inner',
    line: 'Draw the square. If the king’s inside it, the pawn won’t make it.',
    lore: 'The chequered board gave the Exchequer its name: royal accounts were counted on a chequered cloth.',
  },
  'mating-patterns': {
    place: 'The Chapel',
    bailey: 'inner',
    line: 'The same shapes in every window. Learn them and you’ll see them in your games.',
    lore: 'A legend from early Arabic chess books: staked on her husband’s game, Dilaram cried, “Sacrifice your two rooks, not me!” He did, and mated.',
  },
  trapping: {
    place: 'The Mews',
    bailey: 'inner',
    line: 'A falcon with no room to fly is caught.',
    lore: 'A mew was the cage where a hawk was kept while it moulted. Hawking, like chess, was a knightly skill.',
  },
  luring: {
    place: 'The Great Hall',
    bailey: 'inner',
    line: 'Court tricks: pull a piece where you want it, or get in another’s way.',
    lore: 'The queen began as the fers, a counsellor who moved one square diagonally. Her modern move first appears in Valencia, around 1475.',
  },
  // Part II, the Keep: the rest of Steps 3 and 3+, then Steps 4 and 4+.
  'defending-double-attack': {
    place: 'The Forebuilding',
    bailey: 'keep',
    line: 'The keep’s door is guarded twice over. When they threaten two things, find the move that saves both.',
    lore: null,
  },
  'mini-plan': {
    place: 'The Keep Stair',
    bailey: 'keep',
    line: 'One step at a time up the stair. When there’s nothing to take, make a small plan and climb.',
    lore: null,
  },
  'vulnerability-opening': {
    place: 'The Undercroft',
    bailey: 'keep',
    line: 'The stores below are where a careless steward leaves things lying. Early in the night, look for what’s loose.',
    lore: null,
  },
  pinning: {
    place: 'The Well Chamber',
    bailey: 'keep',
    line: 'Everything in the keep draws from the well. Bring every piece out before you draw on any one.',
    lore: null,
  },
  blocking: {
    place: 'The Wall Passage',
    bailey: 'keep',
    line: 'A passage this narrow is easily blocked. Make their own pieces stand in their king’s way.',
    lore: null,
  },
  'pin-luring': {
    place: 'The Mural Gallery',
    bailey: 'keep',
    line: 'Draw a piece onto the line, then hold it there.',
    lore: null,
  },
  'the-magnet': {
    place: 'The Great Chamber',
    bailey: 'keep',
    line: 'Sometimes the king must be drawn out of his chamber before he can be caught.',
    lore: null,
  },
  'weak-pawns': {
    place: 'The Solar',
    bailey: 'keep',
    line: 'In the quiet of the solar, look at their pawns: the lonely, the doubled and the left behind.',
    lore: null,
  },
  'attack-on-the-king': {
    place: 'The Lord’s Chamber',
    bailey: 'keep',
    line: 'Chase a piece onto the square you want, then turn to the king himself.',
    lore: null,
  },
  'seventh-rank': {
    place: 'The Strongroom',
    bailey: 'keep',
    line: 'In the endgame the rules are the treasure: a rook on the seventh, the king to the front.',
    lore: null,
  },
  'attacking-the-king': {
    place: 'The Bell Chamber',
    bailey: 'keep',
    line: 'Ring the bell when the king is open: bring more pieces than he has guards.',
    lore: null,
  },
  'interference-blocking': {
    place: 'The Gallery',
    bailey: 'keep',
    line: 'From the gallery you see every line. Cut one, block one, and know when a draw is the best you have.',
    lore: null,
  },
  'mini-plans': {
    place: 'The Turret',
    bailey: 'keep',
    line: 'Up the turret stair, a small plan for every quiet night, and a battery ready behind the door.',
    lore: null,
  },
  'endgame-technique': {
    place: 'The Keep Roof',
    bailey: 'keep',
    line: 'The whole castle lies below. Win the endings cleanly, and solve the problems the night sets you.',
    lore: null,
  },
  // Part III, the March: Steps 5 and 5+, riding the border towers.
  'material-and-time': {
    place: 'The Crossing',
    bailey: 'march',
    line: 'We ride out tonight. Out here a pawn is worth less than time, and mates take three moves to see.',
    lore: null,
  },
  breakthrough: {
    place: 'The Ford',
    bailey: 'march',
    line: 'Pawns cross where the water is shallow. Learn where to break through, and what each pawn is for.',
    lore: null,
  },
  'pawn-race': {
    place: 'The Watch Fire',
    bailey: 'march',
    line: 'Count the race before you run it, and keep your rook on their seventh rank.',
    lore: null,
  },
  'discovery-and-pin': {
    place: 'The Border Tower',
    bailey: 'march',
    line: 'From the border tower, two old tricks at a longer reach: the discovery and the pin.',
    lore: null,
  },
  'rook-against-pawn': {
    place: 'The Toll Bridge',
    bailey: 'march',
    line: 'Nothing crosses without paying. A rook stops a pawn if your king comes in time.',
    lore: null,
  },
  'strong-square': {
    place: 'The Hill Fort',
    bailey: 'march',
    line: 'Hold the square no pawn can ever reach, and defend what they come for.',
    lore: null,
  },
  'rook-endings': {
    place: 'The Signal Tower',
    bailey: 'march',
    line: 'Rook endings are the most common of all. Learn their signals, and when to light the attack.',
    lore: null,
  },
  'open-file': {
    place: 'The Frontier Gate',
    bailey: 'march',
    line: 'Hold the open road through the gate, and know when the night ends level.',
    lore: null,
  },
  'king-in-the-middle': {
    place: 'The Pele Tower',
    bailey: 'march',
    line: 'A king left in the middle is a tower with the door open. Open the lines to him.',
    lore: null,
  },
  'wrong-bishop': {
    place: 'The Beacon',
    bailey: 'march',
    line: 'Some light shines on the wrong squares. Know which bishop can win, and which never will.',
    lore: null,
  },
  zugzwang: {
    place: 'The Last Tower',
    bailey: 'march',
    line: 'At the last tower, sometimes the only thing they can do is make things worse.',
    lore: null,
  },
  // Part IV, the Citadel: Step 6, a castle of one's own.
  'citadel-gate': {
    place: 'The Citadel Gate',
    bailey: 'citadel',
    line: 'This castle is yours to keep. Start at its gate: the king in the middle, the passed pawn, a plan.',
    lore: null,
  },
  'citadel-walls': {
    place: 'The Citadel Walls',
    bailey: 'citadel',
    line: 'Walk your own walls: room for every piece, a draw held when it must be, and a sound opening.',
    lore: null,
  },
  'citadel-hall': {
    place: 'The Citadel Hall',
    bailey: 'citadel',
    line: 'In your own hall, tactics one move deeper, and the old question: bishop or knight?',
    lore: null,
  },
  'castellans-tower': {
    place: 'The Castellan’s Tower',
    bailey: 'citadel',
    line: 'The last watch: attack, defend, and carry an advantage home. The castle is yours.',
    lore: null,
  },
};

/** The castle ward a post stands in, by its key (the keep beyond them all). */
export function postBailey(key: string): Bailey {
  if (key === 'keep') return 'keep';
  return POST_COPY[key]?.bailey ?? 'outer';
}

/** The rank ladder: a castle after every third post, and Castellan after the
 * last. `PAGE` comes with the first watch. Keys and names are the server's (backend watch.RANKS); `post` is the
 * post whose clearing reaches the rank, null for Page (the first watch) and
 * for Castellan (the last post, however many there are). */
type Rank = { key: string; name: string; post: number | null };
const PAGE: Rank = { key: 'page', name: 'Page', post: null };
const CASTELLAN: Rank = { key: 'castellan', name: 'Castellan', post: null };
export const POST_RANKS: readonly Rank[] = [
  PAGE,
  { key: 'squire-1', name: 'Squire I', post: 3 },
  { key: 'squire-2', name: 'Squire II', post: 6 },
  { key: 'squire-3', name: 'Squire III', post: 9 },
  { key: 'knight-1', name: 'Knight I', post: 12 },
  { key: 'knight-2', name: 'Knight II', post: 15 },
  { key: 'knight-3', name: 'Knight III', post: 18 },
  { key: 'banneret-1', name: 'Knight Banneret I', post: 21 },
  { key: 'banneret-2', name: 'Knight Banneret II', post: 24 },
  { key: 'banneret-3', name: 'Knight Banneret III', post: 27 },
  { key: 'captain-1', name: 'Captain of the Watch I', post: 30 },
  { key: 'captain-2', name: 'Captain of the Watch II', post: 33 },
  { key: 'captain-3', name: 'Captain of the Watch III', post: 36 },
  { key: 'warden-1', name: 'Warden of the March I', post: 39 },
  { key: 'warden-2', name: 'Warden of the March II', post: 42 },
  { key: 'warden-3', name: 'Warden of the March III', post: 45 },
  CASTELLAN,
];

/** The rank a post belongs to, by its 1-based index: the next castle at or
 * after it (Castellan for the posts after the last ladder castle). */
export const rankOfPost = (index: number): Rank =>
  POST_RANKS.find((r) => r.post !== null && r.post >= index) ?? CASTELLAN;

/** A post's words: its place (or its plain topic for a key the app doesn't
 * know), the ward it stands in, the knight's line and its note. */
export function postCopy(ward: { key: string; name: string; index: number }) {
  const copy = POST_COPY[ward.key];
  const bailey: Bailey =
    copy?.bailey ??
    (ward.index <= 6
      ? 'outer'
      : ward.index <= 12
        ? 'middle'
        : ward.index <= 18
          ? 'inner'
          : ward.index <= 32
            ? 'keep'
            : ward.index <= 43
              ? 'march'
              : 'citadel');
  return {
    place: copy?.place ?? ward.name,
    topic: ward.name,
    bailey,
    baileyName: BAILEY_NAMES[bailey],
    line: copy?.line ?? null,
    lore: copy?.lore ?? null,
  };
}
