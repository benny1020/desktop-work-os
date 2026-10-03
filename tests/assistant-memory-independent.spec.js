import {test,expect} from '@playwright/test';
import {installAssistantMemory} from './fixtures/assistant-memory.mjs';
const open=page=>page.keyboard.press('Meta+j');
const send=async(page,text)=>{await page.getByLabel('Ask Claude').fill(text);await page.getByRole('button',{name:'Send to Claude',exact:true}).click();await expect(page.locator('.live-chat-message.assistant').last()).toBeVisible();};

test('Memory readiness cannot erase early typing, and failed archive loading retries without losing a draft',async({page})=>{
 await installAssistantMemory(page);
 await page.evaluate(()=>{const original=window.orbit.invoke;window.failHistory=true;window.orbit.invoke=async(action,args)=>{
  if(action==='assistant.memory'&&args.op==='state')await new Promise(resolve=>window.readyMemory=resolve);
  if(action==='assistant.memory'&&args.op==='history'&&window.failHistory)throw Error('Archive temporarily offline');
  return original(action,args);
 };});
 await open(page);await expect(page.getByLabel('Ask Claude')).toBeDisabled();await page.waitForFunction(()=>window.readyMemory);await page.evaluate(()=>window.readyMemory());
 await expect(page.getByLabel('Ask Claude')).toBeEnabled();await page.getByLabel('Ask Claude').fill('Retain this unsent question');
 await expect(page.getByRole('button',{name:'Retry conversation history',exact:true})).toBeVisible();await page.evaluate(()=>window.failHistory=false);await page.getByRole('button',{name:'Retry conversation history',exact:true}).click();
 await expect(page.getByRole('button',{name:'Retry conversation history',exact:true})).toHaveCount(0);await expect(page.getByLabel('Ask Claude')).toHaveValue('Retain this unsent question');
});

test('Pause keeps the unsent question but does not recall archived exchanges in a new request',async({page})=>{
 await installAssistantMemory(page);await open(page);await send(page,'Archived work preference');await page.getByLabel('Ask Claude').fill('My unsent current question');
 await page.getByRole('tab',{name:/Memory/}).click();await page.getByLabel('New assistant memory').fill('Unsent personal note');
 await page.getByRole('button',{name:'Pause memory',exact:true}).click();await expect(page.getByRole('button',{name:'Resume memory',exact:true})).toBeVisible();
 await expect(page.getByLabel('New assistant memory')).toHaveValue('Unsent personal note');
 await page.getByRole('tab',{name:'Conversation',exact:true}).click();await expect(page.locator('.live-chat-message')).toHaveCount(0);await expect(page.getByLabel('Ask Claude')).toHaveValue('My unsent current question');
 await send(page,'A session-only follow-up');expect(await page.evaluate(()=>window.__fixture.calls.filter(call=>call.action==='claude.chat').at(-1).args.history)).toEqual([]);
});

test('A stale search cannot replace new text or restore forgotten knowledge; notification opt-in is explicit',async({page})=>{
 await installAssistantMemory(page);await open(page);await page.getByRole('tab',{name:/Memory/}).click();
 await page.getByLabel('New assistant memory').fill('Old retry evidence');await page.getByRole('button',{name:'Remember this',exact:true}).click();await expect(page.locator('.memory-record')).toContainText('Old retry evidence');
 await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{if(action==='assistant.memory'&&args.op==='search'){const old=await original(action,args);await new Promise(resolve=>window.releaseSearch=resolve);return old;}return original(action,args);};});
 await page.getByLabel('Search assistant memory').fill('Old');await page.locator('.memory-search').getByRole('button',{name:'Search',exact:true}).click();await page.waitForFunction(()=>window.releaseSearch);
 await page.getByLabel('Search assistant memory').fill('New');await page.getByRole('button',{name:'Forget memory Old retry evidence',exact:true}).click();await expect(page.locator('.memory-record')).toHaveCount(0);await page.evaluate(()=>window.releaseSearch());await expect(page.locator('.memory-record')).toHaveCount(0);
 await page.getByRole('button',{name:'Enable notifications',exact:true}).click();await expect(page.getByRole('button',{name:'Disable notifications',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Forget all memories',exact:true}).click();await expect(page.locator('.memory-forget-all')).toContainText('conversations, facts, and reminders');
});

test('Memory view supports arrow navigation and expanded workspace keeps its controls reachable',async({page})=>{
 await page.setViewportSize({width:980,height:650});await installAssistantMemory(page);await open(page);
 const conversation=page.getByRole('tab',{name:'Conversation',exact:true}), memory=page.getByRole('tab',{name:/Memory/});
 await conversation.focus();await page.keyboard.press('ArrowRight');await expect(memory).toBeFocused();await expect(memory).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'Expand assistant workspace',exact:true}).click();
 await page.getByLabel('New assistant memory').fill('An unsent focused workspace note');await page.getByRole('button',{name:'Dock assistant',exact:true}).click();await expect(page.getByLabel('New assistant memory')).toHaveValue('An unsent focused workspace note');
 await memory.focus();await page.keyboard.press('Home');await expect(conversation).toBeFocused();await expect(page.getByLabel('Ask Claude')).toBeInViewport();
});

test('Partial memory-save failure is visible even when the conversation archive succeeded',async({page})=>{
 await installAssistantMemory(page);
 await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{const result=await original(action,args);return action==='claude.chat'?{...result,memory:{...result.memory,saved:true,error:'Conversation saved, but the new fact could not be saved.'}}:result;};});
 await open(page);await send(page,'Remember a review preference');
 await expect(page.locator('.live-chat-message.assistant')).toContainText('Conversation saved, but the new fact could not be saved.');
});
