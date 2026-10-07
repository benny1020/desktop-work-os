import { chromium } from '@playwright/test';
import { openComplexReview } from '../tests/fixtures/complex-demo.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: 'http://127.0.0.1:5178', viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const shot = async name => {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1420, 880);
  await page.screenshot({ path: `docs/media/diagram-design-${name}.png`, animations: 'disabled' });
};
try {
  await openComplexReview(page);
  await page.getByLabel('Collapse sidebar', { exact: true }).click();
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByRole('button', { name: 'Read PaymentCaptureService.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await shot('dependency');
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  const picker = page.getByLabel('Sequence interaction', { exact: true });
  const options = await picker.locator('option').allTextContents();
  const index = options.findIndex(text => text.endsWith('PaymentCaptureService.ts:28'));
  if (index < 0) throw Error('Transaction interaction was not found');
  await picker.selectOption(String(index));
  await page.getByLabel('Diagram review comment').fill('저장 실패 시 idempotency key도 같은 트랜잭션 안에서 되돌아가는지 확인하고 싶습니다.');
  await page.getByLabel('Toggle theme', { exact: true }).click();
  await shot('transaction-dark');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(JSON.stringify({ screenshots: 2, pageErrors: errors, scope: 'Actual app; synthetic complex MR and sample AI guide' }));
} finally { await browser.close(); }
