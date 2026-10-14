import { createHash } from 'node:crypto';
import { generateSdkKey, hashSdkKey } from './sdk-key';

describe('generateSdkKey', () => {
  it('FR-03: uses ff_test_ for Development and ff_live_ for Production', () => {
    expect(generateSdkKey('Development')).toMatch(/^ff_test_[A-Za-z0-9_-]{43}$/);
    expect(generateSdkKey('Production')).toMatch(/^ff_live_[A-Za-z0-9_-]{43}$/);
  });

  it('FR-03: produces unguessable, unique keys', () => {
    const keys = new Set(Array.from({ length: 1000 }, () => generateSdkKey('Production')));
    expect(keys.size).toBe(1000);
  });
});

describe('hashSdkKey', () => {
  it('SEC-01: returns the SHA-256 hex digest of the raw key', () => {
    // Independent reference: `printf 'ff_test_abc' | shasum -a 256`
    expect(hashSdkKey('ff_test_abc')).toBe(
      createHash('sha256').update('ff_test_abc').digest('hex'),
    );
    expect(hashSdkKey('ff_test_abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('SEC-01: the hash does not contain the raw key', () => {
    const key = generateSdkKey('Production');
    expect(hashSdkKey(key)).not.toContain(key.slice(8));
  });
});
