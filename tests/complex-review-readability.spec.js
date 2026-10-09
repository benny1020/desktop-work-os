import { test, expect } from '@playwright/test';
import { openComplexReview } from './fixtures/complex-demo.mjs';

for (const width of [1440, 980]) test(`Long component names stay readable inside the complex PR diagram at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openComplexReview(page);
  const diagram = page.getByRole('group', { name: 'Dependency flow diagram', exact: true });
  const controller = diagram.getByRole('button', { name: 'Open component PaymentCaptureController.ts', exact: true });
  await expect(controller.locator('.node-label')).toHaveText('PaymentCaptureController');
  await page.getByRole('button', { name: 'By role', exact: true }).click();
  await expect.poll(() => controller.locator('.node-label').evaluate(label => parseFloat(getComputedStyle(label).fontSize) * label.getScreenCTM().a)).toBeGreaterThanOrEqual(12);
  await expect.poll(() => page.locator('.review-flow-context-heading strong').evaluate(title => title.scrollWidth - title.clientWidth)).toBeLessThanOrEqual(1);
  const clipping = await diagram.locator('.diagram-node').evaluateAll(nodes => nodes.flatMap(node => {
    const box = node.querySelector('rect').getBBox();
    return [...node.querySelectorAll('.node-label,.node-path,.node-meta')].flatMap(label => {
      const b = label.getBBox();
      return b.x < box.x || b.x + b.width > box.x + box.width || b.y < box.y || b.y + b.height > box.y + box.height ? [label.textContent] : [];
    });
  }));
  expect(clipping).toEqual([]);
  await controller.press('Enter');
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  await page.getByRole('button', { name: 'Whole flow', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Sequence diagram', exact: true })
    .getByRole('button', { name: 'Open component PaymentCaptureController.ts', exact: true }).locator('.node-label')).toHaveText('PaymentCaptureController');
  const sequenceClipping = await page.locator('.sequence-svg .diagram-node').evaluateAll(nodes => nodes.flatMap(node => {
    const box = node.querySelector('rect').getBBox();
    return [...node.querySelectorAll('.node-label,.node-path')].flatMap(label => {
      const b = label.getBBox();
      return b.x < box.x || b.x + b.width > box.x + box.width || b.y < box.y || b.y + b.height > box.y + box.height ? [label.textContent] : [];
    });
  }));
  expect(sequenceClipping).toEqual([]);
});

test('Complex PR separates execution flows from supporting changes without hiding coverage or keyboard choices', async ({ page }) => {
  await openComplexReview(page);
  await page.getByRole('button', { name: 'Business flows · 4', exact: true }).click();
  await page.getByLabel('Choose review flow', { exact: true }).click();
  const executions = page.getByRole('group', { name: 'Execution flows', exact: true });
  const support = page.getByRole('group', { name: 'Supporting changes', exact: true });
  await expect(executions.getByRole('button', { name: /^Review flow / })).toHaveCount(4);
  await expect(support.getByRole('button', { name: /^Review flow / })).toHaveCount(7);
  await expect(page.locator('.review-flow-menu-heading')).toContainText('4 execution flows · 7 supporting groups');
  const fitTarget = await page.getByLabel('Fit diagram to panel', { exact: true }).boundingBox();
  expect(fitTarget.width).toBeGreaterThanOrEqual(24);
  expect(fitTarget.height).toBeGreaterThanOrEqual(24);
  await page.getByLabel('Search review flows').press('ArrowDown');
  await page.keyboard.press('End');
  await expect(support.getByRole('button').last()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Search review flows')).toBeHidden();
  await expect(page.getByRole('progressbar', { name: 'Files viewed' })).toHaveAttribute('max', '30');
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await page.getByLabel('Search review flows').fill('PaymentWebhookController');
  await expect(executions.getByRole('button', { name: /^Review flow / })).toHaveCount(1);
  await expect(support).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Choose review flow', { exact: true })).toBeFocused();
});
