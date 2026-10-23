jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { parsePreferences } from './preferences';

const defaults = {
  board: 'sage',
  pieces: 'cburnett',
  coordinates: 'inside',
  animation: 'medium',
  legalMoves: 'on',
  lastMove: 'on',
  sounds: 'on',
  bestMove: 'on',
  liveEngine: 'off',
  weekStart: 'sunday',
};

test('damaged or unsupported stored preferences cannot break startup', () => {
  expect(parsePreferences('{')).toEqual(defaults);
  expect(parsePreferences('null')).toEqual(defaults);
  expect(parsePreferences('{"theme":"dark","board":"unsupported"}')).toEqual(
    defaults,
  );
  expect(parsePreferences('{"pieces":"chesscom","sounds":"chesscom"}')).toEqual(
    defaults,
  );
  expect(parsePreferences('{"pieces":"chesscom","sounds":"chesscom"}')).toEqual(
    defaults,
  );
});

test('the Calm board colour is kept once chosen', () => {
  expect(parsePreferences('{"board":"calm"}')).toEqual({
    ...defaults,
    board: 'calm',
  });
});

test('choices saved by older builds are kept, without their light/dark theme', () => {
  expect(parsePreferences('{"theme":"dark","board":"blue"}')).toEqual({
    ...defaults,
    board: 'blue',
  });
  expect(
    parsePreferences(
      '{"theme":"light","board":"brown","pieces":"cburnett","coordinates":"outside","animation":"none","sounds":"off"}',
    ),
  ).toEqual({
    ...defaults,
    board: 'brown',
    pieces: 'cburnett',
    coordinates: 'outside',
    animation: 'none',
    sounds: 'off',
  });
});

test('weeks start on Sunday unless Monday was chosen', () => {
  expect(parsePreferences('{"theme":"dark"}').weekStart).toBe('sunday');
  expect(parsePreferences('{"weekStart":"monday"}').weekStart).toBe('monday');
  expect(parsePreferences('{"weekStart":"friday"}')).toEqual(defaults);
});
