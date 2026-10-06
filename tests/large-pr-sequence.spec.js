import { test, expect } from '@playwright/test';
import { complexDemoSnapshot } from '../src/lib/complex-demo-review.js';
import { buildGraph } from '../src/lib/review-model.mjs';
import { buildReviewFlows, scopeReviewGraph } from '../src/lib/review-flows.mjs';
import { openComplexReview, chooseComplexFlow } from './fixtures/complex-demo.mjs';

const snapshot = complexDemoSnapshot();
const graph = buildGraph(snapshot.files);
const flows = buildReviewFlows(snapshot.files, graph);

test('Every large-PR interaction reaches exact source evidence and keeps its private line draft', async ({ page }) => {
  await openComplexReview(page);
  for (const label of ['capture', 'webhooks', 'reconciliation']) {
    await chooseComplexFlow(page, label);
    await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
    const expected = scopeReviewGraph(graph, flows.find(flow => flow.label === label)).sequence;
    const picker = page.getByLabel('Sequence interaction', { exact: true });
    await expect(picker.locator('option')).toHaveCount(expected.length);
    for (let index = 0; index < expected.length; index++) {
      const step = expected[index];
      await picker.selectOption(String(index));
      await expect(page.locator('.visual-code-heading')).toContainText(step.path);
      await expect(page.locator('.code-provenance')).toContainText(`Selected new line ${step.line}`);
      const text = snapshot.files.find(file => file.path === step.path).content.split('\n')[step.line - 1];
      await expect(page.locator('.visual-code-line.selected code')).toHaveText(text);
      await expect(page.locator('.sequence-svg .sequence-step')).toHaveCount(1);
      await expect(page.locator('.sequence-svg .sequence-step')).toHaveAttribute('aria-label', `Inspect sequence step ${index + 1}: ${step.label}`);
      const clippedLabels = await page.locator('.sequence-svg').evaluate(svg => {
        const width = svg.viewBox.baseVal.width;
        return [...svg.querySelectorAll('.sequence-label,.node-meta')].filter(label => {
          const box = label.getBBox();
          return box.x < 0 || box.x + box.width > width;
        }).map(label => label.textContent);
      });
      expect(clippedLabels).toEqual([]);
      if (index === 0) await page.getByLabel('Diagram review comment').fill(`${label} review draft for the first interaction.`);
    }
    await expect(page.getByLabel('Next interaction', { exact: true })).toBeDisabled();
    await picker.selectOption('0');
    await expect(page.getByLabel('Previous interaction', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Diagram review comment')).toHaveValue(`${label} review draft for the first interaction.`);
    await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
    await expect(picker.locator('option')).toHaveCount(expected.length);
  }
});

test('Inspecting an interaction target preserves its step and both flow modes resume after leaving the MR', async ({ page }) => {
  await openComplexReview(page);
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  const capturePicker = page.getByLabel('Sequence interaction', { exact: true });
  await capturePicker.selectOption('0');
  await page.getByRole('button', { name: 'Open component PaymentCaptureService.ts', exact: true }).click();
  await expect(capturePicker).toHaveValue('0');
  await expect(page.locator('.visual-code-heading')).toContainText('src/capture/PaymentCaptureService.ts');
  await page.getByLabel('Next interaction', { exact: true }).click();
  await expect(capturePicker).toHaveValue('1');
  await page.getByRole('button', { name: 'Whole flow', exact: true }).click();

  await chooseComplexFlow(page, 'webhooks');
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  const webhookPicker = page.getByLabel('Sequence interaction', { exact: true });
  const steps = await webhookPicker.locator('option').count();
  await webhookPicker.selectOption(String(steps - 1));
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Introduce durable payment recovery' })
    .getByRole('button', { name: 'Review', exact: true }).click();
  await expect(webhookPicker).toHaveValue(String(steps - 1));
  await expect(page.getByRole('button', { name: 'Step by step', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await chooseComplexFlow(page, 'capture');
  await expect(page.getByRole('button', { name: 'Whole flow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Step by step', exact: true }).click();
  await expect(capturePicker).toHaveValue('1');
});
