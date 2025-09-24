import { describe, expect, it } from 'vitest';
import { resolveCorsOrigins } from '../config.js';

describe('resolveCorsOrigins', () => {
  it('returns the parsed origin for non-localhost hosts', () => {
    expect(resolveCorsOrigins('https://bitby.dev/app')).toBe('https://bitby.dev');
  });

  it('returns an allow list that includes loopback aliases for localhost', () => {
    const origin = resolveCorsOrigins('http://localhost:5173');
    expect(origin).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://[::1]:5173'
    ]);
  });

  it('returns the same allow list when a loopback alias is configured directly', () => {
    const origin = resolveCorsOrigins('http://127.0.0.1:4173');
    expect(origin).toEqual([
      'http://localhost:4173',
      'http://127.0.0.1:4173',
      'http://[::1]:4173'
    ]);
  });

  it('preserves the configured protocol when expanding loopback aliases', () => {
    const origin = resolveCorsOrigins('https://localhost:8443');
    expect(origin).toEqual([
      'https://localhost:8443',
      'https://127.0.0.1:8443',
      'https://[::1]:8443'
    ]);
  });

  it('falls back to the provided value when parsing fails', () => {
    expect(resolveCorsOrigins('invalid-origin')).toBe('invalid-origin');
  });
});
