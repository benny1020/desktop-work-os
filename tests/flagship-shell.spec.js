import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

test('One global search entry remains usable across every navigation layout and returns keyboard focus', async ({ page }) => {
  await installConnected(page);
  for (const [width, height] of [[1440, 900], [980, 720], [860, 760]]) {
    await page.setViewportSize({ width, height });
    for (const layout of ['Expanded', 'Icons only', 'Hide sidebar']) {
      if (await page.getByLabel('Show sidebar', { exact: true }).isVisible()) await page.getByLabel('Show sidebar', { exact: true }).click();
      await page.getByLabel('Sidebar options', { exact: true }).click();
      await page.getByRole('group', { name: 'Sidebar layout', exact: true }).getByRole('button', { name: layout, exact: true }).click();
      const entry = page.getByRole('button', { name: 'Global search', exact: true });
      await expect(entry).toHaveCount(1);
      expect(await entry.evaluate(el => {
        const b = el.getBoundingClientRect();
        return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight && el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
      })).toBe(true);
      await entry.click();
      await expect(page.getByLabel('Connected global search', { exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(entry).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  expect(await page.evaluate(() => window.__fixture.calls.some(call => /^(jira\.(edit|transition|comment)|gitlab\.(comment|approve)|claude\.)/.test(call.action)))).toBe(false);
});

test('Sample Home prioritizes concrete work and keeps linked previews within the daily context', async ({ page }) => {
  await page.goto('/');
  for (const width of [1440, 980]) {
    await page.setViewportSize({ width, height: 900 });
    const queue = page.getByRole('region', { name: 'Work needing attention', exact: true });
    await expect(queue).toBeVisible();
    await expect(queue).toContainText('Fix order status mapping');
    expect((await queue.getByRole('button', { name: 'Review changes', exact: true }).boundingBox()).y).toBeLessThanOrEqual(300);
    if (width === 980) {
      const agenda = await page.locator('.demo-cockpit .daily-column').boundingBox();
      const trail = await page.getByRole('region', { name: 'Connected work trail', exact: true }).boundingBox();
      expect(agenda.y).toBeLessThan(trail.y);
      await expect(page.getByRole('heading', { name: 'Your day', exact: false })).toBeInViewport();
    }
  }
  await page.getByLabel('Open linked payment policy', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payment Retry Policy', exact: true }).first()).toBeVisible();
  await page.getByLabel('Close inspector', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Good morning, Alex.', exact: true })).toBeVisible();
});
