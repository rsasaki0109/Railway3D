import type { ViewStateSerializable } from '../../renderer/maplibre-deck/view-state';
import type { EntityId, Selection } from '../../renderer/railway/render-types';

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

export const syntheticSearchEntries: readonly SearchEntry[] = [
  createSearchEntry({
    id: 'r3d:zz:synthetic:line:golden',
    kind: 'line',
    primaryName: 'Golden Fixture Line',
    aliases: ['ゴールデン線', 'ごーるでんせん', 'golden line', 'GL'],
    lineName: 'Synthetic Golden',
    regionName: 'Synthetic District',
    center: [139.7671, 35.6812],
    targetView: {
      longitude: 139.7671,
      latitude: 35.6812,
      zoom: 11.5,
      pitch: 52,
      bearing: -28,
    },
  }),
  createSearchEntry({
    id: 'r3d:zz:synthetic:station:A',
    kind: 'station',
    primaryName: 'Station A',
    aliases: ['駅A', 'えきえー', 'エキエー', 'eki a', 'golden station a'],
    stationNumber: 'SYN-A',
    lineName: 'Golden Fixture Line',
    regionName: 'Synthetic West',
    center: [139.61, 35.72],
    targetView: {
      longitude: 139.61,
      latitude: 35.72,
      zoom: 13.5,
      pitch: 55,
      bearing: -28,
    },
  }),
  createSearchEntry({
    id: 'r3d:zz:synthetic:station:C',
    kind: 'station',
    primaryName: 'Station C',
    aliases: ['駅C', 'えきしー', 'エキシー', 'eki c', 'golden station c'],
    stationNumber: 'SYN-C',
    lineName: 'Golden Fixture Line',
    regionName: 'Synthetic East',
    center: [139.92, 35.656],
    targetView: {
      longitude: 139.92,
      latitude: 35.656,
      zoom: 13.5,
      pitch: 55,
      bearing: -28,
    },
  }),
  createSearchEntry({
    id: 'r3d:zz:synthetic:station:echo-north',
    kind: 'station',
    primaryName: 'Station Echo',
    aliases: ['駅エコー', 'えきえこー', 'eki echo north'],
    stationNumber: 'SYN-N',
    lineName: 'North Fixture Branch',
    regionName: 'Synthetic North',
    center: [139.705, 35.604],
    targetView: {
      longitude: 139.705,
      latitude: 35.604,
      zoom: 13,
      pitch: 52,
      bearing: -20,
    },
  }),
  createSearchEntry({
    id: 'r3d:zz:synthetic:station:echo-south',
    kind: 'station',
    primaryName: 'Station Echo',
    aliases: ['駅エコー', 'えきえこー', 'eki echo south'],
    stationNumber: 'SYN-S',
    lineName: 'South Fixture Branch',
    regionName: 'Synthetic South',
    center: [139.708, 35.646],
    targetView: {
      longitude: 139.708,
      latitude: 35.646,
      zoom: 13,
      pitch: 52,
      bearing: -20,
    },
  }),
];
