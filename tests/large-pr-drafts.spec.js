import { openReviewComposer } from "./fixtures/review-composer.mjs";
import { test, expect } from '@playwright/test';
import { openComplexReview, chooseComplexFlow } from './fixtures/complex-demo.mjs';
import { installConnected, snapshot } from './fixtures/connected.mjs';

test('Large PR draft navigation resumes the exact flow and line, opens a folded editor and keeps drafts private on approval', async ({ page }) => {
  await openComplexReview(page);
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByLabel('Your assessment of pending 결제가 재시도 경로를 막나요?').selectOption('checked');
  await expect(page.getByLabel('Review drafts', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Draft comment for pending 결제가 재시도 경로를 막나요?', exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Capture retry needs a pending-state integration test.');
  await chooseComplexFlow(page, 'webhooks');
  await page.getByRole('button', { name: 'Open component PaymentWebhookController.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 11', exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Verify signature rejection is returned consistently.');
  await page.getByRole('button', { name: 'Collapse review composer', exact: true }).click();

  await page.getByLabel('Review drafts', { exact: true }).click();
  await expect(page.getByLabel('Review drafts', { exact: true })).toContainText('2 unposted drafts');
  await page.getByRole('button', { name: 'Resume draft src/capture/PaymentCaptureService.ts:new:21', exact: true }).click();
  await expect(page.getByLabel('Choose review flow', { exact: true })).toContainText('Payment Capture');
  await expect(page.locator('.code-provenance')).toContainText('Selected new line 21');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Capture retry needs a pending-state integration test.');
  await expect(page.getByLabel('Diagram review comment')).toBeFocused();

  await page.getByRole('button', { name: 'Approve MR', exact: true }).click();
  await expect(page.locator('.visual-review-approval')).toContainText('0/30 files viewed · 2 unposted drafts');
  await expect(page.locator('.visual-review-approval')).toContainText('Drafts remain private and are not posted by approval.');
  await expect(page.getByRole('button', { name: 'Confirm approval', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm approval', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approved', exact: true })).toBeDisabled();
  const comments = await page.evaluate(() => JSON.parse(localStorage.getItem('orbit-comments') || '{}'));
  expect(comments['mr-428'] || []).toEqual([]);
  await page.getByLabel('Review drafts', { exact: true }).click();
  await page.getByRole('button', { name: 'Resume draft src/webhooks/PaymentWebhookController.ts:new:11', exact: true }).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Verify signature rejection is returned consistently.');
});

test('Draft navigation restores the old side only for the exact diff, and earlier bases remain read-only', async ({ page }) => {
  await installConnected(page);
  await page.evaluate(({ mr, files }) => {
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === 'gitlab.mr') result.files[0].rows.unshift({ kind: 'removed', text: 'old capture implementation', oldLine: 5, newLine: null });
      return result;
    };
    const refs = JSON.stringify([mr.diff_refs.base_sha, mr.diff_refs.start_sha, mr.diff_refs.head_sha]);
    const previous = JSON.stringify(['earlier-base', mr.diff_refs.start_sha, mr.diff_refs.head_sha]);
    localStorage.setItem(`orbit-visual-drafts:live:${mr.web_url}:${mr.iid}:${mr.diff_refs.head_sha}`, JSON.stringify({
      [`${files[0].path}:old:5:refs:${refs}`]: 'Review the actual removed capture code.',
      [`${files[0].path}:old:6:refs:${previous}`]: 'This note belongs to the earlier base.',
      [`${files[0].path}:old:90`]: 'This legacy note needs verification.',
      'checkpoint:ignore-for-count': 'checked',
    }));
  }, snapshot);
  await page.locator('.attention-row').getByRole('button', { name: /Payment retry review/ }).click();
  await page.getByLabel('Review drafts', { exact: true }).click();
  await expect(page.getByLabel('Review drafts', { exact: true })).toContainText('3 unposted drafts');
  await expect(page.getByRole('button', { name: /^Resume draft / })).toHaveCount(1);
  const earlier = page.getByLabel('Earlier revision drafts');
  await expect(earlier.getByRole('button')).toHaveCount(0);
  await earlier.getByText('src/PaymentController.ts · old line 6', { exact: true }).click();
  await expect(earlier).toContainText('This note belongs to the earlier base.');
  await page.getByRole('button', { name: 'Resume draft src/PaymentController.ts:old:5', exact: true }).click();
  await expect(page.locator('.code-provenance')).toContainText('Selected old line 5');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Review the actual removed capture code.');
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => ['gitlab.comment', 'gitlab.approve'].includes(call.action)))).toEqual([]);
});

test('Escape dismisses the private draft menu while keeping its connected MR and review context open', async ({ page }) => {
  await installConnected(page);
  await page.locator('.attention-row').getByRole('button', { name: /Payment retry review/ }).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Keep this private draft with its connected MR.');
  await page.getByLabel('Review drafts', { exact: true }).click();
  await page.getByRole('button', { name: /^Resume draft / }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Review drafts', { exact: true })).toBeFocused();
  await expect(page.locator('.review-draft-navigator')).not.toHaveAttribute('open');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Keep this private draft with its connected MR.');
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => ['gitlab.comment', 'gitlab.approve'].includes(call.action)))).toEqual([]);
});
