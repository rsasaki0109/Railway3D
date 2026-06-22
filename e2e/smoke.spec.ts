import { expect, test, type Page } from '@playwright/test';

async function waitForMapReady(page: Page) {
  await expect(page.getByTestId('map-status')).toContainText(/3D map ready|Terrain unavailable/, {
    timeout: 30_000,
  });
}

async function selectSearchResult(page: Page, query: string) {
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill(query);
  await page.keyboard.press('Enter');
}

test('loads the PR-008 development build and metadata', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Railway3D' })).toBeVisible();
  await expect(page.getByText('development build')).toBeVisible();
  await expect(
    page.getByText('PR-008 adds the synthetic elevation profile, SVG cursor sync'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'View build metadata' })).toBeVisible();

  const response = await page.request.get('./health.json');
  await expect(response).toBeOK();
  expect(await response.json()).toEqual(
    expect.objectContaining({
      name: 'Railway3D',
      status: 'development',
      version: '0.0.0',
    }),
  );
});

test('loads one interactive MapLibre canvas and responds to zoom', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByTestId('map-viewport')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(1);
  await waitForMapReady(page);

  const before = await page.getByTestId('view-state').textContent();
  await page.locator('.maplibregl-ctrl-zoom-in').click();

  await expect
    .poll(() => page.getByTestId('view-state').textContent(), { timeout: 10_000 })
    .not.toBe(before);
});

test('switches X-ray modes and vertical exaggeration', async ({ page }) => {
  await page.goto('./');

  await waitForMapReady(page);
  await expect(page.getByTestId('xray-status')).toContainText('selected · 1 path');
  await expect(page.getByTestId('legend-badge-X-ray selected')).toBeVisible();

  await page.getByTestId('xray-off').click();
  await expect(page.getByTestId('xray-status')).toContainText('off · 0 paths');

  await page.getByTestId('xray-all-underground').click();
  await expect(page.getByTestId('xray-status')).toContainText('all-underground · 1 path');
  await expect(page.getByTestId('legend-badge-X-ray all-underground')).toBeVisible();

  await page.getByTestId('vex-3').click();
  await expect(page.getByTestId('vex-status')).toContainText('Vertical ×3');
  await expect(page.getByTestId('legend-badge-Vertical x3')).toBeVisible();

  await page.getByTestId('color-structure').click();
  await expect(page.getByTestId('color-structure')).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('legend-title')).toHaveText('Structure');
});

test('switches all visualization modes and updates the dynamic legend', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  const modes = [
    ['color-line', 'Line color'],
    ['color-structure', 'Structure'],
    ['color-clearance', 'Ground clearance'],
    ['color-gradient', 'Gradient'],
    ['color-confidence', 'Confidence'],
  ] as const;

  for (const [testId, title] of modes) {
    await page.getByTestId(testId).click();
    await expect(page.getByTestId(testId)).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('legend-title')).toHaveText(title);
  }

  await page.getByTestId('color-clearance').click();
  await expect(page.getByText('Null clearance is not converted to zero.')).toBeVisible();
});

test('toggles layer and uncertainty controls from the layer panel', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  await expect(page.getByTestId('layer-stations')).toBeChecked();
  await expect(page.getByTestId('layer-labels')).toBeChecked();
  await expect(page.getByTestId('layer-guides')).toBeChecked();
  await expect(page.getByTestId('layer-uncertainty')).toBeChecked();
  await expect(page.getByTestId('legend-badge-Uncertainty on')).toBeVisible();

  await page.getByTestId('layer-uncertainty').uncheck();
  await expect(page.getByTestId('layer-uncertainty')).not.toBeChecked();
  await expect(page.getByTestId('legend-badge-Uncertainty off')).toBeVisible();

  await page.getByTestId('layer-labels').uncheck();
  await expect(page.getByTestId('layer-labels')).not.toBeChecked();
});

test('renders the synthetic SVG elevation profile and table alternative', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  await expect(page.getByTestId('profile-status')).toContainText(
    'Golden synthetic elevation profile',
  );
  await expect(page.getByTestId('profile-chart')).toBeVisible();
  await expect(page.getByTestId('profile-rail-segment')).toHaveCount(2);
  await expect(page.getByTestId('profile-legend')).toContainText('Null rail gap');
  await expect(page.getByTestId('profile-table')).toContainText('Station C');
  await expect(page.getByTestId('profile-table')).toContainText('unknown');
});

test('syncs profile cursor to the map overlay and URL state', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  await expect(page.getByTestId('profile-cursor-status')).toContainText('1.00 km');
  await expect(page.getByTestId('profile-cursor-map-status')).toContainText('1000.0 m');

  await page.getByTestId('profile-chart').scrollIntoViewIfNeeded();
  await page.getByTestId('profile-chart').focus();
  await page.keyboard.press('ArrowRight');

  await expect(page.getByTestId('profile-cursor-status')).toContainText('1.50 km');
  await expect(page.getByTestId('profile-cursor-map-status')).toContainText('1500.0 m');
  await expect.poll(() => page.url()).toContain('profile=1500');

  await page.reload();
  await waitForMapReady(page);
  await expect(page.getByTestId('profile-cursor-status')).toContainText('1.50 km');
});

test('keeps null rail profile samples explicit', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  await page.getByTestId('profile-next-sample').click();
  await page.getByTestId('profile-next-sample').click();
  await expect(page.getByTestId('profile-cursor-status')).toContainText('2.00 km');
  await expect(page.getByTestId('profile-cursor-status')).toContainText('rail unknown');
});

test('brushes the profile and fits the map view', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  const before = await page.getByTestId('view-state').textContent();
  const chart = page.getByTestId('profile-chart');
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  if (box === null) {
    throw new Error('Profile chart bounding box was not available.');
  }

  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.78, box.y + box.height * 0.5);
  await page.mouse.up();

  await expect(page.getByTestId('profile-brush-status')).toContainText('Map fit');
  await expect
    .poll(() => page.getByTestId('view-state').textContent(), { timeout: 10_000 })
    .not.toBe(before);
});

test('supports keyboard search, selection, and clear', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  await page.keyboard.press('/');
  await expect(page.getByTestId('search-input')).toBeFocused();
  await page.getByTestId('search-input').fill('SYN-A');
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('selection-status')).toContainText('Station A');
  await expect(page.getByTestId('inspector-title')).toHaveText('Station A');

  await page.getByTestId('clear-selection').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('selection-status')).toContainText('None');
  await expect(page.getByTestId('inspector-title')).toHaveText('None');
});

test('restores selection with browser back and forward', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  await selectSearchResult(page, 'SYN-A');
  await expect(page.getByTestId('inspector-title')).toHaveText('Station A');

  await selectSearchResult(page, 'SYN-C');
  await expect(page.getByTestId('inspector-title')).toHaveText('Station C');

  await page.goBack();
  await expect(page.getByTestId('inspector-title')).toHaveText('Station A');

  await page.goForward();
  await expect(page.getByTestId('inspector-title')).toHaveText('Station C');
});

test('clamps invalid URL state and ignores unsupported values', async ({ page }) => {
  await page.goto('./#/@999,999,99,99,999?mode=bad&xray=bad&vex=99&station=bad');
  await waitForMapReady(page);

  await expect(page.getByTestId('view-state')).toContainText(
    'lng 180.000 · lat 85.000 · z 22.0 · pitch 75 · bearing 180',
  );
  await expect(page.getByTestId('xray-status')).toContainText('selected · 1 path');
  await expect(page.getByTestId('vex-status')).toContainText('Vertical ×1');
  await expect(page.getByTestId('selection-status')).toContainText('Golden Fixture Line');
});

test('distinguishes same-name station search candidates', async ({ page }) => {
  await page.goto('./');

  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('Station Echo');

  await expect(page.getByText('North Fixture Branch')).toBeVisible();
  await expect(page.getByText('Synthetic North')).toBeVisible();
  await expect(page.getByText('South Fixture Branch')).toBeVisible();
  await expect(page.getByText('Synthetic South')).toBeVisible();
});

test('surfaces WebGL context loss in the DOM', async ({ page }) => {
  await page.goto('./');

  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event('webglcontextlost'));
  });

  await expect(page.getByTestId('map-status')).toContainText('WebGL context lost');
});
