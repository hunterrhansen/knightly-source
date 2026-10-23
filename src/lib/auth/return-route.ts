export function parseReturnRoute(input: string | undefined): string {
  if (!input) return '/';
  if (
    /^\/account-settings\?section=(appearance|connections|reminders|updates|analysis|data)$/.test(
      input,
    ) ||
    /^\/account-settings\?section=appearance&choice=board$/.test(input) ||
    // Tonight's watch and an extra watch keep their mode on reload.
    input === '/practice?mode=lesson' ||
    input === '/practice?mode=extra'
  )
    return input;
  if (/[?#%\\]/.test(input)) return '/';
  if (
    [
      '/',
      '/account',
      '/account-privacy',
      '/account-settings',
      '/games',
      '/progress',
      '/progress/hidden',
      '/practice',
      '/connect-games',
      '/watch',
    ].includes(input)
  )
    return input;
  return /^\/(review|games)\/[1-9]\d*$/.test(input) ? input : '/';
}
let intent = '/';
const storageKey = 'knightly.return-route';
function storage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : undefined;
  } catch {
    return undefined;
  }
}
export function peekReturnRoute() {
  try {
    return parseReturnRoute(storage()?.getItem(storageKey) ?? intent);
  } catch {
    return intent;
  }
}
export function rememberReturnRoute(input: string) {
  intent = parseReturnRoute(input);
  try {
    storage()?.setItem(storageKey, intent);
  } catch {
    /* Storage may be unavailable. */
  }
}
export function consumeReturnRoute(): string {
  const next = peekReturnRoute();
  clearReturnRoute();
  return next;
}
export function clearReturnRoute() {
  intent = '/';
  try {
    storage()?.removeItem(storageKey);
  } catch {
    /* Storage may be unavailable. */
  }
}
