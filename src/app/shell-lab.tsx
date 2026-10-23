import { Redirect } from 'expo-router';
export default function ShellLab() {
  if (!__DEV__) return <Redirect href="/" />;
  const { ShellLabScreen } = require('../features/shell/shell-lab-screen');
  return <ShellLabScreen />;
}
