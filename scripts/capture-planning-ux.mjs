import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { installConnected } from '../tests/fixtures/connected.mjs';

// Synthetic connected fixtures in an isolated browser. Never uses saved credentials.
const root = fileURLToPath(new URL('../', import.meta.url));
const media = new URL('../docs/media/', import.meta.url);
const server = await createServer({ root, configFile: `${root}vite.config.js`, logLevel: 'warn', server: { host: '127.0.0.1', port: 0, strictPort: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: `http://127.0.0.1:${server.httpServer.address().port}`, viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Seoul' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-07T09:00:00+09:00') });
  await installConnected(page);
  const add = async (title, kind = 'task') => {
    await page.getByLabel('Personal item type').selectOption(kind);
    await page.getByLabel('Quick add personal work').fill(title);
    await page.getByRole('button', { name: 'Add to plan', exact: true }).click();
  };
  await add('Backend sync 10am', 'event');
  await add('Review payment retry 11am');
  await add('Release checklist 1pm');
  await add('Update retry docs 2pm');
  await add('Review order status mapping 2026-10-05 11am');
  await add('Draft retry policy 2026-10-06 2pm');
  await add('Review settlement outbox 2026-10-08 2pm');
  await add('Run staging checks 2026-10-09 10am');
  await add('Verify weekend rollout 2026-10-10 9am');
  await page.getByRole('button', { name: 'This Week', exact: true }).first().click();
  await page.getByLabel('Week layout',{exact:true}).selectOption('workweek');
  await page.mouse.move(0, 0);
  const card = page.locator('.planning-grid .plan-task').filter({ hasText: 'Review payment retry' });
  const next = page.locator('.planning-grid .plan-task').filter({ hasText: 'Release checklist' });
  const before = { card: await card.boundingBox(), next: await next.boundingBox() };
  await card.hover();
  await card.getByLabel('More planning actions for Review payment retry', { exact: true }).click();
  const after = { card: await card.boundingBox(), next: await next.boundingBox() };
  expect(after.card.height).toBe(before.card.height);
  expect(after.next.y).toBe(before.next.y);
  await fs.mkdir(media, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('upstream-planning-week.png', media)), animations: 'disabled' });
  await card.getByLabel('More planning actions for Review payment retry', { exact: true }).press('Escape');
  await page.getByRole('heading', {name:'This Week',exact:true}).click();
  await page.screenshot({ path: fileURLToPath(new URL('todo-workweek.png', media)), animations: 'disabled' });
  await page.getByLabel('Toggle theme', { exact: true }).click();
  // Wait for inherited button-color transitions to finish before recording dark pixels.
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.plan-task:not(.done) .plan-task-main > button')).color === getComputedStyle(document.body).color);
  await card.hover();
  await card.getByLabel('More planning actions for Review payment retry', { exact: true }).click();
  await page.screenshot({ path: fileURLToPath(new URL('upstream-planning-week-dark.png', media)), animations: 'disabled' });
  expect(errors).toEqual([]);
  const evidence = { screenshots: 3, before, after, pageErrors: errors, scope: 'Actual isolated app pixels; synthetic Jira/GitLab fixture and personal tasks; frozen 2026-10-07 Asia/Seoul' };
  const evidenceDir = new URL('../research/upstream-planning-ux/', import.meta.url);
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(new URL('screenshots.json', evidenceDir), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await browser?.close();
  await server.close();
}
