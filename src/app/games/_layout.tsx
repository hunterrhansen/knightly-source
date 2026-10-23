import { ModalStack } from '../../features/shell/modal-stack';
// A game's review draws its own header and board.
export default function GamesLayout() {
  return <ModalStack label="Games" bare={['[gameId]']} />;
}
