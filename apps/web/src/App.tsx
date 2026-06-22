import { MapViewport } from './features/map/MapViewport';

const buildLabel = 'development build';
const healthHref = `${import.meta.env.BASE_URL}health.json`;

export function getBuildStatusText(): string {
  return `Railway3D ${buildLabel}`;
}

export function App() {
  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="map-stage" aria-label="Railway3D map shell">
        <MapViewport />
      </section>
      <section className="app-panel" aria-describedby="app-summary">
        <p className="eyebrow">Static-first 3D Railway Geospatial Platform</p>
        <h1 id="app-title">Railway3D</h1>
        <p id="app-summary" className="summary">
          {getBuildStatusText()}. PR-005 adds synthetic railway rendering and X-ray layers on the
          MapLibre and deck.gl map shell. Real railway data is not implemented yet.
        </p>
        <div className="panel-actions">
          <a className="health-link" href={healthHref}>
            View build metadata
          </a>
        </div>
      </section>
    </main>
  );
}
