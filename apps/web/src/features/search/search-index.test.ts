import { describe, expect, it } from 'vitest';

import { normalizeSearchText, searchEntries, syntheticSearchEntries } from './search-index';

describe('search-index', () => {
  it('normalizes Japanese width, kana, spacing, and hyphens', () => {
    expect(normalizeSearchText('ＳＹＮ－Ａ')).toBe('syna');
    expect(normalizeSearchText('エキ エー')).toBe('えきえ');
  });

  it('finds synthetic station by Japanese, kana, romaji, and station number forms', () => {
    expect(searchEntries(syntheticSearchEntries, '駅A')[0]?.primaryName).toBe('Station A');
    expect(searchEntries(syntheticSearchEntries, 'エキエー')[0]?.primaryName).toBe('Station A');
    expect(searchEntries(syntheticSearchEntries, 'eki a')[0]?.primaryName).toBe('Station A');
    expect(searchEntries(syntheticSearchEntries, 'SYN-A')[0]?.primaryName).toBe('Station A');
  });

  it('limits one-character queries', () => {
    expect(searchEntries(syntheticSearchEntries, 's')).toHaveLength(4);
  });

  it('distinguishes same-name station candidates by line and region', () => {
    const echoResults = searchEntries(syntheticSearchEntries, 'Station Echo', { limit: 4 });

    expect(echoResults).toHaveLength(2);
    expect(echoResults[0]?.subtitle).toContain('North Fixture Branch');
    expect(echoResults[0]?.subtitle).toContain('Synthetic North');
    expect(echoResults[1]?.subtitle).toContain('South Fixture Branch');
    expect(echoResults[1]?.subtitle).toContain('Synthetic South');
  });
});
