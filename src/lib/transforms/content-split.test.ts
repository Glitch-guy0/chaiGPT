import { describe, it, expect } from 'vitest';
import { splitContent } from './content-split';

describe('splitContent', () => {
  it('returns inline unchanged when content ≤ 500 chars', () => {
    const result = splitContent('Hello, world!');
    expect(result.inline).toBe('Hello, world!');
    expect(result.extracted).toEqual([]);
  });

  it('splits at 500 boundary when content > 500 chars', () => {
    const long = 'a'.repeat(750);
    const result = splitContent(long);
    expect(result.inline).toBe('a'.repeat(500));
    expect(result.extracted).toEqual(['a'.repeat(250)]);
  });

  it('handles empty content', () => {
    const result = splitContent('');
    expect(result.inline).toBe('');
    expect(result.extracted).toEqual([]);
  });

  it('handles content exactly 500 chars — no split', () => {
    const exact = 'x'.repeat(500);
    const result = splitContent(exact);
    expect(result.inline).toBe(exact);
    expect(result.extracted).toEqual([]);
  });
});
