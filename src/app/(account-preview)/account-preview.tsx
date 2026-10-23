import { Redirect } from 'expo-router';
export default function Screen() {
  if (!__DEV__) return <Redirect href="/" />;
  const {
    AccountPreviewScreen,
  } = require('../../features/account/account-preview-screen');
  return <AccountPreviewScreen />;
}
