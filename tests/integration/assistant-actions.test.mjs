import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareAssistantActions,applyAssistantAction} from '../../src/lib/assistant-actions.js';
const task={id:'task-1',title:'Check retries',date:'2026-10-04',time:'09:00',kind:'task',done:false};
test('Assistant actions reject unknown IDs, invalid calendar dates and event completion',()=>{
 const proposed=prepareAssistantActions([{type:'complete_task',taskId:'missing'},{type:'reschedule_task',taskId:'task-1',date:'2026-02-30'},{type:'create_task',title:'Bad time',date:'2026-10-06',time:'25:00'},{type:'complete_task',taskId:'event'}],[task,{...task,id:'event',kind:'event'}]);
 assert.deepEqual(proposed,[]);
});
test('Assistant reschedule has a fresh-state guard and preserves external linkage',()=>{
 const linked={...task,object:{type:'issue',key:'PAY-382'}};
 const [action]=prepareAssistantActions([{type:'reschedule_task',taskId:task.id,date:'2026-10-06',time:'10:00'}],[linked]);
 const plan={tasks:[linked],activity:[]};
 assert.throws(()=>applyAssistantAction({...plan,tasks:[{...linked,time:'11:00'}]},action),/changed/);
 const next=applyAssistantAction(plan,action);
 assert.equal(next.tasks[0].date,'2026-10-06');assert.equal(next.tasks[0].object,linked.object);assert.equal(plan.tasks[0].date,'2026-10-04');
});
test('Assistant create actions are idempotent by suggestion ID',()=>{
 const [action]=prepareAssistantActions([{type:'create_task',title:'Review policy',date:'2026-10-06'}],[]);
 const next=applyAssistantAction({tasks:[],activity:[]},action);
 assert.equal(next.tasks.length,1);assert.throws(()=>applyAssistantAction(next,action),/already applied/);
});
