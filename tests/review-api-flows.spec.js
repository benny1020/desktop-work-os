import { test, expect } from '@playwright/test';
import { openApiReview, chooseApi } from './fixtures/api-demo.mjs';
const component = (page, name) => page.getByRole('button', { name: `Open component ${name}.ts`, exact: true });

test('API default shows request and handler return, with only selected methods in repeated classes', async ({ page }) => {
  await openApiReview(page);
  await component(page, 'PaymentService').click();
  await expect(page.getByLabel('Methods in this API flow')).toContainText('capture()');
  await expect(page.getByLabel('Methods in this API flow')).not.toContainText('refund()');
  await expect(page.getByRole('button', { name: 'Select source line 10', exact: true })).toHaveClass(/selected/);
  await chooseApi(page, 'POST /payments/refund');
  await component(page, 'PaymentService').click();
  await expect(page.getByLabel('Methods in this API flow')).toContainText('refund()');
  await expect(page.getByLabel('Methods in this API flow')).not.toContainText('capture()');
  await expect(page.getByRole('button', { name: 'Select source line 19', exact: true })).toHaveClass(/selected/);
  await expect(page.getByLabel('Current API flow')).toContainText('L17');
  await expect(page.getByRole('img', { name: 'Dependency flow diagram' })).not.toContainText('saveCapture()');
  await expect(page.getByRole('img', { name: 'Dependency flow diagram' })).toContainText('saveRefund()');
});
test('canonical shared-method drafts survive API switching and flow completion stays independent', async ({ page }) => {
  await openApiReview(page);
  await page.getByLabel('Mark API flow reviewed').check();
  await component(page, 'PaymentAuditService').click();
  await page.getByRole('button', { name: 'Select source line 7', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('What happens if the audit write fails after commit?');
  await expect(page.getByLabel('Methods in this API flow')).toContainText('Unchanged context');
  await expect(page.getByRole('button', { name: 'Diff', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Code and your review')).toContainText('Context source · MR comment');
  await chooseApi(page, 'POST /payments/refund');
  await expect(page.getByLabel('Mark API flow reviewed')).not.toBeChecked();
  await component(page, 'PaymentAuditService').click();
  await page.getByRole('button', { name: 'Select source line 7', exact: true }).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('What happens if the audit write fails after commit?');
  await chooseApi(page, 'POST /payments/capture');
  await expect(page.getByLabel('Mark API flow reviewed')).toBeChecked();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('What happens if the audit write fails after commit?');
  await expect(page.getByRole('progressbar', { name: 'Files viewed' })).toHaveAttribute('max', '5');
});
test('AI checkpoints are restricted to selected API methods, including unchanged shared context', async ({ page }) => {
  await openApiReview(page);
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  const ai = page.getByLabel('AI review alongside code');
  await expect(ai).toContainText('기존 pending 승인');
  await expect(ai).not.toContainText('동시 환불');
  await expect(ai).toContainText('감사 기록 실패');
  await chooseApi(page, 'POST /payments/refund');
  await expect(ai).not.toContainText('기존 pending 승인');
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await expect(ai).toContainText('동시 환불');
  await expect(ai).not.toContainText('기존 pending 승인');
});
test('unlinked documentation remains available and grouping can switch back without losing the API', async ({ page }) => {
  await openApiReview(page);
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await page.getByLabel('Search review flows').fill('payment-contract.md');
  await page.getByRole('button', { name: /^Review flow / }).click();
  await expect(page.getByLabel('Component code')).toContainText('Payment response contract');
  await page.getByRole('button', { name: 'File groups', exact: true }).click();
  await expect(page.getByRole('button', { name: 'File groups', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Business flows/ }).click();
  await expect(page.getByLabel('Current API flow')).toContainText('POST /payments/capture');
});
for (const layout of [{ width: 1440, height: 900 }, { width: 980, height: 650 }]) for (const theme of ['light', 'dark']) {
  test(`API diagram, code and AI remain usable at ${layout.width}×${layout.height} ${theme}`, async ({ page }) => {
    await page.setViewportSize(layout); await openApiReview(page);
    if (theme === 'dark') await page.getByLabel('Toggle theme', { exact: true }).click();
    await component(page, 'PaymentRepository').click();
    await page.getByLabel('Methods in this API flow').getByRole('button', { name: /saveCapture/ }).click();
    await expect(page.getByRole('button', { name: 'Select source line 8', exact: true })).toHaveClass(/selected/);
    await expect(page.getByRole('button', { name: 'Zoom in diagram', exact: true })).toBeInViewport();
    await expect(page.getByLabel('AI review alongside code')).toBeInViewport();
    await expect(page.getByLabel('Current API flow')).toBeInViewport({ ratio: 1 });
    expect(await page.locator('.visual-map-panel').evaluate(panel => panel.scrollTop)).toBe(0);
    await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
    await expect(page.locator('.sequence-svg .sequence-step')).toBeInViewport();
    await page.getByLabel('Current API flow').locator('summary').click();
    await expect(page.getByRole('button', { name: 'Zoom in diagram', exact: true })).toBeInViewport();
    await page.getByLabel('Diagram review comment').fill('Inspect atomic persistence and replay behavior.');
    await expect(page.getByRole('button', { name: 'Add demo comment', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
test('returning from Home restores unchanged-context code, source line, flow and private draft', async ({ page }) => {
  await openApiReview(page); await chooseApi(page, 'POST /payments/refund');
  await component(page, 'PaymentAuditService').click();
  await page.getByRole('button', { name: 'Select source line 7', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('Retain this exact shared code context.');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Separate capture and refund request paths' }).getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByLabel('Current API flow')).toContainText('POST /payments/refund');
  await expect(page.locator('.visual-code-heading')).toContainText('PaymentAuditService.ts');
  await expect(page.getByRole('button', { name: 'Select source line 7', exact: true })).toHaveClass(/selected/);
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Retain this exact shared code context.');
});
