// Deterministic suggestions from the existing local plan. No model or service calls.
const HOUR = 60 * 60 * 1000;
const localDay = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function localTime(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isFinite(+value) && localDay(value) === date ? value : null;
}
export function taskEvidence(task) {
  return JSON.stringify([task.id,task.title,task.date || '',task.time || '',task.kind || 'task',!!task.done,task.object?.type || '',task.object?.origin || '',task.object?.key || task.object?.id || '',task.object?.projectId || '',task.object?.iid || '']);
}
export function buildAssistantBrief(tasks, {now = new Date(), windowMs = 24 * HOUR} = {}) {
  const today = localDay(now), seen = new Set(), entries = [];
  for (const task of tasks || []) {
    if (!task?.id || task.done || seen.has(task.id)) continue;
    seen.add(task.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(task.date || '') || localDay(new Date(`${task.date}T12:00:00`)) !== task.date) continue;
    const at = localTime(task.date, task.time);
    let reason, label, priority;
    if (task.kind === 'event') {
      if (!at || +at < +now || +at > +now + windowMs) continue;
      reason = 'upcoming-event'; label = 'Upcoming personal event'; priority = 0;
    } else if (task.date < today) {
      reason = 'carryover'; label = 'Unfinished from an earlier day'; priority = 1;
    } else if (task.date === today || (at && +at >= +now && +at <= +now + windowMs)) {
      reason = 'scheduled'; label = task.date === today ? 'Scheduled today' : 'Scheduled within 24 hours'; priority = 2;
    } else continue;
    entries.push({id:task.id,taskId:task.id,title:task.title,reason,label,priority,date:task.date,time:task.time || '',at:at?.toISOString() || null,evidence:taskEvidence(task),object:task.object || null});
  }
  return entries.sort((a,b)=>a.priority-b.priority || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.title.localeCompare(b.title));
}
export function currentBriefTask(tasks, entry) {
  const task = tasks.find(task => task.id === entry.taskId);
  if (!task || task.done || taskEvidence(task) !== entry.evidence) throw Error('This task changed. Review the refreshed brief before acting.');
  return task;
}
export function applyBriefAction(plan, entry, action, {now = new Date(), activityId = crypto.randomUUID()} = {}) {
  const task = currentBriefTask(plan.tasks, entry);
  const today = localDay(now);
  let changes, text;
  if (action === 'today') {
    if (task.kind === 'event' || task.date >= today) throw Error('Only unfinished tasks from an earlier day can be brought to Today.');
    changes = {date:today}; text = `${task.title}: Scheduled ${today} from Assistant brief`;
  } else if (action === 'complete') {
    changes = {done:true}; text = `${task.title}: Completed locally from Assistant brief`;
  } else throw Error('Unsupported personal plan action.');
  return {...plan,tasks:plan.tasks.map(item=>item.id===task.id?{...item,...changes}:item),activity:[{id:activityId,at:now.toISOString(),text},...(plan.activity || [])].slice(0,100)};
}
