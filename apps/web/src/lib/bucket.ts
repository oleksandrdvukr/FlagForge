/**
 * Browser port of the server's bucketing (ADR-0004), used only to visualize where a user
 * lands. Pinned to the same golden vectors as `apps/api/src/evaluation/engine/bucket.spec.ts`;
 * the server remains the source of truth for evaluation.
 *
 * Returns `null` where Web Crypto is unavailable: browsers expose `crypto.subtle` only in
 * secure contexts (HTTPS or localhost), and plain-HTTP deployments are supported.
 */
export async function bucket(userId: string, flagKey: string): Promise<number | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const data = new TextEncoder().encode(`${userId}:${flagKey}`);
  const digest = await subtle.digest('SHA-256', data);
  return new DataView(digest).getUint32(0, false) % 100;
}
