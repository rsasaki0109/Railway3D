import { useAppStore } from '../../app/app-store';
import { getLegendDefinition, getVisualizationBadges } from './legend-definitions';

function swatchStyle(color: readonly [number, number, number]) {
  return {
    backgroundColor: `rgb(${color[0]} ${color[1]} ${color[2]})`,
  };
}

export function Legend() {
  const { state } = useAppStore();
  const legend = getLegendDefinition(state.visualization.colorMode);
  const badges = getVisualizationBadges(state.visualization);

  return (
    <section className="legend-panel" aria-labelledby="legend-title">
      <div className="legend-heading">
        <h2 id="legend-title" data-testid="legend-title">
          {legend.title}
        </h2>
        {legend.unit === undefined ? null : <span className="legend-unit">{legend.unit}</span>}
      </div>
      <div className="status-badges" aria-label="Visualization state">
        {badges.map((badge) => (
          <span key={badge} className="status-badge" data-testid={`legend-badge-${badge}`}>
            {badge}
          </span>
        ))}
      </div>
      <ul className="legend-list">
        {legend.entries.map((item) => (
          <li key={`${item.label}-${item.visualCue}`} className="legend-entry">
            <span className="legend-swatch" style={swatchStyle(item.color)} aria-hidden="true" />
            <span>
              <span className="legend-entry-label">{item.label}</span>
              <span className="legend-entry-cue">{item.visualCue}</span>
            </span>
          </li>
        ))}
      </ul>
      <ul className="legend-notes">
        {legend.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}
