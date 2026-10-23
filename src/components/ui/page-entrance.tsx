import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
} from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { tokens } from '../../theme/tokens';

/**
 * A page arrives whole: the blocks there when it opens are simply shown (the
 * screen's own transition is the entrance; pages people return to often
 * shouldn't replay one). A block that appears later, such as a section
 * that loads, fades in place on the `settle` timing; nothing moves up or
 * down. Each block enters once, when it mounts; re-renders and data
 * refreshes leave it still. Reanimated skips layout animations under
 * reduced motion.
 *
 * Keep the stock FadeIn (no `withInitialValues`): on web a customised
 * entering animation becomes a keyframe whose cleanup pins the block
 * `position: absolute` at its first size, so a card that later grows (the
 * streak calendar's month, a section that loads) runs under the next one.
 *
 * Fragments are opened so each card enters on its own. Keys follow each
 * child's slot (empty conditionals included), so a block appearing above
 * another never remounts or replays the one below.
 */
export function PageEntrance({ children }: { children: ReactNode }) {
  const blocks: { key: string; node: ReactElement }[] = [];
  const collect = (nodes: ReactNode, path: string) => {
    Children.forEach(nodes, (node, index) => {
      if (!isValidElement(node)) return;
      const slot = `${path}${node.key ?? index}`;
      if (node.type === Fragment)
        collect((node.props as { children?: ReactNode }).children, `${slot}.`);
      else blocks.push({ key: slot, node });
    });
  };
  collect(children, '');
  const opened = useRef(false);
  useEffect(() => {
    opened.current = true;
  }, []);
  const entering = opened.current
    ? FadeIn.duration(tokens.motion.springs.settle.duration)
    : undefined;
  return blocks.map(({ key, node }) => (
    <Animated.View key={key} entering={entering}>
      {node}
    </Animated.View>
  ));
}
