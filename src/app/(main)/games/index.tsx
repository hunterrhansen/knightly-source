import { useRouter } from 'expo-router';
import { GamesScreen } from '../../../features/games/games-screen';
export default function Games() {
  const router = useRouter();
  return (
    <GamesScreen
      onOpenGame={(gameId) =>
        router.push({ pathname: '/games/[gameId]', params: { gameId } })
      }
      onAccounts={() => router.push('/connect-games')}
    />
  );
}
