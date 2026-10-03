// Record real UI interactions using synthetic service fixtures only.
// Run Vite on 127.0.0.1:5178 first. No company credentials are used.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { installConnected } from '../tests/fixtures/connected.mjs';
const root = new URL('..', import.meta.url).pathname;
const browser = await chromium.launch();
const manifest = { syntheticData: true, animations: [], screenshots: [], errors: [] };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function screenshot(page, name) {
  await page.screenshot({path: `${root}/docs/media/${name}.png`, animations:'disabled'});
  manifest.screenshots.push(name);
}
const hero = await browser.newPage({viewport:{width:1440,height:900}});
await hero.goto('http://127.0.0.1:5178');
await expect(hero.getByRole('heading',{name:'Good morning, Alex.'})).toBeVisible();
await hero.evaluate(() => document.fonts.ready);
await screenshot(hero, 'daily-command-center');
await hero.close();
async function scene(name, actions) {
  const folder = `${root}/artifacts/readme-recording/${name}`;
  await fs.mkdir(folder, { recursive: true });
  for (const file of await fs.readdir(folder)) if (/^\d+\.png$/.test(file)) await fs.unlink(`${folder}/${file}`);
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:5178', viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => manifest.errors.push(error.message));
  await installConnected(page);
  await expect(page.locator('.inbox-work')).toBeVisible();
  let done = false, count = 0;
  const start = Date.now(), times = [];
  const record = (async () => {
    while (!done) {
      times.push(Date.now() - start);
      await page.screenshot({ path: `${folder}/${String(count++).padStart(4, '0')}.png` });
      await pause(170);
    }
  })();
  try { await actions(page); await pause(1000); }
  finally { done = true; await record; await page.close(); }
  manifest.animations.push({ name, frames: count, durationMs: Date.now()-start, times });
  await fs.writeFile(`${folder}/timing.json`, JSON.stringify(times));
}
await scene('visual-review', async p => {
  await p.locator('.attention-row').getByRole('button', { name: /Payment retry review/ }).click();
  await expect(p.getByRole('img', { name: 'Dependency flow diagram' })).toBeVisible();
  await pause(1400);
  await p.getByRole('button', { name: 'Open component PaymentService.ts', exact: true }).click();
  await pause(900);
  await p.getByRole('checkbox', { name: /Mark .* as viewed/ }).check();
  await pause(500);
  await p.getByRole('button', {name:'Next unreviewed',exact:true}).click();
  await pause(600);
  await p.getByRole('button', { name: 'Open component PaymentService.ts', exact: true }).click();
  await p.getByRole('tab', { name: 'Sequence', exact: true }).click();
  await pause(1300);
  await p.getByRole('button', { name: 'Source', exact: true }).click();
  await p.getByRole('button', { name: 'Select source line 7', exact: true }).click();
  await p.getByLabel('Diagram review comment').pressSequentially('Could concurrent retries reuse the same idempotency key?', { delay: 35 });
  await pause(900);
  await p.getByRole('button', { name: 'Post to GitLab', exact: true }).click();
  await expect(p.locator('.component-comment')).toContainText('concurrent retries');
  await pause(900);
  await p.getByRole('button', { name: 'Generate AI guide', exact: true }).click();
  await expect(p.locator('.guide-summary')).toBeVisible();
  await pause(1600);
  await p.keyboard.press('Meta+j');
  await p.getByLabel('Ask Claude').fill('Which part should I review first?');
  await p.getByRole('button',{name:'Send to Claude'}).click();
  await expect(p.locator('.live-chat-message.assistant')).toBeVisible();
  await p.getByRole('tab', {name:'Dependency flow',exact:true}).click();
  await p.getByLabel('Fit diagram to panel').click();
  await screenshot(p, 'contextual-assistant');
});
await scene('connected-context', async p => {
  await pause(600);
  await p.locator('.live-inbox').getByRole('button', { name: /PAY-382 Payment retry implementation/ }).click();
  await expect(p.getByLabel('Live issue inspector')).toBeVisible();await pause(1000);
  await p.getByRole('button', { name: 'Find linked MR & wiki' }).click();await pause(900);
  await p.getByRole('button', { name: 'Payment Retry Policy', exact: true }).click();
  await expect(p.locator('.remote-document')).toBeVisible();await pause(1200);
  await screenshot(p, 'wiki-preview');
  await p.getByLabel('Back in context').click();
  await p.getByRole('button', { name: '!7 PAY-382 Payment retry review', exact: true }).click();
  await expect(p.getByRole('img', { name: 'Dependency flow diagram' })).toBeVisible();await pause(1100);
  await p.getByRole('button', { name: 'Pipeline', exact: true }).click();
  await p.getByRole('button', { name: '#482 · success', exact: true }).click();
  await expect(p.locator('.pipeline-stages')).toBeVisible();await pause(1400);
  await p.getByLabel('Close context preview').click();await pause(1100);
});
await scene('daily-planning', async p => {
  await p.getByLabel('Quick add personal work').pressSequentially('Prepare deployment review tomorrow 2pm', { delay: 40 });
  await p.getByRole('button', { name: 'Add to plan', exact: true }).click();await pause(600);
  await p.getByRole('button', { name: 'Add to Today', exact: true }).click();await pause(700);
  await p.getByRole('button', { name: 'This Week', exact: true }).first().click();await pause(1500);
  await p.getByRole('button', { name: 'Calendar', exact: true }).first().click();
  await p.getByLabel('Calendar range').selectOption('Month');await pause(1700);
  await screenshot(p, 'calendar');
  await p.keyboard.press('Meta+k');
  await p.getByLabel('Connected global search').pressSequentially('PAY-382', { delay: 100 });
  await expect(p.locator('[cmdk-item]').filter({ hasText: 'PAY-382 Payment retry implementation' })).toBeVisible();await pause(1500);
});
const dark = await browser.newPage({baseURL:'http://127.0.0.1:5178',viewport:{width:1440,height:900}});
await installConnected(dark);
await expect(dark.locator('.inbox-work')).toBeVisible();
await dark.getByLabel('Quick add personal work').fill('Prepare deployment review today 10am');
await dark.getByRole('button',{name:'Add to plan',exact:true}).click();
await dark.getByRole('button',{name:'Toggle theme'}).click();
await screenshot(dark, 'dark-workspace');
await dark.close();
await fs.writeFile(`${root}/artifacts/readme-recording/manifest.json`, JSON.stringify(manifest, null, 2));
await browser.close();
if (manifest.errors.length) throw new Error(manifest.errors.join('\n'));
console.log(JSON.stringify(manifest.animations.map(({name,frames,durationMs})=>({name,frames,durationMs}))));
