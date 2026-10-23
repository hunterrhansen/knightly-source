import { parseReturnRoute } from './return-route';

test('preserves only registered internal destinations', () => {
  for (const path of [
    '/',
    '/account',
    '/account-privacy',
    '/games',
    '/progress',
    '/practice',
    '/connect-games',
    '/watch',
    '/review/42',
    '/games/42',
    '/progress/hidden',
  ])
    expect(parseReturnRoute(path)).toBe(path);
  for (const path of [
    undefined,
    'https://evil.example',
    '//evil.example',
    '/sign-in',
    '/privacy',
    '/review/0',
    '/review/-1',
    '/review/42?next=bad',
    '/%2f%2fevil',
    '/unknown',
    '/play',
    '/account#x',
    // All stats is part of Progress now.
    '/progress/stats',
  ])
    expect(parseReturnRoute(path)).toBe('/');
});

test('restores a settings detail and its choice while rejecting unregistered parameters', () => {
  expect(
    parseReturnRoute('/account-settings?section=appearance&choice=board'),
  ).toBe('/account-settings?section=appearance&choice=board');
  expect(parseReturnRoute('/account-settings?section=data')).toBe(
    '/account-settings?section=data',
  );
  expect(parseReturnRoute('/account-settings?section=data&choice=board')).toBe(
    '/',
  );
  // The theme choice was removed when Knightly went dark only.
  expect(
    parseReturnRoute('/account-settings?section=appearance&choice=theme'),
  ).toBe('/');
  expect(parseReturnRoute('/account-settings?section=unknown')).toBe('/');
  expect(
    parseReturnRoute(
      '/account-settings?section=data&next=https://evil.example',
    ),
  ).toBe('/');
});

test('tonight’s watch and an extra watch keep their mode, and nothing else gets through', () => {
  for (const route of ['/practice?mode=lesson', '/practice?mode=extra'])
    expect(parseReturnRoute(route)).toBe(route);
  for (const route of [
    '/practice?daily=1',
    '/games?daily=1',
    '/review/7?mode=lesson',
    '/practice?mode=lesson&next=https://evil.example',
    '/practice?mode=tactic&tactic=fork',
    '/practice?mode=replay',
  ])
    expect(parseReturnRoute(route)).toBe('/');
});
