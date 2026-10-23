/** Whether a remembered route can be restored after sign-in: the path, the
 * modals over it (Account, Games, Progress) and the routes they open. */
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
