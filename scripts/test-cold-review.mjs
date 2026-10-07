import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { openComplexReview, chooseComplexFlow } from '../tests/fixtures/complex-demo.mjs';

const cache = await fs.mkdtemp(path.join(os.tmpdir(), 'worklane-cold-review-'));
const server = await createServer({ configFile: 'vite.config.js', cacheDir: cache, logLevel: 'warn',
  server: { host: '127.0.0.1', port: 0, strictPort: false } });
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1440, height: 900 } });
  const errors = []; let navigations = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  await openComplexReview(page);
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByRole('button', { name: 'Draft comment for pending 결제가 재시도 경로를 막나요?', exact: true }).click();
  const draft = 'Cold-start review keeps the private source-line draft.';
  await page.getByLabel('Diagram review comment').fill(draft);
  await expect(page.getByRole('button', { name: 'API flows · 2', exact: true })).toBeVisible({ timeout: 30000 });
  await chooseComplexFlow(page, 'webhooks');
  await chooseComplexFlow(page, 'capture');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue(draft);
  assert.equal(navigations, 1, 'Parser discovery must not reload the page during review');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ scope: 'Empty Vite cache + actual browser + synthetic MR',
    checks: ['First parser-worker load keeps the review open', 'Flow switching preserves the first private source-line draft'],
    unexpectedReloads: navigations - 1, pageErrors: errors }));
} finally {
  await browser?.close();
  await server.close();
  await fs.rm(cache, { recursive: true, force: true });
}
