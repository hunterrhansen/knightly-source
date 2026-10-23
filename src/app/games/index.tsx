import { useRouter } from 'expo-router';
import { GamesScreen } from '../../features/games/games-screen';
import {
  useCloseModal,
  useLeaveModal,
} from '../../features/shell/modal-stack-types';
/** The Games modal: a game opens inside it; Accounts & sync over the path. */
export default function Games() {
  const router = useRouter();
  const leave = useLeaveModal();
  return (
    <GamesScreen
      onOpenGame={(id) =>
        router.push({ pathname: '/games/[gameId]', params: { gameId: id } })
      }
      onAccounts={() => leave('/connect-games')}
      onClose={useCloseModal()}
    />
  );
}
