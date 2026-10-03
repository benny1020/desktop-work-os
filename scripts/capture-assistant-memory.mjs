import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {installAssistantMemory} from '../tests/fixtures/assistant-memory.mjs';
const folder=new URL('../artifacts/assistant-capture/',import.meta.url).pathname;await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({baseURL:'http://127.0.0.1:5178',viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const shot=async n=>page.screenshot({path:`${folder}${n}.png`,animations:"disabled"});
try{
 await installAssistantMemory(page);
 for(const title of ['Review payment retries today 10am','Prepare API planning notes today 2pm']){await page.getByLabel('Quick add personal work').fill(title);await page.getByRole('button',{name:'Add to plan',exact:true}).click();}
 await page.getByRole('button',{name:'Add to Today',exact:true}).click();
 await page.keyboard.press('Meta+j');await page.getByRole('tab',{name:/Memory/}).click();
 await page.getByLabel('New assistant memory').fill('I prefer reviewing payment changes before lunch. Keep the afternoon free for deep work.');await page.getByRole('button',{name:'Remember this',exact:true}).click();await expect(page.locator('.memory-record')).toBeVisible();
 await page.getByRole('tab',{name:'Conversation',exact:true}).click();
 await page.evaluate(()=>{window.__assistantReply={answer:'Your morning is best kept for review. You asked me to protect the afternoon for deep work.\n\nStart with the payment retry change, then prepare a short decision note before planning. I have drafted one follow-up for tomorrow. Nothing has been scheduled yet.',suggestions:[{type:'create_task',title:'Follow up on payment retry review decisions',date:'2026-10-05',time:'10:00',reason:'Keep the follow-up before lunch, as you prefer.'}]};});
 await page.getByLabel('Ask Claude').fill('Help me organize the payment review and its follow-up.');await page.getByRole('button',{name:'Send to Claude',exact:true}).click();await expect(page.locator('.assistant-action-card')).toBeVisible();await shot('01-docked');
 await page.getByRole('button',{name:'Expand assistant workspace'}).click();await shot('02-expanded');
 await page.getByText('Used 1 memories · View sources').click();await shot('03-sources');
 await page.getByRole('button',{name:'Confirm change',exact:true}).click();await expect(page.locator('.assistant-action-card')).toContainText('Applied');await shot('04-confirmed');
 await page.getByRole('tab',{name:/Memory/}).click();await shot('05-memory');
 await page.getByRole('tab',{name:'Conversation',exact:true}).click();await page.getByRole('button',{name:'Toggle theme'}).click();await shot('06-dark');
 await fs.copyFile(folder+'02-expanded.png',new URL('../docs/media/assistant-memory.png',import.meta.url));
 await fs.copyFile(folder+'05-memory.png',new URL('../docs/media/assistant-memory-controls.png',import.meta.url));
 await fs.copyFile(folder+'06-dark.png',new URL('../docs/media/assistant-memory-dark.png',import.meta.url));
 await fs.writeFile(folder+'evidence.json',JSON.stringify({fixtures:true,liveClaude:false,screens:6,errors},null,2));console.log(JSON.stringify({screens:6,errors}));
}finally{await browser.close();}
