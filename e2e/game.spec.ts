import { test, expect, type Page } from '@playwright/test';
const snapshot = (p: Page) => p.evaluate(() => (window as any).apexSnapshot?.());
async function start(page: Page, night = false) {
  await page.goto('/');
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('button', { name: 'Low', exact: true }).click();
  if (night) await page.getByRole('button', { name: 'Night', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: /Start race/ }).click();
  await expect.poll(async () => (await snapshot(page))?.race.phase).toBe('racing');
}

test('production driving, collision, recovery, pause, settings and restart', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await start(page);
  await expect.poll(async () => (await snapshot(page))?.models).toBe(4);
  const initial = await snapshot(page);
  await page.keyboard.down('w');
  await expect.poll(async () => (await snapshot(page)).vehicle.speedKmh).toBeGreaterThan(35);
  await page.keyboard.down('d');
  await expect.poll(async () => (await snapshot(page)).impact, { timeout: 45000 }).toBeGreaterThan(initial.impact);
  await page.keyboard.up('d'); await page.keyboard.up('w');
  const driven = await snapshot(page);
  expect(Math.hypot(driven.car.x - initial.car.x, driven.car.z - initial.car.z)).toBeGreaterThan(5);
  expect(driven.camera).not.toEqual(initial.camera);
  await page.keyboard.press('r');
  await expect.poll(async () => (await snapshot(page)).vehicle.speedKmh).toBeLessThan(5);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  const paused = await snapshot(page);
  await page.waitForTimeout(500); expect((await snapshot(page)).race.total).toBe(paused.race.total);
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('button', { name: 'Night', exact: true }).click();
  await page.getByRole('button', { name: 'Medium', exact: true }).click();
  await page.getByRole('checkbox', { name: /Mute/ }).check();
  expect((await snapshot(page)).race.total).toBe(paused.race.total);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: /Resume/ }).click();
  await expect.poll(async () => (await snapshot(page)).race.total).toBeGreaterThan(paused.race.total);
  await page.screenshot({ path: info.outputPath('night.png') });
  console.log('Rendering counters (960x600, headless Chromium):', JSON.stringify(await snapshot(page)));
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: /Restart/ }).click();
  await expect.poll(async () => (await snapshot(page)).race.phase).toBe('countdown');
  expect((await snapshot(page)).settings.environment).toBe('night');
  await page.reload();
  await expect.poll(async () => (await snapshot(page))?.settings.muted).toBe(true);
  expect(errors).toEqual([]);
});

test('mobile portrait menu and landscape touch controls', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 }); await start(page, true);
  const gas = page.getByRole('button', { name: 'GAS', exact: true });
  await expect(gas).toBeVisible();
  await gas.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
  await expect.poll(async () => (await snapshot(page)).vehicle.speedKmh).toBeGreaterThan(20);
  await gas.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
  await page.screenshot({ path: info.outputPath('mobile-driving.png') });
  await page.getByRole('button', { name: 'II', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('mobile.png') });
  expect(errors).toEqual([]); await context.close();
});

test('missing optional GLB leaves a drivable recovery car', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/sports-car.glb', route => route.abort());
  await start(page);
  expect((await snapshot(page)).models).toBe(0);
  await page.keyboard.down('w');
  await expect.poll(async () => (await snapshot(page)).vehicle.speedKmh).toBeGreaterThan(20);
  await page.keyboard.up('w'); expect(errors).toEqual([]);
});

test('sensor denial keeps touch steering available', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'DeviceOrientationEvent', { configurable: true, value: class { static async requestPermission() { return 'denied'; } } });
  });
  await page.goto('/'); await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('button', { name: 'Enable tilt', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Permission denied');
  await expect(page.getByRole('button', { name: 'Touch / keys', exact: true })).toHaveClass('on');
});
