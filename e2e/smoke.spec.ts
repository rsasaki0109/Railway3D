import { expect, test, type Page } from '@playwright/test';

async function waitForMapReady(page: Page) {
  await expect(page.getByTestId('map-status')).toContainText(/3D map ready|Terrain unavailable/, {
    timeout: 60_000,
  });
}

async function selectSearchResult(page: Page, query: string) {
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill(query);
  await page.keyboard.press('Enter');
}

test('loads the Tokyo Metro development build and metadata', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Railway3D' })).toBeVisible();
  await expect(page.getByText('development build')).toBeVisible();
  await expect(page.locator('#app-summary')).toContainText('Tokyo Metro pilot');
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
  await expect(page.getByTestId('xray-status')).toContainText('all-underground · 2 paths');
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

test('renders the Ginza Line elevation profile and table alternative', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  await expect(page.getByTestId('profile-status')).toContainText('銀座線');
  await expect(page.getByTestId('profile-chart')).toBeVisible();
  await expect(page.getByTestId('profile-rail-segment')).toHaveCount(2);
  await expect(page.getByTestId('profile-legend')).toContainText('Null rail gap');
  await expect(page.getByTestId('profile-table')).toContainText('渋谷');
  await expect(page.getByTestId('profile-table')).toContainText('unknown');
});

test('syncs profile cursor to the map overlay and URL state', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  await expect(page.getByTestId('profile-cursor-status')).toContainText('2.40 km');
  await expect(page.getByTestId('profile-cursor-map-status')).toContainText('2400.0 m');

  await page.getByTestId('profile-chart').scrollIntoViewIfNeeded();
  await page.getByTestId('profile-chart').focus();
  await page.keyboard.press('ArrowRight');

  await expect(page.getByTestId('profile-cursor-status')).toContainText('3.20 km');
  await expect(page.getByTestId('profile-cursor-map-status')).toContainText('3200.0 m');
  await expect.poll(() => page.url()).toContain('profile=3200');

  await page.reload();
  await waitForMapReady(page);
  await expect(page.getByTestId('profile-cursor-status')).toContainText('3.20 km');
});

test('keeps null rail profile samples explicit', async ({ page }) => {
  await page.goto('./#/@139.77,35.68,12,52,-28?line=r3d:jp:tokyometro:line:ginza&profile=7200');
  await waitForMapReady(page);

  await expect(page.getByTestId('profile-cursor-status')).toContainText('7.20 km');
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
  await page.getByTestId('search-input').fill('G-16');
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('selection-status')).toContainText('上野');
  await expect(page.getByTestId('inspector-title')).toHaveText('上野');

  await page.getByTestId('clear-selection').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('selection-status')).toContainText('None');
  await expect(page.getByTestId('inspector-title')).toHaveText('None');
});

test('restores selection with browser back and forward', async ({ page }) => {
  await page.goto('./');
  await waitForMapReady(page);

  await selectSearchResult(page, 'G-16');
  await expect(page.getByTestId('inspector-title')).toHaveText('上野');

  await selectSearchResult(page, 'G-01');
  await expect(page.getByTestId('inspector-title')).toHaveText('渋谷');

  await page.goBack();
  await expect(page.getByTestId('inspector-title')).toHaveText('上野');

  await page.goForward();
  await expect(page.getByTestId('inspector-title')).toHaveText('渋谷');
});

test('clamps invalid URL state and ignores unsupported values', async ({ page }) => {
  await page.goto('./#/@999,999,99,99,999?mode=bad&xray=bad&vex=99&station=bad');
  await waitForMapReady(page);

  await expect(page.getByTestId('view-state')).toContainText(
    'lng 180.000 · lat 85.000 · z 22.0 · pitch 75 · bearing 180',
  );
  await expect(page.getByTestId('xray-status')).toContainText('selected · 1 path');
  await expect(page.getByTestId('vex-status')).toContainText('Vertical ×1');
  await expect(page.getByTestId('selection-status')).toContainText('銀座線');
});

test('distinguishes same-name station search candidates', async ({ page }) => {
  await page.goto('./');

  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('銀座');

  await expect(page.getByText('銀座線').first()).toBeVisible();
  await expect(page.getByText('丸ノ内線').first()).toBeVisible();
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
