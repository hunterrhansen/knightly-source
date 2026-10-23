import { parsePublicConfig } from './api/response-schemas';
import { readApiOrigin } from './app-config';

test('requires a trusted origin and explicit localhost allowance', () => {
  expect(readApiOrigin('https://api.knightly.example/', false)).toBe(
    'https://api.knightly.example',
  );
  expect(readApiOrigin('http://localhost:8000', true)).toBe(
    'http://localhost:8000',
  );
  for (const value of [
    undefined,
    '',
    'https://u:p@api.example',
    'https://api.example/path',
    'https://api.example?q=1',
    'https://api.example#x',
    'http://api.example',
    'http://localhost:8000',
  ]) {
    expect(() => readApiOrigin(value, false)).toThrow();
  }
});
test('bootstrap refuses local fallback and malformed configuration', () => {
  expect(() =>
    parsePublicConfig({ clerk_publishable_key: null, contact: null }),
  ).toThrow();
  expect(() =>
    parsePublicConfig({ clerk_publishable_key: '', contact: null }),
  ).toThrow();
  expect(() => parsePublicConfig({ clerk_publishable_key: 123 })).toThrow();
  expect(() =>
    parsePublicConfig({
      clerk_publishable_key: 'pk_test_example',
      contact: null,
    }),
  ).toThrow();
  expect(
    parsePublicConfig({
      clerk_publishable_key: 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k',
      contact: null,
    }).clerk_publishable_key,
  ).toBe('pk_test_Y2xlcmsuZXhhbXBsZS5jb20k');
});
