import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

test('Connected commands return keyboard focus to the launch point after cancellation', async ({ page }) => {
  await installConnected(page);
  const origin = page.getByRole('button', { name: 'Home', exact: true });
  for (const shortcut of ['Meta+k', 'Meta+n']) {
    await origin.focus();
    await page.keyboard.press(shortcut);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(origin).toBeFocused();
  }
  const mouseOrigin = page.getByLabel('Global search', { exact: true });
  await mouseOrigin.click();
  await page.getByRole('button', { name: 'Close connected command' }).click();
  await expect(mouseOrigin).toBeFocused();
});

test('Connected navigation commands remain searchable and keyboard executable', async ({ page }) => {
  await installConnected(page);
  await page.keyboard.press('Meta+k');
  await page.getByLabel('Connected global search', { exact: true }).fill('Docs');
  const docs = page.locator('[cmdk-item]').filter({ hasText: /^Docs/ });
  await expect(docs).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.topbar')).toContainText('Docs');
});

test('A local search miss explains the empty result and can be cleared without closing', async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => {
    for (const name of ['jira', 'gitlab', 'confluence']) window.__fixture.configs[name].tokenConfigured = false;
  });
  await page.keyboard.press('Meta+k');
  const input = page.getByLabel('Connected global search', { exact: true });
  await input.fill('zznomatchzz');
  await expect(page.getByRole('status').filter({ hasText: 'No matching tasks or commands' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.locator('[cmdk-item]').filter({ hasText: /^Docs/ })).toBeVisible();
});

test('Mouse navigation opens its destination and object selection keeps focus in its preview', async ({ page }) => {
  await installConnected(page);
  await page.getByLabel('Global search', { exact: true }).click();
  await page.getByLabel('Connected global search', { exact: true }).fill('Docs');
  await page.locator('[cmdk-item]').filter({ hasText: /^Docs/ }).click();
  await expect(page.locator('.topbar')).toContainText('Docs');
  await page.keyboard.press('Meta+k');
  await page.getByLabel('Connected global search', { exact: true }).fill('PAY-382');
  await page.locator('[cmdk-item]').filter({ hasText: 'PAY-382 Payment retry implementation' }).click();
  await expect(page.getByLabel('Live issue inspector')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'))).toBe(true);
});
