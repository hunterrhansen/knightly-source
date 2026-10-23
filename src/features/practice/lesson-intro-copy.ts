/** Each lesson's intro in the knight's words (issue #326): the line he speaks
 * at the post, and what to look for on the learner's first try. Approved copy;
 * the aims follow the Steps Method's lessons, the words are Knightly's own.
 * Keyed by the backend's lesson keys (curriculum.WARDS). */
export type IntroCopy = { line: string; look: string };

const COPY: Record<string, IntroCopy> = {
  'board-vision': {
    line: 'Every watch starts here. Before you move: what can their pieces reach, and what of yours is left unguarded?',
    look: 'Find the piece they left unguarded.',
  },
  'attack-defend': {
    line: 'A raider’s threat has four answers: take it, step away, guard, or block. Choose the one that costs you nothing.',
    look: 'Which of the four answers works here?',
  },
  exchange: {
    line: 'Trade only when you come out ahead: a knight for a rook is a good night’s work, a queen for a knight is not.',
    look: 'Take where you win more than you give.',
  },
  'mate-in-one': {
    line: 'One pull of the chain and the gate is shut. Look at every check you have: which leaves the king nowhere to go?',
    look: 'Try each check. Which leaves no escape?',
  },
  'creating-mate': {
    line: 'A queen alone can’t close the gate. Drive their king to the edge, then let your king guard its last squares.',
    look: 'Bring your king to guard the escape squares.',
  },
  'winning-material': {
    line: 'Count before you take: more attackers than defenders and the piece is yours; fewer, and the raid goes wrong.',
    look: 'Count attackers and defenders, then take.',
  },
  activity: {
    line: 'A piece is worth what it can reach. A knight in the centre watches eight squares, in the corner two. Wake your idlest piece.',
    look: 'Give your quietest piece more squares.',
  },
  'double-attack': {
    line: 'One move, two threats. They can answer only one, so the other is yours.',
    look: 'Find a move that hits two things at once.',
  },
  'double-attack-king': {
    line: 'Not only the queen: a knight, a pawn, even your king can strike two targets at once.',
    look: 'Which piece can hit two targets?',
  },
  'mate-in-two': {
    line: 'Some mates take two steps up the stair: a check that drives the king, or a quiet move that takes its last square. Watch their back rank too.',
    look: 'Look for the forcing first move.',
  },
  'mating-rook': {
    line: 'A rook shuts the king out rank by rank. Box it in, then bring your king to finish.',
    look: 'Shrink the box, then bring your king.',
  },
  pin: {
    line: 'A pinned piece can’t move without exposing something worth more behind it. Pin it, then strike again.',
    look: 'Line up on a piece with something bigger behind.',
  },
  'golden-rules': {
    line: 'Three rules for the first moves of every night: a pawn to the centre, pieces out, and the king behind the walls.',
    look: 'Which move follows all three?',
  },
  'eliminating-defence': {
    line: 'When one guard holds the post, deal with that guard: take it, chase it, or draw it away.',
    look: 'Find the one piece doing the guarding.',
  },
  'opening-principles': {
    line: 'Every opening move should bring a piece out, ideally with a threat. Keep the queen in the keep, and watch the weak square by your king.',
    look: 'Which square by their king is weak?',
  },
  'discovered-attack': {
    line: 'Step one piece aside and the one behind it strikes. The piece that moved can threaten something too.',
    look: 'Which of your pieces is blocking another?',
  },
  'defending-mate': {
    line: 'When they threaten mate, stop it first: take the attacker, guard the square, step away, or block. Everything else can wait.',
    look: 'What’s their threat, and how do you stop it?',
  },
  stalemate: {
    line: 'No legal move and no check is a draw. When you’re winning, leave the king a square. When you’re losing, look for it.',
    look: 'Mate them, and leave no stalemate.',
  },
  intermezzo: {
    line: 'Before you take back, look for something stronger in between: a check or a bigger threat they must answer first.',
    look: 'Is there a check before the recapture?',
  },
  'thinking-ahead': {
    line: 'Picture the board after each move without moving a piece: where does everything stand, and what can they do?',
    look: 'What does the board look like after their reply?',
  },
  'pawn-endings': {
    line: 'With only kings and pawns, your king is a fighter. Bring it forward and take the opposition: kings face to face, one square apart.',
    look: 'Put your king opposite theirs.',
  },
  'passed-pawn': {
    line: 'A passed pawn has nothing in its way. Get in front of it, your king if you can, before it runs.',
    look: 'Get in front of the pawn.',
  },
  'discovered-check': {
    line: 'Step a piece off the line to uncover check from the one behind. The piece that moved can take whatever it likes.',
    look: 'Which piece can step off the line with a threat?',
  },
  'double-check': {
    line: 'Two checks at once: nothing can block or take both, so the king itself must move.',
    look: 'Find the move that checks twice.',
  },
  'attacking-pinned': {
    line: 'A pinned piece is held in the stocks: it can’t run. Attack it once more, with a pawn if you can.',
    look: 'Hit the pinned piece again.',
  },
  'defending-pin': {
    line: 'Caught in a pin? Block the line, take the pinner, step away with the piece behind, or strike back elsewhere.',
    look: 'How do you get out of the pin?',
  },
  'x-ray': {
    line: 'A piece’s watch passes through an enemy in its way: once that piece is gone, it’s guarding what lies behind.',
    look: 'Look through the piece in the way.',
  },
  skewer: {
    line: 'Strike a big piece with a smaller one lined up behind it. When the big one steps aside, take what was behind.',
    look: 'Find the line with two targets on it.',
  },
  'square-of-pawn': {
    line: 'Draw a square from the pawn to its last rank. If the king can step inside it, the pawn is caught.',
    look: 'Can the king reach the square?',
  },
  promotion: {
    line: 'Push when nothing can stop it, clear the way when something can, and pick the right piece at the end.',
    look: 'Is the way to the last rank clear?',
  },
  'key-squares': {
    line: 'Each pawn has key squares two ranks ahead. Get your king onto one and the pawn will queen.',
    look: 'Head for the key square.',
  },
  'mating-nets': {
    line: 'Open the king’s shelter by a capture, a lure, or a quiet move, then finish with a shape you know.',
    look: 'Which pawn is in the way, and which pattern finishes?',
  },
  threats: {
    line: 'After every move they make, ask what they want. Which of your pieces or squares is weak? Then stop it.',
    look: 'What did their last move threaten?',
  },
  trapping: {
    line: 'A falcon with no room to fly is caught. Take away a piece’s squares, then attack it.',
    look: 'Which of their pieces has nowhere to go?',
  },
  mobility: {
    line: 'Take away their pieces’ squares and they can’t take part in the night’s work.',
    look: 'Which move leaves their piece fewest squares?',
  },
  luring: {
    line: 'Court tricks: draw a piece onto the square where your fork or pin is waiting.',
    look: 'Which square would set up your fork or pin?',
  },
  interfering: {
    line: 'Step between a guard and what it guards, and the protection is gone.',
    look: 'Which line can you cut?',
  },
  deflection: {
    line: 'Pull a guard away from its post, and what it was guarding falls.',
    look: 'What is their defender guarding?',
  },
  clearing: {
    line: 'Sometimes your own piece blocks the way. Move it, even as a sacrifice, to open the line.',
    look: 'Which of your pieces is in the way?',
  },
};

/** A lesson's intro words; a lesson the app does not know yet gets plain ones. */
export function introCopy(key: string, name: string): IntroCopy {
  return (
    COPY[key] ?? {
      line: `Tonight’s new lesson: ${name}. Watch it once from the wall, then try it.`,
      look: 'Find the best move.',
    }
  );
}
