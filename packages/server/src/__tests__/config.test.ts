import { describe, expect, it } from 'vitest';
import { resolveCorsOrigins } from '../config.js';

describe('resolveCorsOrigins', () => {
  it('returns the parsed origin for non-localhost hosts', () => {
    expect(resolveCorsOrigins('https://bitby.dev/app')).toBe('https://bitby.dev');
  });

  it('returns a regex that permits localhost aliases across ports', () => {
    const origin = resolveCorsOrigins('http://localhost:5173');
    expect(origin).toBeInstanceOf(RegExp);
    const pattern = origin as RegExp;
    expect(pattern.test('http://localhost:5173')).toBe(true);
    expect(pattern.test('http://localhost:5174')).toBe(true);
    expect(pattern.test('http://127.0.0.1:5173')).toBe(true);
    expect(pattern.test('http://[::1]:6006')).toBe(true);
    expect(pattern.test('https://localhost:5173')).toBe(false);
  });

  it('returns a regex when 127.0.0.1 is configured directly', () => {
    const origin = resolveCorsOrigins('http://127.0.0.1:4173');
    expect(origin).toBeInstanceOf(RegExp);
    const pattern = origin as RegExp;
    expect(pattern.test('http://localhost:8080')).toBe(true);
    expect(pattern.test('http://127.0.0.1:4173')).toBe(true);
    expect(pattern.test('http://[::1]:9000')).toBe(true);
    expect(pattern.test('https://127.0.0.1:4173')).toBe(false);
  });

  it('falls back to the provided value when parsing fails', () => {
    expect(resolveCorsOrigins('invalid-origin')).toBe('invalid-origin');
  });
});
