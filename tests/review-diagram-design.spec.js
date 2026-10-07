import { test, expect } from '@playwright/test';
import { openApiReview } from './fixtures/api-demo.mjs';
import { openComplexReview } from './fixtures/complex-demo.mjs';

for (const theme of ['light', 'dark']) for (const size of [{ width: 1440, height: 900 }, { width: 980, height: 650 }])
  test(`Diagram rails, source labels and keyboard review remain readable at ${size.width}×${size.height} ${theme}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openApiReview(page);
    if (theme === 'dark') await page.getByLabel('Toggle theme', { exact: true }).click();
    const diagram = page.getByRole('img', { name: 'Dependency flow diagram', exact: true });
    await expect(diagram).toBeVisible();
    const geometry = await diagram.evaluate(svg => {
      const boxes = [...svg.querySelectorAll('.diagram-node')].map(node => {
        const rect = node.querySelector('rect').getBBox(), matrix = node.getScreenCTM();
        const point = svg.createSVGPoint(); point.x = rect.x; point.y = rect.y;
        const start = point.matrixTransform(matrix); point.x += rect.width; point.y += rect.height;
        const end = point.matrixTransform(matrix);
        return { id: node.getAttribute('aria-label').replace('Open component ', ''), x: start.x, y: start.y, right: end.x, bottom: end.y };
      });
      const labels = [...svg.querySelectorAll('.dependency-layer > text:first-of-type')].map(label => {
        const b = label.getBBox(), m = label.getScreenCTM(), p = svg.createSVGPoint(); p.x = b.x; p.y = b.y;
        const a = p.matrixTransform(m); p.x += b.width; p.y += b.height; const z = p.matrixTransform(m);
        return { x: a.x, y: a.y, right: z.x, bottom: z.y };
      });
      const collisions = [];
      for (const edge of svg.querySelectorAll('.dependency-edge')) {
        const path = edge.querySelector('.edge-line'), from = edge.dataset.sourceFrom.split('/').at(-1), to = edge.dataset.sourceTo.split('/').at(-1);
        for (let length = 0; length <= path.getTotalLength(); length += 3) {
          const p = path.getPointAtLength(length).matrixTransform(path.getScreenCTM());
          if (boxes.some(b => ![from, to].includes(b.id) && p.x > b.x + 1 && p.x < b.right - 1 && p.y > b.y + 1 && p.y < b.bottom - 1)) collisions.push('component');
          if (labels.some(b => p.x > b.x && p.x < b.right && p.y > b.y && p.y < b.bottom)) collisions.push('caption');
        }
      }
      return { collisions, paths: [...svg.querySelectorAll('.edge-line')].map(path => path.getAttribute('d')),
        caption: svg.querySelector('desc').textContent, named: !!document.getElementById(svg.getAttribute('aria-labelledby')) };
    });
    expect(geometry.collisions).toEqual([]);
    expect(geometry.paths).toHaveLength(5);
    expect(geometry.paths.every(d => d && !d.includes(' C '))).toBe(true);
    expect(geometry.named).toBe(true);
    expect(geometry.caption).toContain('code evidence');
    const service = diagram.getByRole('button', { name: 'Open component PaymentService.ts', exact: true });
    const audit = diagram.getByRole('button', { name: 'Open component PaymentAuditService.ts', exact: true });
    const ys = await Promise.all([service.getAttribute('transform'), audit.getAttribute('transform')]);
    expect(Number(ys[0].match(/,([\d.]+)\)/)[1])).toBeLessThan(Number(ys[1].match(/,([\d.]+)\)/)[1]));
    const first = diagram.locator('.dependency-edge').first();
    await first.press('Enter');
    await expect(page.locator('.code-provenance')).toContainText('Selected new line 10');
    await page.getByLabel('Diagram review comment').fill('Verify the capture request boundary.');
    await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
    const step = page.locator('.sequence-step').first();
    await expect(step).toHaveAttribute('data-call-evidence', 'source call');
    await expect(step.locator('.sequence-label')).toContainText('capture()');
    await expect(step.locator('.node-meta')).toContainText('source call');
    const lineStyle = await step.locator('line').evaluate(line => getComputedStyle(line).strokeDasharray);
    expect(lineStyle).toBe('none');
    await expect(page.getByLabel('Diagram review comment')).toHaveValue('Verify the capture request boundary.');
  });

test('Shared dependency badges expose distinct parents while preserving exact source inspection', async ({ page }) => {
  await openComplexReview(page);
  const service = page.getByRole('img', { name: 'Dependency flow diagram' }).getByRole('button', { name: 'Open component PaymentCaptureService.ts', exact: true });
  await expect(service.locator('.node-fan-in')).toHaveAttribute('aria-label', '3 incoming components');
  await expect(service.locator('.node-fan-in')).toHaveText('3 in');
  await service.press('Enter');
  await expect(page.locator('.visual-code-heading')).toContainText('src/capture/PaymentCaptureService.ts');
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  const step = page.locator('.sequence-step').first();
  await expect(step).toHaveAttribute('data-call-evidence', 'inferred');
  expect(await step.locator('line').evaluate(line => getComputedStyle(line).strokeDasharray)).not.toBe('none');
});
