import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

test.beforeEach(async ({page}) => installConnected(page));
async function add(page,title) { await page.getByLabel('Quick add personal work').fill(title); await page.getByRole('button',{name:'Add to plan',exact:true}).click(); }

test('Provider switching preserves unsaved in-memory connection drafts without storing tokens locally', async ({page}) => {
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('Service URL').fill('https://new-gitlab.company.test');
  await page.getByLabel('API token').fill('unsaved-gitlab-token');
  await page.getByRole('button',{name:/Jira Cloud/}).click();
  await page.getByLabel('Service URL').fill('https://jira-draft.atlassian.net');
  await page.getByRole('button',{name:/GitLab Self-Managed/}).click();
  await expect(page.getByLabel('Service URL')).toHaveValue('https://new-gitlab.company.test');
  await expect(page.getByLabel('API token')).toHaveValue('unsaved-gitlab-token');
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('unsaved-gitlab-token');
  await page.getByRole('button',{name:/Jira Cloud/}).click();
  await expect(page.getByLabel('Service URL')).toHaveValue('https://jira-draft.atlassian.net');
});

test('Pending save locks provider and fields, then clears saved token even if connection verification fails', async ({page}) => {
  await page.evaluate(()=>{
    const original=window.orbit.invoke;
    window.orbit.invoke=async(action,args)=>{
      if(action==='config.save') {
        window.__fixture.calls.push({action,args});
        await new Promise(resolve=>{window.releaseSave=resolve});
        return {...args.config,token:undefined,tokenConfigured:true};
      }
      if(action==='config.test') throw Error('Could not verify access.');
      return original(action,args);
    };
  });
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('API token').fill('replacement-token');
  await page.getByRole('button',{name:'Save & test connection',exact:true}).click();
  await expect(page.getByRole('button',{name:/Jira Cloud/})).toBeDisabled();
  await expect(page.getByLabel('Service URL')).toBeDisabled();
  await page.evaluate(()=>window.releaseSave());
  await expect(page.getByRole('alert')).toContainText('Could not verify access.');
  await expect(page.getByLabel('API token')).toHaveValue('');
  await expect(page.getByLabel('API token')).toHaveAttribute('placeholder','Keep saved token, or enter a replacement');
  await expect(page.getByRole('button',{name:/Jira Cloud/})).toBeEnabled();
  await page.getByRole('button',{name:/Jira Cloud/}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Assistant rejects a stale schedule proposal after the task is moved manually', async ({page}) => {
  await add(page,'Review retries');
  await page.keyboard.press('Meta+j');
  await page.getByLabel('Ask Claude').fill('Move Review retries tomorrow');
  await page.getByRole('button',{name:'Send to Claude',exact:true}).click();
  await expect(page.getByRole('button',{name:'Confirm schedule'})).toBeVisible();
  await page.getByLabel('Date for Review retries',{exact:true}).fill('2027-01-19');
  await page.getByRole('button',{name:'Confirm schedule'}).click();
  await expect(page.getByRole('alert')).toContainText('changed since the suggestion');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')).tasks[0].date)).toBe('2027-01-19');
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='claude.chat'))).toEqual([]);
});

test('Moving unfinished tasks is one atomic save and storage failure leaves all dates unchanged', async ({page}) => {
  await add(page,'First item');await add(page,'Second item');
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')).tasks);
  await page.evaluate(()=>{
    const save=Storage.prototype.setItem;
    window.planWrites=0;window.failPlanSave=true;
    Storage.prototype.setItem=function(key,value){
      if(key==='orbit.connected.plan.v1'){window.planWrites++;if(window.failPlanSave)throw Error('Storage full');}
      return save.call(this,key,value);
    };
  });
  await page.getByRole('button',{name:'Move unfinished to next day'}).click();
  await expect(page.getByRole('alert')).toContainText('Storage full');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')).tasks)).toEqual(original);
  await page.evaluate(()=>{window.planWrites=0;window.failPlanSave=false;});
  await page.getByRole('button',{name:'Move unfinished to next day'}).click();
  expect(await page.evaluate(()=>window.planWrites)).toBe(1);
  await expect(page.locator('.plan-task')).toHaveCount(2);
});
