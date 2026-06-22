import { useAppStore } from '../../app/app-store';
import type { VisualizationState } from '../../renderer/railway/render-types';

type ToggleKey = Extract<
  keyof VisualizationState,
  'stationVisible' | 'labelVisible' | 'guideVisible' | 'uncertaintyVisible'
>;

const toggles: readonly {
  key: ToggleKey;
  label: string;
  detail: string;
  testId: string;
}[] = [
  {
    key: 'stationVisible',
    label: 'Stations',
    detail: 'Station points in the synthetic fixture',
    testId: 'layer-stations',
  },
  {
    key: 'labelVisible',
    label: 'Labels',
    detail: 'Station labels kept separate from station visibility',
    testId: 'layer-labels',
  },
  {
    key: 'guideVisible',
    label: 'Guides',
    detail: 'Selection guide and profile cursor overlays',
    testId: 'layer-guides',
  },
  {
    key: 'uncertaintyVisible',
    label: 'Uncertainty',
    detail: 'Extra cue for low-confidence or unknown values',
    testId: 'layer-uncertainty',
  },
];

export function LayerPanel() {
  const { state, dispatch } = useAppStore();

  const setToggle = (key: ToggleKey, checked: boolean) => {
    dispatch({
      type: 'set-visualization',
      visualization: {
        ...state.visualization,
        [key]: checked,
      },
    });
  };

  return (
    <section className="layer-panel" aria-labelledby="layer-panel-title">
      <h2 id="layer-panel-title">Layers</h2>
      <div className="layer-list">
        {toggles.map((toggle) => (
          <label key={toggle.key} className="layer-toggle">
            <input
              type="checkbox"
              checked={state.visualization[toggle.key]}
              data-testid={toggle.testId}
              onChange={(event) => setToggle(toggle.key, event.currentTarget.checked)}
            />
            <span>
              <span className="layer-toggle-title">{toggle.label}</span>
              <span className="layer-toggle-detail">{toggle.detail}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
