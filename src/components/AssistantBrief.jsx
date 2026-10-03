import React, {useEffect,useRef,useState} from 'react';
import {Bell,Check,ChevronRight,Sparkles} from 'lucide-react';
import {usePlan,planChange,dayKey} from '../lib/planning';
import {invoke} from '../lib/integration-client';
import {buildAssistantBrief,currentBriefTask,applyBriefAction} from '../lib/assistant-planning';
import '../assistant-brief.css';
const reminderList=value=>Array.isArray(value)?value:value?.reminders || [];
const inputDate=value=>{const date=new Date(value);return Number.isFinite(+date)?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`:'';};

export default function AssistantBrief({onOpen,onNavigate,onAssistant,onReminder,configVersion=0}) {
  const plan=usePlan(), [now,setNow]=useState(()=>new Date()), [expanded,setExpanded]=useState(false), [error,setError]=useState(''), [notice,setNotice]=useState(''), [reminder,setReminder]=useState(null), [remindAt,setRemindAt]=useState(''), [busy,setBusy]=useState(false), [memory,setMemory]=useState(null), [reminders,setReminders]=useState([]), [reminderError,setReminderError]=useState(''), [retry,setRetry]=useState(0);
  const generation=useRef(0), readVersion=useRef(0);
  useEffect(()=>{
    const current=++generation.current;let state=null;
    setMemory(null);setReminders([]);setReminder(null);setError('');setNotice('');setReminderError('');setBusy(false);
    async function refresh(){
      const ticket=++readVersion.current;
      setNow(new Date());
      try{
        if(!state){state=await invoke('assistant.memory',{op:'state'});if(current!==generation.current||ticket!==readVersion.current)return;setMemory(state);setReminders(reminderList(state));}
        else {const items=await invoke('assistant.reminders',{op:'list',scope:state.scope,epoch:state.epoch});if(current!==generation.current||ticket!==readVersion.current)return;setReminders(reminderList(items));}
        setReminderError('');
      }catch(error){if(current===generation.current&&ticket===readVersion.current){state=null;setReminderError(error.message);}}
    }
    refresh();
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    const changed=()=>{state=null;refresh();};
    const timer=setInterval(visible,30000);document.addEventListener('visibilitychange',visible);
    window.addEventListener('worklane:memory-changed',changed);
    return()=>{generation.current++;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('worklane:memory-changed',changed);};
  },[configVersion,retry]);
  const entries=buildAssistantBrief(plan.tasks,{now});
  const carryover=entries.filter(entry=>entry.reason==='carryover');
  const reminderTasks=new Set();
  const nearReminders=reminders.filter(item=>['due','scheduled'].includes(item.state)&&Number.isFinite(+new Date(item.dueAt))&&+new Date(item.dueAt)<=+now+86400000).sort((a,b)=>+new Date(a.dueAt)-+new Date(b.dueAt)).filter(item=>{if(!item.taskId)return true;if(reminderTasks.has(item.taskId))return false;reminderTasks.add(item.taskId);return true;});
  const scheduled=entries.filter(entry=>entry.reason!=='carryover'&&!reminderTasks.has(entry.taskId));
  const plannedTasks=scheduled.filter(entry=>entry.reason!=='upcoming-event');
  const visible=expanded?scheduled:scheduled.filter(entry=>entry.reason==='upcoming-event').slice(0,1);
  const visibleReminders=expanded?nearReminders:nearReminders.slice(0,2);
  function act(entry,action) {
    try {
      planChange(current=>applyBriefAction(current,entry,action));
      setError('');setNotice(action==='today'?`${entry.title} brought to Today. Jira deadline unchanged.`:`${entry.title} completed in your local plan.`);
    } catch(error){setError(error.message);}
  }
  function open(entry) {
    try {
      const task=currentBriefTask(plan.tasks,entry);
      if(task.object && onOpen)onOpen(task.object);
      else onNavigate?.('My Work',task.date?'Today':'Backlog',{planDate:task.date,taskId:task.id});
      setError('');
    } catch(error){setError(error.message);}
  }
  function prepareReminder(entry){
    try{currentBriefTask(plan.tasks,entry);setReminder(entry);const planned=entry.at?+new Date(entry.at):0;setRemindAt(inputDate(planned>Date.now()?planned:Date.now()+3600000));setError('');}catch(error){setError(error.message);}
  }
  async function reminderAction(op,item,dueAt){
    if(busy||!memory)return;const current=generation.current;
    setBusy(true);setError('');
    try{
      const result=await invoke('assistant.reminders',{op,scope:memory.scope,epoch:memory.epoch,id:item.id,...(dueAt?{dueAt}:{})});
      if(current!==generation.current)return;
      readVersion.current++;
      setReminders(reminderList(result));setNotice(op==='dismiss'?'Reminder dismissed.':'Reminder snoozed for 30 minutes.');
    }catch(error){if(current===generation.current)setError(error.message);}finally{if(current===generation.current)setBusy(false);}
  }
  async function saveReminder(event) {
    event.preventDefault();if(busy||(!memory&&!onReminder))return;const current=generation.current;
    try {
      const task=currentBriefTask(plan.tasks,reminder);
      const at=new Date(remindAt);
      if(!Number.isFinite(+at)||+at<=Date.now())throw Error('Choose a future time for this reminder.');
      setBusy(true);setError('');
      const result=onReminder?await onReminder(task,{dueAt:at.toISOString(),evidence:reminder.evidence}):await invoke('assistant.reminders',{op:'create',scope:memory.scope,epoch:memory.epoch,title:task.title,dueAt:at.toISOString(),taskId:task.id});
      if(current!==generation.current)return;
      readVersion.current++;
      if(!onReminder||result?.reminders)setReminders(reminderList(result));
      setNotice(`Reminder saved for ${task.title}.`);setReminder(null);setRemindAt('');
    } catch(error){if(current===generation.current)setError(error.message);}finally{if(current===generation.current)setBusy(false);}
  }
  return <section className="assistant-brief" aria-label="Assistant brief">
    <header><div><Sparkles size={14}/><h2>Assistant brief</h2><span className="pill">{scheduled.length+nearReminders.length+(carryover.length?1:0)}</span></div></header>
    <p className="brief-boundary">From your local plan · no AI request</p>
    {carryover.length>0&&<div className="brief-carryover"><button className="brief-task-title" onClick={()=>onNavigate?.('My Work','Today',{planDate:dayKey()})}>{carryover.length} unfinished from earlier days<ChevronRight size={12}/></button><small>Review earlier local dates and choose what to bring forward.</small></div>}
    {!expanded&&plannedTasks.length>0&&<button className="quiet-button brief-expand" aria-expanded={false} onClick={()=>setExpanded(true)}>Review {plannedTasks.length} planned {plannedTasks.length===1?'task':'tasks'}</button>}
    {!scheduled.length&&!nearReminders.length&&!carryover.length&&<p className="brief-empty">No unfinished earlier tasks or near-term plans to flag.</p>}
    {visibleReminders.map(item=><article key={item.id} className="brief-entry"><div className="brief-entry-main"><span>{+new Date(item.dueAt)<=+now?'Reminder due':'Upcoming reminder'}</span><b>{item.title}</b><small>{new Date(item.dueAt).toLocaleString()}</small></div><div className="brief-entry-actions">{item.taskId&&plan.tasks.some(task=>task.id===item.taskId)&&<button className="quiet-button" onClick={()=>{const task=plan.tasks.find(task=>task.id===item.taskId);onNavigate?.('My Work',task.date?'Today':'Backlog',{planDate:task.date,taskId:task.id});}}>Open task</button>}<button className="quiet-button" disabled={busy} onClick={()=>reminderAction('snooze',item,new Date(Date.now()+1800000).toISOString())}>Snooze 30m</button><button className="quiet-button" disabled={busy} onClick={()=>reminderAction('dismiss',item)}>Dismiss</button></div></article>)}
    {visible.map(entry=><article key={entry.id} className="brief-entry">
      <div className="brief-entry-main"><span>{entry.label}</span><button className="brief-task-title" onClick={()=>open(entry)}>{entry.title}<ChevronRight size={12}/></button><small><time>{entry.date}{entry.time?` · ${entry.time}`:''}</time> · {entry.reason==='upcoming-event'?'Personal event':'Local task'}</small></div>
      <div className="brief-entry-actions"><button className="quiet-button" aria-label={`Complete locally ${entry.title}`} onClick={()=>act(entry,'complete')}><Check size={13}/>Complete</button><button className="quiet-button" disabled={busy} aria-label={`Remind me about ${entry.title}`} onClick={()=>prepareReminder(entry)}><Bell size={12}/>Remind me</button></div>
    </article>)}
    {(expanded||scheduled.filter(entry=>entry.reason==='upcoming-event').length>1||nearReminders.length>2)&&<button className="quiet-button brief-expand" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Show fewer':`Show all ${scheduled.length+nearReminders.length} items`}</button>}
    {reminder&&<form className="brief-reminder" onSubmit={saveReminder}><label>Remind me about <b>{reminder.title}</b><input type="datetime-local" aria-label="Reminder date and time" value={remindAt} disabled={busy} onChange={e=>setRemindAt(e.target.value)}/></label><div><button className="btn primary" disabled={busy||!remindAt||(!memory&&!onReminder)}>{busy?'Saving…':'Confirm reminder'}</button><button type="button" className="quiet-button" disabled={busy} onClick={()=>setReminder(null)}>Cancel</button></div><small>Desktop notifications require opt-in and Worklane to be running.</small></form>}
    {reminderError&&<details className="brief-reminder-status"><summary>Reminders unavailable</summary><p>{reminderError}</p><button className="quiet-button" onClick={()=>setRetry(value=>value+1)}>Retry reminders</button></details>}
    {error&&<p role="alert" className="connection-error">{error}</p>}
    {notice&&<p role="status" className="brief-notice">{notice}</p>}
    {onAssistant&&<button className="quiet-button brief-expand" onClick={onAssistant}>Open assistant</button>}
  </section>;
}
