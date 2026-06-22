import { expect, test } from '@playwright/test';

test('loads the PR-001 development build and metadata', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Railway3D' })).toBeVisible();
  await expect(page.getByText('development build')).toBeVisible();
  await expect(page.getByText('PR-004 adds the MapLibre and deck.gl map shell')).toBeVisible();
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
    timeout: 15_000,
  });

  const before = await page.getByTestId('view-state').textContent();
  await page.locator('.maplibregl-ctrl-zoom-in').click();

  await expect.poll(() => page.getByTestId('view-state').textContent()).not.toBe(before);
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
