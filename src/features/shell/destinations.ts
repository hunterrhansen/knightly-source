const destinations = [
  { id: 'today', label: 'Today', href: '/' },
  { id: 'games', label: 'Games', href: '/games' },
  { id: 'progress', label: 'Progress', href: '/progress' },
] as const;

export function availableDestinations() {
  return destinations;
}

/** Whether a remembered route can be restored after sign-in: the main tabs,
 * Account and the full-screen learning routes. */
export function isDestinationAvailable(path: string) {
  // Query strings were validated by parseReturnRoute; availability is per route.
  const route = path.split('?')[0] ?? path;
  return (
    route === '/' ||
    route === '/account' ||
    route === '/account-privacy' ||
    route === '/account-settings' ||
    route === '/practice' ||
    /^\/(review|games)\/[1-9]\d*$/.test(route) ||
    route === '/games' ||
    route === '/progress' ||
    route === '/progress/hidden' ||
    route === '/connect-games' ||
    route === '/watch'
  );
}
