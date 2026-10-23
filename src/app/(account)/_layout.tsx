import { AccountStack } from '../../features/account/account-stack';
export const unstable_settings = { anchor: 'account' };
export default function Layout() {
  return <AccountStack />;
}
