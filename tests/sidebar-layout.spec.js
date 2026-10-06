import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

const choose = async (page, name) => {
  await page.getByLabel('Sidebar options', {exact:true}).click();
  await page.getByRole('group', {name:'Sidebar layout',exact:true}).getByRole('button', {name,exact:true}).click();
};

test('Sidebar minimizes, hides, restores the last visible layout and remembers it after reload', async ({page}) => {
  await page.goto('/');
  const width = () => page.locator('.app-main').evaluate(el => el.getBoundingClientRect().width);
  const originalWidth = await width();
  await page.getByLabel('Collapse sidebar', {exact:true}).click();
  await expect(page.locator('.sidebar')).toHaveCSS('width','66px');
  expect(await width()).toBeGreaterThan(originalWidth);
  await page.locator('nav').getByRole('button',{name:'Projects',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Project issues',exact:true})).toBeVisible();
  await choose(page,'Hide sidebar');
  await expect(page.getByRole('complementary',{name:'Workspace navigation'})).toHaveCount(0);
  await expect(page.getByLabel('Show sidebar',{exact:true})).toBeFocused();
  expect(await width()).toBe(1440);
  await page.reload();
  await expect(page.getByLabel('Show sidebar',{exact:true})).toBeVisible();
  await page.getByLabel('Show sidebar',{exact:true}).click();
  await expect(page.locator('.sidebar')).toHaveCSS('width','66px');
  await choose(page,'Expanded');
  await expect(page.locator('.sidebar')).toHaveCSS('width','222px');
  await page.reload();
  await expect(page.locator('.sidebar')).toHaveCSS('width','222px');
});

test('Sidebar options dismiss by keyboard; a narrow dark hidden shell keeps recovery and search usable', async ({page}) => {
  await page.setViewportSize({width:980,height:650});
  await page.goto('/');
  await page.getByLabel('Sidebar options',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Expanded',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Sidebar options',{exact:true})).toBeFocused();
  await page.getByLabel('Toggle theme',{exact:true}).click();
  await page.keyboard.press('Control+Backslash');
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Show sidebar',{exact:true})).toBeInViewport();
  await expect.poll(()=>page.getByLabel('Show sidebar',{exact:true}).evaluate(el=>getComputedStyle(el).color)).toBe('rgb(176, 189, 196)');
  await page.screenshot({path:'artifacts/sidebar-hidden-dark.png'});
  await page.keyboard.press('Control+Backslash');
  await expect(page.locator('.sidebar')).toBeVisible();
  await choose(page,'Icons only');
  await page.screenshot({path:'artifacts/sidebar-icons-dark.png'});
});

test('Hiding navigation from a review preview preserves selected code, focus and unsent human draft', async ({page}) => {
  await installConnected(page);
  await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
  await page.getByRole('button',{name:'Open component PaymentService.ts',exact:true}).click();
  const input=page.getByLabel('Diagram review comment');
  await input.fill('Keep my review while I focus on the code.');
  await page.keyboard.press('Meta+Backslash');
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(input).toHaveValue('Keep my review while I focus on the code.');
  await expect(input).toBeFocused();
  await expect(page.locator('.visual-code-heading')).toContainText('PaymentService.ts');
  await page.keyboard.press('Meta+Backslash');
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(input).toBeFocused();
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>['gitlab.comment','gitlab.approve','jira.update'].includes(c.action)).length)).toBe(0);
});
