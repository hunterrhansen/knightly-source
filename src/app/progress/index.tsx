import { ProgressScreen } from '../../features/progress/progress-screen';
import {
  useCloseModal,
  useLeaveModal,
} from '../../features/shell/modal-stack-types';
export default function Progress() {
  return <ProgressScreen onClose={useCloseModal()} leave={useLeaveModal()} />;
}
