// The story copy for the curriculum's posts (docs/specs/2026-10-20-ward-path-design.md,
// "The eighteen posts" and "The lore"). The server sends each post's key and
// its plain topic; the place, the ward it stands in, the knight's line and its
// note from the old books are the app's, keyed by that key. A key the app
// doesn't know still renders, by its plain topic.

/** The castle's three wards, walked from the gate inward, then the keep. */
type Bailey = 'outer' | 'middle' | 'inner' | 'keep';

const BAILEY_NAMES: Record<Bailey, string> = {
  outer: 'Outer Ward',
  middle: 'Middle Ward',
  inner: 'Inner Ward',
  keep: 'The Keep',
};

type PostCopy = {
  place: string;
  bailey: Bailey;
  /** The knight introduces the post in one line, through the place. */
  line: string;
  /** One short note of real history (or labelled legend), each sourced in the
   * spec's "From the old books". */
  lore: string;
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
};

/** The castle ward a post stands in, by its key (the keep beyond them all). */
export function postBailey(key: string): Bailey {
  if (key === 'keep') return 'keep';
  return POST_COPY[key]?.bailey ?? 'outer';
}

/** A rank castle stands after every third post; the keep after the last. The
 * keys are the server's rank keys (backend watch.RANKS). */
export const POSTS_PER_RANK = 3;
export const POST_RANKS = [
  { key: 'page', name: 'Page' },
  { key: 'squire-1', name: 'Squire I' },
  { key: 'squire-2', name: 'Squire II' },
  { key: 'squire-3', name: 'Squire III' },
  { key: 'knight-1', name: 'Knight I' },
  { key: 'knight-2', name: 'Knight II' },
  { key: 'knight-3', name: 'Knight III' },
] as const;

/** The rank a post belongs to, by its 1-based index. */
export const rankOfPost = (index: number) =>
  POST_RANKS[
    Math.min(POST_RANKS.length - 2, Math.floor((index - 1) / POSTS_PER_RANK))
  ] ?? POST_RANKS[0];

/** A post's words: its place (or its plain topic for a key the app doesn't
 * know), the ward it stands in, the knight's line and its note. */
export function postCopy(ward: { key: string; name: string; index: number }) {
  const copy = POST_COPY[ward.key];
  const bailey: Bailey =
    copy?.bailey ??
    (ward.index <= 6 ? 'outer' : ward.index <= 12 ? 'middle' : 'inner');
  return {
    place: copy?.place ?? ward.name,
    topic: ward.name,
    bailey,
    baileyName: BAILEY_NAMES[bailey],
    line: copy?.line ?? null,
    lore: copy?.lore ?? null,
  };
}
