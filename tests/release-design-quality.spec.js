import { openReviewComposer } from "./fixtures/review-composer.mjs";
import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

const geometry = page => page.locator('.diagram-scroll').evaluate(canvas => {
  const c = canvas.getBoundingClientRect(), svg = canvas.querySelector('svg').getBoundingClientRect();
  const map = canvas.closest('.visual-map-panel').getBoundingClientRect();
  return { width:svg.width, height:svg.height, canvasHeight:c.height,
    inside:svg.left >= c.left - 1 && svg.right <= c.right + 1 && svg.top >= Math.max(c.top,map.top) - 1 && svg.bottom <= Math.min(c.bottom,map.bottom,innerHeight) + 1 };
});

for (const theme of ['light', 'dark']) test(`Fit stays stable after settling, AI generation and resize in ${theme}`, async ({ page }) => {
  await page.setViewportSize({width:980,height:720});
  await installConnected(page);
  if (theme === 'dark') await page.getByLabel('Toggle theme').click();
  await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
  await expect(page.getByLabel('Expand AI review')).toBeVisible();
  await page.getByLabel('Fit diagram to panel').click();
  await expect.poll(async () => (await geometry(page)).inside).toBe(true);
  const first = await geometry(page);
  // A ResizeObserver feedback loop took ~400ms to shrink an initially correct map.
  await page.waitForTimeout(1000);
  const settled = await geometry(page);
  expect(settled.inside).toBe(true);
  expect(settled.height).toBeGreaterThan(100);
  expect(Math.abs(settled.height-first.height)).toBeLessThan(2);
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await page.getByLabel('Select source line 5',{exact:true}).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('My private review before asking AI.');
  await page.getByRole('button',{name:'Generate AI guide',exact:true}).click();
  await expect(page.locator('.ai-review-guide .ai-summary')).toBeVisible();
  for (const viewport of [{width:1440,height:900},{width:980,height:720}]) {
    await page.setViewportSize(viewport);
    await page.getByLabel('Fit diagram to panel').click();
    await expect.poll(async () => (await geometry(page)).inside).toBe(true);
    await page.waitForTimeout(500);
    expect((await geometry(page)).inside).toBe(true);
    await expect(page.getByLabel('Diagram review comment')).toHaveValue('My private review before asking AI.');
  }
  const menu = page.locator('.api-source-files');
  await menu.locator('summary').click();
  await menu.getByRole('button').first().focus();
  await page.keyboard.press('Escape');
  await expect(menu.locator('summary')).toBeFocused();
  await expect(menu).not.toHaveAttribute('open','');
  expect(await page.evaluate(() => window.__fixture.calls.filter(c => ['gitlab.comment','gitlab.approve'].includes(c.action)))).toEqual([]);
});

test('Connection loading failure offers a working local retry', async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => window.__fixture.setFailure('config.list'));
  await page.locator('nav .nav-item[aria-label="Projects"]').click();
  await expect(page.getByRole('heading',{name:'Your connections could not be loaded'})).toBeVisible();
  await page.evaluate(() => window.__fixture.setFailure(''));
  await page.getByRole('button',{name:'Retry connections',exact:true}).click();
  await expect(page.getByRole('button',{name:'PAY-382',exact:true})).toBeVisible();
});

test('All primary toolbar actions remain clickable at 860px', async ({ page }) => {
  await page.setViewportSize({width:860,height:760});
  await installConnected(page);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  for (const selector of ['.assistant-toggle','.notification-button','.workspace-mode','.sidebar-options-trigger']) {
    expect(await page.locator(selector).evaluate(el => {
      const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    })).toBe(true);
  }
});
