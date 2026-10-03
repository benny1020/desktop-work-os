import {test,expect} from '@playwright/test';
import {installConnected} from './fixtures/connected.mjs';

test('Search streams ready services, retains keyboard access and ignores stale responses',async({page})=>{
  await installConnected(page);
  await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{
    if(action==='confluence.search') await new Promise(resolve=>window.finishWiki=resolve);
    if(action==='jira.issues' && args.jql.includes('OLD-1')) {await new Promise(resolve=>window.finishOld=resolve);return {issues:[{key:'OLD-1',fields:{summary:'Old response'}}]};}
    return original(action,args);
  };});
  await page.keyboard.press('Meta+k');
  await page.getByLabel('Connected global search').fill('OLD-1');
  await expect(page.locator('[cmdk-item]').filter({hasText:'Payment retry review'})).toBeVisible();
  await expect(page.getByLabel('Search service status')).toContainText('Wiki · Searching');
  await page.getByLabel('Connected global search').fill('PAY-382');
  const issue=page.locator('[cmdk-item]').filter({hasText:'PAY-382 Payment retry implementation'});
  await expect(issue).toBeVisible();await expect(issue).toContainText('In Progress · Alex Kim');
  await page.evaluate(()=>window.finishOld());
  await expect(page.locator('[cmdk-item]').filter({hasText:'Old response'})).toHaveCount(0);
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(page.getByLabel('Connected global search')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('Search retries only a failed source without dropping ready results or query',async({page})=>{
  await installConnected(page);await page.evaluate(()=>window.__fixture.setFailure('jira.issues'));
  await page.keyboard.press('Meta+k');await page.getByLabel('Connected global search').fill('PAY-382');
  await expect(page.getByRole('button',{name:'Retry Jira',exact:true})).toBeVisible();
  await expect(page.locator('[cmdk-item]').filter({hasText:'Payment Retry Policy'})).toBeVisible();
  const before=await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='confluence.search').length);
  await page.evaluate(()=>window.__fixture.setFailure(''));
  await page.getByRole('button',{name:'Retry Jira',exact:true}).click();
  await expect(page.locator('[cmdk-item]').filter({hasText:'PAY-382 Payment retry implementation'})).toBeVisible();
  await expect(page.getByLabel('Connected global search')).toHaveValue('PAY-382');
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='confluence.search').length)).toBe(before);
});

test('Quick create keeps separate session drafts across closing and clears only a submitted draft',async({page})=>{
  await installConnected(page);await page.keyboard.press('Meta+n');
  await page.getByRole('button',{name:'Jira issue',exact:true}).click();
  await page.getByLabel('New work title').fill('My unfinished issue');await page.getByLabel('New work body').fill('Important investigation context');
  await page.getByRole('button',{name:'Wiki document',exact:true}).click();
  await expect(page.getByLabel('New work title')).toHaveValue('');
  await page.getByLabel('New work title').fill('Independent wiki draft');
  await page.keyboard.press('Escape');await page.keyboard.press('Meta+n');
  await expect(page.getByLabel('New work title')).toHaveValue('Independent wiki draft');
  await expect(page.getByLabel('New work title')).toBeFocused();
  await page.getByRole('button',{name:'Jira issue',exact:true}).click();
  await expect(page.getByLabel('New work title')).toHaveValue('My unfinished issue');
  await expect(page.getByLabel('New work body')).toHaveValue('Important investigation context');
  await page.getByLabel('New issue project').selectOption('PAY');await page.getByLabel('New issue type').selectOption('3');
  await page.getByRole('button',{name:'Create in Jira',exact:true}).click();
  await expect(page.getByLabel('Live issue inspector')).toBeVisible();
  await page.keyboard.press('Meta+n');await expect(page.getByLabel('New work title')).toHaveValue('');
  await page.getByRole('button',{name:'Wiki document',exact:true}).click();await expect(page.getByLabel('New work title')).toHaveValue('Independent wiki draft');
  await page.getByRole('button',{name:'Discard draft',exact:true}).click();await page.keyboard.press('Escape');await page.keyboard.press('Meta+n');
  await expect(page.getByLabel('New work title')).toHaveValue('');
});

test('Quick create scopes drafts to service account and recovers failed form options',async({page})=>{
  await installConnected(page);await page.evaluate(()=>window.__fixture.setFailure('jira.projects'));
  await page.keyboard.press('Meta+n');await page.getByRole('button',{name:'Jira issue',exact:true}).click();
  await page.getByLabel('New work title').fill('Tenant A draft');
  await expect(page.getByRole('button',{name:'Retry form options',exact:true})).toBeVisible();
  await page.evaluate(()=>window.__fixture.setFailure(''));await page.getByRole('button',{name:'Retry form options',exact:true}).click();
  await page.getByLabel('New issue project').selectOption('PAY');
  await expect(page.getByLabel('New work title')).toHaveValue('Tenant A draft');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__fixture.configs.jira.url='https://tenant-b.fixture.test');
  await page.keyboard.press('Meta+n');await expect(page.getByLabel('New work title')).toHaveValue('');
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>['jira.create','confluence.create'].includes(c.action)).length)).toBe(0);
});

test('A failed connection lookup does not block local quick create and submission stays reachable at 980px',async({page})=>{
  await page.setViewportSize({width:980,height:650});await installConnected(page);
  await page.evaluate(()=>window.__fixture.setFailure('config.list'));
  await page.keyboard.press('Meta+n');
  await page.getByLabel('New work title').fill('Local note during outage');
  await page.getByRole('button',{name:'Save local task',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Saved to your local plan'})).toBeVisible();
  await page.evaluate(()=>window.__fixture.setFailure(''));
  await page.getByRole('button',{name:'Retry connections',exact:true}).click();
  await page.getByRole('button',{name:'Jira issue',exact:true}).click();
  await page.getByLabel('New work title').fill('Follow up the service outage');await page.getByLabel('New work body').fill('Investigate and document recovery.');
  const button=await page.getByRole('button',{name:'Create in Jira',exact:true}).boundingBox();
  expect(button.y+button.height).toBeLessThan(650);
  await expect(page.getByRole('button',{name:'Retry connections',exact:true})).toHaveCount(0);
});
