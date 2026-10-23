import { useLocalSearchParams } from 'expo-router';
import { PracticeScreen } from '../features/practice/practice-screen';
export default function Screen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return (
    <PracticeScreen extra={mode === 'extra'} challenge={mode === 'challenge'} />
  );
}
