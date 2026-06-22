import { expect, test } from '@playwright/test';

test('loads the PR-005 development build and metadata', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Railway3D' })).toBeVisible();
  await expect(page.getByText('development build')).toBeVisible();
  await expect(
    page.getByText('PR-005 adds synthetic railway rendering and X-ray layers'),
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
  await expect(page.getByTestId('map-status')).toContainText(/3D map ready|Terrain unavailable/, {
    timeout: 30_000,
  });

  const before = await page.getByTestId('view-state').textContent();
  await page.locator('.maplibregl-ctrl-zoom-in').click();

  await expect
    .poll(() => page.getByTestId('view-state').textContent(), { timeout: 10_000 })
    .not.toBe(before);
});

test('switches X-ray modes and vertical exaggeration', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByTestId('map-status')).toContainText(/3D map ready|Terrain unavailable/, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('xray-status')).toContainText('selected · 1 path');

  await page.getByTestId('xray-off').click();
  await expect(page.getByTestId('xray-status')).toContainText('off · 0 paths');

  await page.getByTestId('xray-all-underground').click();
  await expect(page.getByTestId('xray-status')).toContainText('all-underground · 1 path');

  await page.getByTestId('vex-3').click();
  await expect(page.getByTestId('vex-status')).toContainText('Vertical ×3');

  await page.getByTestId('color-structure').click();
  await expect(page.getByTestId('color-structure')).toHaveAttribute('data-active', 'true');
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
