import {test,expect} from '@playwright/test';
import {installConnected} from './fixtures/connected.mjs';
// These scenarios describe a Seoul workday; make the browser clock explicit on CI.
test.use({timezoneId:'Asia/Seoul'});
async function setup(page){
 await page.clock.setFixedTime(new Date('2026-10-04T12:00:00+09:00'));
 await installConnected(page);
 await page.evaluate(()=>{
  window.__brief={calls:[],reminders:[],fail:false};const original=window.orbit.invoke;
  window.orbit.invoke=async(action,args)=>{
   if(action==='assistant.memory')return{scope:'scope-a',epoch:3,enabled:true,memories:[],reminders:window.__brief.reminders,notificationsEnabled:false};
   if(action==='assistant.reminders'){
    const state=window.__brief;state.calls.push(args);if(state.fail)throw Error('Reminder storage unavailable');
    if(args.op==='create'){const item={id:crypto.randomUUID(),title:args.title,taskId:args.taskId,dueAt:args.dueAt,state:'scheduled'};state.reminders.push(item);return {reminders:structuredClone(state.reminders)};}
    if(args.op==='snooze'||args.op==='dismiss')state.reminders=state.reminders.map(item=>item.id===args.id?{...item,state:args.op==='dismiss'?'dismissed':'scheduled',dueAt:args.dueAt||item.dueAt}:item);
    return structuredClone(state.reminders);
   }
   return original(action,args);
  };
 });
 const brief=page.getByRole('region',{name:'Assistant brief',exact:true});
 await brief.getByText('Reminders unavailable',{exact:true}).click();await brief.getByRole('button',{name:'Retry reminders',exact:true}).click();
 await expect(brief.getByText('Reminders unavailable',{exact:true})).toHaveCount(0);
 return brief;
}
async function expandTasks(brief){const button=brief.getByRole('button',{name:/Review \d+ planned tasks?/});if(await button.count())await button.click();}
async function add(page,title,kind='task'){await page.getByLabel('Personal item type').selectOption(kind);await page.getByLabel('Quick add personal work').fill(title);await page.getByRole('button',{name:'Add to plan',exact:true}).click();}

test('Brief explains local evidence, excludes past events and completed tasks, and opens the exact plan',async({page})=>{
 const brief=await setup(page);
 await add(page,'Earlier payment review 2026-10-03');await add(page,'Past meeting 2026-10-03 9am','event');await add(page,'Upcoming standup 2026-10-04 1pm','event');await add(page,'Finish retry review');
 await expect(brief).toContainText('1 unfinished from earlier days');await expect(brief).toContainText('Upcoming personal event');await expect(brief).not.toContainText('Past meeting');
 await expect(brief.getByRole('button',{name:'Upcoming standup',exact:true})).toHaveCount(1);
 await expandTasks(brief);await brief.getByRole('button',{name:'Complete locally Finish retry review',exact:true}).click();await expect(brief).not.toContainText('Scheduled today');
 expect(await page.evaluate(()=>window.__fixture.calls.filter(call=>['claude.chat','jira.edit','jira.transition'].includes(call.action)).length)).toBe(0);
 await brief.getByRole('button',{name:'Upcoming standup',exact:true}).click();
 await expect(page.getByLabel('Planning date')).toHaveValue('2026-10-04');await expect(page.locator('.plan-task-main>button').filter({hasText:'Upcoming standup'})).toBeFocused();
});

test('Reminder creation is explicit, scoped, and preserves the form on failure',async({page})=>{
 const brief=await setup(page);await add(page,'Confirm the release checklist');
 await expandTasks(brief);await brief.getByRole('button',{name:'Remind me about Confirm the release checklist',exact:true}).click();
 await expect(brief.getByLabel('Reminder date and time')).toHaveValue('2026-10-04T13:00');
 expect(await page.evaluate(()=>window.__brief.calls.filter(call=>call.op==='create').length)).toBe(0);
 await page.evaluate(()=>window.__brief.fail=true);await brief.getByRole('button',{name:'Confirm reminder',exact:true}).click();
 await expect(brief.getByRole('alert')).toContainText('Reminder storage unavailable');await expect(brief.getByLabel('Reminder date and time')).toHaveValue('2026-10-04T13:00');
 await page.evaluate(()=>window.__brief.fail=false);await brief.getByRole('button',{name:'Confirm reminder',exact:true}).click();
 await expect(brief.getByRole('status')).toContainText('Reminder saved');await expect(brief.getByText('Upcoming reminder',{exact:true})).toBeVisible();
 const call=await page.evaluate(()=>window.__brief.calls.filter(call=>call.op==='create').at(-1));expect(call.scope).toBe('scope-a');expect(call.epoch).toBe(3);expect(call.taskId).toBeTruthy();
 await expect(brief.getByRole('button',{name:'Confirm the release checklist',exact:true})).toHaveCount(0);
 await brief.getByRole('button',{name:'Snooze 30m',exact:true}).click();await expect(brief.getByRole('status')).toContainText('snoozed');
 await brief.getByRole('button',{name:'Dismiss',exact:true}).click();await expect(brief.getByText('Upcoming reminder',{exact:true})).toHaveCount(0);
});

test('A task changed while the reminder form is open cannot create a stale reminder',async({page})=>{
 const brief=await setup(page);await add(page,'Review request context');await expandTasks(brief);await brief.getByRole('button',{name:'Remind me about Review request context',exact:true}).click();
 await page.getByRole('button',{name:'Complete Review request context',exact:true}).click();await brief.getByRole('button',{name:'Confirm reminder',exact:true}).click();
 await expect(brief.getByRole('alert')).toContainText('This task changed');expect(await page.evaluate(()=>window.__brief.calls.filter(call=>call.op==='create').length)).toBe(0);
});

test('Brief actions and reminder composer remain usable at desktop and narrow widths',async({page})=>{
 const brief=await setup(page);await add(page,'Payment review 2026-10-03');await add(page,'Release handoff 2026-10-04 1pm','event');
 await brief.getByRole('button',{name:'Remind me about Release handoff',exact:true}).click();
 for(const [width,height,dark]of [[1440,900,false],[980,720,true]]){
  await page.setViewportSize({width,height});if(dark)await page.getByLabel('Toggle theme').click();
  const button=brief.getByRole('button',{name:'Confirm reminder',exact:true});await button.scrollIntoViewIfNeeded();
  expect(await button.evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({animations:'disabled',path:`artifacts/assistant-brief-${width}.png`});
 }
});

test('An older reminder refresh cannot revive a dismissed reminder',async({page})=>{
 const brief=await setup(page);await add(page,'Check retry alerts');await expandTasks(brief);await brief.getByRole('button',{name:'Remind me about Check retry alerts',exact:true}).click();await brief.getByRole('button',{name:'Confirm reminder',exact:true}).click();
 await expect(brief.getByText('Upcoming reminder',{exact:true})).toBeVisible();
 await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{
  if(action==='assistant.reminders'&&args.op==='list'){const old=structuredClone(window.__brief.reminders);await new Promise(resolve=>window.finishOldReminderList=resolve);return{reminders:old};}
  return original(action,args);
 };document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>window.finishOldReminderList);
 await brief.getByRole('button',{name:'Dismiss',exact:true}).click();await expect(brief.getByText('Upcoming reminder',{exact:true})).toHaveCount(0);
 await page.evaluate(()=>window.finishOldReminderList());await expect(brief.getByText('Upcoming reminder',{exact:true})).toHaveCount(0);
});

test('A memory change event refreshes the reminder lease before the next explicit save',async({page})=>{
 const brief=await setup(page);await add(page,'Check a new memory lease');await expandTasks(brief);
 await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=(action,args)=>action==='assistant.memory'&&args.op==='state'?Promise.resolve({scope:'scope-a',epoch:4,memories:[],reminders:[]}):original(action,args);window.dispatchEvent(new Event('worklane:memory-changed'));});
 await brief.getByRole('button',{name:'Remind me about Check a new memory lease',exact:true}).click();await brief.getByRole('button',{name:'Confirm reminder',exact:true}).click();
 await expect(brief.getByRole('status')).toContainText('Reminder saved');expect(await page.evaluate(()=>window.__brief.calls.filter(call=>call.op==='create').at(-1).epoch)).toBe(4);
});

for(const [timezoneId,display] of [['Asia/Seoul','2026-10-04T13:00'],['UTC','2026-10-04T04:00']]) {
 test.describe(`Reminder timezone ${timezoneId}`,()=>{
  test.use({timezoneId});
  test('local reminder input maps to the same absolute scheduled instant',async({page})=>{
   const brief=await setup(page);await add(page,'Cross-timezone release reminder');await expandTasks(brief);
   await brief.getByRole('button',{name:'Remind me about Cross-timezone release reminder',exact:true}).click();
   await expect(brief.getByLabel('Reminder date and time')).toHaveValue(display);
   await brief.getByRole('button',{name:'Confirm reminder',exact:true}).click();
   await expect(brief.getByRole('status')).toContainText('Reminder saved');
   expect(await page.evaluate(()=>window.__brief.calls.find(call=>call.op==='create').dueAt)).toBe('2026-10-04T04:00:00.000Z');
  });
 });
}
