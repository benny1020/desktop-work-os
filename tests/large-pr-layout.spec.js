import { test, expect } from '@playwright/test';
import { openComplexReview, chooseComplexFlow } from './fixtures/complex-demo.mjs';

const layouts = [
  { width: 1440, height: 900 },
  { width: 980, height: 900 },
  { width: 980, height: 650 },
];

async function mapGeometry(page) {
  return page.locator('.visual-map-panel').evaluate(panel => {
    const box = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
    return { panel: box(panel), progress: box(panel.querySelector('.review-file-progress')),
      controls: box(panel.querySelector('.review-diagram-controls')), selected: box(panel.querySelector('.diagram-node.selected')) };
  });
}

for (const layout of layouts) {
  test(`Large PR sequence can read one interaction and return from overview at ${layout.width}×${layout.height}`, async ({ page }) => {
    await page.setViewportSize(layout);
    await openComplexReview(page);
    await chooseComplexFlow(page, 'webhooks');
    await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Step by step', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.sequence-svg .diagram-node')).toHaveCount(2);
    await expect(page.locator('.sequence-svg .sequence-step')).toHaveCount(1);
    const renderedFont = await page.locator('.sequence-svg .node-label').first().evaluate(label => {
      const scale = label.getScreenCTM().a;
      return parseFloat(getComputedStyle(label).fontSize) * scale;
    });
    expect(renderedFont).toBeGreaterThanOrEqual(7);
    await expect(page.locator('.sequence-svg .sequence-step')).toBeInViewport();
    await page.getByLabel('Next interaction', { exact: true }).click();
    await expect(page.getByLabel('Sequence interaction', { exact: true })).toHaveValue('1');
    await expect(page.locator('.sequence-svg .sequence-step')).toBeInViewport();
    await page.getByRole('button', { name: 'Whole flow', exact: true }).click();
    await page.getByLabel('Fit diagram to panel', { exact: true }).click();
    await page.getByLabel('Read diagram at 100%', { exact: true }).click();
    await expect(page.locator('.diagram-toolbar')).toContainText('100%');
    await expect(page.getByLabel('Zoom out diagram', { exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'Step by step', exact: true }).click();
    await expect(page.locator('.sequence-svg .diagram-node')).toHaveCount(2);
    await expect(page.locator('.sequence-svg .sequence-step')).toBeInViewport();
  });
}

for (const layout of layouts) for (const theme of ['light', 'dark']) {
  test(`Large PR lower layers and saved composer remain usable at ${layout.width}×${layout.height} ${theme}`, async ({ page }) => {
    await page.setViewportSize(layout);
    await openComplexReview(page);
    if (theme === 'dark') await page.getByLabel('Toggle theme', { exact: true }).click();
    await chooseComplexFlow(page, 'capture');
    await page.getByRole('button', { name: 'Read RetryPolicy.ts', exact: true }).click();
    await expect(page.getByLabel('Choose review flow', { exact: true })).toContainText('Payment Capture');
    await expect(page.getByLabel('Zoom in diagram', { exact: true })).toBeInViewport();
    await expect.poll(async () => {
      const geometry = await mapGeometry(page);
      return geometry.selected.top >= geometry.controls.bottom - 2 && geometry.selected.bottom <= geometry.panel.bottom + 2;
    }).toBe(true);
    const beforeZoom = await mapGeometry(page);
    expect(beforeZoom.progress.top).toBeGreaterThanOrEqual(beforeZoom.panel.top - 1);
    expect(beforeZoom.controls.top).toBeGreaterThanOrEqual(beforeZoom.progress.bottom - 1);
    await page.getByLabel('Zoom in diagram', { exact: true }).click();
    await expect(page.getByLabel('Zoom out diagram', { exact: true })).toBeInViewport();
    await expect.poll(async () => {
      const geometry = await mapGeometry(page);
      return geometry.selected.top >= geometry.controls.bottom - 2 && geometry.selected.bottom <= geometry.panel.bottom + 2;
    }).toBe(true);

    await page.getByRole('button', { name: 'Source', exact: true }).click();
    await page.getByRole('button', { name: 'Select source line 4', exact: true }).click();
    const draft = 'Keep the jitter policy consistent between worker and reconciliation retries.';
    await page.getByLabel('Diagram review comment').fill(draft);
    const codeBefore = (await page.locator('.visual-code-scroll').boundingBox()).height;
    await page.getByRole('button', { name: 'Collapse review composer', exact: true }).click();
    await expect(page.getByLabel('Diagram review comment')).toBeHidden();
    const codeAfter = (await page.locator('.visual-code-scroll').boundingBox()).height;
    expect(codeAfter - codeBefore).toBeGreaterThan(70);
    expect(codeAfter).toBeGreaterThan(220);
    await expect(page.getByRole('button', { name: 'Approve MR', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'Expand review composer', exact: true }).click();
    await expect(page.getByLabel('Diagram review comment')).toHaveValue(draft);
    await expect(page.getByRole('button', { name: 'Add demo comment', exact: true })).toBeInViewport();
  });
}
