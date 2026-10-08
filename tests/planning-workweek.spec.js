import {test,expect} from '@playwright/test';
import {installConnected} from './fixtures/connected.mjs';
test.beforeEach(async ({page}) => { await page.clock.install({time:new Date('2026-10-07T09:00:00+09:00')}); await installConnected(page); });
async function add(page,title) { await page.getByLabel('Quick add personal work').fill(title); await page.getByRole('button',{name:'Add to plan',exact:true}).click(); }
test('Workweek widens weekdays without losing weekend work or changing task data',async({page})=>{
  await add(page,'Review retry 2026-10-07 11am'); await add(page,'Weekend release 2026-10-10 2pm');
  await page.getByRole('button',{name:'This Week',exact:true}).first().click();
  await expect(page.locator('.planning-grid > section')).toHaveCount(7);
  const original=await page.evaluate(()=>localStorage.getItem('orbit.connected.plan.v1'));
  const before=(await page.getByLabel('Plan for 2026-10-07',{exact:true}).boundingBox()).width;
  await page.getByLabel('Week layout',{exact:true}).selectOption('workweek');
  await expect(page.locator('.planning-grid > section')).toHaveCount(5);
  expect((await page.getByLabel('Plan for 2026-10-07',{exact:true}).boundingBox()).width).toBeGreaterThan(before);
  await expect(page.locator('.planning-week-toolbar')).toContainText('2 planned');
  await expect(page.getByLabel('Show 1 weekend item',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('orbit.connected.plan.v1'))).toBe(original);
  await page.getByLabel('Show 1 weekend item',{exact:true}).click();
  await expect(page.getByLabel('Plan for 2026-10-10',{exact:true})).toContainText('Weekend release');
  await expect(page.getByLabel('Open day 2026-10-10',{exact:true})).toBeFocused();
});
test('The week display survives navigation and narrow workweeks fit while Calendar keeps seven days',async({page})=>{
  await add(page,'Read retry docs'); await page.getByRole('button',{name:'This Week',exact:true}).first().click();
  await page.getByLabel('Week layout',{exact:true}).selectOption('workweek');
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:'My Work',exact:true}).click();
  await page.getByRole('button',{name:'This Week',exact:true}).first().click();
  await expect(page.getByLabel('Week layout',{exact:true})).toHaveValue('workweek');
  await page.setViewportSize({width:980,height:650});
  expect(await page.locator('.planning-grid').evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Calendar',exact:true}).first().click();
  await page.getByLabel('Calendar range',{exact:true}).selectOption('Week');
  await expect(page.locator('.planning-grid > section')).toHaveCount(7);
  await expect(page.getByLabel('Week layout',{exact:true})).toHaveCount(0);
});
