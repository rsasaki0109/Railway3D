const buildLabel = 'development build';
const healthHref = `${import.meta.env.BASE_URL}health.json`;

export function getBuildStatusText(): string {
  return `Railway3D ${buildLabel}`;
}

export function App() {
  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="hero" aria-describedby="app-summary">
        <p className="eyebrow">Static-first 3D Railway Geospatial Platform</p>
        <h1 id="app-title">Railway3D</h1>
        <p id="app-summary" className="summary">
          {getBuildStatusText()}. This PR-001 screen only verifies the workspace, build, test, and
          static deployment pipeline.
        </p>
        <a className="health-link" href={healthHref}>
          View build metadata
        </a>
      </section>
      <section className="status-panel" aria-label="Bootstrap status">
        <h2>Bootstrap scope</h2>
        <ul>
          <li>React and Vite application shell</li>
          <li>GitHub Pages base path support</li>
          <li>TypeScript, lint, unit, E2E, and Python CLI checks</li>
        </ul>
      </section>
    </main>
  );
}
