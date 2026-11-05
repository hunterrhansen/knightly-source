import type { MapCastle } from './journey-map';

const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const posts = (n: number) => `${n} ${n === 1 ? 'post' : 'posts'}`;

export function castleText(castle: MapCastle) {
  if (castle.state === 'reached')
    return castle.reachedOn
      ? `Reached ${shortDate(castle.reachedOn)}`
      : 'Reached';
  if (castle.key === 'page') return 'Your first watch';
  if (castle.beyond || castle.after === undefined)
    return 'Beyond the posts built';
  if (castle.state === 'later' || castle.toGo === null)
    return `After post ${castle.after}`;
  return `${posts(castle.toGo)} to go`;
}
