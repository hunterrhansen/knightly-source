import { Redirect } from 'expo-router';

// Metro removes this branch and the lab dependency from production bundles.
const BoardLabScreen = __DEV__
  ? require('../features/board-lab/board-lab-screen').BoardLabScreen
  : null;

export default function BoardLabRoute() {
  return BoardLabScreen ? <BoardLabScreen /> : <Redirect href="/" />;
}
