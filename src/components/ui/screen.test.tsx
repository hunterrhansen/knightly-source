import { fireEvent, render } from '@testing-library/react-native';
import { ScrollView, Text, View } from 'react-native';
import { Screen } from './screen';

test('auto scrolling keeps overflowing content reachable after content and viewport changes', () => {
  const view = render(
    <Screen preset="auto">
      <Text>Last action</Text>
    </Screen>,
  );
  const scroll = view.UNSAFE_getByType(ScrollView);
  const content = scroll
    .findAllByType(View)
    .filter((node) => node.props.onLayout)
    .at(-1);
  if (!content) throw new Error('Screen content measurement view missing');
  const layout = (height: number) => ({
    nativeEvent: { layout: { x: 0, y: 0, width: 320, height } },
  });

  fireEvent(scroll, 'layout', layout(600));
  fireEvent(content, 'layout', layout(200));
  expect(scroll.props.scrollEnabled).toBe(false);
  fireEvent(content, 'layout', layout(900));
  expect(scroll.props.scrollEnabled).toBe(true);
  fireEvent(content, 'layout', layout(500));
  expect(scroll.props.scrollEnabled).toBe(false);
  fireEvent(scroll, 'layout', layout(300));
  expect(scroll.props.scrollEnabled).toBe(true);
  expect(view.getByText('Last action')).toBeTruthy();
});
