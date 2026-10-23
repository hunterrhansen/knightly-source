import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReviewScreen } from '../../features/review/review-screen';
import {
  useLeaveModal,
  useLockModalDismiss,
} from '../../features/shell/modal-stack-types';
/** A game inside the Games modal: its review, back to the list; tonight's
 * watch opens over the path. The sheet's swipe-down is off while it shows,
 * so dragging a piece never closes Games. */
export default function Game() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const leave = useLeaveModal();
  useLockModalDismiss();
  return (
    <ReviewScreen
      gameId={gameId}
      onExit={() =>
        router.canGoBack() ? router.back() : router.replace('/games')
      }
      onKeepWatch={() => leave('/practice?mode=lesson')}
    />
  );
}
