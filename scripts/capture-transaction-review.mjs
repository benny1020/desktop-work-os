import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { openComplexReview } from '../tests/fixtures/complex-demo.mjs';

await fs.mkdir('docs/media', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: 'http://127.0.0.1:5178', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function shot(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1420, 880);
  await page.screenshot({ path: `docs/media/transaction-review-${name}.png`, animations: 'disabled' });
}
try {
  await openComplexReview(page);
  await page.getByLabel('Collapse sidebar', { exact: true }).click();
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  await page.getByLabel('Sequence interaction', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('저장과 Outbox 발행은 같은 트랜잭션을 쓰고 있습니다. Outbox 실패 시 capture도 rollback되는지 통합 테스트를 추가해 주세요.');
  await expect(page.locator('.sequence-transaction-frame')).toContainText('TX scope · inside · L27–31');
  await shot('inside-light');
  await page.getByLabel('Toggle theme', { exact: true }).click();
  await shot('inside-dark');
  await page.getByLabel('Sequence interaction', { exact: true }).selectOption('10');
  await page.getByLabel('Diagram review comment').fill('락 해제는 트랜잭션 밖의 finally에서 실행됩니다. Redis 해제 오류가 원래 결제 오류를 덮어쓰지 않는지도 확인하고 싶습니다.');
  await expect(page.locator('.sequence-transaction-context')).toContainText('Outside TX scope');
  await shot('outside-dark');
  console.log(JSON.stringify({ screenshots: 3, viewport: '1440×900', pageErrors: errors }));
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
