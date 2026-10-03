import {test,expect} from '@playwright/test';
import {installAssistantMemory} from './fixtures/assistant-memory.mjs';
const open=async page=>{await page.keyboard.press('Meta+j');await expect(page.getByLabel('Ask Claude')).toBeVisible();};
const send=async(page,text)=>{await page.getByLabel('Ask Claude').fill(text);await page.getByRole('button',{name:'Send to Claude',exact:true}).click();};
test('Durable conversation survives reload and memory sources are inspectable',async({page})=>{
  await installAssistantMemory(page);await open(page);
  await page.getByRole('tab',{name:/Memory/}).click();
  await page.getByLabel('New assistant memory').fill('Review payment code before lunch.');
  await page.getByRole('button',{name:'Remember this',exact:true}).click();
  await expect(page.locator('.memory-record')).toContainText('Review payment code before lunch.');
  await page.getByRole('tab',{name:'Conversation',exact:true}).click();await send(page,'What do you remember about reviews?');
  await expect(page.locator('.live-chat-message.assistant')).toContainText('preferences');
  await page.getByText('Used 1 memories · View sources').click();
  await expect(page.locator('.assistant-recalled')).toContainText('before lunch');
  await page.reload();await open(page);
  await expect(page.locator('.live-chat-message.user')).toContainText('What do you remember');
  await expect(page.locator('.live-chat-message.assistant')).toContainText('preferences');
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='claude.chat').length)).toBe(0);
});
test('Knowledge can be edited, paused and forgotten without resurrecting session messages',async({page})=>{
  await installAssistantMemory(page);await open(page);await send(page,'Remember my workday');
  await expect(page.locator('.live-chat-message.assistant')).toBeVisible();
  await page.getByRole('tab',{name:/Memory/}).click();
  await page.getByLabel('New assistant memory').fill('Meetings at nine');await page.getByRole('button',{name:'Remember this'}).click();
  await page.getByRole('button',{name:'Edit memory Meetings at nine'}).click();await page.getByLabel('Edit assistant memory').fill('Meetings at ten');await page.getByRole('button',{name:'Save memory',exact:true}).click();
  await expect(page.locator('.memory-record')).toContainText('Meetings at ten');
  await page.getByRole('button',{name:'Pause memory'}).click();await expect(page.getByRole('button',{name:'Resume memory'})).toBeVisible();
  await page.getByRole('button',{name:'Forget all memories'}).click();await page.getByRole('button',{name:'Confirm forget all'}).click();
  await page.getByRole('tab',{name:'Conversation',exact:true}).click();await expect(page.locator('.live-chat-message')).toHaveCount(0);
  await page.reload();await open(page);await expect(page.locator('.live-chat-message')).toHaveCount(0);
});
test('Structured task suggestion requires explicit confirmation and applies only once',async({page})=>{
  await installAssistantMemory(page);await open(page);
  await page.evaluate(()=>{window.__assistantReply={answer:'I prepared a task for tomorrow.',suggestions:[{type:'create_task',title:'Review retry decisions',date:'2026-10-05',time:'10:00',reason:'Leave time before planning.'}]};});
  await send(page,'Plan a review');await expect(page.getByRole('button',{name:'Confirm change'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')||'{"tasks":[]}').tasks.length)).toBe(0);
  await page.getByRole('button',{name:'Confirm change'}).click();await expect(page.locator('.assistant-action-card')).toContainText('Applied');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')).tasks.filter(t=>t.title==='Review retry decisions').length)).toBe(1);
});
test('Expanded assistant keeps draft, current context and visible controls at desktop sizes',async({page})=>{
  await installAssistantMemory(page);await open(page);await page.getByLabel('Ask Claude').fill('Keep my draft while I think');
  await page.getByRole('button',{name:'Expand assistant workspace'}).click();await expect(page.locator('.assistant-expanded')).toBeVisible();
  await expect(page.getByLabel('Ask Claude')).toHaveValue('Keep my draft while I think');await expect(page.getByRole('button',{name:'Send to Claude'})).toBeInViewport();
  await page.screenshot({path:'artifacts/assistant-workspace-light.png'});
  await page.setViewportSize({width:980,height:650});await expect(page.getByLabel('Close assistant')).toBeInViewport();await expect(page.getByLabel('Ask Claude')).toBeInViewport();
  await page.getByRole('button',{name:'Dock assistant'}).click();await expect(page.getByLabel('Ask Claude')).toHaveValue('Keep my draft while I think');
});
