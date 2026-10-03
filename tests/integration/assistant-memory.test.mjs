import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createAssistantMemoryStore, createReminderScheduler } = require('../../electron/assistant-memory.cjs');
const { createIntegrationService } = require('../../electron/integrations.cjs');
function setup(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'worklane-memory-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const key = crypto.randomBytes(32);
  const safeStorage = {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'keychain',
    encryptString(text) { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([iv, cipher.update(text), cipher.final(), cipher.getAuthTag()]); },
    decryptString(buffer) { const decipher = crypto.createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12)); decipher.setAuthTag(buffer.subarray(-16)); return Buffer.concat([decipher.update(buffer.subarray(12, -16)), decipher.final()]).toString(); },
  };
  let configs = { claude: { url: 'https://claude.fixture.test', token: 'configured-secret-claude-123', model: 'fixture-model' }, jira: { url: 'https://jira.fixture.test', email: 'user@example.test', token: 'configured-secret-jira-456' } };
  let time = Date.parse('2026-10-04T09:00:00Z');
  const factory = () => createAssistantMemoryStore({ directory, safeStorage, getConfigs: () => configs, now: () => time, ...options });
  const store = factory();
  const vault = { read: () => structuredClone(configs), write: (next) => { configs = next; } };
  return { directory, safeStorage, store, factory, vault, configs: () => configs, change: (value) => { configs = value; }, tick: (ms) => { time += ms; } };
}
const append = (store, lease, text = 'Remember my Tuesday planning habit.') => store.archive(lease, { conversationId: crypto.randomUUID(), contextKey: 'home', title: 'Planning', messages: [{id: crypto.randomUUID(),role:'user',text},{id:crypto.randomUUID(),role:'assistant',text:'We can plan on Tuesdays.'}] });

test('Encrypted atomic archive and facts survive restart with restrictive permissions and provenance', (t) => {
  const f = setup(t), lease = f.store.getState().lease;
  append(f.store, lease);
  f.store.saveFact(lease, {text:'Tuesday planning',source:{contextKey:'home',conversationId:'planning'}});
  const file = path.join(f.directory, `assistant-memory-${lease.scope}.enc`);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(file).includes(Buffer.from('Tuesday')), false);
  assert.equal(fs.readdirSync(f.directory).filter(p => p.endsWith('.tmp')).length, 0);
  const restarted = f.factory().getState();
  assert.equal(restarted.conversations.length, 1);
  assert.equal(restarted.facts[0].source.conversationId, 'planning');
});

test('Unavailable OS storage, basic_text and corrupt archives fail closed without replacement', (t) => {
  const f = setup(t), state = f.store.getState(), file = path.join(f.directory, `assistant-memory-${state.scope}.enc`);
  append(f.store, state.lease);
  const original = fs.readFileSync(file);
  f.safeStorage.isEncryptionAvailable = () => false;
  assert.throws(() => f.store.getState(), /unavailable/);
  assert.deepEqual(fs.readFileSync(file), original);
  f.safeStorage.isEncryptionAvailable = () => true;
  f.safeStorage.getSelectedStorageBackend = () => 'basic_text';
  assert.throws(() => f.store.saveFact(state.lease, {text:'No plaintext fallback'}), /unavailable/);
  f.safeStorage.getSelectedStorageBackend = () => 'keychain';
  fs.writeFileSync(file, 'corrupt archive');
  assert.throws(() => f.store.getState(), /left unchanged/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'corrupt archive');
});

test('Credential and profile isolation reject stale account writes; restoring credentials restores its archive', (t) => {
  const f = setup(t), first = f.store.getState(), original = f.configs();
  append(f.store, first.lease);
  f.change({...original,claude:{...original.claude,token:'different-account-secret'}});
  const second = f.store.getState();
  assert.notEqual(second.scope, first.scope);
  assert.equal(second.conversations.length, 0);
  assert.throws(() => append(f.store, first.lease), /account changed/);
  f.change(original);
  assert.equal(f.store.getState().conversations.length, 1);
  const other = setup(t);
  assert.equal(other.store.getState().conversations.length, 0);
});

test('Clear, forget and pause invalidate in-flight leases; paused archive never silently saves', (t) => {
  const f = setup(t); let state = f.store.getState();
  append(f.store,state.lease);
  f.store.clear(state.lease);
  assert.throws(() => append(f.store,state.lease), /late operation/);
  state = f.store.getState();
  const fact = f.store.saveFact(state.lease,{text:'Keep only this fact'}).result;
  f.store.forget(state.lease,{kind:'fact',id:fact.id});
  assert.throws(() => append(f.store,state.lease), /late operation/);
  state = f.store.getState(); f.store.setRemembering(state.lease,false);
  assert.throws(() => append(f.store,state.lease), /late operation/);
  assert.deepEqual(append(f.store,f.store.getState().lease).saved,false);
  assert.equal(f.store.getState().conversations.length,0);
});

test('Full archive refuses new writes without pruning existing history', (t) => {
  const f = setup(t,{maxBytes:1700}), state=f.store.getState();
  append(f.store,state.lease,'Original conversation');
  const before=f.store.getState();
  assert.throws(() => append(f.store,state.lease,'x'.repeat(2000)),/Nothing was discarded/);
  assert.deepEqual(f.store.getState(),before);
});

test('Secrets are redacted before persistence; retrieval is bounded and includes source IDs', (t) => {
  const f=setup(t), lease=f.store.getState().lease;
  append(f.store,lease,`configured-secret-claude-123 configured-secret-jira-456 Bearer other-bearer-secret sk-ant-extra-secret`);
  for(let i=0;i<20;i++) f.store.saveFact(lease,{text:`Planning ${i} ${'context '.repeat(70)}`,source:{contextKey:'home',conversationId:'source-'+i}});
  const serialized=JSON.stringify(f.store.getState());
  for(const secret of ['configured-secret-claude-123','configured-secret-jira-456','other-bearer-secret','sk-ant-extra-secret']) assert.equal(serialized.includes(secret),false);
  const retrieved=f.store.retrieve(lease,{query:'Planning',maxChars:1500});
  assert.ok(JSON.stringify(retrieved.items).length <= 1500);
  assert.ok(retrieved.items.length > 0 && retrieved.limited);
  assert.ok(retrieved.items[0].source.conversationId);
});

function reply(answer='Tuesday planning works.', memories=[]) {
  return {stop_reason:'tool_use',content:[{type:'tool_use',name:'worklane_reply',input:{answer,memories,suggestions:[{type:'reminder',title:'Plan',dueAt:'2026-10-05T09:00:00Z',reason:'You asked to plan'}]}}]};
}
test('Durable chat uses captured credentials and only stores exact user quotes, without executing suggestions', async (t) => {
  const f=setup(t), requests=[];
  const service=createIntegrationService({vault:f.vault,assistantMemory:f.store,fetchImpl:async(url,opts)=>{requests.push(JSON.parse(opts.body)); return new Response(JSON.stringify(reply('Use Tuesdays',[{text:'inferred paraphrase',kind:'preference',sourceQuote:'Tuesday planning'},{text:'false fact',kind:'note',sourceQuote:'not in user question'}])),{status:200});}});
  const state=await service.invoke('assistant.memory',{op:'state'});
  const result=await service.invoke('claude.chat',{message:'I prefer Tuesday planning.',memory:{scope:state.scope,epoch:state.epoch,contextKey:'home'}});
  assert.equal(requests.length,1); assert.equal(requests[0].tool_choice.name,'worklane_reply');
  assert.equal(result.memory.saved,true); assert.equal(result.suggestions.length,1);
  const saved=await service.invoke('assistant.memory',{op:'state'});
  assert.equal(saved.memories.length,1); assert.equal(saved.memories[0].text,'Tuesday planning');
  assert.equal(saved.reminders.length,0);
  const history=await service.invoke('assistant.memory',{op:'history',scope:saved.scope,epoch:saved.epoch,contextKey:'home'});
  assert.equal(history.entries[0].question,'I prefer Tuesday planning.');
});

test('Late Claude response cannot resurrect cleared history or persist under a changed account', async (t) => {
  const f=setup(t); let resolve;
  const service=createIntegrationService({vault:f.vault,assistantMemory:f.store,fetchImpl:()=>new Promise(r=>{resolve=()=>r(new Response(JSON.stringify(reply()),{status:200}));})});
  for(const change of ['clear','account']) {
    const state=await service.invoke('assistant.memory',{op:'state'});
    const pending=service.invoke('claude.chat',{message:'Tuesday planning',memory:{scope:state.scope,epoch:state.epoch,contextKey:'home'}});
    if(change==='clear') await service.invoke('assistant.memory',{op:'clear',scope:state.scope,epoch:state.epoch,target:'all'});
    else f.change({...f.configs(),claude:{...f.configs().claude,token:'changed-during-request'}});
    resolve(); const result=await pending;
    assert.equal(result.memory.saved,false); assert.match(result.memory.error,/changed/);
    assert.equal(f.store.getState().conversations.length,0);
  }
});

test('Reminders catch up after restart, require notification opt-in and notify once without Claude', async (t) => {
  const f=setup(t), lease=f.store.getState().lease;
  const reminder=f.store.saveReminder(lease,{text:'Planning',dueAt:'2026-10-04T09:01:00Z'}).result;
  let notifications=0;
  const scheduler=createReminderScheduler({store:f.factory(),notify:async()=>{notifications++;return true;}});
  f.tick(120000); await scheduler.tick(); assert.equal(notifications,0);
  f.store.setNotifications(lease,true);
  await Promise.all([scheduler.tick(),scheduler.tick()]); await scheduler.tick();
  assert.equal(notifications,1);
  assert.equal(f.store.getState().reminders[0].status,'delivered');
  f.store.saveReminder(lease,{id:reminder.id,text:'Planning',dueAt:'2026-10-04T09:04:00Z'});
  f.tick(180000); await scheduler.tick(); assert.equal(notifications,2);
  f.store.updateReminder(lease,{id:reminder.id,status:'done'});
  await scheduler.tick(); assert.equal(notifications,2);
});

test('Forgetting a fact removes its supporting episode and prevents automatic regeneration; explicit remember can restore it', (t) => {
  const f=setup(t), lease=f.store.getState().lease;
  append(f.store,lease,'I prefer Tuesday planning.');
  f.store.archive(lease,{conversationId:'deploy',contextKey:'deploy',title:'Deploy',messages:[{id:'deploy-user',role:'user',text:'Unrelated deployment discussion.'},{id:'deploy-answer',role:'assistant',text:'Verify the pipeline.'}]});
  const fact=f.store.saveFact(lease,{text:'Tuesday planning',sourceQuote:'Tuesday planning',automatic:true}).result;
  f.store.forget(lease,{kind:'fact',id:fact.id});
  const next=f.store.getState();
  assert.equal(next.conversations.length,1); assert.equal(next.facts.length,0);
  assert.equal(JSON.stringify(next.conversations).includes('Tuesday'),false);
  assert.equal(f.store.saveFact(next.lease,{text:'Tuesday planning',automatic:true}).result,null);
  f.store.saveFact(next.lease,{text:'Tuesday planning'});
  assert.equal(f.store.getState().facts.length,1);
});

test('Search returns actionable full memory and deduplicated episode identities, and pause omits retrieval', async (t) => {
  const f=setup(t), calls=[];
  const service=createIntegrationService({vault:f.vault,assistantMemory:f.store,fetchImpl:async(url,opts)=>{calls.push(JSON.parse(opts.body));return new Response(JSON.stringify(reply()),{status:200});}});
  let state=await service.invoke('assistant.memory',{op:'state'});
  await service.invoke('assistant.memory',{op:'remember',...state,text:'Tuesday planning'});
  append(f.store,{scope:state.scope,epoch:state.epoch},'Tuesday planning');
  const found=await service.invoke('assistant.memory',{op:'search',...state,query:'Tuesday'});
  assert.ok(found.memories[0].createdAt);assert.equal(found.memories[0].sourceQuote,'Tuesday planning');
  assert.equal(found.episodes.length,1);assert.ok(found.episodes[0].question);assert.ok(found.episodes[0].answer);
  state=await service.invoke('assistant.memory',{op:'enabled',...state,enabled:false});
  const response=await service.invoke('claude.chat',{message:'What do you remember?',memory:{scope:state.scope,epoch:state.epoch,contextKey:'home'}});
  assert.deepEqual(JSON.parse(calls[0].messages.at(-1).content).retrievedMemory,[]);
  assert.equal(response.memory.saved,false);assert.equal(response.memory.paused,true);
});

test('Forgetting a memory also removes later paraphrased episodes that used it', (t) => {
  const f=setup(t), lease=f.store.getState().lease;
  const fact=f.store.saveFact(lease,{text:'I plan every Tuesday.'}).result;
  f.store.archive(lease,{conversationId:'recall',contextKey:'home',title:'Recall',usedMemoryIds:[fact.id],messages:[{id:'q',role:'user',text:'When do I plan?'},{id:'a',role:'assistant',text:'The second weekday is your preferred planning day.'}]});
  f.store.forget(lease,{kind:'fact',id:fact.id});
  assert.equal(f.store.getState().conversations.length,0);
});

test('Automatic facts deduplicate and forgetting an explicit duplicate also removes the original', (t) => {
  const f=setup(t), lease=f.store.getState().lease;
  const first=f.store.saveFact(lease,{text:'Tuesday planning',automatic:true}).result;
  const repeated=f.store.saveFact(lease,{text:'Tuesday planning',automatic:true}).result;
  assert.equal(repeated.id,first.id);assert.equal(f.store.getState().facts.length,1);
  const explicit=f.store.saveFact(lease,{text:'Tuesday planning'}).result;
  f.store.forget(lease,{kind:'fact',id:explicit.id});
  assert.equal(f.store.getState().facts.length,0);
});

for (const change of ['dismiss-second','snooze-second','disable','dismiss-first']) test(`Scheduler rechecks live state after awaiting notification: ${change}`, async (t) => {
  const f=setup(t), lease=f.store.getState().lease;
  const first=f.store.saveReminder(lease,{text:'First',dueAt:'2026-10-04T09:01:00Z'}).result;
  const second=f.store.saveReminder(lease,{text:'Second',dueAt:'2026-10-04T09:01:00Z'}).result;
  f.store.setNotifications(lease,true);f.tick(120000);
  const sent=[];let finish;
  const scheduler=createReminderScheduler({store:f.store,notify:async item=>{sent.push(item.id);if(sent.length===1)await new Promise(resolve=>{finish=resolve;});return true;}});
  const pending=scheduler.tick();
  if(change==='dismiss-second')f.store.updateReminder(lease,{id:second.id,status:'done'});
  if(change==='snooze-second')f.store.saveReminder(lease,{id:second.id,text:'Second',dueAt:'2026-10-04T09:10:00Z'});
  if(change==='disable')f.store.setNotifications(lease,false);
  if(change==='dismiss-first')f.store.updateReminder(lease,{id:first.id,status:'done'});
  finish();await pending;
  const state=f.store.getState();
  if(change==='dismiss-first')assert.equal(state.reminders.find(r=>r.id===first.id).status,'done');
  else assert.deepEqual(sent,[first.id]);
  if(change==='dismiss-second')assert.equal(state.reminders.find(r=>r.id===second.id).status,'done');
  if(change==='snooze-second')assert.equal(state.reminders.find(r=>r.id===second.id).dueAt,'2026-10-04T09:10:00.000Z');
});

test('Generated archive titles redact credentials before truncation', async (t) => {
  const f=setup(t), secret='private-configured-token-'+ 's'.repeat(300);
  f.change({...f.configs(),claude:{...f.configs().claude,token:secret}});
  const service=createIntegrationService({vault:f.vault,assistantMemory:f.store,fetchImpl:async()=>new Response(JSON.stringify(reply()),{status:200})});
  const state=await service.invoke('assistant.memory',{op:'state'});
  await service.invoke('claude.chat',{message:`${secret} Do not keep this credential.`,memory:{scope:state.scope,epoch:state.epoch,contextKey:'home'}});
  const saved=JSON.stringify(f.store.getState());
  assert.equal(saved.includes(secret.slice(0,100)),false);
  assert.equal(f.store.getState().conversations[0].title.startsWith('[REDACTED]'),true);
});

test('A fact write failure after archive success returns an explicit partial warning with the answer', async (t) => {
  const f=setup(t);
  const service=createIntegrationService({vault:f.vault,assistantMemory:f.store,fetchImpl:async()=>new Response(JSON.stringify(reply('Answer remains available',[{text:'Tuesday planning',kind:'note',sourceQuote:'Tuesday planning'}])),{status:200})});
  const state=await service.invoke('assistant.memory',{op:'state'});
  f.store.saveFact=()=>{throw Error('Assistant memory is full. Nothing was discarded.');};
  const response=await service.invoke('claude.chat',{message:'Tuesday planning',memory:{scope:state.scope,epoch:state.epoch,contextKey:'home'}});
  assert.equal(response.content[0].text,'Answer remains available');
  assert.equal(response.memory.saved,true);assert.equal(response.memory.partial,true);
  assert.match(response.memory.error,/Conversation saved, but/);
  assert.equal(f.store.getState().conversations.length,1);
});

test('Editing a memory retires superseded supporting and dependent episodes while preserving record identity', async (t) => {
  const f=setup(t), service=createIntegrationService({vault:f.vault,assistantMemory:f.store});
  const original=f.store.getState(), lease=original.lease;
  f.store.archive(lease,{conversationId:'tuesday-source',contextKey:'home',title:'Review day',messages:[{id:'day-q',role:'user',text:'Review Tuesday'},{id:'day-a',role:'assistant',text:'Your review day is Tuesday.'}]});
  const fact=f.store.saveFact(lease,{text:'Review Tuesday',sourceQuote:'Review Tuesday',sourceContext:'home',source:{conversationId:'tuesday-source'}}).result;
  f.store.archive(lease,{conversationId:'dependent',contextKey:'home',title:'Recall',usedMemoryIds:[fact.id],messages:[{id:'when-q',role:'user',text:'Which weekday?'},{id:'when-a',role:'assistant',text:'The second weekday.'}]});
  f.store.archive(lease,{conversationId:'unrelated',contextKey:'code',title:'Deploy',messages:[{id:'deploy',role:'user',text:'Keep the release gated on green tests.'}]});
  f.tick(1000);
  const updated=await service.invoke('assistant.memory',{op:'update',...lease,id:fact.id,text:'Review Wednesday'});
  assert.equal(updated.memories[0].id,fact.id);
  assert.equal(updated.memories[0].createdAt,fact.createdAt);
  assert.equal(updated.memories[0].sourceQuote,'Review Wednesday');
  assert.equal(updated.memories[0].sourceContext,'Edited by you');
  assert.deepEqual(updated.memories[0].source,{});
  const next=f.store.getState();
  assert.deepEqual(next.conversations.map(c=>c.id),['unrelated']);
  const recalled=JSON.stringify(f.store.retrieve(next.lease,{query:'review weekday'}));
  assert.equal(recalled.includes('Tuesday'),false);assert.equal(recalled.includes('Wednesday'),true);
  assert.throws(()=>append(f.store,lease),/late operation/);
  assert.equal(f.store.saveFact(next.lease,{text:'Review Tuesday',automatic:true}).result,null);
  assert.equal(f.store.getState().facts.length,1);
});
