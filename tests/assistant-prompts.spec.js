import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

test.beforeEach(async ({page}) => installConnected(page));
const chats = page => page.evaluate(()=>window.__fixture.calls.filter(call=>call.action==='claude.chat'));

test('Home suggestion fills the composer without requesting Claude, explicit send preserves selected context', async ({page}) => {
  await page.keyboard.press('Meta+j');
  await expect(page.getByLabel('Assistant selected context')).toContainText('Home');
  await page.getByRole('button',{name:'Help me prioritize my personal plan',exact:true}).click();
  await expect(page.getByLabel('Ask Claude')).toHaveValue('Help me prioritize my personal plan');
  await expect(page.getByLabel('Ask Claude')).toBeFocused();
  expect(await chats(page)).toEqual([]);
  await page.getByRole('button',{name:'Send to Claude',exact:true}).click();
  await expect(page.locator('.live-chat-message.assistant')).toBeVisible();
  const calls=await chats(page);
  expect(calls).toHaveLength(1);
  expect(JSON.parse(JSON.parse(calls[0].args.context).selected).section).toBe('Home');
});

test('MR suggestions show its actual file context and are drafts until explicitly sent', async ({page}) => {
  await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
  await expect(page.getByRole('group',{name:'Dependency flow diagram',exact:true})).toBeVisible();
  await page.keyboard.press('Meta+j');
  const indicator=page.getByLabel('Assistant selected context');
  await expect(indicator).toContainText('MR !7');
  await page.getByRole('button',{name:'What should I review first?',exact:true}).click();
  expect(await chats(page)).toEqual([]);
  await page.getByRole('button',{name:'Send to Claude',exact:true}).click();
  await expect(page.locator('.live-chat-message.assistant')).toBeVisible();
  const calls=await chats(page);
  const selected=JSON.parse(JSON.parse(calls[0].args.context).selected);
  expect(selected.iid).toBe(7);
  expect(selected.type).toBe('merge_request');
  expect(selected.file).toBeTruthy();
  await expect(indicator).toContainText(selected.file);
  await expect(indicator).not.toContainText('headSha');
  await page.screenshot({path:'artifacts/assistant-context-prompts.png'});
});

test('Integration setup uses generic public placeholders and hides optional endpoint details', async ({page}) => {
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:/Jira Cloud/}).click();
  await expect(page.getByLabel('Service URL')).toHaveAttribute('placeholder','https://your-company.atlassian.net');
  await expect(page.getByLabel('Atlassian cloud ID')).toBeHidden();
  await page.getByText('Using a scoped API token?',{exact:true}).click();
  await expect(page.getByLabel('Atlassian cloud ID')).toBeVisible();
  await page.getByRole('button',{name:/Claude · Anthropic API/}).click();
  await expect(page.getByLabel('Claude workspace ID')).toBeHidden();
  await page.getByText('Advanced endpoint options',{exact:true}).click();
  await expect(page.getByLabel('Claude workspace ID')).toBeVisible();
});
