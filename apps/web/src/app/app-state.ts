import {
  INITIAL_VIEW_STATE,
  type ViewStateSerializable,
} from '../renderer/maplibre-deck/view-state';
import { SYNTHETIC_LINE_ID } from '../renderer/railway/synthetic-render-dataset';
import type { Selection, VisualizationState } from '../renderer/railway/render-types';

export interface ViewSlice {
  view: ViewStateSerializable;
}

export interface VisualizationSlice {
  visualization: VisualizationState;
}

export interface SelectionSlice {
  selection: Selection;
  hovered: Selection;
  profileCursorChainageM: number | null;
}

export interface DataSlice {
  datasetId: string;
  status: 'ready';
  error: string | null;
}

export interface UiSlice {
  activePanel: 'none' | 'search' | 'details';
}

export interface AppState
  extends ViewSlice, VisualizationSlice, SelectionSlice, DataSlice, UiSlice {}

export const DEFAULT_VISUALIZATION: VisualizationState = {
  colorMode: 'line',
  xrayMode: 'selected',
  verticalExaggeration: 1,
  stationVisible: true,
  labelVisible: true,
  guideVisible: true,
  uncertaintyVisible: true,
};

export const DEFAULT_SELECTION: Selection = { kind: 'line', id: SYNTHETIC_LINE_ID };

export const DEFAULT_APP_STATE: AppState = {
  view: INITIAL_VIEW_STATE,
  visualization: DEFAULT_VISUALIZATION,
  selection: DEFAULT_SELECTION,
  hovered: null,
  profileCursorChainageM: null,
  datasetId: 'synthetic-render-fixture',
  status: 'ready',
  error: null,
  activePanel: 'search',
};

export type AppAction =
  | { type: 'hydrate'; state: AppState }
  | { type: 'set-view'; view: ViewStateSerializable }
  | { type: 'set-visualization'; visualization: VisualizationState }
  | { type: 'set-selection'; selection: Selection }
  | { type: 'set-hovered'; hovered: Selection }
  | { type: 'set-active-panel'; activePanel: UiSlice['activePanel'] };

export function createAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...DEFAULT_APP_STATE,
    ...overrides,
    visualization: {
      ...DEFAULT_APP_STATE.visualization,
      ...overrides.visualization,
    },
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'set-view':
      return { ...state, view: action.view };
    case 'set-visualization':
      return { ...state, visualization: action.visualization };
    case 'set-selection':
      return { ...state, selection: action.selection, activePanel: 'details' };
    case 'set-hovered':
      return { ...state, hovered: action.hovered };
    case 'set-active-panel':
      return { ...state, activePanel: action.activePanel };
  }
}

export function selectionKey(selection: Selection): string {
  if (selection === null) {
    return 'none';
  }

  return `${selection.kind}:${selection.id}${selection.kind === 'segment' ? `:${selection.chainageM ?? ''}` : ''}`;
}
