import type { ViewStateSerializable } from '../../renderer/maplibre-deck/view-state';
import type { EntityId, Selection } from '../../renderer/railway/render-types';
import {
  TOKYO_METRO_GINZA_LINE_ID,
  TOKYO_METRO_MARUNOUCHI_LINE_ID,
  tokyoMetroStationCatalog,
} from '../../renderer/railway/tokyo-metro-render-dataset';

export type SearchEntryKind = 'line' | 'station';

export interface SearchEntry {
  id: EntityId;
  kind: SearchEntryKind;
  primaryName: string;
  subtitle: string;
  normalizedNames: readonly string[];
  center: readonly [longitude: number, latitude: number];
  targetView: ViewStateSerializable;
  selection: Exclude<Selection, null>;
}

interface SearchEntrySource {
  id: EntityId;
  kind: SearchEntryKind;
  primaryName: string;
  aliases: readonly string[];
  stationNumber?: string;
  lineName: string;
  regionName: string;
  center: readonly [longitude: number, latitude: number];
  targetView: ViewStateSerializable;
}

function kanaToHiragana(value: string): string {
  return Array.from(value)
    .map((character) => {
      const codePoint = character.codePointAt(0);
      if (codePoint === undefined || codePoint < 0x30a1 || codePoint > 0x30f6) {
        return character;
      }

      return String.fromCodePoint(codePoint - 0x60);
    })
    .join('');
}

export function normalizeSearchText(value: string): string {
  return kanaToHiragana(value.normalize('NFKC').toLocaleLowerCase('ja-JP'))
    .replace(/[ー－‐‑‒–—―-]/g, '')
    .replace(/[\s_・･.]/g, '');
}

function createSearchEntry(source: SearchEntrySource): SearchEntry {
  const names = [source.primaryName, ...source.aliases, source.stationNumber ?? ''];
  const normalizedNames = Array.from(
    new Set(names.map(normalizeSearchText).filter((name) => name.length > 0)),
  );
  const subtitleParts = [source.kind === 'station' ? 'Station' : 'Line', source.lineName];
  if (source.stationNumber !== undefined) {
    subtitleParts.push(source.stationNumber);
  }
  subtitleParts.push(source.regionName);

  return {
    id: source.id,
    kind: source.kind,
    primaryName: source.primaryName,
    subtitle: subtitleParts.join(' · '),
    normalizedNames,
    center: source.center,
    targetView: source.targetView,
    selection: { kind: source.kind, id: source.id },
  };
}

function scoreEntry(entry: SearchEntry, normalizedQuery: string): number | null {
  if (normalizedQuery.length === 0) {
    return 100;
  }

  let bestScore: number | null = null;
  for (const name of entry.normalizedNames) {
    let score: number | null = null;
    if (name === normalizedQuery) {
      score = 0;
    } else if (name.startsWith(normalizedQuery)) {
      score = 10 + name.length - normalizedQuery.length;
    } else if (name.includes(normalizedQuery)) {
      score = 40 + name.indexOf(normalizedQuery);
    }

    if (score !== null && (bestScore === null || score < bestScore)) {
      bestScore = score;
    }
  }

  return bestScore;
}

export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  options: { limit?: number } = {},
): readonly SearchEntry[] {
  const normalizedQuery = normalizeSearchText(query);
  const limit = options.limit ?? (normalizedQuery.length <= 1 ? 4 : 8);
  const scored = entries
    .map((entry, index) => ({ entry, index, score: scoreEntry(entry, normalizedQuery) }))
    .filter((result): result is { entry: SearchEntry; index: number; score: number } => {
      return result.score !== null;
    })
    .sort((left, right) => left.score - right.score || left.index - right.index);

  return scored.slice(0, limit).map((result) => result.entry);
}

export function findSearchEntryBySelection(
  entries: readonly SearchEntry[],
  selection: Selection,
): SearchEntry | null {
  if (selection === null) {
    return null;
  }

  return (
    entries.find((entry) => entry.selection.kind === selection.kind && entry.id === selection.id) ??
    null
  );
}

function stationSearchEntry(
  id: SearchEntry['id'],
  primaryName: string,
  aliases: readonly string[],
  stationNumber: string,
  lineName: string,
  center: readonly [number, number],
): SearchEntry {
  return createSearchEntry({
    id,
    kind: 'station',
    primaryName,
    aliases,
    stationNumber,
    lineName,
    regionName: 'Tokyo Metro',
    center,
    targetView: {
      longitude: center[0],
      latitude: center[1],
      zoom: 14,
      pitch: 55,
      bearing: -28,
    },
  });
}

/** Primary search index for the Tokyo Metro GitHub Pages pilot. */
export const tokyoMetroSearchEntries: readonly SearchEntry[] = [
  createSearchEntry({
    id: TOKYO_METRO_GINZA_LINE_ID,
    kind: 'line',
    primaryName: '銀座線',
    aliases: ['ぎんざせん', 'ginza line', 'ginza', 'G', '東京メトロ銀座線'],
    lineName: 'Tokyo Metro Ginza Line',
    regionName: 'Tokyo',
    center: [139.7671, 35.6812],
    targetView: {
      longitude: 139.75,
      latitude: 35.68,
      zoom: 12,
      pitch: 52,
      bearing: -28,
    },
  }),
  createSearchEntry({
    id: TOKYO_METRO_MARUNOUCHI_LINE_ID,
    kind: 'line',
    primaryName: '丸ノ内線',
    aliases: ['まるのうちせん', 'marunouchi line', 'marunouchi', 'M', '東京メトロ丸ノ内線'],
    lineName: 'Tokyo Metro Marunouchi Line',
    regionName: 'Tokyo',
    center: [139.73, 35.69],
    targetView: {
      longitude: 139.73,
      latitude: 35.69,
      zoom: 11.8,
      pitch: 52,
      bearing: -20,
    },
  }),
  ...tokyoMetroStationCatalog.ginza.map((station) =>
    stationSearchEntry(
      station.id,
      station.name,
      [station.number, station.name],
      station.number,
      '銀座線',
      [station.position[0], station.position[1]],
    ),
  ),
  ...tokyoMetroStationCatalog.marunouchi
    .filter(
      (station) => !tokyoMetroStationCatalog.ginza.some((ginza) => ginza.name === station.name),
    )
    .map((station) =>
      stationSearchEntry(
        station.id,
        station.name,
        [station.number, station.name],
        station.number,
        '丸ノ内線',
        [station.position[0], station.position[1]],
      ),
    ),
  // Same-name transfer stations appear on both lines with distinct ids.
  stationSearchEntry(
    'r3d:jp:tokyometro:station:marunouchi-ginza',
    '銀座',
    ['ぎんざ', 'ginza', 'M-16'],
    'M-16',
    '丸ノ内線',
    [139.7671, 35.6717],
  ),
  stationSearchEntry(
    'r3d:jp:tokyometro:station:marunouchi-akasaka-mitsuke',
    '赤坂見附',
    ['あかさかみつけ', 'akasaka-mitsuke', 'M-13'],
    'M-13',
    '丸ノ内線',
    [139.7366, 35.6769],
  ),
];

/** @deprecated Use tokyoMetroSearchEntries; kept alias for gradual migration. */
export const syntheticSearchEntries = tokyoMetroSearchEntries;
