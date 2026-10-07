import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { installConnected } from '../tests/fixtures/connected.mjs';

// Actual UI pixels, synthetic data, and an owned server/browser; no personal tabs.
const server = await createServer({ configFile:'vite.config.js', logLevel:'warn', server:{host:'127.0.0.1',port:0} });
await server.listen();
let browser;
const errors = [];
const shots = [];
try {
  browser = await chromium.launch();
  const page = await browser.newPage({baseURL:`http://127.0.0.1:${server.httpServer.address().port}`, viewport:{width:1440,height:900}});
  page.on('pageerror', error => errors.push(error.message));
  await fs.mkdir('docs/media', {recursive:true});
  const shot = async name => {
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1420,880);
    await page.screenshot({path:`docs/media/upstream-${name}.png`,animations:'disabled'});
    shots.push(name);
  };
  await page.goto('/');
  await page.getByRole('button',{name:'Code',exact:true}).click();
  await page.getByRole('row').filter({hasText:'Unify settlement API, Kafka delivery and reconciliation'}).getByRole('button',{name:'Review',exact:true}).click();
  await expect(page.getByLabel('Current business flow')).toContainText('Kafka');
  await page.getByLabel('Collapse sidebar',{exact:true}).click();
  await page.getByRole('button',{name:'Preview AI guide',exact:true}).click();
  await page.getByRole('button',{name:'Open component SettlementService.ts',exact:true}).click();
  await page.locator('.diagram-scroll').evaluate(canvas => { canvas.scrollTop = 110; });
  await page.getByLabel('Calls for selected component',{exact:true}).click();
  await expect(page.getByLabel('Source calls for selected component',{exact:true})).toContainText('SettlementPersistenceAdapter.save()');
  await shot('review-calls');
  await page.getByLabel('Source calls for selected component',{exact:true}).getByRole('button',{name:/Inspect call .*SettlementPersistenceAdapter.save\(\)/}).click();
  await page.getByLabel('Diagram review comment').fill('Does this save use the same idempotency boundary as the storage read?');
  await page.getByLabel('Flow details',{exact:true}).click();
  await page.locator('.api-contracts summary').click();
  await shot('review-details');
  await page.setViewportSize({width:980,height:650});
  await page.getByLabel('Toggle theme',{exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.waitForTimeout(300); // Allow theme color transitions to settle before pixels.
  await page.getByLabel('Flow details',{exact:true}).click();
  await expect(page.locator('.api-contracts')).toHaveAttribute('open','');
  await shot('review-narrow-dark');

  const commands = await browser.newPage({baseURL:page.url(),viewport:{width:1440,height:900}});
  commands.on('pageerror', error => errors.push(error.message));
  await installConnected(commands);
  await commands.getByLabel('Global search',{exact:true}).click();
  await commands.getByLabel('Connected global search').fill('Docs');
  await expect(commands.locator('[cmdk-item]').filter({hasText:'Docs'}).first()).toBeVisible();
  await commands.screenshot({path:'docs/media/upstream-search-navigation.png',animations:'disabled'}); shots.push('search-navigation');
  await commands.keyboard.press('Escape');
  await commands.evaluate(() => { for (const key of ['jira','gitlab','confluence']) window.__fixture.configs[key].tokenConfigured = false; });
  await commands.getByLabel('Global search',{exact:true}).click();
  await commands.getByLabel('Connected global search').fill('zznomatchzz');
  await expect(commands.getByRole('status').filter({hasText:'No matching tasks or commands.'})).toBeVisible();
  await commands.screenshot({path:'docs/media/upstream-search-empty.png',animations:'disabled'}); shots.push('search-empty');
  expect(errors).toEqual([]);
  const evidence = {screenshots:shots,pageErrors:errors,scope:'Actual Worklane UI in isolated Chromium; synthetic demo and service fixtures'};
  await fs.mkdir('research/upstream-ux-review',{recursive:true});
  await fs.writeFile('research/upstream-ux-review/screenshots.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
} finally { await browser?.close(); await server.close(); }
