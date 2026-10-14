import { createHash } from 'node:crypto';

/**
 * ADR-0004: deterministic rollout bucket in [0, 99].
 *
 * First 4 bytes of sha256(`${userId}:${flagKey}`) as an unsigned big-endian integer, modulo 100.
 * Frozen for v1 — changing it reshuffles every user's bucket.
 */
export function bucket(userId: string, flagKey: string): number {
  const digest = createHash('sha256').update(`${userId}:${flagKey}`, 'utf8').digest();
  return digest.readUInt32BE(0) % 100;
}
