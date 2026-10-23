import { parsePublishableKey } from '@clerk/shared/keys';
import { z } from 'zod';
import { ApiError } from './api-error';
import type { paths } from './schema';
export type MeResponse =
  paths['/api/me']['get']['responses'][200]['content']['application/json'];
type PublicConfig =
  paths['/api/config']['get']['responses'][200]['content']['application/json'];
const nullableCount = z.number().int().nonnegative().nullable();
export const meSchema = z.object({
  admin: z.boolean(),
  limits: z.object({
    history_months: nullableCount,
    max_analysed: nullableCount,
    max_accounts: z.number().int().positive(),
  }),
}) satisfies z.ZodType<MeResponse>;
const configSchema = z.object({
  clerk_publishable_key: z.string().nullable(),
  contact: z.string().nullable(),
}) satisfies z.ZodType<PublicConfig>;
export type ReadyConfig = PublicConfig & { clerk_publishable_key: string };
export function parsePublicConfig(value: unknown): ReadyConfig {
  const result = configSchema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      'invalid-response',
      'Knightly returned invalid sign-in configuration.',
    );
  const key = result.data.clerk_publishable_key;
  if (!key || !parsePublishableKey(key))
    throw new ApiError(
      'invalid-response',
      'Account sign-in is not configured on this server.',
    );
  return {
    ...result.data,
    clerk_publishable_key: key,
  };
}
