import { test, expect } from '@playwright/test';
import { openComplexReview } from './fixtures/complex-demo.mjs';
import { complexDemoSnapshot } from '../src/lib/complex-demo-review.js';

for (const theme of ['light', 'dark']) test(`IDE syntax and bracket colors keep exact code and inline review usable in ${theme}`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  // Measure settled palettes, not the transient Source → Diff button background.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openComplexReview(page);
  if (theme === 'dark') await page.getByLabel('Toggle theme').click();
  await page.getByLabel('Read PaymentCaptureService.ts', { exact: true }).click();
  await expect(page.locator('.code-language')).toHaveText('TypeScript');
  const kinds = await page.locator('.visual-code-scroll .review-code-token').evaluateAll(tokens =>
    [...new Set(tokens.flatMap(token => [...token.classList]))]);
  for (const kind of ['keyword', 'class-name', 'function', 'string', 'bracket-0', 'bracket-1', 'bracket-2']) expect(kinds).toContain(kind);
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  const expected = complexDemoSnapshot().files.find(file => file.path === 'src/capture/PaymentCaptureService.ts').content;
  const lines = await page.locator('.visual-code-line code').allTextContents();
  expect(lines.map(line => line === ' ' ? '' : line).join('\n')).toBe(expected);
  await page.getByRole('button', { name: 'Select source line 21', exact: true }).click();
  await expect(page.locator('.visual-code-line.selected code')).toHaveText('    if (existing) return existing;');
  await page.getByLabel('Diagram review comment').fill('Rainbow colors keep my inline comment on line 21.');
  await page.getByRole('button', { name: 'Diff', exact: true }).click();
  await expect(page.locator('.visual-code-line.selected')).toHaveAttribute('data-code-line', 'new-21');
  await expect(page.locator('.visual-code-line.removed')).not.toHaveCount(0);

  const contrastFailures = await page.locator('.visual-code-panel').evaluate(panel => {
    const style = getComputedStyle(panel);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const luminance = color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = style.getPropertyValue('--bg'); context.fillRect(0, 0, 1, 1);
      context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
        const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const backgrounds = [style.getPropertyValue('--bg'), ...['.added', '.removed', '.selected'].map(selector =>
      getComputedStyle(panel.querySelector(`.visual-code-line${selector}`)).backgroundColor)];
    const colors = ['keyword', 'function', 'type', 'string', 'number', 'property', 'comment', 'punctuation'].map(name => `--code-${name}`)
      .concat(Array.from({ length: 6 }, (_, index) => `--bracket-${index}`));
    return colors.flatMap(name => backgrounds.flatMap(background => {
      const a = luminance(style.getPropertyValue(name)), b = luminance(background);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      return ratio < 4.5 ? [{ name, background, ratio }] : [];
    }));
  });
  expect(contrastFailures).toEqual([]);
  await page.setViewportSize({ width: 980, height: 650 });
  await page.getByRole('button', { name: 'Add demo comment', exact: true }).click();
  const posted = page.locator('.component-comment').filter({ hasText: 'Rainbow colors keep my inline comment on line 21.' });
  await expect(posted).toHaveCount(1);
  await expect(posted.locator('small')).toHaveText('Line 21');
  expect(errors).toEqual([]);
});
