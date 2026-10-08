import { openReviewComposer } from "./fixtures/review-composer.mjs";
import { test, expect } from '@playwright/test';
const open = async page => {
  await page.goto('/');
  await page.getByRole('button', {name:'Code',exact:true}).click();
  await page.getByRole('row').filter({hasText:'Unify settlement API, Kafka delivery and reconciliation'}).getByRole('button', {name:'Review',exact:true}).click();
  await expect(page.getByLabel('Current business flow')).toContainText('Kafka');
  await page.getByLabel('Collapse sidebar',{exact:true}).click();
};
const showContracts = async page => {
  const details = page.getByLabel('Flow details', {exact:true});
  if (await details.count()) await details.click();
  if (await page.locator('.api-contracts').getAttribute('open') === null) await page.locator('.api-contracts summary').click();
};
const geometry = page => page.locator('.diagram-scroll').evaluate(canvas => {
  const c = canvas.getBoundingClientRect(), m = canvas.closest('.visual-map-panel').getBoundingClientRect();
  return {visible:Math.min(c.bottom,m.bottom,innerHeight)-Math.max(c.top,m.top,0), height:c.height,
    panelWidth:m.width, viewWidth:innerWidth};
});
test('Opening contracts cannot push the graph out of a narrow review window', async ({page}) => {
  await open(page); await showContracts(page);
  await page.setViewportSize({width:980,height:650});
  await expect.poll(async () => (await geometry(page)).visible).toBeGreaterThanOrEqual(140);
  const before = await geometry(page);
  await page.locator('.api-contracts summary').click();
  expect(Math.abs((await geometry(page)).height - before.height)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('Flow details disclose source contracts without consuming the diagram or losing a private draft', async ({page}) => {
  await open(page);
  await expect.poll(async () => (await geometry(page)).visible).toBeGreaterThanOrEqual(300);
  await page.getByRole('button',{name:'Open component SettlementPersistenceAdapter.ts',exact:true}).click();
  await page.getByRole('button',{name:'Select source line 6',exact:true}).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Keep this storage-read review note.');
  const before = await geometry(page);
  await showContracts(page);
  expect(Math.abs((await geometry(page)).height - before.height)).toBeLessThan(2);
  const event = page.locator('.api-contracts').getByRole('button',{name:'SettlementEvent.ts',exact:true});
  await event.focus(); await event.press('Escape');
  await expect(page.getByLabel('Flow details',{exact:true})).toBeFocused();
  await expect(page.locator('.api-flow-details')).not.toHaveAttribute('open','');
  await showContracts(page); await event.click();
  await expect(page.getByLabel('Component code')).toContainText('eventVersion: 2');
  await page.getByRole('button',{name:'Open component SettlementPersistenceAdapter.ts',exact:true}).click();
  await page.getByRole('button',{name:'Select source line 6',exact:true}).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Keep this storage-read review note.');
});
test('Class links disclose both storage operations at their exact source lines without changing visualization', async ({page}) => {
  await open(page);
  await page.getByRole('button',{name:'Open component SettlementService.ts',exact:true}).click();
  await page.getByLabel('Calls for selected component',{exact:true}).click();
  const calls = page.getByLabel('Source calls for selected component',{exact:true});
  await expect(calls).toContainText('SettlementPersistenceAdapter.find()');
  await expect(calls).toContainText('SettlementPersistenceAdapter.save()');
  await calls.getByRole('button',{name:/Inspect call .*SettlementPersistenceAdapter.save\(\)/}).click();
  await expect(page.getByRole('tab',{name:'Dependency flow',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByLabel('Component code').locator('.visual-code-line.selected')).toContainText('this.storage.save');
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Verify this save shares the idempotency constraint.');
  await page.getByRole('tab',{name:'Sequence',exact:true}).click();
  await expect(page.locator('.sequence-label')).toContainText('save()');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Verify this save shares the idempotency constraint.');
});
test('A selected call site remains readable when the review window shrinks', async ({page}) => {
  await open(page);
  await page.getByRole('button',{name:'Open component SettlementService.ts',exact:true}).click();
  await page.getByLabel('Calls for selected component',{exact:true}).click();
  await page.getByLabel('Source calls for selected component',{exact:true}).getByRole('button',{name:/Inspect call .*SettlementPersistenceAdapter.save\(\)/}).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Check this storage write.');
  await page.setViewportSize({width:980,height:650});
  await expect.poll(() => page.getByLabel('Component code').evaluate(canvas => {
    const bounds = canvas.getBoundingClientRect(), row = canvas.querySelector('.visual-code-line.selected').getBoundingClientRect();
    return row.top >= bounds.top - 1 && row.bottom <= bounds.bottom + 1;
  })).toBe(true);
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Check this storage write.');
  // Ordinary reading must still be able to scroll away from the selection.
  await page.getByLabel('Component code').evaluate(canvas => { canvas.scrollTop = 0; });
  await expect.poll(() => page.getByLabel('Component code').evaluate(canvas => canvas.scrollTop)).toBe(0);
});
