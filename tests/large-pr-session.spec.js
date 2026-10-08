import { openReviewComposer } from "./fixtures/review-composer.mjs";
import { test, expect } from '@playwright/test';
import { openComplexReview, chooseComplexFlow } from './fixtures/complex-demo.mjs';

const reopen = async page => {
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Introduce durable payment recovery' })
    .getByRole('button', { name: 'Review', exact: true }).click();
};

test('Large PR resumes each flow and its AI evidence after switching tools and another MR', async ({ page }) => {
  await openComplexReview(page);
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByRole('button', { name: 'Draft comment for pending 결제가 재시도 경로를 막나요?', exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Keep the capture retry review at its exact code line.');
  await page.getByLabel('Your assessment of pending 결제가 재시도 경로를 막나요?').selectOption('checked');
  await page.getByLabel('Mark src/capture/PaymentCaptureService.ts as viewed').check();

  await chooseComplexFlow(page, 'webhooks');
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  await page.getByRole('button', { name: 'Open component PaymentWebhookController.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 11', exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Verify the webhook signature error response.');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /Review changes/ }).click();
  await expect(page.getByRole('heading', { name: 'Fix order status mapping', exact: true })).toBeVisible();
  await openReviewComposer(page);
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('');

  await reopen(page);
  await expect(page.getByLabel('Choose review flow', { exact: true })).toContainText('Payment Webhook');
  await expect(page.getByRole('tab', { name: 'Sequence', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Source', exact: true })).toHaveClass(/active/);
  await expect(page.locator('.code-provenance')).toContainText('Selected new line 11');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Verify the webhook signature error response.');
  await expect(page.getByLabel('Your assessment of 지연된 이벤트가 최신 상태를 덮어쓰나요?')).toBeVisible();

  await chooseComplexFlow(page, 'capture');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Keep the capture retry review at its exact code line.');
  await expect(page.getByLabel('Your assessment of pending 결제가 재시도 경로를 막나요?')).toHaveValue('checked');
  await expect(page.getByRole('progressbar', { name: 'Files viewed' })).toHaveAttribute('value', '1');
});

test('Large PR Next unreviewed reaches every changed file exactly once, including shared and support scopes', async ({ page }) => {
  await openComplexReview(page);
  const visited = new Set();
  for (let index = 0; index < 30; index++) {
    const mark = page.getByRole('checkbox', { name: /^Mark .* as viewed$/ });
    const path = (await mark.getAttribute('aria-label')).replace(/^Mark /, '').replace(/ as viewed$/, '');
    expect(visited.has(path)).toBe(false);
    visited.add(path);
    await mark.check();
    await expect(page.getByRole('progressbar', { name: 'Files viewed' })).toHaveAttribute('value', String(index + 1));
    if (index < 29) await page.getByRole('button', { name: 'Next unreviewed', exact: true }).click();
  }
  expect(visited.size).toBe(30);
  await expect(page.getByRole('button', { name: 'Next unreviewed', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Approve MR', exact: true })).toBeEnabled();
  await reopen(page);
  await expect(page.getByRole('progressbar', { name: 'Files viewed' })).toHaveAttribute('value', '30');
  await expect(page.getByRole('button', { name: 'Approve MR', exact: true })).toBeEnabled();
});

test('A posted complex-PR comment keeps its code position after reopen and reload without becoming a private draft again', async ({ page }) => {
  await openComplexReview(page);
  await page.getByRole('button', { name: 'Open component PaymentCaptureService.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Select new line 21', exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Keep pending retries separate from completed captures.');
  await page.getByRole('button', { name: 'Add demo comment', exact: true }).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('');
  await reopen(page);
  const posted = page.locator('.component-comment').filter({ hasText: 'Keep pending retries separate from completed captures.' });
  await expect(posted).toHaveCount(1);
  await expect(posted).toContainText('Line 21');
  await page.reload();
  await openComplexReview(page);
  await page.getByRole('button', { name: 'Open component PaymentCaptureService.ts', exact: true }).click();
  await openReviewComposer(page);
  await expect(posted).toHaveCount(1);
  await expect(posted).toContainText('Line 21');
  await page.getByRole('button', { name: 'Select new line 21', exact: true }).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('');
});
