import { describe, expect, it } from 'vitest';

import { normalizeSearchText, searchEntries, tokyoMetroSearchEntries } from './search-index';

describe('search-index', () => {
  it('normalizes Japanese width, kana, spacing, and hyphens', () => {
    expect(normalizeSearchText('Ｇ－１６')).toBe('g16');
    expect(normalizeSearchText('うえの')).toBe('うえの');
  });

  it('finds Tokyo Metro stations by Japanese and station number', () => {
    expect(searchEntries(tokyoMetroSearchEntries, '上野')[0]?.primaryName).toBe('上野');
    expect(searchEntries(tokyoMetroSearchEntries, 'G-16')[0]?.primaryName).toBe('上野');
    expect(searchEntries(tokyoMetroSearchEntries, '渋谷')[0]?.primaryName).toBe('渋谷');
  });

  it('finds Ginza and Marunouchi lines', () => {
    expect(searchEntries(tokyoMetroSearchEntries, '銀座線')[0]?.kind).toBe('line');
    expect(searchEntries(tokyoMetroSearchEntries, '丸ノ内線')[0]?.primaryName).toBe('丸ノ内線');
  });

  it('limits one-character queries', () => {
    expect(searchEntries(tokyoMetroSearchEntries, 'g')).toHaveLength(4);
  });

  it('distinguishes same-name station candidates by line', () => {
    const ginzaResults = searchEntries(tokyoMetroSearchEntries, '銀座', { limit: 8 }).filter(
      (entry) => entry.kind === 'station' && entry.primaryName === '銀座',
    );

    expect(ginzaResults.length).toBeGreaterThanOrEqual(2);
    expect(ginzaResults.some((entry) => entry.subtitle.includes('銀座線'))).toBe(true);
    expect(ginzaResults.some((entry) => entry.subtitle.includes('丸ノ内線'))).toBe(true);
  });
});
