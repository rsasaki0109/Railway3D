import type { Selection } from '../../renderer/railway/render-types';
import { findSearchEntryBySelection, syntheticSearchEntries } from '../search/search-index';

export interface SelectionDisplay {
  title: string;
  subtitle: string;
}

export function getSelectionDisplay(selection: Selection): SelectionDisplay {
  if (selection === null) {
    return {
      title: 'None',
      subtitle: 'No line or station selected',
    };
  }

  const entry = findSearchEntryBySelection(syntheticSearchEntries, selection);
  if (entry !== null) {
    return {
      title: entry.primaryName,
      subtitle: entry.subtitle,
    };
  }

  return {
    title: selection.id,
    subtitle: selection.kind,
  };
}
