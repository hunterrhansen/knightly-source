import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { parsePublicConfig, type ReadyConfig } from './api/response-schemas';
import { CACHE_MAX_AGE } from './query-cache';

const snapshotSchema = z.object({
  savedAt: z.number().finite().nonnegative(),
  config: z.unknown(),
});
const key = (origin: string) => `knightly.public-config.v1.${origin}`;
export async function readPublicConfig(origin: string) {
  try {
    const stored = await AsyncStorage.getItem(key(origin));
    if (!stored) return;
    const snapshot = snapshotSchema.parse(JSON.parse(stored));
    const age = Date.now() - snapshot.savedAt;
    if (age < 0 || age >= CACHE_MAX_AGE)
      throw new Error('Expired configuration');
    return parsePublicConfig(snapshot.config);
  } catch {
    await removePublicConfig(origin);
    return;
  }
}
export async function savePublicConfig(origin: string, config: ReadyConfig) {
  try {
    await AsyncStorage.setItem(
      key(origin),
      JSON.stringify({ savedAt: Date.now(), config }),
    );
  } catch {
    // Optional startup optimization; storage failure must not prevent sign-in.
  }
}
export async function removePublicConfig(origin: string) {
  try {
    await AsyncStorage.removeItem(key(origin));
  } catch {
    // Authentication still requires Clerk, independently of this public cache.
  }
}
