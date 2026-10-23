import { raidOf } from './practice-raid';
import type { PracticeSession } from './practice-session';

type Exercise = NonNullable<
  ReturnType<PracticeSession['getSnapshot']>['exercise']
>;

// A card from the learner's game: white to move, Nf7+ Rxf7 Qxf7 wins the
// rook that threatened Rf2 (the raid captain).
const fen = 'r4r1k/6pp/8/6N1/2Q5/8/6PP/6K1 w - - 1 16';
const line = ['g5f7', 'f8f7', 'c4f7'];

function card(over: Partial<Exercise> = {}, item: object = {}): Exercise {
  return {
    item: {
      kind: 'card',
      game_id: 4,
      ply: 31,
      fen_before: fen,
      color: 'white',
      opponent: 'kd_88',
      line,
      threat: {
        threats: [
          { uci: 'f8f2', san: 'Rf2', line: ['f8f2'], net: 1, mate: null },
        ],
      },
      ...item,
    },
    played: [],
    fen,
    positionId: 'p1',
    entered: true,
    hinted: false,
    hintLevel: 0,
    thought: 0,
    since: 0,
    ...over,
  } as unknown as Exercise;
}

const ids = (raid: ReturnType<typeof raidOf>) =>
  raid?.raiders.map((r) => `${r.kind}@${r.id}${r.out ? ' out' : ''}`).sort();

describe('the raiders at the treeline', () => {
  it('are the opponent’s pieces, over their files as the board shows them', () => {
    const white = raidOf(card(), 'ready', 'w');
    expect(ids(white)).toEqual(['k@h8', 'p@g7', 'p@h7', 'r@a8', 'r@f8']);
    const rook = (raid: typeof white) =>
      raid?.raiders.find((r) => r.id === 'a8');
    // The a-file is on the left with white at the bottom, the right with black.
    expect(rook(white)).toMatchObject({ file: 0, depth: 0 });
    expect(rook(raidOf(card(), 'ready', 'b'))).toMatchObject({
      file: 7,
      depth: 7,
    });
  });

  it('knocks out the piece the learner captures and follows the opponent’s moves', () => {
    // Nf7+ Rxf7: the rook that started on f8 now stands on f7, still in.
    const replied = raidOf(card({ played: ['g5f7', 'f8f7'] }), 'ready', 'w');
    expect(replied?.raiders.find((r) => r.id === 'f8')).toMatchObject({
      file: 5,
      depth: 1,
      out: false,
    });
    // Qxf7, a right move awaiting nothing more: that rook is out.
    const solved = raidOf(
      card({
        played: ['g5f7', 'f8f7'],
        quality: 'best',
        line: { uci: line, san: ['Nf7+', 'Rxf7', 'Qxf7'], fens: [] },
      }),
      'answered',
      'w',
    );
    expect(ids(solved)).toEqual(['k@h8', 'p@g7', 'p@h7', 'r@a8', 'r@f8 out']);
  });

  it('knocks nothing out after a wrong move, though the solution is known', () => {
    const missed = card({
      line: { uci: line, san: ['Nf7+', 'Rxf7', 'Qxf7'], fens: [] },
    });
    expect(raidOf(missed, 'wrong', 'w')?.raiders.some((r) => r.out)).toBe(
      false,
    );
    expect(raidOf(missed, 'ready', 'w')?.raiders.some((r) => r.out)).toBe(
      false,
    );
  });

  it('knocks a captured raider out as soon as the move is judged right', () => {
    const attempt = {
      from: 'c4',
      to: 'f7',
      attemptId: 'a',
      positionId: 'p',
      source: 'activation',
    } as const;
    const exercise = card({ played: ['g5f7', 'f8f7'], attempt });
    expect(
      raidOf(exercise, 'pending', 'w')?.raiders.find((r) => r.id === 'f8')?.out,
    ).toBe(false);
    expect(
      raidOf(exercise, 'replying', 'w')?.raiders.find((r) => r.id === 'f8')
        ?.out,
    ).toBe(true);
  });

  it('fall back on a right answer, edge in on a wrong one and wait again after a rewind', () => {
    expect(raidOf(card(), 'ready', 'w')?.mood).toBe('lurk');
    expect(raidOf(card(), 'replying', 'w')?.mood).toBe('fallBack');
    expect(raidOf(card({ quality: 'best' }), 'answered', 'w')?.mood).toBe(
      'fallBack',
    );
    expect(raidOf(card(), 'wrong', 'w')?.mood).toBe('edgeIn');
    expect(raidOf(card(), 'refuting', 'w')?.mood).toBe('edgeIn');
    // Try again rewinds the board: they wait at the treeline again.
    expect(raidOf(card(), 'ready', 'w')?.mood).toBe('lurk');
    // The solution shown is no right answer.
    expect(raidOf(card({ quality: 'shown' }), 'answered', 'w')?.mood).toBe(
      'lurk',
    );
    const threat = (correct: boolean) =>
      raidOf(
        card({ threat: { threats: [], answer: 'f8f2', correct } }),
        'threat-shown',
        'w',
      )?.mood;
    expect(threat(true)).toBe('fallBack');
    expect(threat(false)).toBe('edgeIn');
  });

  it('keeps the same raiders through the position’s moves', () => {
    expect(raidOf(card({ positionId: 'p2' }), 'ready', 'w')?.key).toBe(
      raidOf(card(), 'ready', 'w')?.key,
    );
  });
});

describe('the plaque', () => {
  it('names the piece whose move led here, never the threat’s piece', () => {
    // The threat starts from the rook on f8; the plaque names the king that
    // just moved (…Kh8 from g8), giving no hint of the answer.
    expect(raidOf(card({}, { prev_uci: 'g8h8' }), 'ready', 'w')?.named).toBe(
      'kd_88’s king',
    );
    expect(
      raidOf(card({}, { threat: null, prev_uci: 'g8h8' }), 'ready', 'w')?.named,
    ).toBe('kd_88’s king');
    expect(
      raidOf(
        card({}, { threat: null, prev_uci: 'g8h8', opponent: null }),
        'ready',
        'w',
      )?.named,
    ).toBe('Their king');
  });

  it('names nothing without a game’s move to name, even with a known threat', () => {
    expect(raidOf(card({}, { prev_uci: null }), 'ready', 'w')?.named).toBe(
      undefined,
    );
    const puzzle = card({}, { kind: 'puzzle', id: 'p1', threat: undefined });
    expect(raidOf(puzzle, 'ready', 'w')?.named).toBe(undefined);
  });
});

describe('the raid captain', () => {
  it('is the threatening piece on a multi-move line, one segment per learner move', () => {
    expect(raidOf(card(), 'ready', 'w')?.captain).toEqual({
      id: 'f8',
      name: 'kd_88’s rook',
      segments: 2,
      cracked: 0,
    });
  });

  it('takes a hit for each right move and none for a wrong one', () => {
    const cracked = (
      over: Partial<Exercise>,
      phase: Parameters<typeof raidOf>[1],
    ) => raidOf(card(over), phase, 'w')?.captain?.cracked;
    expect(cracked({ played: ['g5f7', 'f8f7'] }, 'ready')).toBe(1);
    // A wrong second move: the learner loses nothing and the captain keeps its hit.
    expect(cracked({ played: ['g5f7', 'f8f7'] }, 'wrong')).toBe(1);
    expect(cracked({ played: [] }, 'wrong')).toBe(0);
    expect(
      cracked({ played: ['g5f7', 'f8f7'], quality: 'best' }, 'answered'),
    ).toBe(2);
    // Shown the line after a miss: the shown moves land no hits.
    expect(
      cracked({ played: ['g5f7', 'f8f7'], quality: 'shown' }, 'answered'),
    ).toBe(1);
  });

  it('is absent when the threat is unknown or the line is one move', () => {
    expect(raidOf(card({}, { threat: null }), 'ready', 'w')?.captain).toBe(
      undefined,
    );
    expect(raidOf(card({}, { line: ['g5f7'] }), 'ready', 'w')?.captain).toBe(
      undefined,
    );
    const puzzle = card({}, { kind: 'puzzle', id: 'p1', threat: undefined });
    expect(raidOf(puzzle, 'ready', 'w')?.captain).toBe(undefined);
  });
});
