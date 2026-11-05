import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReviewScreen } from '../../features/review/review-screen';

/** Review opens above the tabs so the board keeps the full screen. */
export default function Game() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  return (
    <ReviewScreen
      gameId={gameId}
      onExit={() =>
        router.canGoBack() ? router.back() : router.replace('/games')
      }
      onKeepWatch={() => router.push('/practice?mode=lesson')}
    />
  );
}
