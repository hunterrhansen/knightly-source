export function readApiOrigin(
  value: string | undefined,
  allowLocalHttp: boolean,
): string {
  if (!value)
    throw new Error('Set EXPO_PUBLIC_API_URL to your Knightly API origin.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('The Knightly API address is invalid.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '') ||
    (url.protocol !== 'https:' &&
      !(allowLocalHttp && local && url.protocol === 'http:'))
  ) {
    throw new Error(
      'Use an HTTPS API origin without credentials, a path, or query parameters.',
    );
  }
  return url.origin;
}
