import { useAppStore } from '../../app/app-store';
import { getSelectionDisplay } from './selection-display';

export function FeatureInspector() {
  const { state, dispatch } = useAppStore();
  const display = getSelectionDisplay(state.selection);

  return (
    <section className="feature-inspector" aria-labelledby="inspector-title">
      <div>
        <p className="eyebrow">Selection</p>
        <h2 id="inspector-title" data-testid="inspector-title">
          {display.title}
        </h2>
        <p className="inspector-subtitle" data-testid="inspector-subtitle">
          {display.subtitle}
        </p>
      </div>
      <dl className="inspector-list">
        <div>
          <dt>Dataset</dt>
          <dd>{state.datasetId}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{state.status}</dd>
        </div>
      </dl>
      <p className="inspector-note">Synthetic fixture only · no real railway elevation data</p>
      <button
        type="button"
        className="map-action"
        data-testid="clear-selection"
        onClick={() => dispatch({ type: 'set-selection', selection: null })}
      >
        Clear selection
      </button>
    </section>
  );
}
