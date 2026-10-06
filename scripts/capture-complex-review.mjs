import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { openComplexReview, chooseComplexFlow } from '../tests/fixtures/complex-demo.mjs';

const output = 'docs/media';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: 'http://127.0.0.1:5178', viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const shot = async name => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector('.toast.visible'));
  await page.mouse.move(1420, 880);
  await page.screenshot({ path: `${output}/complex-review-${name}.png`, animations: 'disabled' });
};
try {
  await openComplexReview(page);
  await page.getByLabel('Collapse sidebar', { exact: true }).click();
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.locator('.guide-finding').filter({ hasText: 'pending 결제가 재시도 경로를 막나요?' }).click();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 21', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('pending은 최종 결과가 아니므로 바로 반환하면 Worker가 gateway를 재호출하지 못할 것 같습니다. 완료 상태만 반환하고 재시도 통합 테스트를 추가해 주세요.');
  await shot('capture');
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await shot('scopes');
  await page.getByRole('button', { name: 'Review flow webhooks', exact: true }).click();
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByRole('button', { name: 'Open component PaymentWebhookService.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 18', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('gatewaySequence < event.sequence 조건으로 갱신하고, refunded → 지연된 captured 순서의 테스트가 필요해 보입니다.');
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Sequence diagram' })).toBeVisible();
  // Pan back to the entry point so the capture includes Controller → Service → Repository.
  await page.locator('.diagram-scroll').hover();
  await page.mouse.wheel(-1800, 0);
  await expect(page.locator('.diagram-scroll')).toHaveJSProperty('scrollLeft', 0);
  await shot('webhook-sequence');
  await chooseComplexFlow(page, 'reconciliation');
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.locator('.guide-finding').filter({ hasText: '부분 실패를 건너뛰고 커서가 전진하나요?' }).click();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 28', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('실패한 settlement를 durable retry에 저장한 뒤 cursor를 전진시켜 주세요. 실패 ID가 다음 실행에서 복구되는지 확인하고 싶습니다.');
  await page.getByRole('tab', { name: 'Dependency flow', exact: true }).click();
  await page.getByLabel('Toggle theme').click();
  await shot('reconciliation-dark');
  console.log(JSON.stringify({ screenshots: 4, viewport: '1440×900', pageErrors: errors }));
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
