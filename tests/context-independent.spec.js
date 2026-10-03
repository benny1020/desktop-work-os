import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';
const nav=(page,name)=>page.locator(`nav .nav-item[aria-label="${name}"]`).click();
test.beforeEach(async({page})=>installConnected(page));

test('Posting a Jira comment preserves unsaved due date and assignee drafts',async({page})=>{
  await nav(page,'Projects');
  await page.getByRole('button',{name:'PAY-382',exact:true}).click();
  await page.getByLabel('Jira due date').fill('2027-01-19');
  await page.getByLabel('Find Jira assignee').fill('Daniel');
  await page.getByRole('button',{name:'Find people'}).click();
  await page.getByLabel('Jira assignee',{exact:true}).selectOption('daniel');
  await page.getByLabel('Live Jira comment').fill('Independent investigation note.');
  await page.getByRole('button',{name:'Post to Jira',exact:true}).click();
  await expect(page.getByLabel('Live Jira comment')).toHaveValue('');
  await expect(page.getByLabel('Jira due date')).toHaveValue('2027-01-19');
  await expect(page.getByLabel('Jira assignee',{exact:true})).toHaveValue('daniel');
  const edits=await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='jira.edit'));
  expect(edits).toEqual([]);
  await page.getByRole('button',{name:'Save due date in Jira'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='jira.edit').at(-1)?.args)).toEqual({key:'PAY-382',due:'2027-01-19'});
});

test('Issue draft and underlying inspector survive wiki preview in desktop light and narrow dark',async({page})=>{
  for(const theme of ['light','dark']) {
    if(theme==='dark') {await page.setViewportSize({width:980,height:720});await page.getByLabel('Toggle theme').click();}
    await nav(page,'Projects');
    await page.getByRole('button',{name:'PAY-382',exact:true}).click();
    await page.getByLabel('Live Jira comment').fill(`Investigation draft ${theme}`);
    await page.getByRole('button',{name:'Find linked MR & wiki'}).click();
    await page.getByRole('button',{name:'Payment Retry Policy',exact:true}).click();
    await expect(page.locator('.remote-document')).toContainText('Bound retries');
    await page.getByLabel('Close context preview').click();
    await expect(page.getByLabel('Live Jira comment')).toHaveValue(`Investigation draft ${theme}`);
    await page.getByLabel('Live Jira comment').scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Live Jira comment')).toBeInViewport();
    await expect(page.getByLabel('Close live issue')).toBeInViewport();
    await page.screenshot({path:`artifacts/context-independent-${theme}.png`});
    await page.getByLabel('Close live issue').click();
  }
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='jira.comment'))).toEqual([]);
});

test('Edits entered during a slow post-comment refresh survive when the response arrives',async({page})=>{
  await nav(page,'Projects');await page.getByRole('button',{name:'PAY-382',exact:true}).click();
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-04');
  await page.evaluate(()=>{
    const original=window.orbit.invoke;
    window.orbit.invoke=async(action,args)=>{
      if(action==='jira.issue')await new Promise(resolve=>window.releaseIssueRefresh=resolve);
      return original(action,args);
    };
  });
  await page.getByLabel('Live Jira comment').fill('Refresh while editing another field.');
  await page.getByRole('button',{name:'Post to Jira',exact:true}).click();
  await page.waitForFunction(()=>Boolean(window.releaseIssueRefresh));
  await page.getByLabel('Jira due date').fill('2027-03-02');
  await page.evaluate(()=>window.releaseIssueRefresh());
  await expect(page.getByRole('button',{name:'Save due date in Jira'})).toBeEnabled();
  await expect(page.getByLabel('Jira due date')).toHaveValue('2027-03-02');
});

test('Searching for the same dated task again returns to its date after manual date navigation',async({page})=>{
  await page.getByLabel('Quick add personal work').fill('Repeated task target tomorrow 2pm');
  await page.getByRole('button',{name:'Add to plan',exact:true}).click();
  async function findTask(){
    await page.keyboard.press('Meta+k');await page.getByLabel('Connected global search').fill('Repeated task target');
    await page.locator('[cmdk-item]').filter({hasText:'Repeated task target'}).click();
  }
  await findTask();
  await expect(page.locator('.plan-task')).toContainText('Repeated task target');
  const scheduled=await page.getByLabel('Planning date').inputValue();
  await page.getByLabel('Previous planning period').click();
  await expect(page.locator('.plan-task')).toHaveCount(0);
  await findTask();
  await expect(page.getByLabel('Planning date')).toHaveValue(scheduled);
  await expect(page.locator('.plan-task-main button').filter({hasText:'Repeated task target'})).toBeFocused();
});

test('Successful comment feedback stays explicit when the following refresh fails',async({page})=>{
  await nav(page,'Projects');await page.getByRole('button',{name:'PAY-382',exact:true}).click();
  await expect(page.getByLabel('Live Jira comment')).toBeVisible();
  await page.evaluate(()=>{
    const original=window.orbit.invoke;let posted=false;
    window.orbit.invoke=async(action,args)=>{
      if(action==='jira.issue'&&posted)throw Error('Refresh unavailable.');
      const result=await original(action,args);
      if(action==='jira.comment')posted=true;
      return result;
    };
  });
  await page.getByLabel('Live Jira comment').fill('A comment the service accepted.');
  await page.getByRole('button',{name:'Post to Jira',exact:true}).click();
  await expect(page.getByLabel('Live issue inspector').getByRole('status')).toContainText('Comment posted to Jira.');
  await expect(page.getByRole('alert')).toContainText('Refresh unavailable.');
  await expect(page.getByLabel('Live Jira comment')).toHaveValue('');
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='jira.comment'))).toHaveLength(1);
});
