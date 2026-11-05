import { Redirect } from 'expo-router';
import { MainLayout } from '../../features/shell/main-layout';
export default function NavigationPreviewLayout() {
  return __DEV__ ? <MainLayout preview /> : <Redirect href="/" />;
}
