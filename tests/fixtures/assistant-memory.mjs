import {installConnected} from './connected.mjs';
// Test adapter only. Production persistence is encrypted in Electron main.
export async function installAssistantMemory(page) {
  await installConnected(page);
  await page.addInitScript(()=>{
    const key='fixture.assistant-memory',initial=()=>({scope:'fixture-personal',epoch:crypto.randomUUID(),enabled:true,notificationsEnabled:false,memories:[],episodes:[],reminders:[]});
    const read=()=>JSON.parse(localStorage.getItem(key)||'null')||initial();
    const write=s=>localStorage.setItem(key,JSON.stringify(s));
    const view=s=>({...s,stats:{memories:s.memories.length,conversations:s.episodes.length}});
    if(!localStorage.getItem(key))write(initial());
    const previous=window.__fixture.invoke.bind(window.__fixture);
    window.__fixture.invoke=async(action,args={})=>{
      if(!['assistant.memory','assistant.reminders','claude.chat'].includes(action))return previous(action,args);
      window.__fixture.calls.push({action,args});
      const s=read(), now=new Date().toISOString();
      if(action==='assistant.memory') {
        if(args.op==='state')return view(s);
        if(args.epoch!==s.epoch||args.scope!==s.scope)throw Error('Assistant memory changed. Retry with current memory.');
        if(args.op==='history'){const all=s.episodes.filter(e=>e.contextKey===args.contextKey).reverse();return{entries:all.slice(args.offset||0,(args.offset||0)+(args.limit||20)),total:all.length};}
        if(args.op==='search')return{memories:s.memories.filter(m=>m.text.includes(args.query)),episodes:s.episodes.filter(e=>(e.question+e.answer).includes(args.query))};
        if(args.op==='remember')s.memories.push({id:crypto.randomUUID(),text:args.text,kind:args.kind,sourceQuote:args.text,createdAt:now,updatedAt:now});
        if(args.op==='update'){s.memories=s.memories.map(m=>m.id===args.id?{...m,text:args.text,updatedAt:now}:m);s.epoch=crypto.randomUUID();}
        if(args.op==='forget'){if(args.type==='memory')s.memories=s.memories.filter(m=>m.id!==args.id);else s.episodes=s.episodes.filter(e=>e.id!==args.id);s.epoch=crypto.randomUUID();}
        if(args.op==='clear'){s.memories=[];s.episodes=[];s.reminders=[];s.epoch=crypto.randomUUID();}
        if(args.op==='enabled'){s.enabled=args.enabled;s.epoch=crypto.randomUUID();}
        if(args.op==='notifications')s.notificationsEnabled=args.enabled;
        write(s);return view(s);
      }
      if(action==='assistant.reminders') {
        if(args.op==='create')s.reminders.push({id:crypto.randomUUID(),title:args.title,dueAt:args.dueAt,taskId:args.taskId,state:'scheduled',createdAt:now});
        if(args.op==='dismiss')s.reminders=s.reminders.map(r=>r.id===args.id?{...r,state:'dismissed'}:r);
        if(args.op==='snooze')s.reminders=s.reminders.map(r=>r.id===args.id?{...r,state:'scheduled',dueAt:args.dueAt}:r);
        write(s);return{reminders:s.reminders};
      }
      const reply=window.__assistantReply || {answer:'I will keep your review preferences in mind.',suggestions:[]};
      const used=s.enabled?s.memories.map(m=>({id:m.id,kind:'fact',text:m.text,at:m.createdAt})):[];
      if(s.enabled){s.episodes.push({id:crypto.randomUUID(),question:args.message,answer:reply.answer,contextKey:args.memory.contextKey,createdAt:now});write(s);}
      return{content:[{type:'text',text:reply.answer}],suggestions:reply.suggestions||[],memory:{saved:s.enabled,used,stats:view(s).stats}};
    };
  });
  await page.reload();
}
