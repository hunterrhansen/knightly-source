import { Chess } from 'chess.js';
import { Profiler, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import {
  type BoardProps,
  Chessboard,
  createTransition,
  type Transition,
} from '../../chess/board';
import { applyMove, moveFromUci } from '../../chess/move';
import { createStyles } from '../../theme/theme';
import { Button } from '../../ui';

// Development-only board benchmark: replays positions through the real
// Chessboard and measures UI-thread frames, JS-thread frames and React commits.
// Dev builds are slower than release; compare runs, not absolute numbers.

// The Opera Game, 33 plies.
const SAN =
  'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(
    ' ',
  );
type Ply = { fen: string; uci: string };
function gamePlies() {
  const chess = new Chess();
  const out: Ply[] = [{ fen: chess.fen(), uci: '' }];
  for (const san of SAN) {
    const m = chess.move(san);
    out.push({ fen: chess.fen(), uci: m.lan });
  }
  return out;
}
type Scenario = 'replay' | 'morph' | 'jump';
const STEP_MS: Record<Scenario, number> = {
  replay: 300,
  morph: 500,
  jump: 500,
};
const JUMPS = [0, 12, 24, 33, 6, 18, 30, 0, 20, 33];
const SLOW = 1000 / 60 + 8; // a frame noticeably late at 60 Hz

type Stats = {
  frames: number;
  mean: number;
  max: number;
  slow: number;
  janky: number;
};
const summary = (
  count: number,
  sum: number,
  max: number,
  slow: number,
  janky: number,
): Stats => ({
  frames: count,
  mean: count ? sum / count : 0,
  max,
  slow,
  janky,
});

export function BoardBenchDemo() {
  const styles = useStyles();
  const plies = useMemo(gamePlies, []);
  const [board, setBoard] = useState<{
    id: string;
    fen: string;
    transition?: Transition;
    lastUci?: string;
  }>({
    id: 'bench-0',
    fen: plies[0]?.fen ?? '',
  });
  const [running, setRunning] = useState<Scenario>();
  const [results, setResults] = useState<string[]>([]);

  // UI thread: Reanimated frame callback, accumulated in shared values.
  const ui = useSharedValue({ count: 0, sum: 0, max: 0, slow: 0, janky: 0 });
  const frames = useFrameCallback((frame) => {
    'worklet';
    const dt = frame.timeSincePreviousFrame;
    if (dt == null) return;
    ui.modify((s) => {
      'worklet';
      s.count += 1;
      s.sum += dt;
      s.max = Math.max(s.max, dt);
      if (dt > SLOW) s.slow += 1;
      if (dt > 50) s.janky += 1;
      return s;
    });
  }, false);
  // JS thread: requestAnimationFrame deltas.
  const js = useRef({
    count: 0,
    sum: 0,
    max: 0,
    slow: 0,
    janky: 0,
    last: 0,
    on: false,
  });
  const commits = useRef({ count: 0, sum: 0, max: 0 });

  const jsLoop = (t: number) => {
    const s = js.current;
    if (!s.on) return;
    if (s.last) {
      const dt = t - s.last;
      s.count += 1;
      s.sum += dt;
      s.max = Math.max(s.max, dt);
      if (dt > SLOW) s.slow += 1;
      if (dt > 50) s.janky += 1;
    }
    s.last = t;
    requestAnimationFrame(jsLoop);
  };

  const run = (scenario: Scenario) => {
    if (running) return;
    setRunning(scenario);
    setBoard({ id: `${scenario}-start`, fen: plies[0]?.fen ?? '' });
    const steps =
      scenario === 'replay' ? plies.slice(1).map((_, i) => i + 1) : JUMPS;
    let i = 0;
    const start = () => {
      ui.value = { count: 0, sum: 0, max: 0, slow: 0, janky: 0 };
      js.current = {
        count: 0,
        sum: 0,
        max: 0,
        slow: 0,
        janky: 0,
        last: 0,
        on: true,
      };
      commits.current = { count: 0, sum: 0, max: 0 };
      frames.setActive(true);
      requestAnimationFrame(jsLoop);
      tick();
    };
    const tick = () => {
      const index = steps[i];
      i += 1;
      if (index === undefined) {
        setTimeout(finish, 600);
        return;
      }
      const ply = plies[index];
      if (!ply) return;
      const id = `${scenario}-${i}`;
      const before = plies[index - 1];
      let transition: Transition | undefined;
      if (scenario === 'replay' && before && ply.uci)
        transition = createTransition(
          { id, positionId: id, reason: 'replay' },
          applyMove(before.fen, moveFromUci(ply.uci)),
        );
      else if (scenario === 'morph')
        transition = createTransition({ id, positionId: id, reason: 'morph' });
      else
        transition = createTransition({
          id,
          positionId: id,
          reason: 'navigation',
        });
      setBoard({ id, fen: ply.fen, transition, lastUci: ply.uci || undefined });
      setTimeout(tick, STEP_MS[scenario]);
    };
    const finish = () => {
      frames.setActive(false);
      js.current.on = false;
      const u = ui.value;
      const j = js.current;
      const c = commits.current;
      const uiStats = summary(u.count, u.sum, u.max, u.slow, u.janky);
      const jsStats = summary(j.count, j.sum, j.max, j.slow, j.janky);
      const line = `${scenario}: UI ${uiStats.frames}f mean ${uiStats.mean.toFixed(1)}ms max ${uiStats.max.toFixed(0)}ms slow ${uiStats.slow} janky ${uiStats.janky} | JS ${jsStats.frames}f mean ${jsStats.mean.toFixed(1)}ms max ${jsStats.max.toFixed(0)}ms slow ${jsStats.slow} janky ${jsStats.janky} | commits ${c.count} mean ${(c.count ? c.sum / c.count : 0).toFixed(1)}ms max ${c.max.toFixed(1)}ms`;
      console.log(
        `[board-bench] ${JSON.stringify({ scenario, ui: uiStats, js: jsStats, commits: { count: c.count, mean: c.count ? c.sum / c.count : 0, max: c.max } })}`,
      );
      setResults((r) => [line, ...r].slice(0, 9));
      setRunning(undefined);
    };
    setTimeout(start, 400);
  };

  const last = board.lastUci ? moveFromUci(board.lastUci) : undefined;
  const props: BoardProps = {
    position: { id: board.id, fen: board.fen },
    orientation: 'w',
    policy: { mode: 'read-only' },
    presentation: {
      showDestinations: false,
      highlights: [],
      arrows: [],
      ...(board.transition ? { transition: board.transition } : {}),
      ...(last ? { lastMove: { from: last.from, to: last.to } } : {}),
    },
    onAttempt: () => {},
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        {(['replay', 'morph', 'jump'] as const).map((s) => (
          <Button key={s} disabled={!!running} onPress={() => run(s)}>
            {running === s ? 'Running…' : `Bench ${s}`}
          </Button>
        ))}
      </View>
      <Profiler
        id="board"
        onRender={(_id, _phase, actual) => {
          const c = commits.current;
          c.count += 1;
          c.sum += actual;
          c.max = Math.max(c.max, actual);
        }}
      >
        <View style={styles.board}>
          <Chessboard {...props} />
        </View>
      </Profiler>
      {results.map((r) => (
        <Text key={r} style={styles.result} selectable>
          {r}
        </Text>
      ))}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  wrap: { gap: theme.spacing.md },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  board: { width: '100%', maxWidth: 480, aspectRatio: 1 },
  result: {
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: 12,
  },
}));
