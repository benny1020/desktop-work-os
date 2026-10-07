import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { openApiReview, chooseApi } from '../tests/fixtures/api-demo.mjs';
await fs.mkdir('docs/media', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: 'http://127.0.0.1:5178', viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const shot = async name => {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1420, 880);
  await page.screenshot({ path: `docs/media/api-review-${name}.png`, animations: 'disabled' });
};
try {
  await openApiReview(page);
  await page.getByLabel('Collapse sidebar', { exact: true }).click();
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByRole('button', { name: 'Read PaymentService.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 12', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('기존 pending 승인과 완료된 승인을 구분하고, 재시도 요청의 gateway 호출을 테스트해 주세요.');
  await shot('capture');
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await shot('scopes');
  await page.getByRole('button', { name: 'Review flow POST /payments/refund', exact: true }).click();
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByRole('button', { name: 'Read PaymentService.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 22', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('동시 환불 요청이 같은 잔여 금액을 읽을 수 있습니다. 검증과 차감의 원자성을 확인하고 싶습니다.');
  await shot('refund');
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  await page.getByLabel('Toggle theme', { exact: true }).click();
  await shot('sequence-dark');
  await page.setViewportSize({ width: 980, height: 650 });
  await shot('narrow-dark');
  await fs.mkdir('research/api-flow-review', { recursive: true });
  const evidence = { screenshots: 5, pageErrors: errors, scope: 'Actual app, synthetic API demo and sample AI guide' };
  await fs.writeFile('research/api-flow-review/screenshots.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
