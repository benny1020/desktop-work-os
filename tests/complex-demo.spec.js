import { openReviewComposer } from "./fixtures/review-composer.mjs";
import { test, expect } from '@playwright/test';
import { initialMRs } from '../src/data.js';
import { openComplexReview, chooseComplexFlow } from './fixtures/complex-demo.mjs';

test('Complex PR keeps diagram, AI checkpoints, source and private review together across flows', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openComplexReview(page);
  await expect(page.getByRole('progressbar', { name: 'Files viewed' })).toHaveAttribute('max', '30');
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByRole('button', { name: 'Draft comment for pending 결제가 재시도 경로를 막나요?', exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('pending 상태는 Worker 재진입 시 gateway를 호출하도록 분리해 주세요.');
  await chooseComplexFlow(page, 'webhooks');
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Draft comment for 지연된 이벤트가 최신 상태를 덮어쓰나요?', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft comment for pending 결제가 재시도 경로를 막나요?', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Sequence diagram' })).toBeVisible();
  await page.getByRole('button', { name: 'Open component PaymentWebhookController.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 11', exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('서명 검증 실패 응답도 확인해 주세요.');
  await chooseComplexFlow(page, 'capture');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('pending 상태는 Worker 재진입 시 gateway를 호출하도록 분리해 주세요.');
  await chooseComplexFlow(page, 'reconciliation');
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Draft comment for 부분 실패를 건너뛰고 커서가 전진하나요?', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Adding the complex sample preserves existing review state after reload', async ({ page }) => {
  const saved = initialMRs.filter(mr => mr.id !== '428').map(mr => mr.id === '391' ? { ...mr, status: 'Approved' } : mr);
  await page.addInitScript(saved => {
    if (!localStorage.getItem('complex-fixture-seeded')) {
      localStorage.setItem('orbit-mrs', JSON.stringify(saved));
      localStorage.setItem('complex-fixture-seeded', 'true');
    }
  }, saved);
  await openComplexReview(page);
  await page.reload();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('orbit-mrs')));
  expect(restored.filter(mr => mr.id === '428')).toHaveLength(1);
  expect(restored.find(mr => mr.id === '391').status).toBe('Approved');
});
