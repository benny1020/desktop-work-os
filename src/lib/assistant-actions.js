import {taskEvidence} from './assistant-planning.js';
function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d=new Date(`${value}T12:00:00`);
  return Number.isFinite(+d)&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`===value;
}
export function prepareAssistantActions(suggestions,tasks) {
  return (Array.isArray(suggestions)?suggestions:[]).slice(0,6).flatMap(s=>{
    if(!s || !['create_task','reschedule_task','complete_task','reminder'].includes(s.type))return [];
    const task=tasks.find(t=>t.id===s.taskId);
    if(['reschedule_task','complete_task'].includes(s.type)&&(!task||task.done||task.kind==='event'))return [];
    if(['create_task','reschedule_task'].includes(s.type)&&!validDate(s.date))return [];
    if(s.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))return [];
    if(s.type==='reminder'&&(!Number.isFinite(Date.parse(s.dueAt))||Date.parse(s.dueAt)<=Date.now()))return [];
    const title=(task?.title||s.title||'').trim().slice(0,500);
    if(!title)return [];
    return [{...s,title,id:crypto.randomUUID(),evidence:task?taskEvidence(task):null,status:'pending'}];
  });
}
export function applyAssistantAction(plan,action) {
  if(!['create_task','reschedule_task','complete_task'].includes(action.type))throw Error('Unsupported personal plan action.');
  const current=plan.tasks.find(t=>t.id===action.taskId);
  if(action.type!=='create_task'&&(!current||taskEvidence(current)!==action.evidence))throw Error('This task changed since the suggestion. Ask again before applying it.');
  if(['create_task','reschedule_task'].includes(action.type)&&!validDate(action.date))throw Error('The suggested date is invalid.');
  const changes=action.type==='complete_task'?{done:true}:{date:action.date,time:action.time || ''};
  const task=action.type==='create_task'?{id:action.id,title:action.title,kind:'task',done:false,...changes}:null;
  if(task&&plan.tasks.some(t=>t.id===task.id))throw Error('This suggestion was already applied.');
  return {...plan,tasks:task?[...plan.tasks,task]:plan.tasks.map(t=>t.id===action.taskId?{...t,...changes}:t),activity:[{id:crypto.randomUUID(),at:new Date().toISOString(),text:`${action.title}: ${action.type==='complete_task'?'Completed':`Scheduled ${action.date}`} from Assistant`},...(plan.activity||[])].slice(0,100)};
}
