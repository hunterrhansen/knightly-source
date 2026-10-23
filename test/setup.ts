import type {
  TextInputProps as MockExpoTextInputProps,
  PickerItemProps as MockPickerItemProps,
  PickerProps as MockPickerProps,
} from '@expo/ui';
import type {
  NativeSyntheticEvent as MockNativeEvent,
  TextInput as MockNativeTextInput,
  TextInputSubmitEditingEventData as MockSubmitEvent,
} from 'react-native';
import 'react-native-gesture-handler/jestSetup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Every test starts as a fresh installation. Individual relaunch tests keep
// storage between mounts within that test, just as the real app does.
beforeEach(async () => {
  await AsyncStorage.clear();
});

// The native bridge's default Jest stub resolves undefined; model its boolean contract.
jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

// expo-audio requires its native module at import; record playback instead.
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    isLoaded: true,
    currentTime: 0,
    play: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

// The board's Skia overlay draws on the display thread, which Jest cannot run;
// its taps, selection and travel logic (fast-board) still run here. What it
// draws needs a device check.
// The layered piece layer is a Skia canvas too. Its mock leaves one marker per
// piece it is given, so tests check which pieces the board hands it; how the
// atlas draws and moves them needs a device check.
jest.mock('../src/chess/board/layered/piece-layer', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  return {
    PieceLayer: ({
      pieces,
    }: {
      pieces: readonly { id: string; square: string }[];
    }) =>
      pieces.map((piece) =>
        createElement(View, {
          key: piece.id,
          testID: `visual-piece-${piece.square}`,
        }),
      ),
    layeredSupported: true,
  };
});
jest.mock('../src/chess/board/board-overlay', () => ({
  BoardOverlay: () => null,
  fastOverlaySupported: true,
}));

jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock'),
);

jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  const React = require('react');
  return {
    ...mock,
    useReducedMotion: () => false,
    // Reanimated's mock leaves out the CSS easing builder; a plain curve
    // object stands in, since Jest never runs CSS animations.
    cubicBezier: (x1: number, y1: number, x2: number, y2: number) => ({
      x1,
      y1,
      x2,
      y2,
    }),
    useSharedValue: (value: unknown) =>
      React.useRef(mock.useSharedValue(value)).current,
  };
});

// Universal Expo UI delegates to native views in Jest. Test shared controller
// behavior through RN hosts; real labels, menus and focus need runtime checks.
jest.mock('@expo/ui', () => {
  const React: typeof import('react') = require('react');
  const RN: typeof import('react-native') = require('react-native');
  const { useNativeState } = jest.requireActual(
    '../node_modules/@expo/ui/src/universal/State.ts',
  );
  const Picker = ({
    accessibilityLabel,
    selectedValue,
    onValueChange,
    enabled = true,
    children,
  }: MockPickerProps<string>) =>
    React.createElement(
      RN.View,
      {
        accessible: true,
        accessibilityRole: 'combobox',
        accessibilityLabel,
        accessibilityValue: { text: String(selectedValue) },
        accessibilityState: { disabled: !enabled },
        ...{ onValueChange },
      },
      children,
    );
  Picker.Item = ({ label }: MockPickerItemProps) =>
    React.createElement(RN.Text, null, label);
  return {
    useNativeState,
    Host: RN.View,
    Row: RN.View,
    Column: RN.View,
    Spacer: RN.View,
    Text: RN.Text,
    Picker,
    TextInput: React.forwardRef<
      MockNativeTextInput,
      Omit<MockExpoTextInputProps, 'ref'>
    >(
      (
        {
          value,
          onChangeText,
          onSubmitEditing,
          onFocus,
          onBlur,
          onContentSizeChange,
          textAlign,
          selection,
          onSelectionChange,
          ...props
        },
        ref,
      ) =>
        React.createElement(RN.TextInput, {
          ...props,
          ...{ ref },
          value: value?.value,
          textAlign:
            textAlign === 'left' ||
            textAlign === 'right' ||
            textAlign === 'center'
              ? textAlign
              : undefined,
          selection: selection?.value,
          onSelectionChange: onSelectionChange
            ? (event) => onSelectionChange(event.nativeEvent.selection)
            : undefined,
          onContentSizeChange: onContentSizeChange
            ? (event) => onContentSizeChange(event.nativeEvent.contentSize)
            : undefined,
          onChangeText: (text: string) => {
            if (value) value.value = text;
            onChangeText?.(text);
          },
          onSubmitEditing: (event: MockNativeEvent<MockSubmitEvent>) =>
            onSubmitEditing?.(event.nativeEvent.text),
          onFocus: () => onFocus?.(),
          onBlur: () => onBlur?.(),
        }),
    ),
  };
});
