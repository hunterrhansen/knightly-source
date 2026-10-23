import { Redirect } from 'expo-router';
export default function Screen() {
  if (!__DEV__) return <Redirect href="/" />;
  const { PrivacyScreen } = require('../../features/account/privacy-screen');
  return <PrivacyScreen inAccount />;
}
