import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { installConnected } from '../tests/fixtures/connected.mjs';

const folder = new URL('../docs/media/', import.meta.url).pathname;
await fs.mkdir(folder, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: 'http://127.0.0.1:5178', viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00+09:00'));
  await installConnected(page);
  await expect(page.locator('.inbox-work[data-linked-work="PAY-382"]')).toBeVisible();
  await page.getByLabel('Quick add personal work').fill('Read retry runbook 2026-10-08 11am');
  await page.getByRole('button', { name: 'Add to plan', exact: true }).click();
  await page.getByRole('button', { name: 'This Week', exact: true }).first().click();
  await page.getByLabel('Planning date').fill('2026-10-09');
  await page.locator('.inbox-work[data-linked-work="PAY-382"]').getByRole('button', { name: 'Add to 2026-10-09', exact: true }).click();
  await page.locator('.inbox-work[data-linked-work="mr:42:7"]').getByRole('button', { name: 'Add review to 2026-10-09', exact: true }).click();
  await expect(page.locator('.planning-grid')).toContainText('Planned after deadline');
  await page.locator('.main-content').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: folder + 'planning-week-practical.png', animations: 'disabled' });
  await page.locator('nav .nav-item[aria-label="Projects"]').click();
  await page.locator('nav .subnav button[aria-label="Sprint"]').click();
  await expect(page.getByLabel('Jira planning sprint')).toHaveValue('24');
  await page.locator('.live-board-card').first().click();
  const inspector = page.getByLabel('Live issue inspector');
  await expect(inspector).toContainText('Payment retry implementation');
  await inspector.locator('.issue-planning-details summary').click();
  await inspector.getByLabel('Jira scrum board').selectOption('10');
  await inspector.getByLabel('Jira sprint', { exact: true }).selectOption('25');
  await inspector.getByRole('button', { name: 'Move to sprint in Jira', exact: true }).click();
  await expect(inspector.getByLabel('Jira sprint membership')).toContainText('Sprint 25');
  await page.getByLabel('Jira planning sprint').selectOption('25');
  await expect(page.locator('.live-board-card')).toHaveCount(1);
  await inspector.getByRole('button', { name: 'Plan…', exact: true }).click();
  await expect(inspector.getByLabel('Local planning date')).toHaveValue('2026-10-09');
  await page.screenshot({ path: folder + 'planning-sprint-practical.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await expect(page.locator('.live-board-card')).toHaveCSS('color', 'rgb(222, 228, 232)');
  await page.screenshot({ path: folder + 'planning-sprint-practical-dark.png', animations: 'disabled' });
  if (errors.length) throw Error(errors.join('\n'));
  console.log(JSON.stringify({ screenshots: 3, fixtureData: true, errors }));
} finally {
  await browser.close();
}
