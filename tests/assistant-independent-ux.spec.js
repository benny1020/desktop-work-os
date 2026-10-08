import {test,expect} from '@playwright/test';
import { revealPlanningActions } from "./fixtures/planning-controls.mjs";
import {installConnected} from './fixtures/connected.mjs';
const send=page=>page.getByRole('button',{name:'Send to Claude',exact:true}).click();

test('Replacing a token on the same endpoint isolates prior assistant conversation',async({page})=>{
 await installConnected(page);
 await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{
  if(action==='config.save'){const {token,...safe}=args.config;window.__fixture.configs[args.service]={...safe,tokenConfigured:true};return window.__fixture.configs[args.service];}
  if(action==='config.test')return{name:'Replacement account'};
  return original(action,args);
 };});
 await page.keyboard.press('Meta+j');await page.getByLabel('Ask Claude').fill('Confidential account A context');await send(page);
 await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByLabel('API token').fill('account-b-token');await page.getByRole('button',{name:'Save & test connection',exact:true}).click();
 await expect(page.getByLabel('API token')).toHaveValue('');
 await page.getByRole('button',{name:'Home',exact:true}).click();await page.keyboard.press('Meta+j');
 await expect(page.getByLabel('Ask Claude')).toBeEnabled();
 await expect(page.locator('.live-chat-message')).toHaveCount(0);
 await page.getByLabel('Ask Claude').fill('New account question');await send(page);
 await expect(page.locator('.live-chat-message.assistant')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='claude.chat').at(-1).args.history)).toEqual([]);
});

test('Stored proposal cannot move a task completed while assistant is closed',async({page})=>{
 await installConnected(page);
 await page.getByLabel('Quick add personal work').fill('Verify deployment');await page.getByRole('button',{name:'Add to plan',exact:true}).click();
 await revealPlanningActions(page, 'Verify deployment');
 const date=await page.getByLabel('Date for Verify deployment',{exact:true}).inputValue();
 await page.keyboard.press('Meta+j');await page.getByLabel('Ask Claude').fill('Move Verify deployment tomorrow');await send(page);
 await expect(page.getByRole('button',{name:'Confirm schedule'})).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Complete Verify deployment',exact:true}).click();
 await page.keyboard.press('Meta+j');await page.getByRole('button',{name:'Confirm schedule'}).click();
 await expect(page.getByRole('alert')).toContainText('changed since the suggestion');
 await revealPlanningActions(page, 'Verify deployment');
 await expect(page.getByLabel('Date for Verify deployment',{exact:true})).toHaveValue(date);
 expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='claude.chat').length)).toBe(0);
});

test('Late failure preserves a newer draft and narrow dark compose remains reachable',async({page})=>{
 await page.setViewportSize({width:980,height:650});await installConnected(page);await page.getByLabel('Toggle theme').click();
 await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{if(action==='claude.chat')await new Promise((resolve,reject)=>window.rejectAnswer=()=>reject(Error('Network interrupted')));return original(action,args);};});
 await page.keyboard.press('Meta+j');await page.getByLabel('Ask Claude').fill('Original pending question');await send(page);
 await page.waitForFunction(()=>window.rejectAnswer);await page.getByLabel('Ask Claude').fill('New follow-up draft');await page.keyboard.press('Escape');await page.evaluate(()=>window.rejectAnswer());await page.keyboard.press('Meta+j');
 await expect(page.getByRole('alert')).toContainText('Network interrupted');await expect(page.getByLabel('Ask Claude')).toHaveValue('New follow-up draft');
 await expect(page.locator('.live-chat-message.user')).toContainText('Original pending question');
 const button=page.getByRole('button',{name:'Send to Claude',exact:true});
 expect(await button.evaluate(el=>{const b=el.getBoundingClientRect();return b.bottom<=innerHeight&&el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);
 await page.screenshot({animations:'disabled',path:'artifacts/assistant-independent-980-dark.png'});
 await page.setViewportSize({width:1440,height:900});await page.getByLabel('Toggle theme').click();await page.screenshot({animations:'disabled',path:'artifacts/assistant-independent-1440-light.png'});
});
