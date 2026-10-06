import { test, expect } from '@playwright/test';
import { openComplexReview } from './fixtures/complex-demo.mjs';
import { installConnected } from './fixtures/connected.mjs';

test('A shared component keeps the initial business flow and its AI review context', async ({ page }) => {
  await openComplexReview(page);
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await page.getByLabel('Read RetryPolicy.ts', { exact: true }).click();
  await expect(page.getByLabel('Choose review flow', { exact: true })).toContainText('Payment Capture request handling');
  await expect(page.locator('.visual-code-heading')).toContainText('src/shared/RetryPolicy.ts');
  await expect(page.getByRole('button', { name: 'Draft comment for pending 결제가 재시도 경로를 막나요?', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'AI review alongside code' })).toContainText('13 files');
});

test('Collapsing the composer while posting keeps failures visible and the private draft recoverable', async ({ page }) => {
  await installConnected(page);
  await page.locator('nav .nav-item[aria-label="Code"]').click();
  await page.locator('.connected-content button').filter({ hasText: 'PAY-382 Payment retry review' }).click();
  await page.getByRole('button', { name: 'Select new line 2', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('Keep this private draft if posting fails.');
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      if (action === 'gitlab.comment') {
        await new Promise(resolve => { window.finishComment = resolve; });
        throw Error('Temporary posting failure');
      }
      return original(action, args);
    };
  });
  await page.getByRole('button', { name: 'Post to GitLab', exact: true }).click();
  await page.getByLabel('Collapse review composer', { exact: true }).click();
  await page.evaluate(() => window.finishComment());
  await expect(page.getByRole('alert')).toContainText('Temporary posting failure');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Expand review composer', { exact: true }).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Keep this private draft if posting fails.');
});
