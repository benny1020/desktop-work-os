import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

test('Assistant follow-ups include completed exchanges and preserve failed questions', async ({page}) => {
  await installConnected(page);
  await page.keyboard.press('Meta+j');
  const input = page.getByLabel('Ask Claude');
  await input.fill('Where should I start?');
  await page.getByRole('button', {name:'Send to Claude'}).click();
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
  await input.fill('Explain that recommendation.');
  await page.getByRole('button', {name:'Send to Claude'}).click();
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(2);
  const history = await page.evaluate(() => window.__fixture.calls.filter(c=>c.action==='claude.chat').at(-1).args.history);
  expect(history).toEqual([
    {role:'user',content:'Where should I start?'},
    {role:'assistant',content:'Review idempotency handling and the bounded retry path.'},
  ]);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = (action, args) => action === 'claude.chat' ? Promise.reject(Error('Fixture offline')) : invoke(action,args);
  });
  await input.fill('Keep this question when offline');
  await page.getByRole('button', {name:'Send to Claude'}).click();
  await expect(page.getByRole('alert')).toContainText('Fixture offline');
  await expect(input).toHaveValue('Keep this question when offline');
});

test('Worklane branding preserves the existing personal plan and theme keys', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('orbit-theme', JSON.stringify('dark'));
    localStorage.setItem('orbit.connected.plan.v1', JSON.stringify({tasks:[{id:'legacy',title:'Existing local work',date:'',time:'',done:false,kind:'task'}],recent:[],favorites:[],activity:[]}));
  });
  await installConnected(page);
  await expect(page).toHaveTitle(/Worklane/);
  await expect(page.locator('.workspace-switcher b')).toHaveText('worklane');
  await page.getByRole('button',{name:'Backlog',exact:true}).first().click();
  await expect(page.locator('.plan-task')).toContainText('Existing local work');
});

test('Assistant follows navigation and restores underlying issue after nested preview', async ({page}) => {
  await installConnected(page);
  await page.getByRole('button',{name:'Projects',exact:true}).click();
  await page.getByRole('button',{name:'Payment retry implementation',exact:true}).click();
  await expect(page.getByLabel('Live issue inspector')).toContainText('Payment retry implementation');
  await page.getByRole('button',{name:'Find linked MR & wiki'}).click();
  await page.getByRole('button',{name:'Payment Retry Policy',exact:true}).click();
  await expect(page.locator('.remote-document')).toBeVisible();
  await page.getByLabel('Close context preview').click();
  await page.keyboard.press('Meta+j');
  await page.getByLabel('Ask Claude').fill('What am I looking at now?');
  await page.getByRole('button',{name:'Send to Claude'}).click();
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
  const selected = () => page.evaluate(() => JSON.parse(window.__fixture.calls.filter(c=>c.action==='claude.chat').at(-1).args.context).selected);
  expect(await selected()).toContain('PAY-382');
  await page.getByLabel('Close live issue').click();
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByLabel('Ask Claude').fill('And now?');
  await page.getByRole('button',{name:'Send to Claude'}).click();
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
  expect(await page.evaluate(() => window.__fixture.calls.filter(c=>c.action==='claude.chat').at(-1).args.history)).toEqual([]);
  expect(JSON.parse(await selected())).toEqual({section:'Home',view:'Home'});
});

test('Source selection sends the visible code with its commit and line provenance', async ({page}) => {
  await installConnected(page);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = (action,args) => action === 'gitlab.code'
      ? Promise.resolve({content: Array.from({length:70},(_,i)=>i===49?'const SOURCE_ONLY_REVIEW_TARGET = 123;':`// source line ${i+1}`).join('\n')})
      : invoke(action,args);
  });
  await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await page.getByRole('button',{name:'Select source line 50',exact:true}).click();
  await page.keyboard.press('Meta+j');
  await page.getByLabel('Ask Claude').fill('Explain the selected code');
  await page.getByRole('button',{name:'Send to Claude'}).click();
  await expect(page.locator('.live-chat-message.assistant')).toBeVisible();
  const context = await page.evaluate(() => JSON.parse(JSON.parse(window.__fixture.calls.filter(c=>c.action==='claude.chat').at(-1).args.context).selected));
  expect(context.codeMode).toBe('Source');
  expect(context.line).toBe(50);
  expect(context.source.excerpt).toContain('50: const SOURCE_ONLY_REVIEW_TARGET = 123;');
  expect(context.source.fromLine).toBe(40);
  expect(context.source.toLine).toBe(60);
  expect(context.source.ref).toBe(context.headSha);
  expect(context.source.truncated).toBe(true);
});

test('A late Jira refresh cannot restore context after leaving the issue', async ({page}) => {
  await installConnected(page);
  await page.getByRole('button',{name:'Projects',exact:true}).click();
  await page.getByRole('button',{name:'Payment retry implementation',exact:true}).click();
  await expect(page.getByLabel('Live issue inspector')).toContainText('Payment retry implementation');
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action,args) => {
      if(action === 'jira.issue') {
        window.__lateRefreshPending = true;
        await new Promise(resolve => window.__releaseLateRefresh = resolve);
      }
      return invoke(action,args);
    };
  });
  await page.getByLabel('Jira comment').fill('Confirm retry behavior');
  await page.getByRole('button',{name:'Post to Jira',exact:true}).click();
  await page.waitForFunction(() => window.__lateRefreshPending);
  await page.getByLabel('Close live issue').click();
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.evaluate(() => window.__releaseLateRefresh());
  await page.keyboard.press('Meta+j');
  await page.getByLabel('Ask Claude').fill('What is current?');
  await page.getByRole('button',{name:'Send to Claude'}).click();
  await expect(page.locator('.live-chat-message.assistant')).toBeVisible();
  const selected = await page.evaluate(() => JSON.parse(window.__fixture.calls.filter(c=>c.action==='claude.chat').at(-1).args.context).selected);
  expect(JSON.parse(selected)).toEqual({section:'Home',view:'Home'});
});
