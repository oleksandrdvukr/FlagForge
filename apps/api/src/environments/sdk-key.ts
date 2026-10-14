import { createHash, randomBytes } from 'node:crypto';
import { SDK_KEY_PREFIXES, type EnvironmentName } from '@flagforge/shared';

/** 32 random bytes = 256 bits of entropy (FR-03). */
const SDK_KEY_RANDOM_BYTES = 32;

/** FR-03: `ff_test_` / `ff_live_` + base64url(32 random bytes). */
export function generateSdkKey(environment: EnvironmentName): string {
  return SDK_KEY_PREFIXES[environment] + randomBytes(SDK_KEY_RANDOM_BYTES).toString('base64url');
}

/** FR-04, SEC-01: only this hex digest is ever persisted. */
export function hashSdkKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}
