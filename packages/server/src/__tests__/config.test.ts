import { describe, expect, it } from 'vitest';
import { resolveCorsOrigins } from '../config.js';

describe('resolveCorsOrigins', () => {
  it('returns the parsed origin for non-localhost hosts', () => {
    expect(resolveCorsOrigins('https://bitby.dev/app')).toBe('https://bitby.dev');
  });

  it('adds the 127.0.0.1 alias when localhost is configured', () => {
    expect(resolveCorsOrigins('http://localhost:5173')).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ]);
  });

  it('adds the localhost alias when 127.0.0.1 is configured', () => {
    expect(resolveCorsOrigins('http://127.0.0.1:4173')).toEqual([
      'http://127.0.0.1:4173',
      'http://localhost:4173'
    ]);
  });

  it('falls back to the provided value when parsing fails', () => {
    expect(resolveCorsOrigins('invalid-origin')).toBe('invalid-origin');
  });
});
