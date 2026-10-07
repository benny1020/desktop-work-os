import { test, expect } from '@playwright/test';
import { openComplexReview, chooseComplexFlow } from './fixtures/complex-demo.mjs';
import { complexDemoSnapshot } from '../src/lib/complex-demo-review.js';
import { buildGraph } from '../src/lib/review-model.mjs';
import { transactionScopes } from '../src/lib/review-transactions.mjs';

const snapshot = complexDemoSnapshot();
const scopes = transactionScopes(snapshot.files).scopes;
const allSteps = buildGraph(snapshot.files).sequence;
const cases = [
  { flow: 'capture', path: 'src/capture/PaymentCaptureService.ts', inside: 28, outside: 38 },
  { flow: 'webhooks', path: 'src/webhooks/PaymentWebhookService.ts', inside: 18, outside: 23 },
  { flow: 'reconciliation', path: 'src/reconciliation/ReconciliationService.ts', inside: 21, outside: 28 },
];
async function chooseLine(page, path, line) {
  const picker = page.getByLabel('Sequence interaction', { exact: true });
  const options = await picker.locator('option').allTextContents();
  const index = options.findIndex(text => text.endsWith(`${path.split('/').at(-1)}:${line}`));
  expect(index).toBeGreaterThanOrEqual(0);
  await picker.selectOption(String(index));
  return index;
}
for (const theme of ['light', 'dark']) test(`Transaction scopes preserve exact source and private reviews in all three flows (${theme})`, async ({ page }) => {
  await openComplexReview(page);
  if (theme === 'dark') await page.getByLabel('Toggle theme', { exact: true }).click();
  for (const item of cases) {
    await chooseComplexFlow(page, item.flow);
    await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
    const scope = scopes.find(scope => scope.path === item.path);
    const index = await chooseLine(page, item.path, item.inside);
    await expect(page.locator('.sequence-transaction-frame')).toHaveCount(1);
    await expect(page.locator('.transaction-caption').first()).toContainText(`TX scope · inside · L${scope.startLine}–${scope.endLine}`);
    await page.getByLabel('Diagram review comment').fill(`Check ${item.flow} transaction atomicity.`);
    await page.getByRole('button', { name: `Open transaction start ${item.path.split('/').at(-1)}:${scope.startLine}`, exact: true }).press('Enter');
    await expect(page.locator('.code-provenance')).toContainText(`Selected new line ${scope.startLine}`);
    await expect(page.getByLabel('Sequence interaction', { exact: true })).toHaveValue(String(index));
    await page.getByRole('button', { name: `Open transaction end ${item.path.split('/').at(-1)}:${scope.endLine}`, exact: true }).click();
    await expect(page.locator('.code-provenance')).toContainText(`Selected new line ${scope.endLine}`);
    await chooseLine(page, item.path, item.inside);
    await expect(page.getByLabel('Diagram review comment')).toHaveValue(`Check ${item.flow} transaction atomicity.`);
    await chooseLine(page, item.path, item.outside);
    await expect(page.locator('.sequence-transaction-frame')).toHaveCount(0);
    await expect(page.locator('.sequence-transaction-context')).toContainText('Outside TX scope');
    await page.getByRole('button', { name: 'Whole flow', exact: true }).click();
    await expect(page.locator('.sequence-transaction-frame')).toHaveCount(1);
    const frame = page.locator('.sequence-transaction-frame');
    const included = allSteps.filter(step => step.path === item.path && step.line >= scope.startLine && step.line <= scope.endLine);
    const result = await page.locator('.sequence-svg').evaluate((svg, lines) => {
      const r = svg.querySelector('.sequence-transaction-frame > rect').getBBox();
      return [...svg.querySelectorAll('.sequence-step')].map(step => {
        const line = Number(step.querySelector('.node-meta').textContent.match(/:(\d+) ·/)[1]);
        const y = Number(step.querySelector('line').getAttribute('y1'));
        return { line, inside: y > r.y && y < r.y + r.height };
      }).filter(step => lines.includes(step.line));
    }, included.map(step => step.line));
    expect(result.length).toBe(included.length);
    expect(result.every(step => step.inside)).toBe(true);
    await expect(frame).toContainText('Callback ends');
    await page.getByRole('button', { name: 'Step by step', exact: true }).click();
  }
});
for (const size of [{ width: 1440, height: 900 }, { width: 980, height: 650 }]) test(`Transaction frame, boundary actions and code stay reachable at ${size.width}×${size.height}`, async ({ page }) => {
  await page.setViewportSize(size);
  await openComplexReview(page);
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  await chooseLine(page, cases[0].path, 28);
  await expect(page.locator('.sequence-step')).toBeInViewport();
  const end = page.getByRole('button', { name: 'Open transaction end PaymentCaptureService.ts:31', exact: true });
  await end.click();
  await expect(page.locator('.visual-code-line.selected')).toBeInViewport();
  await expect(page.locator('.visual-code-line.selected code')).toHaveText('      });');
  const clipped = await page.locator('.sequence-svg').evaluate(svg => [...svg.querySelectorAll('.transaction-caption')].some(label => {
    const box = label.getBBox(); return box.x < 0 || box.x + box.width > svg.viewBox.baseVal.width;
  }));
  expect(clipped).toBe(false);
});
