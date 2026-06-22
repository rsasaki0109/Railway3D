import { AppStoreProvider } from './app/app-store';
import { readInitialAppState, UrlStateSync } from './app/UrlStateSync';
import { FeatureInspector } from './features/inspector/FeatureInspector';
import { LayerPanel } from './features/layers/LayerPanel';
import { Legend } from './features/legend/Legend';
import { MapViewport } from './features/map/MapViewport';
import { SearchCommand } from './features/search/SearchCommand';

const buildLabel = 'development build';
const healthHref = `${import.meta.env.BASE_URL}health.json`;

export function getBuildStatusText(): string {
  return `Railway3D ${buildLabel}`;
}

export function App() {
  const initialState = readInitialAppState();

  return (
    <AppStoreProvider initialState={initialState}>
      <UrlStateSync />
      <main className="app-shell" aria-labelledby="app-title">
        <section className="map-stage" aria-label="Railway3D map shell">
          <MapViewport />
        </section>
        <section className="app-panel" aria-describedby="app-summary">
          <div className="app-heading">
            <p className="eyebrow">Static-first 3D Railway Geospatial Platform</p>
            <h1 id="app-title">Railway3D</h1>
            <p id="app-summary" className="summary">
              {getBuildStatusText()}. PR-007 adds visualization modes, legend, uncertainty cues, and
              layer controls. Real railway data is not implemented yet.
            </p>
          </div>
          <SearchCommand />
          <FeatureInspector />
          <Legend />
          <LayerPanel />
          <div className="panel-actions">
            <a className="health-link" href={healthHref}>
              View build metadata
            </a>
          </div>
        </section>
      </main>
    </AppStoreProvider>
  );
}
