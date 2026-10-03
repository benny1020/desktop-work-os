import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAssistantBrief,currentBriefTask,applyBriefAction} from '../../src/lib/assistant-planning.js';
const now=new Date(2026,9,4,12,0);
const task=(id,changes={})=>({id,title:id,date:'2026-10-04',time:'',kind:'task',done:false,...changes});
test('brief classifies actual local schedules, excludes stale meetings/completed/backlog, and deduplicates task IDs',()=>{
 const entries=buildAssistantBrief([task('old',{date:'2026-10-03'}),task('old',{date:'2026-10-03'}),task('meeting',{kind:'event',time:'13:00'}),task('past meeting',{kind:'event',time:'09:00'}),task('done',{done:true}),task('backlog',{date:''}),task('tomorrow',{date:'2026-10-05',time:'11:59'}),task('later',{date:'2026-10-05',time:'12:01'})],{now});
 assert.deepEqual(entries.map(e=>[e.id,e.reason]),[['meeting','upcoming-event'],['old','carryover'],['tomorrow','scheduled']]);
 assert.equal(entries[2].label,'Scheduled within 24 hours');
 assert.ok(entries.every(e=>!e.label.toLowerCase().includes('due')));
});
test('brief rejects impossible dates/times and uses local calendar boundaries',()=>{
 const entries=buildAssistantBrief([task('impossible',{date:'2026-02-30'}),task('invalid event',{kind:'event',time:'25:00'}),task('untimed tomorrow',{date:'2026-10-05'}),task('today')],{now});
 assert.deepEqual(entries.map(e=>e.id),['today']);
});
test('explicit completion only changes matching local task; schedule change preserves linked service metadata',()=>{
 const first=task('old',{date:'2026-10-03',object:{type:'issue',key:'PAY-382',origin:'https://jira.example'}}),other=task('other');
 const plan={tasks:[first,other],activity:[],favorites:[]};const entry=buildAssistantBrief(plan.tasks,{now}).find(e=>e.id==='old');
 const next=applyBriefAction(plan,entry,'today',{now,activityId:'action'});
 assert.equal(next.tasks[0].date,'2026-10-04');assert.deepEqual(next.tasks[0].object,first.object);assert.equal(plan.tasks[0].date,'2026-10-03');assert.equal(next.tasks[1],other);
 assert.throws(()=>applyBriefAction(next,entry,'complete',{now}),/changed/);
 const fresh=buildAssistantBrief(next.tasks,{now}).find(e=>e.id==='old');
 assert.equal(applyBriefAction(next,fresh,'complete',{now}).tasks[0].done,true);
});
test('stale evidence blocks deleted, completed, renamed, rescheduled and relinked tasks',()=>{
 const original=task('x',{object:{type:'issue',key:'PAY-382',origin:'https://jira.example'}});const entry=buildAssistantBrief([original],{now})[0];
 for(const change of [{done:true},{title:'Updated'},{date:'2026-10-05'},{time:'14:00'},{object:{...original.object,origin:'https://other.example'}}])assert.throws(()=>currentBriefTask([{...original,...change}],entry),/changed/);
 assert.throws(()=>currentBriefTask([],entry),/changed/);
});
