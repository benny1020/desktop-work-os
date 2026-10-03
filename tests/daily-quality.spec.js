import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

test.beforeEach(async ({ page }) => installConnected(page));
async function add(page, title) {
  await page.getByLabel('Quick add personal work').fill(title);
  await page.getByRole('button', {name:'Add to plan',exact:true}).click();
}

test('Daily summary uses actual personal plan and the suggested review retains Home context', async ({page}) => {
  await expect(page.getByLabel('Daily summary')).toContainText('0 planned items');
  await expect(page.getByLabel('Daily summary')).toContainText('1 review requested');
  await add(page, 'Review the retry behavior');
  await expect(page.getByLabel('Daily summary')).toContainText('1 planned item');
  await page.getByLabel('Complete Review the retry behavior',{exact:true}).click();
  await expect(page.getByLabel('Daily summary')).toContainText('1 completed locally');
  await expect(page.getByLabel('Daily summary')).toContainText('0 planned items');
  await page.getByRole('button',{name:'Review changes',exact:true}).click();
  await expect(page.getByRole('img',{name:'Dependency flow diagram',exact:true})).toBeVisible();
  await page.getByLabel('Close context preview').click();
  await expect(page.getByRole('heading',{name:'A clear start to your day'})).toBeVisible();
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='claude.review'))).toEqual([]);
});

test('Undo removal restores the saved record and original order, not unsaved editor text', async ({page}) => {
  await add(page,'First task');
  await page.locator('.live-inbox').getByRole('button',{name:'Add to Today',exact:true}).click();
  await add(page,'Last task');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')).tasks);
  await page.getByLabel('Edit plan for PAY-382 Payment retry implementation',{exact:true}).click();
  await page.getByLabel('Personal work title',{exact:true}).fill('Unsaved title change');
  await page.getByRole('button',{name:'Delete personal work',exact:true}).click();
  await expect(page.locator('.plan-task')).toHaveCount(2);
  await page.getByRole('button',{name:'Undo removal',exact:true}).click();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')).tasks);
  expect(after).toEqual(before);
  await expect(page.getByRole('button',{name:'Undo removal',exact:true})).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')).tasks)).toEqual(before);
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>['jira.edit','jira.transition'].includes(c.action)))).toEqual([]);
});

test('Empty plan gives a keyboard entry point and makes the local-service boundary available on demand', async ({page}) => {
  await page.getByRole('button',{name:'Plan your first item',exact:true}).click();
  await expect(page.getByLabel('Quick add personal work')).toBeFocused();
  const boundary=page.locator('.plan-boundary').first();
  await expect(boundary.locator('p')).toBeHidden();
  await boundary.locator('summary').click();
  await expect(boundary).toContainText('does not change Jira status or due dates');
  await expect(boundary.locator('p')).toBeVisible();
});

test('Daily command center keeps its next action and available work in view in light and dark', async ({page}) => {
  await add(page,'Daily standup 9am');
  await add(page,'Review retry implementation 11am');
  await add(page,'Check idempotency');
  for (const theme of ['light','dark']) {
    if(theme==='dark') await page.getByLabel('Toggle theme').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    const action=await page.getByRole('button',{name:'Review changes',exact:true}).boundingBox();
    expect(action.y+action.height).toBeLessThan(860);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`artifacts/daily-quality-${theme}.png`});
  }
});

test('Without service connections, setup is actionable and no review count is invented', async ({page}) => {
  await page.evaluate(()=>{
    window.__fixture.configs.jira.tokenConfigured=false;
    window.__fixture.configs.gitlab.tokenConfigured=false;
  });
  await page.getByLabel('Workspace data mode').selectOption('demo');
  await page.getByLabel('Workspace data mode').selectOption('connected');
  await expect(page.getByLabel('Daily summary')).toContainText('GitLab not connected');
  await expect(page.getByLabel('Daily summary')).not.toContainText('0 reviews requested');
  await page.getByRole('button',{name:'Connect your tools',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Connect your workspace',exact:true})).toBeVisible();
});
