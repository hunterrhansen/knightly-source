import { Redirect } from 'expo-router';

/** Compatibility for old journey links; learning now starts from Today. */
export function TodayNodeScreen() {
  return <Redirect href="/" />;
}
