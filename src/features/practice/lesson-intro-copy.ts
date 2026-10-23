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
    look: 'Mate without stalemate, or find the stalemate that saves you.',
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
  // Beyond the Keep: Steps 3 to 6, each from its Steps lesson's aim.
  'defending-double-attack': {
    line: 'Two threats at once? Look for the one move that answers both: guard one while saving the other, or strike back with check.',
    look: 'Which move saves both?',
  },
  'draw-3': {
    line: 'When the night is lost, look for the draw: stalemate, too little material to mate, or a check they can never escape.',
    look: 'Is there a way to draw?',
  },
  'mini-plan': {
    line: 'No tactic tonight? Make a small plan: aim at their weakest point, improve your worst piece, or fix their pawns.',
    look: 'What small plan helps most?',
  },
  'rook-pawn': {
    line: 'A rook pawn is the weakest: the corner lets the defending king hold on. Know when it still wins.',
    look: 'Can their king reach the corner?',
  },
  'vulnerability-opening': {
    line: 'Early in the game, pieces are often left loose and the king is unguarded. Look for what they’ve neglected.',
    look: 'What did they leave unguarded?',
  },
  underpromotion: {
    line: 'A queen isn’t always best. When it stalemates or misses a check, a knight or rook can win instead.',
    look: 'Which piece should the pawn become?',
  },
  development: {
    line: 'Bring every piece out, each to a good square, before any piece moves twice.',
    look: 'Which piece is still asleep?',
  },
  pinning: {
    line: 'Pin a piece to something bigger, and pin it again from another line if you can.',
    look: 'Which piece can you pin?',
  },
  'opening-advantage': {
    line: 'A lead in development is worth using before it fades: open lines while their pieces sleep.',
    look: 'How do you use your lead?',
  },
  blocking: {
    line: 'Make their own pieces block their king’s escape squares, then mate.',
    look: 'Which square can you make them block?',
  },
  'pin-luring': {
    line: 'Lure a piece onto the line where a pin is waiting.',
    look: 'Which piece can you draw into the pin?',
  },
  'passed-pawn-4': {
    line: 'A passed pawn wants to run. Push yours with support, and stop theirs before it’s too late.',
    look: 'Push, or stop theirs first?',
  },
  'eliminating-double-attack': {
    line: 'When a defender spoils your double attack, take it, chase it or lure it away first.',
    look: 'Which defender spoils the fork?',
  },
  magnet: {
    line: 'Sacrifice to drag the king out of his shelter, onto a square where mate is waiting.',
    look: 'Where can you drag the king?',
  },
  'weak-pawns': {
    line: 'Isolated, doubled and backward pawns are weak. Aim your pieces at them and keep yours healthy.',
    look: 'Which of their pawns is weakest?',
  },
  'material-advantage': {
    line: 'Ahead in material? Trade pieces, not pawns, and the win comes nearer.',
    look: 'Which trade brings the win closer?',
  },
  'chasing-targeting': {
    line: 'Chase a piece onto the square where your fork is waiting, or aim at the square it must go to.',
    look: 'Where can you chase it?',
  },
  'king-attack-4': {
    line: 'Attack a castled king with pieces working together: rook and bishop, rook and knight, knight and bishop.',
    look: 'Which pieces can join the attack?',
  },
  'seventh-rank-4': {
    line: 'A rook on the seventh rank attacks pawns and pens the king in.',
    look: 'Can your rook reach the seventh?',
  },
  'endgame-strategy': {
    line: 'In the endgame the king fights, an outside passed pawn wins, and the opposition decides.',
    look: 'Which rule decides this ending?',
  },
  'queen-against-pawn': {
    line: 'A queen beats a pawn on the seventh by checking the king in front of it, except some rook and bishop pawns that draw.',
    look: 'Can you get your king closer with check?',
  },
  'attacking-king-4p': {
    line: 'Attack the king with more pieces than he has defenders, and open the lines to him.',
    look: 'How do you open the king?',
  },
  'opening-traps': {
    line: 'Some opening traps are old as the castle. Know them, so you set them and never fall in.',
    look: 'What trap is set here?',
  },
  'interference-4p': {
    line: 'Put a piece between a defender and what it guards.',
    look: 'Which line can you cut?',
  },
  'blocking-4p': {
    line: 'Make their pieces crowd their own king, then mate.',
    look: 'Which square can you make them block?',
  },
  'draws-4p': {
    line: 'Stalemate, a perpetual check, or too little to mate: a lost game can still be held.',
    look: 'How do you save the game?',
  },
  'mini-plans-4p': {
    line: 'Raise your activity, find their weakness, open the position when you’re better.',
    look: 'What small plan helps most?',
  },
  'pawn-endings-4p': {
    line: 'Pawn endings are counted, not guessed: the opposition, spare tempi and the right moment to push.',
    look: 'Count it before you move.',
  },
  batteries: {
    line: 'Line up a battery, then move the front piece with a threat of its own.',
    look: 'How do you set up the battery?',
  },
  'endgame-technique': {
    line: 'Winning endings follow rules: activate the king, cut the enemy king off, and push the passed pawn.',
    look: 'Which rule wins this ending?',
  },
  'chess-problems': {
    line: 'Composed puzzles, mate in two: a quiet first move sets the trap.',
    look: 'Look for the quiet first move.',
  },
  'material-and-time': {
    line: 'Material isn’t everything. A pawn behind can be worth it for a lead in time and activity.',
    look: 'Is the material worth the time?',
  },
  'mate-5': {
    line: 'Mates in two and three: picture every check and every reply before you start.',
    look: 'What is the first forcing move?',
  },
  breakthrough: {
    line: 'Pawns facing each other can break through with a sacrifice, and one pawn runs home.',
    look: 'Which pawn breaks through?',
  },
  'using-pawns': {
    line: 'Pawns hold squares, open lines and make passed pawns. Each pawn move should do one of these.',
    look: 'What should this pawn do?',
  },
  'pawn-race': {
    line: 'When both sides push, count who queens first, and whether the new queen gives check.',
    look: 'Who queens first?',
  },
  'seventh-rank-5': {
    line: 'Two rooks on the seventh rank can mate or sweep up pawns.',
    look: 'How do your rooks use the seventh?',
  },
  'discovered-attack-5': {
    line: 'Make the discovery: clear the line, remove a defender, or build the battery.',
    look: 'What stands in the battery’s way?',
  },
  'pin-5': {
    line: 'Win with the pin: clear its line, aim at the target, then attack the pinned piece.',
    look: 'How do you win the pinned piece?',
  },
  'opening-5': {
    line: 'Choose the opening move that develops, fights for the centre, and keeps your king safe.',
    look: 'Which move does the most?',
  },
  'rook-against-pawn': {
    line: 'A rook stops a pawn when its king can help; cut the enemy king off and count the tempi.',
    look: 'Can you cut their king off?',
  },
  'strong-square': {
    line: 'A strong square can never be attacked by an enemy pawn. Put a knight there.',
    look: 'Which square can no pawn reach?',
  },
  'defending-5': {
    line: 'Defend first: the threat of mate, the passed pawn, the attack on your king.',
    look: 'What is their threat?',
  },
  'rook-endings': {
    line: 'Rook endings follow known plans: build a bridge, cut the king off, keep your rook behind the pawn.',
    look: 'Which plan wins here?',
  },
  'king-attack-5': {
    line: 'Attack the castled king, often with a sacrifice to tear the cover away.',
    look: 'Which sacrifice opens the king?',
  },
  'open-file': {
    line: 'An open file is a road for rooks. Take it first, then use it to get in.',
    look: 'Which file should your rook take?',
  },
  'draw-5': {
    line: 'Stalemate, too little material, the wrong bishop: know the draws so you can find them, or avoid them.',
    look: 'Which move holds the draw?',
  },
  'activity-5p': {
    line: 'Make your pieces active and open the position for them.',
    look: 'Which piece needs more room?',
  },
  'pawn-endings-5p': {
    line: 'Tempo moves decide pawn endings: the side that runs out of good moves loses.',
    look: 'Who runs out of moves first?',
  },
  'king-in-middle-5p': {
    line: 'A king left in the middle is a target. Open the centre before he escapes.',
    look: 'How do you open the centre?',
  },
  'wrong-bishop': {
    line: 'A bishop that can’t cover the queening corner draws with a rook pawn. Know which bishop wins.',
    look: 'Does the bishop cover the corner?',
  },
  'vulnerability-5p': {
    line: 'Look for what’s weak, but check whether grabbing it is really winning.',
    look: 'Is the pawn really free?',
  },
  'queen-endings': {
    line: 'In queen endings, keep checking or shield your king; the passed pawn decides.',
    look: 'Can their checks run out?',
  },
  'defending-5p': {
    line: 'Defend calmly against threats, passed pawns and attacks on your king.',
    look: 'What is their threat?',
  },
  'eternal-pins': {
    line: 'Keep a pin going without rushing; it can hold a whole position. And know how to break one.',
    look: 'How do you keep the pin?',
  },
  'bishop-against-pawns': {
    line: 'A bishop stops pawns from a distance, on the squares in front of them.',
    look: 'Which square stops both pawns?',
  },
  zugzwang: {
    line: 'Sometimes any move makes things worse. Give them the move when they can only spoil their position.',
    look: 'Can you pass the move to them?',
  },
  'king-in-middle-6': {
    line: 'Punish a king still in the centre: open lines, even at the cost of material.',
    look: 'How do you open the centre?',
  },
  'passed-pawn-6': {
    line: 'Make a passed pawn, push it with support, and stop theirs with a blockade.',
    look: 'How do you make a passed pawn?',
  },
  strategy: {
    line: 'Plans come from the pawn structure: where to attack, where to put your pieces.',
    look: 'What does the pawn structure tell you?',
  },
  'mobility-6': {
    line: 'Give your pieces room, and take room away from theirs.',
    look: 'Which move restricts them most?',
  },
  'draw-6': {
    line: 'Fortresses, perpetuals and stalemates: the best defence can still end level.',
    look: 'Which move holds the draw?',
  },
  'opening-6': {
    line: 'Play the opening by its principles, not by memory: develop, the centre, king safety.',
    look: 'Which move does the most?',
  },
  'tactics-6': {
    line: 'Combinations one move deeper: lure, deflect and sacrifice together.',
    look: 'What is the first move of the combination?',
  },
  'pawn-ending-6': {
    line: 'Hard pawn endings and studies: count, and look for the surprising tempo.',
    look: 'Count it before you move.',
  },
  'bishop-or-knight': {
    line: 'A knight loves closed positions and outposts; a bishop wants open lines. Choose which to keep.',
    look: 'Which minor piece belongs here?',
  },
  'kings-attack-6': {
    line: 'Lead an attack on the king to mate, three moves deep.',
    look: 'What starts the attack?',
  },
  'advantage-ending': {
    line: 'Turn an endgame advantage into a win: improve slowly, give nothing away.',
    look: 'What improves your position most?',
  },
  bishops: {
    line: 'Good bishop, bad bishop: pawns on its colour block it. The bishop pair rules open positions.',
    look: 'Is this bishop good or bad?',
  },
  'defending-6': {
    line: 'Find the defensive resources: the counter-attack, the fortress, the only move.',
    look: 'What is their threat, and your resource?',
  },
  'rook-endgame-6': {
    line: 'Theoretical rook endings: Lucena to win, Philidor to draw.',
    look: 'Which known position is this?',
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
