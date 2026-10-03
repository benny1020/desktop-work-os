import {test,expect} from '@playwright/test';
import {installConnected} from './fixtures/connected.mjs';
const openMR=page=>page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
const send=page=>page.getByRole('button',{name:'Send to Claude',exact:true}).click();

test('Closing Assistant preserves conversation and unfinished input in memory and restores keyboard focus',async({page})=>{
  await installConnected(page);
  const origin=page.getByRole('button',{name:'Home',exact:true});await origin.focus();
  await page.keyboard.press('Meta+j');await expect(page.getByLabel('Ask Claude')).toBeFocused();
  await page.getByLabel('Ask Claude').fill('Remember this review question');await send(page);
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
  await page.getByLabel('Ask Claude').fill('Unfinished follow-up');await page.keyboard.press('Escape');
  await expect(origin).toBeFocused();await page.keyboard.press('Meta+j');
  await expect(page.getByLabel('Ask Claude')).toHaveValue('Unfinished follow-up');
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
  expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).not.toContain('Unfinished follow-up');
  expect(await page.evaluate(()=>JSON.stringify({...sessionStorage}))).not.toContain('Remember this review question');
  await send(page);await expect(page.locator('.live-chat-message.assistant')).toHaveCount(2);
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='claude.chat').at(-1).args.history[0].content)).toBe('Remember this review question');
});

test('A pending request survives closing without duplicate send and keeps the response',async({page})=>{
  await installConnected(page);
  await page.evaluate(()=>{const original=window.orbit.invoke;window.requestCount=0;window.orbit.invoke=async(action,args)=>{if(action==='claude.chat'){window.requestCount++;await new Promise(resolve=>window.finishResponse=resolve);}return original(action,args);};});
  await page.keyboard.press('Meta+j');await page.getByLabel('Ask Claude').fill('Analyze once');await send(page);
  await page.waitForFunction(()=>window.requestCount===1);await page.keyboard.press('Escape');await page.keyboard.press('Meta+j');
  await expect(page.getByText('Claude is responding…')).toBeVisible();
  await page.getByLabel('Ask Claude').fill('My next question');await expect(page.getByRole('button',{name:'Send to Claude',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await page.evaluate(()=>window.finishResponse());await page.keyboard.press('Meta+j');
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
  await expect(page.getByLabel('Ask Claude')).toHaveValue('My next question');
  expect(await page.evaluate(()=>window.requestCount)).toBe(1);
});

test('MR line navigation keeps its conversation while issue context isolates a pending reply',async({page})=>{
  await installConnected(page);await openMR(page);await page.keyboard.press('Meta+j');
  await page.getByLabel('Ask Claude').fill('MR draft before selecting code');
  await page.getByRole('button',{name:'Open component PaymentService.ts',exact:true}).click();
  await expect(page.getByLabel('Ask Claude')).toHaveValue('MR draft before selecting code');
  await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{if(action==='claude.chat')await new Promise(resolve=>window.finishMR=resolve);return original(action,args);};});
  await send(page);await page.waitForFunction(()=>typeof window.finishMR==='function');
  await page.locator('.mr-linked-context').getByRole('button',{name:'PAY-382',exact:true}).click();
  await expect(page.getByLabel('Assistant selected context')).toContainText('PAY-382');
  await expect(page.locator('.live-chat-message')).toHaveCount(0);
  await page.getByLabel('Ask Claude').fill('Separate issue draft');await page.evaluate(()=>window.finishMR());
  await expect(page.locator('.live-chat-message')).toHaveCount(0);
  await page.getByLabel('Back in context').click();
  await expect(page.getByLabel('Assistant selected context')).toContainText('MR !7');
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
  await page.locator('.mr-linked-context').getByRole('button',{name:'PAY-382',exact:true}).click();
  await expect(page.getByLabel('Ask Claude')).toHaveValue('Separate issue draft');
});

test('Late failure retains the question after reopening and retry is explicitly requested',async({page})=>{
  await page.setViewportSize({width:980,height:650});await installConnected(page);
  await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{if(action==='claude.chat')await new Promise((resolve,reject)=>window.failResponse=()=>reject(Error('Temporary offline')));return original(action,args);};});
  await page.keyboard.press('Meta+j');await page.getByLabel('Ask Claude').fill('Keep my failed request');await send(page);
  await page.waitForFunction(()=>typeof window.failResponse==='function');await page.keyboard.press('Escape');await page.evaluate(()=>window.failResponse());await page.keyboard.press('Meta+j');
  await expect(page.getByRole('alert')).toContainText('Temporary offline');await expect(page.getByLabel('Ask Claude')).toHaveValue('Keep my failed request');
  await page.evaluate(()=>window.orbit.invoke=(action,args)=>window.__fixture.invoke(action,args));
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='claude.chat').length)).toBe(0);
  await send(page);await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
});

test('Endpoint changes isolate prior drafts and configuration read failures can retry in place',async({page})=>{
  await installConnected(page);await page.keyboard.press('Meta+j');await page.getByLabel('Ask Claude').fill('Original company context');await page.keyboard.press('Escape');
  await page.evaluate(()=>{window.__fixture.configs.gitlab.url='https://other-gitlab.fixture.test';window.__fixture.setFailure('config.list');});
  await page.keyboard.press('Meta+j');await expect(page.getByRole('button',{name:'Retry assistant',exact:true})).toBeVisible();
  await page.evaluate(()=>window.__fixture.setFailure(''));await page.getByRole('button',{name:'Retry assistant',exact:true}).click();
  await expect(page.getByLabel('Ask Claude')).toBeEnabled();await expect(page.getByLabel('Ask Claude')).toHaveValue('');
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='claude.chat').length)).toBe(0);
});

test('Assistant shows new exchanges but does not pull the reader away from earlier evidence',async({page})=>{
  await page.setViewportSize({width:980,height:650});await installConnected(page);
  await page.evaluate(()=>{const original=window.orbit.invoke;window.answerCount=0;window.orbit.invoke=async(action,args)=>{
    if(action!=='claude.chat')return original(action,args);
    const count=++window.answerCount;
    if(count===2)await new Promise(resolve=>window.finishSecond=resolve);
    return{content:[{type:'text',text:count===1?'Detailed review evidence. '.repeat(700):`Answer ${count}`} ]};
  };});
  await page.keyboard.press('Meta+j');await page.getByLabel('Ask Claude').fill('First question');await send(page);
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
  const tailVisible=()=>page.evaluate(()=>{const body=document.querySelector('.live-assistant-body').getBoundingClientRect(),last=document.querySelector('.live-chat-message:last-of-type').getBoundingClientRect();return last.bottom<=body.bottom+1;});
  await expect.poll(tailVisible).toBe(true);
  await page.getByLabel('Ask Claude').fill('Second question');await send(page);await page.waitForFunction(()=>window.finishSecond);
  await page.locator('.live-assistant-body').evaluate(body=>{body.scrollTop=0;body.dispatchEvent(new Event('scroll'));});
  await page.evaluate(()=>window.finishSecond());await expect(page.locator('.live-chat-message.assistant')).toHaveCount(2);
  expect(await page.locator('.live-assistant-body').evaluate(body=>body.scrollTop)).toBe(0);
  await page.getByLabel('Ask Claude').fill('Third question');await send(page);
  await expect(page.getByText('Answer 3',{exact:true})).toBeVisible();await expect.poll(tailVisible).toBe(true);
});

test('Two wiki documents retain separate assistant conversations through context Back',async({page})=>{
  await installConnected(page);
  await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{
    if(action==='confluence.search')return{results:[{content:{id:'doc-a',title:'Retry evidence A'}},{content:{id:'doc-b',title:'Retry evidence B'}}]};
    const result=await original(action,args);
    if(action==='confluence.page')return{...result,id:args.id,title:args.id==='doc-a'?'Retry evidence A':'Retry evidence B'};
    return result;
  };});
  const chooseDoc=async title=>{await page.keyboard.press('Meta+k');await page.getByLabel('Connected global search').fill('Retry evidence');await page.locator('[cmdk-item]').filter({hasText:title}).click();};
  await chooseDoc('Retry evidence A');await page.keyboard.press('Meta+j');
  await expect(page.getByLabel('Assistant selected context')).toContainText('Retry evidence A');
  await page.getByLabel('Ask Claude').fill('Analyze document A');await send(page);await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
  await page.getByLabel('Ask Claude').fill('A follow-up draft');await chooseDoc('Retry evidence B');
  await expect(page.getByLabel('Assistant selected context')).toContainText('Retry evidence B');
  await expect(page.locator('.live-chat-message')).toHaveCount(0);await expect(page.getByLabel('Ask Claude')).toHaveValue('');
  await page.getByLabel('Ask Claude').fill('B follow-up draft');await page.getByLabel('Back in context').click();
  await expect(page.getByLabel('Assistant selected context')).toContainText('Retry evidence A');
  await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);await expect(page.getByLabel('Ask Claude')).toHaveValue('A follow-up draft');
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='claude.chat').length)).toBe(1);
});
