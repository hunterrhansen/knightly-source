import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReviewScreen } from '../../features/review/review-screen';
export default function Screen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  return (
    <ReviewScreen
      gameId={gameId}
      onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      onKeepWatch={() => router.push('/practice?mode=lesson')}
    />
  );
}
