import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';
test.beforeEach(async ({page})=>installConnected(page));
async function add(page,title,kind='task') {
 await page.getByLabel('Personal item type').selectOption(kind);
 await page.getByLabel('Quick add personal work').fill(title);
 await page.getByRole('button',{name:'Add to plan',exact:true}).click();
}
test('Weekly task geometry stays stable during hover, keyboard focus and schedule actions',async({page})=>{
 await add(page,'Review payment retry 11am');await add(page,'Release checklist 1pm');
 await page.getByRole('button',{name:'This Week',exact:true}).first().click();await page.mouse.move(0,0);
 const card=page.locator('.planning-grid .plan-task').filter({hasText:'Review payment retry'}), next=page.locator('.planning-grid .plan-task').filter({hasText:'Release checklist'});
 const before={card:await card.boundingBox(),next:await next.boundingBox()};
 await card.hover();expect((await card.boundingBox()).height).toBe(before.card.height);expect((await next.boundingBox()).y).toBe(before.next.y);
 await card.getByLabel('Edit plan for Review payment retry',{exact:true}).focus();expect((await next.boundingBox()).y).toBe(before.next.y);
 await card.getByLabel('More planning actions for Review payment retry',{exact:true}).press('Enter');
 await expect(card.getByLabel('Time for Review payment retry',{exact:true})).toBeVisible();expect((await card.boundingBox()).height).toBe(before.card.height);expect((await next.boundingBox()).y).toBe(before.next.y);
 await card.getByLabel('Time for Review payment retry',{exact:true}).fill('11:30');await card.getByLabel('Time for Review payment retry',{exact:true}).press('Escape');
 await expect(card.getByLabel('More planning actions for Review payment retry',{exact:true})).toBeFocused();
 expect((await next.boundingBox()).y).toBe(before.next.y);
});
test('Event completion is an explicit toggle with a separate calendar marker and guarded Undo',async({page})=>{
 await add(page,'Backend sync 10am','event');const row=page.locator('.plan-task').filter({hasText:'Backend sync'});
 const toggle=page.getByLabel('Complete Backend sync',{exact:true});await expect(toggle).toHaveAttribute('aria-pressed','false');
 await expect(toggle.locator('.lucide-calendar-days')).toHaveCount(0);await expect(row.locator('.plan-event-marker')).toBeVisible();
 await row.locator('.plan-event-marker').click();await expect(toggle).toHaveAttribute('aria-pressed','false');await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await toggle.focus();await page.keyboard.press('Space');await expect(page.getByLabel('Reopen Backend sync',{exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Undo completion',exact:true}).click();await expect(page.getByLabel('Complete Backend sync',{exact:true})).toHaveAttribute('aria-pressed','false');
 expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>['jira.edit','jira.transition'].includes(c.action)))).toEqual([]);
});
test('Incidental editor dismissals retain each item draft while explicit Cancel discards',async({page})=>{
 await add(page,'Review retry');await add(page,'Release checklist');
 await page.getByLabel('Edit plan for Review retry',{exact:true}).click();await page.getByLabel('Personal work title',{exact:true}).fill('Review retry with race-condition questions');await page.getByLabel('Personal work time',{exact:true}).fill('14:30');await page.keyboard.press('Escape');
 await page.getByLabel('Edit plan for Release checklist',{exact:true}).click();await expect(page.getByLabel('Personal work title',{exact:true})).toHaveValue('Release checklist');await page.keyboard.press('Escape');
 await page.getByLabel('Edit plan for Review retry',{exact:true}).click();await expect(page.getByLabel('Personal work title',{exact:true})).toHaveValue('Review retry with race-condition questions');await expect(page.getByLabel('Personal work time',{exact:true})).toHaveValue('14:30');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByLabel('Edit plan for Review retry',{exact:true}).click();await expect(page.getByLabel('Personal work title',{exact:true})).toHaveValue('Review retry');
 await page.getByLabel('Personal work title',{exact:true}).fill('Saved review retry');await page.getByRole('button',{name:'Save personal work',exact:true}).click();await page.getByLabel('Edit plan for Saved review retry',{exact:true}).click();await expect(page.getByLabel('Personal work title',{exact:true})).toHaveValue('Saved review retry');
});
test('Outside editor dismissal retains draft and completion Undo never overwrites a later edit',async({page})=>{
 await add(page,'Plan release');await page.getByLabel('Edit plan for Plan release',{exact:true}).click();await page.getByLabel('Personal work title',{exact:true}).fill('Plan release handoff');await page.mouse.click(5,5);
 await expect(page.getByRole('dialog')).toBeHidden();await page.getByLabel('Edit plan for Plan release',{exact:true}).click();await expect(page.getByLabel('Personal work title',{exact:true})).toHaveValue('Plan release handoff');await page.getByRole('button',{name:'Save personal work',exact:true}).click();
 await page.getByLabel('Complete Plan release handoff',{exact:true}).click();await page.getByLabel('Edit plan for Plan release handoff',{exact:true}).click();await page.getByLabel('Personal work title',{exact:true}).fill('Updated completed release');await page.getByRole('button',{name:'Save personal work',exact:true}).click();await page.getByRole('button',{name:'Undo completion',exact:true}).click();
 await expect(page.getByLabel('Reopen Updated completed release',{exact:true})).toBeVisible();await expect(page.getByRole('status').filter({hasText:'changed after completion'})).toBeVisible();
});

test('More opened by keyboard closes immediately on Escape from its opener',async({page})=>{
 await add(page,'Keyboard review');await page.getByRole('button',{name:'This Week',exact:true}).first().click();
 const more=page.getByLabel('More planning actions for Keyboard review',{exact:true});await more.focus();await more.press('Enter');await expect(more).toHaveAttribute('aria-expanded','true');await expect(more).toBeFocused();
 await more.press('Escape');await expect(more).toHaveAttribute('aria-expanded','false');await expect(more).toBeFocused();await expect(page.getByRole('group',{name:'Planning actions for Keyboard review',exact:true})).toHaveCount(0);
});
async function externalEdit(page,title,time) {
 await page.evaluate(async({title,time})=>{const {planChange}=await import('/src/lib/planning.js');planChange(p=>({...p,tasks:p.tasks.map(t=>({...t,title,time}))}));},{title,time});
}
test('Concurrent newer saved work invalidates a dismissed editor draft using its true opening snapshot',async({page})=>{
 await add(page,'Audit task 11am');await page.getByLabel('Edit plan for Audit task',{exact:true}).click();await page.getByLabel('Personal work title',{exact:true}).fill('Unsaved old title');await externalEdit(page,'Updated externally','16:00');await page.keyboard.press('Escape');
 await page.getByLabel('Edit plan for Updated externally',{exact:true}).click();await expect(page.getByLabel('Personal work title',{exact:true})).toHaveValue('Updated externally');await expect(page.getByLabel('Personal work time',{exact:true})).toHaveValue('16:00');
});
test('Concurrent save conflict keeps draft and newer work until explicit review and acknowledgement',async({page})=>{
 await add(page,'Audit task 11am');await page.getByLabel('Edit plan for Audit task',{exact:true}).click();await page.getByLabel('Personal work title',{exact:true}).fill('My reviewed draft');await externalEdit(page,'Updated externally','16:00');await page.getByRole('button',{name:'Save personal work',exact:true}).click();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orbit.connected.plan.v1')).tasks[0]);expect(await saved()).toMatchObject({title:'Updated externally',time:'16:00'});
 await expect(page.getByRole('dialog').getByRole('alert')).toContainText('changed while you were editing');await expect(page.getByLabel('Personal work title',{exact:true})).toHaveValue('My reviewed draft');await expect(page.getByLabel('Latest saved personal work')).toContainText('16:00');
 await externalEdit(page,'Updated again','17:00');await page.getByRole('button',{name:'Apply these edits to latest work',exact:true}).click();expect(await saved()).toMatchObject({title:'Updated again',time:'17:00'});await expect(page.getByLabel('Latest saved personal work')).toContainText('17:00');
 await page.getByRole('button',{name:'Apply these edits to latest work',exact:true}).click();await expect(page.getByRole('dialog')).toBeHidden();expect(await saved()).toMatchObject({title:'My reviewed draft',time:'11:00'});
});
