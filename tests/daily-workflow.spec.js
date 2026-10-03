import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';
test.beforeEach(async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-03T12:00:00+09:00'));
  await installConnected(page);
});
async function add(page,title){await page.getByLabel('Quick add personal work').fill(title);await page.getByRole('button',{name:'Add to plan',exact:true}).click();}

test('Today shows unfinished earlier tasks with their local dates, excluding past events, and brings them forward with undo',async({page})=>{
  const today=await page.getByLabel('Planning date').inputValue();
  await add(page,'Review retry contract 2026-10-01');
  await page.getByLabel('Personal item type').selectOption('event');
  await add(page,'Past standup 2026-10-01 9am');
  const carry=page.getByRole('region',{name:'Unfinished from earlier days'});
  await expect(carry).toContainText('Review retry contract');
  await expect(carry).toContainText('2026-10-01');
  await expect(carry).not.toContainText('Past standup');
  await carry.getByRole('button',{name:'Bring to Today',exact:true}).click();
  await expect(page.getByLabel('Date for Review retry contract',{exact:true})).toHaveValue(today);
  await page.getByRole('button',{name:'Undo schedule move',exact:true}).click();
  await expect(carry).toContainText('Review retry contract');
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>['jira.edit','jira.transition'].includes(c.action)))).toEqual([]);
});

test('Calendar day drilldown returns to its exact original month and Today keeps the range',async({page})=>{
  const today=await page.getByLabel('Planning date').inputValue();
  await page.getByRole('button',{name:'Calendar',exact:true}).first().click();
  await page.getByLabel('Calendar range').selectOption('Month');
  await page.getByLabel('Planning date').fill('2026-10-15');
  await page.getByRole('button',{name:'Open day 2026-10-21',exact:true}).click();
  await expect(page.getByLabel('Calendar range')).toHaveValue('Day');
  await expect(page.getByLabel('Planning date')).toHaveValue('2026-10-21');
  await page.getByRole('button',{name:'Back to month',exact:true}).click();
  await expect(page.getByLabel('Calendar range')).toHaveValue('Month');
  await expect(page.getByRole('button',{name:'Open day 2026-10-21',exact:true})).toBeFocused();
  await expect(page.getByLabel('Planning date')).toHaveValue('2026-10-15');
  await page.getByRole('button',{name:'Return to today',exact:true}).click();
  await expect(page.getByLabel('Planning date')).toHaveValue(today);
  await expect(page.getByLabel('Calendar range')).toHaveValue('Month');
});

test('End-of-day move keeps meetings in place, and undo never overwrites a newer schedule',async({page})=>{
  const today=await page.getByLabel('Planning date').inputValue();
  await add(page,'Complete release notes');await add(page,'Review retry logic');
  await page.getByLabel('Personal item type').selectOption('event');await add(page,'Daily standup 9am');
  await page.getByRole('button',{name:'Move unfinished to next day',exact:true}).click();
  await expect(page.locator('.plan-task')).toHaveCount(2);
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')).tasks);
  expect((await stored()).find(t=>t.title==='Daily standup').date).toBe(today);
  await page.getByLabel('Date for Review retry logic',{exact:true}).fill('2027-03-02');
  await page.getByRole('button',{name:'Undo schedule move',exact:true}).click();
  const tasks=await stored();
  expect(tasks.find(t=>t.title==='Complete release notes').date).toBe(today);
  expect(tasks.find(t=>t.title==='Review retry logic').date).toBe('2027-03-02');
  expect(tasks.find(t=>t.title==='Daily standup').date).toBe(today);
  await expect(page.getByLabel('Planning date')).toHaveValue(today);
});

test('Carryover discloses a long queue and keyboard day drilldown returns to the original week',async({page})=>{
  for(let i=1;i<=5;i++)await add(page,`Earlier task ${i} 2026-10-01`);
  const carry=page.getByRole('region',{name:'Unfinished from earlier days'});
  await expect(carry.getByRole('button',{name:'Earlier task 4',exact:true})).toBeHidden();
  await carry.getByText('Show 2 more earlier tasks',{exact:true}).click();
  await expect(carry.getByRole('button',{name:'Earlier task 4',exact:true})).toBeVisible();
  await carry.getByRole('button',{name:'Bring all 5 to Today',exact:true}).click();
  await expect(page.locator('.plan-task')).toHaveCount(5);
  await page.getByRole('button',{name:'This Week',exact:true}).first().click();
  const originalDate=await page.getByLabel('Planning date').inputValue();
  const day=page.locator('.planning-day-heading button').nth(2);
  const selected=(await day.getAttribute('aria-label')).replace('Open day ','');
  await day.focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('Planning date')).toHaveValue(selected);
  await expect(page.getByLabel('Calendar range')).toHaveValue('Day');
  await page.getByRole('button',{name:'Back to week',exact:true}).click();
  await expect(page.getByRole('heading',{name:'This Week',exact:true})).toBeVisible();
  await expect(page.getByLabel('Planning date')).toHaveValue(originalDate);
});

test('Carryover and day navigation stay usable at desktop and narrow widths',async({page})=>{
  await add(page,'Review payment idempotency 2026-10-01');await add(page,'Prepare incident follow-up 2026-10-02');
  await add(page,'Validate the retry budget');
  for(const [width,height,theme]of [[1440,900,'light'],[980,720,'dark']]){
    await page.setViewportSize({width,height});
    if(theme==='dark')await page.getByLabel('Toggle theme').click();
    await expect(page.getByRole('region',{name:'Unfinished from earlier days'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({animations:'disabled',path:`artifacts/daily-workflow-home-${width}.png`});
  }
  await page.getByRole('button',{name:'Calendar',exact:true}).first().click();
  await page.getByLabel('Calendar range').selectOption('Month');
  await page.screenshot({animations:'disabled',path:'artifacts/daily-workflow-month-980.png'});
});

test('Leaving planning preserves drilldown, unfinished quick entry and schedule undo',async({page})=>{
  await add(page,'Carryover context 2026-10-01');
  await page.getByRole('button',{name:'Bring to Today',exact:true}).click();
  await page.getByRole('button',{name:'Calendar',exact:true}).first().click();await page.getByLabel('Calendar range').selectOption('Month');
  await page.getByLabel('Planning date').fill('2026-11-15');await page.getByRole('button',{name:'Open day 2026-11-21',exact:true}).click();
  await page.getByLabel('Quick add personal work').fill('Draft a local follow-up');
  await page.getByRole('button',{name:'Docs',exact:true}).click();await page.getByLabel('Go back',{exact:true}).click();
  await expect(page.getByLabel('Planning date')).toHaveValue('2026-11-21');await expect(page.getByLabel('Calendar range')).toHaveValue('Day');
  await expect(page.getByLabel('Quick add personal work')).toHaveValue('Draft a local follow-up');
  await page.getByRole('button',{name:'Back to month',exact:true}).click();
  await expect(page.getByLabel('Planning date')).toHaveValue('2026-11-15');await expect(page.getByLabel('Calendar range')).toHaveValue('Month');
  await page.getByRole('button',{name:'Undo schedule move',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')).tasks.find(t=>t.title==='Carryover context').date)).toBe('2026-10-01');
});

test('Returning to the last month row makes its focused day visible in a narrow window',async({page})=>{
  await page.setViewportSize({width:980,height:650});
  await page.getByRole('button',{name:'Calendar',exact:true}).first().click();await page.getByLabel('Calendar range').selectOption('Month');await page.getByLabel('Planning date').fill('2026-11-15');
  const day=page.getByRole('button',{name:'Open day 2026-12-06',exact:true});await day.click();await page.getByRole('button',{name:'Back to month',exact:true}).click();
  await expect(day).toBeFocused();
  await expect.poll(()=>day.evaluate(el=>{const b=el.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight;})).toBe(true);
});

test('Home keeps today separate from the remembered My Work calendar range',async({page})=>{
  const today=await page.getByLabel('Planning date').inputValue();await add(page,'Visible release proof');
  await page.getByRole('button',{name:'Calendar',exact:true}).first().click();await page.getByLabel('Calendar range').selectOption('Month');await page.getByLabel('Planning date').fill('2026-11-15');
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await expect(page.getByLabel('Planning date')).toHaveValue(today);await expect(page.locator('.plan-task')).toContainText('Visible release proof');
  await page.getByRole('button',{name:'Calendar',exact:true}).first().click();
  await expect(page.getByLabel('Planning date')).toHaveValue('2026-11-15');await expect(page.getByLabel('Calendar range')).toHaveValue('Month');
});

test('An unfinished Plan here entry keeps its exact target day after leaving and returning',async({page})=>{
  await page.getByRole('button',{name:'Calendar',exact:true}).first().click();await page.getByLabel('Calendar range').selectOption('Month');await page.getByLabel('Planning date').fill('2026-10-15');
  const target=page.getByRole('region',{name:'Plan for 2026-09-28',exact:true});
  await target.getByRole('button',{name:'+ Plan here',exact:true}).click();await page.getByLabel('Quick add personal work').fill('September retrospective draft');
  await page.getByRole('button',{name:'Docs',exact:true}).click();await page.getByLabel('Go back',{exact:true}).click();
  await expect(page.getByLabel('Quick add personal work')).toHaveValue('September retrospective draft');await expect(page.locator('#plan-quick-target')).toContainText('2026-09-28');
  await page.getByRole('button',{name:'Add to plan',exact:true}).click();
  await expect(target).toContainText('September retrospective draft');
});
