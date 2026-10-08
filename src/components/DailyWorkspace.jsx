import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import "../daily-workflow.css";
import AssistantBrief from "./AssistantBrief";
import { useAutoSync } from "../lib/use-auto-sync";
import SyncStatus from "./SyncStatus";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  MoreHorizontal,
  CalendarDays,
  GitPullRequest,
  ArrowUpRight,
  CheckCircle2,
  Link2,
  Undo2,
} from "lucide-react";
import { invoke } from "../lib/integration-client";
import {
  usePlan,
  dayKey,
  shiftDay,
  shiftMonth,
  parseQuick,
  addPlanTask,
  updateTask,
  moveTask,
  planChange,
  objectKey,
} from "../lib/planning";
// Keep the personal planning position and reversible local actions across app navigation.
// This is renderer memory only, matching the lifetime of the undo controls.
const planningSessions = new Map();
let planningUndo = { removed: null, scheduleUndo: null, completionUndo: null };
const editorDrafts = new Map();
function PlanTask({ task, tasks, today, act, onOpen, onEdit, onMove, onComplete, due, compact = false }) {
  const [actions, setActions] = useState(null);
  const rowRef = useRef(null), moreRef = useRef(null);
  useEffect(() => {
    if (!actions) return;
    const closeOutside = event => { if (!rowRef.current?.contains(event.target)) setActions(null); };
    const closeOnScroll = () => setActions(null);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [actions]);
  const siblings = tasks.filter((item) => item.date === task.date && (item.time || "") === (task.time || ""));
  const index = siblings.findIndex((item) => item.id === task.id);
  return (
    <div
      ref={rowRef}
      className={`plan-task ${task.done ? "done" : ""} ${task.kind} ${compact ? "compact-actions" : ""}`}
      onKeyDown={event => { if (actions && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setActions(null); moreRef.current?.focus(); } }}
      data-plan-task-id={task.id}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/orbit-task", task.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.getData("text/orbit-task") === task.id) return;
        onMove(e.dataTransfer.getData("text/orbit-task"), task.date, task.id);
      }}
    >
      <button
        className="plan-check"
        aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}
        aria-pressed={Boolean(task.done)}
        title={`${task.done ? "Reopen" : "Complete"} ${task.kind === "event" ? "event" : "task"} locally`}
        onClick={() => onComplete(task)}
      >
        {task.done ? (
          <Check size={13} />
        ) : null}
      </button>
      {compact && <div className="plan-task-compact-meta">{task.kind === "event" && <button className="plan-event-marker" title="Edit personal event" aria-label={`Edit event ${task.title}`} onClick={() => onEdit({ ...task })}><CalendarDays size={12} /></button>}{task.time ? <time>{task.time}</time> : <span>Any time</span>}</div>}
      <div className="plan-task-main">
        <button
          onClick={() =>
            task.object ? onOpen(task.object) : onEdit({ ...task })
          }
        >
          {!compact && task.kind === "event" && <button className="plan-event-marker" title="Edit personal event" aria-label={`Edit event ${task.title}`} onClick={() => onEdit({ ...task })}><CalendarDays size={12} /></button>}
          {!compact && task.time && <time>{task.time}</time>}
          {task.title}
        </button>
        <small>
          {task.object?.type === "issue"
            ? "Jira linked"
            : task.object?.type === "mr"
              ? "GitLab review"
              : task.kind === "event"
                ? "Personal event"
                : "Personal task"}{" "}
          · {task.done ? "Completed locally" : "Local plan"}
        </small>
        {due && <div className="plan-deadline"><span className={`plan-due-badge ${due < today ? "overdue" : ""}`}>Jira due {due}</span>{!task.done && task.date && task.date > due && <span className="plan-deadline-warning">Planned after deadline</span>}</div>}
      </div>
      {compact && <div className="plan-task-compact-controls">
        <button title="Edit personal plan" aria-label={`Edit plan for ${task.title}`} onClick={() => onEdit({ ...task })}><Pencil size={12} /></button>
        <button ref={moreRef} title="More planning actions" aria-label={`More planning actions for ${task.title}`} aria-expanded={Boolean(actions)} aria-controls={`plan-actions-${task.id}`} onClick={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          setActions(actions ? null : { left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 160)) });
        }}><MoreHorizontal size={13} /></button>
      </div>}
      {(!compact || actions) && <div id={`plan-actions-${task.id}`} className={`plan-task-actions ${compact ? "plan-actions-popover" : ""}`} style={compact ? actions : undefined} role={compact ? "group" : undefined} aria-label={compact ? `Planning actions for ${task.title}` : undefined} onKeyDown={event => { if (compact && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setActions(null); moreRef.current?.focus(); } }}>
        <button
          title="Move up"
          aria-label={`Move up ${task.title}`}
          aria-disabled={index === 0}
          onClick={() => index > 0 && act(() => moveTask(task.id, task.date, siblings[index - 1].id))}
        >
          <ArrowUp size={12} />
        </button>
        <button
          title="Move down"
          aria-label={`Move down ${task.title}`}
          aria-disabled={index === siblings.length - 1}
          onClick={() => index < siblings.length - 1 && act(() => moveTask(siblings[index + 1].id, task.date, task.id))}
        >
          <ArrowDown size={12} />
        </button>
        {!compact && <button
          title="Edit personal plan"
          aria-label={`Edit plan for ${task.title}`}
          onClick={() => onEdit({ ...task })}
        >
          <Pencil size={12} />
        </button>}
        <label>
          <span className="sr-only">Date for {task.title}</span>
          <input
            type="date"
            value={task.date || ""}
            onChange={(e) =>
              act(() => updateTask(task.id, { date: e.target.value }))
            }
          />
        </label>
        <input
          aria-label={`Time for ${task.title}`}
          type="time"
          value={task.time || ""}
          onChange={(e) =>
            act(() => updateTask(task.id, { time: e.target.value }))
          }
        />
        <button
          title="Tomorrow"
          aria-label={`Tomorrow ${task.title}`}
          onClick={() =>
            onMove(task.id, shiftDay(today, 1))
          }
        >
          <ChevronRight size={14} />
        </button>
      </div>}
    </div>
  );
}

export default function DailyWorkspace(props) {
  const planningKey = props.section === "Home" ? "Home" : "My Work";
  return <PlanningWorkspace key={planningKey} {...props} planningKey={planningKey} />;
}

function PlanningWorkspace({
  section,
  view,
  configs,
  onOpen,
  onNavigate,
  onSettings,
  focusDate,
  focusTaskId,
  focusRequestId,
  planningKey,
  configVersion,
  notificationPreferences = { reviews: true, deadlines: true, digest: true },
}) {
  const plan = usePlan(),
    today = dayKey();
  const planningSession = planningSessions.get(planningKey);
  const rememberedRange = planningSession?.ranges?.[view];
  const ranges = useRef({ ...planningSession?.ranges });
  const explicitRange = useRef(null);
  const [editing, setEditing] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const editorBase = useRef(null);
  const [editorConflict, setEditorConflict] = useState(null);
  function editTask(task) {
    const draft = editorDrafts.get(task.id);
    const valid = draft && JSON.stringify(draft.base) === JSON.stringify(task);
    if (draft && !valid) { editorDrafts.delete(task.id); setNotice("Saved work changed since this draft. Opened the latest saved item; earlier edits were not applied."); }
    editorBase.current = { ...task }; setEditorConflict(null); setError("");
    setDraftRestored(Boolean(valid)); setEditing(valid ? { ...draft.value } : { ...task });
  }
  function closeEditor(discard = false) {
    if (editing) {
      const saved = editorBase.current;
      if (discard || !saved || JSON.stringify(editing) === JSON.stringify(saved)) editorDrafts.delete(editing.id);
      else { editorDrafts.set(editing.id, { base: { ...saved }, value: { ...editing } }); setNotice("Personal work draft kept. Reopen the item to continue editing."); }
    }
    if (discard) setNotice("");
    setEditing(null); setDraftRestored(false); setEditorConflict(null);
  }
  function saveEditor(expectedBase = editorBase.current) {
    act(() => {
      planChange(p => {
        const saved = p.tasks.find(task => task.id === editing.id);
        if (!saved) throw Error("This item was removed while you were editing. Your draft remains open; it was not saved.");
        if (JSON.stringify(saved) !== JSON.stringify(expectedBase)) {
          setEditorConflict({ ...saved });
          throw Error("This item changed while you were editing. Your draft is kept here. Review the latest saved work before applying your edits.");
        }
        return { ...p, tasks: p.tasks.map(task => task.id === editing.id ? { ...task, title: editing.title.trim(), date: editing.date, time: editing.time, kind: editing.kind } : task),
          activity: [{ id: crypto.randomUUID(), at: new Date().toISOString(), text: `${saved.title}: Updated` }, ...p.activity].slice(0, 100) };
      });
      editorDrafts.delete(editing.id); setDraftRestored(false); setEditorConflict(null); setEditing(null); setNotice("Personal work saved locally.");
    });
  }
  const [removed, setRemoved] = useState(() => planningUndo.removed);
  const [scheduleUndo, setScheduleUndo] = useState(() => planningUndo.scheduleUndo);
  const [completionUndo, setCompletionUndo] = useState(() => planningUndo.completionUndo);
  const [returnRange, setReturnRange] = useState(() => planningSession?.returnRange || null);
  const quickInput = useRef(null);
  const rootRef = useRef(null);
  const [quickDate, setQuickDate] = useState(() => planningSession?.quickDate || null);
  const [backlogQuery, setBacklogQuery] = useState(() => planningSession?.backlogQuery || "");
  const [showCompleted, setShowCompleted] = useState(() => planningSession?.showCompleted || false);
  const [weekLayout, setWeekLayout] = useState(() => planningSession?.weekLayout || "full");
  const [date, setDate] = useState(() => focusDate || (view === "Today" ? today : rememberedRange?.date || planningSession?.date || today)),
    [mode, setMode] = useState(() => rememberedRange?.mode || planningSession?.mode || "Week"),
    [quick, setQuick] = useState(() => planningSession?.quick || ""),
    [kind, setKind] = useState(() => planningSession?.kind || "task"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [feed, setFeed] = useState({ issues: [], mrs: [], errors: [] }),
    [loading, setLoading] = useState(false);
  const [expandedAttention, setExpandedAttention] = useState(false);
  const lastRange = useRef({ view, date, mode });
  if (lastRange.current.view === view) lastRange.current = { view, date, mode };
  useEffect(() => {
    const previous = lastRange.current;
    if (previous.view === view) return;
    ranges.current[previous.view] = { date: previous.date, mode: previous.mode };
    const next = explicitRange.current?.view === view ? explicitRange.current : view === "Today" ? { date: today, mode } : ranges.current[view] || { date, mode };
    const targetDate = focusDate || next.date;
    lastRange.current = { view, date: targetDate, mode: next.mode };
    setDate(targetDate); setMode(next.mode);
    explicitRange.current = null;
  }, [view]);
  useEffect(() => {
    const currentRange = lastRange.current;
    ranges.current[view] = { date: currentRange.date, mode: currentRange.mode };
    planningSessions.set(planningKey, { ...currentRange, ranges: { ...ranges.current }, quick, kind, quickDate, returnRange, backlogQuery, showCompleted, weekLayout });
    planningUndo = { removed, scheduleUndo, completionUndo };
  }, [planningKey, view, date, mode, quick, kind, quickDate, returnRange, removed, scheduleUndo, completionUndo, backlogQuery, showCompleted, weekLayout]);
  useEffect(() => {
    if (focusDate && /^\d{4}-\d{2}-\d{2}$/.test(focusDate)) setDate(focusDate);
    if (!focusTaskId) return;
    const frame = requestAnimationFrame(() => {
      const row = [...(rootRef.current?.querySelectorAll("[data-plan-task-id]") || [])].find((item) => item.dataset.planTaskId === focusTaskId);
      const button = row?.querySelector(".plan-task-main > button");
      button?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusDate, focusTaskId, focusRequestId]);
  const connectedFeed = Boolean(configs.jira?.tokenConfigured || configs.gitlab?.tokenConfigured);
  const sync = useAutoSync({
    key: `daily-work:${configVersion}:${configs.jira?.url || ""}:${configs.gitlab?.url || ""}`,
    services: ["jira", "gitlab"], enabled: connectedFeed && !loading,
    refresh: refreshFeed,
  });
  async function refreshFeed(isCurrent) {
    const [j, g] = await Promise.allSettled([
      configs.jira?.tokenConfigured
        ? invoke("jira.issues", { jql: "assignee = currentUser() AND statusCategory != Done ORDER BY duedate ASC, updated DESC" })
        : Promise.resolve({ issues: [] }),
      configs.gitlab?.tokenConfigured ? invoke("gitlab.mrs", { mine: true }) : Promise.resolve({ items: [] }),
    ]);
    if (!isCurrent()) return;
    const errors = [["Jira", j], ["GitLab", g]].flatMap(([service, result]) => result.status === "rejected" ? [`${service}: ${result.reason.message}`] : []);
    setFeed(previous => ({
      issues: j.status === "fulfilled" ? j.value.issues : previous.issues,
      mrs: g.status === "fulfilled" ? g.value.items : previous.mrs,
      errors,
    }));
    if (errors.length) throw new Error(errors.join(" · "));
  }
  useEffect(() => {
    let alive = true;
    setFeed({ issues: [], mrs: [], errors: [] });
    setLoading(true);
    refreshFeed(() => alive)
      .then(() => { if (alive) sync.markSynced(); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [configs]);
  const previousRange = useRef({ date, view });
  useEffect(() => {
    if (previousRange.current.date !== date || previousRange.current.view !== view) setQuickDate(null);
    previousRange.current = { date, view };
  }, [date, view]);
  const act = (fn) => {
    try {
      fn();
      setError("");
    } catch (e) {
      setError(e.message);
      setNotice("");
    }
  };
  function add(e) {
    e.preventDefault();
    act(() => {
      const t = parseQuick(quick, view === "Backlog" ? "" : quickDate || date);
      const issue = kind === "task" && feed.issues.find((item) => item.key.toUpperCase() === t.title.toUpperCase());
      const object = issue ? issueObject(issue) : null;
      const existing = object && linkedPlan(object);
      if (existing) scheduleTasks([existing], t.date, `Scheduled ${object.title} · ${t.date || "Backlog"}${t.time ? ` at ${t.time}` : ""}`, t.time ? { time: t.time } : {});
      else addPlanTask({ ...t, kind, ...(object ? { title: object.title, object } : {}) });
      setQuick("");
      if (!existing) setNotice(`Saved locally · ${t.date || "Backlog"} ${t.time}`);
    });
  }
  const linkedPlan = (object) => plan.tasks.find((task) => !task.done && objectKey(task.object) === objectKey(object));
  function planObject(o, targetDate = today) {
    act(() => {
      const existing = linkedPlan(o);
      if (existing) {
        if (existing.date !== targetDate) scheduleTasks([existing], targetDate, `Moved ${o.title} to ${targetDate === today ? "Today" : targetDate || "Backlog"}.`);
        return;
      }
      addPlanTask({ title: o.title, object: o, date: targetDate });
      setNotice(`Added to ${targetDate === today ? "Today" : targetDate || "Backlog"}`);
    });
  }
  function movePlanTask(id, targetDate, before) {
    act(() => {
      const task = plan.tasks.find((item) => item.id === id);
      if (!task) return;
      const target = before && plan.tasks.find((item) => item.id === before);
      if (target && task.date === targetDate && (task.time || "") !== (target.time || "")) {
        setNotice("Timed items stay in chronological order. Edit the time to move this item; drag items with the same time to reorder.");
        return;
      }
      moveTask(id, targetDate, before);
      if (task.date !== targetDate) {
        const orderBefore = plan.tasks.map((item) => item.id), orderAfter = orderBefore.filter((item) => item !== id);
        const insertion = before ? orderAfter.indexOf(before) : -1;
        orderAfter.splice(insertion < 0 ? orderAfter.length : insertion, 0, id);
        setScheduleUndo({ moves: [{ id, from: task.date, to: targetDate, before: task, after: { ...task, date: targetDate } }], orderBefore, orderAfter, fromView: date, toView: targetDate });
        setNotice(`Moved ${task.title} to ${targetDate || "Backlog"}.`);
      } else setNotice(`Reordered ${task.title} · ${task.time || "untimed items"}.`);
    });
  }
  function scheduleTasks(items, targetDate, message, changes = {}) {
    const moves = items.map((task) => ({ id: task.id, from: task.date, to: targetDate, before: task, after: { ...task, ...changes, date: targetDate } }));
    const ids = new Set(moves.map((move) => move.id));
    planChange((p) => ({
      ...p,
      tasks: p.tasks.map((task) => ids.has(task.id) ? { ...task, ...changes, date: targetDate } : task),
      activity: [...p.tasks.filter((task) => ids.has(task.id)).map((task) => ({ id: crypto.randomUUID(), at: new Date().toISOString(), text: `${task.title}: Scheduled ${targetDate}` })), ...p.activity].slice(0, 100),
    }));
    setScheduleUndo({ moves, fromView: date, toView: targetDate });
    setNotice(message);
  }
  function undoSchedule() {
    act(() => {
      let restored = 0;
      planChange((p) => {
        const activity = [];
        let tasks = p.tasks.map((task) => {
          const move = scheduleUndo.moves.find((item) => item.id === task.id);
          if (!move || JSON.stringify(task) !== JSON.stringify(move.after)) return task;
          restored++;
          activity.push({ id: crypto.randomUUID(), at: new Date().toISOString(), text: `${task.title}: Restored schedule ${move.from || "Backlog"}` });
          return { ...move.before };
        });
        if (restored === scheduleUndo.moves.length && scheduleUndo.orderAfter && JSON.stringify(p.tasks.map((task) => task.id)) === JSON.stringify(scheduleUndo.orderAfter)) {
          const records = new Map(tasks.map((task) => [task.id, task]));
          tasks = scheduleUndo.orderBefore.map((id) => records.get(id));
        }
        return { ...p, tasks, activity: [...activity, ...p.activity].slice(0, 100) };
      });
      if (date === scheduleUndo.toView) setDate(scheduleUndo.fromView);
      setScheduleUndo(null);
      setNotice(`${restored} ${restored === 1 ? "task" : "tasks"} restored. Items changed since the move were kept as they are.`);
    });
  }
  function openDay(day) {
    if (!(view === "Calendar" && mode === "Day")) setReturnRange({ date, view, mode, selectedDay: day });
    setDate(day);
    setMode("Day");
    explicitRange.current = { view: "Calendar", date: day, mode: "Day" };
    if (view !== "Calendar") onNavigate("My Work", "Calendar");
  }
  const issueObject = (i) => ({
    type: "issue",
    key: i.key,
    title: `${i.key} ${i.fields.summary}`,
    origin: configs.jira?.url,
  });
  const mrObject = (m) => ({
    type: "mr",
    projectId: m.project_id,
    iid: m.iid,
    title: `!${m.iid} ${m.title}`,
    origin: configs.gitlab?.url,
  });
  function planningAction(object, compact = false, targetDate = today) {
    const existing = linkedPlan(object);
    const inTarget = existing?.date === targetDate;
    const targetLabel = targetDate === today ? "Today" : targetDate;
    const addLabel = object.type === "mr" && !compact ? `Add review to ${targetLabel}` : compact ? targetLabel : `Add to ${targetLabel}`;
    return <div className="linked-plan-action">
      {existing && <small>{existing.date === today ? "Planned today" : existing.date ? `Planned ${existing.date}${existing.time ? ` at ${existing.time}` : ""}` : "In your backlog"}</small>}
      <button className="btn" disabled={inTarget} onClick={() => planObject(object, targetDate)}>{inTarget ? `In ${targetLabel}` : existing ? `Move to ${targetLabel}` : addLabel}</button>
    </div>;
  }
  const taskDue = (task) => task.object?.type === "issue" && task.object.origin === configs.jira?.url ? feed.issues.find((issue) => issue.key === task.object.key)?.fields.duedate : null;
  const taskRow = (task) => <PlanTask key={task.id} task={task} tasks={plan.tasks} today={today} act={act} onOpen={onOpen} onEdit={editTask} onMove={movePlanTask} onComplete={completePlanTask} due={taskDue(task)} compact={(home || view === "This Week" || view === "Calendar" && mode === "Week") && Boolean(task.date)} />;
  function completePlanTask(task) {
    act(() => {
      const after = { ...task, done: !task.done };
      updateTask(task.id, { done: after.done });
      setCompletionUndo({ before: { ...task }, after });
      if (view === "Backlog" && !showCompleted && !task.done) {
        const index = tasks.findIndex((item) => item.id === task.id);
        const next = tasks[index + 1] || tasks[index - 1];
        requestAnimationFrame(() => {
          const row = [...(rootRef.current?.querySelectorAll("[data-plan-task-id]") || [])].find((item) => item.dataset.planTaskId === next?.id);
          (row?.querySelector(".plan-check") || rootRef.current?.querySelector('[aria-label="Search backlog"]'))?.focus({ preventScroll: true });
        });
      }
    });
  }
  function dayTasks(d) {
    return plan.tasks
      .filter((t) => t.date === d)
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  }
  const weekday = (new Date(date + "T12:00:00").getDay() + 6) % 7;
  let days = Array.from({ length: 7 }, (_, i) => shiftDay(date, i - weekday));
  const weekItems = plan.tasks.filter(task => days.includes(task.date));
  const weekendItems = weekItems.filter(task => days.slice(5).includes(task.date));
  if (view === "This Week" && weekLayout === "workweek") days = days.slice(0, 5);
  if (view === "Calendar" && mode === "Day") days = [date];
  if (view === "Calendar" && mode === "Month") {
    const first = date.slice(0, 8) + "01",
      offset = (new Date(first + "T12:00:00").getDay() + 6) % 7;
    days = Array.from({ length: 42 }, (_, i) => shiftDay(first, i - offset));
  }
  const home = section === "Home",
    weekly = view === "This Week" || view === "Calendar",
    tasks =
      view === "Backlog" ? plan.tasks.filter((t) => !t.date && (showCompleted || !t.done) && t.title.toLowerCase().includes(backlogQuery.trim().toLowerCase())) : dayTasks(date);
  const backlogCompleted = plan.tasks.filter((task) => !task.date && task.done).length;
  let quickPreview = null, quickError = "";
  if (quick.trim()) {
    try {
      quickPreview = parseQuick(quick, view === "Backlog" ? "" : quickDate || date);
      const issue = kind === "task" && feed.issues.find((item) => item.key.toUpperCase() === quickPreview.title.toUpperCase());
      if (issue) {
        const object = issueObject(issue), existing = linkedPlan(object);
        quickPreview = { ...quickPreview, title: object.title, linked: true, existingDate: existing ? existing.date || "Backlog" : null };
      }
    }
    catch (error) { quickError = error.message; }
  }
  const carryover = plan.tasks.filter((task) => !task.done && task.kind !== "event" && task.date && task.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const showCarryover = date === today && (home || view === "Today") && carryover.length > 0;
  const due = feed.issues.filter(
    (i) => i.fields.duedate && i.fields.duedate <= shiftDay(today, 1),
  );
  const remaining = tasks.filter((t) => !t.done);
  const remainingNoun = remaining.some((task) => task.kind === "event") ? "item" : "task";
  const completed = tasks.filter((t) => t.done);
  const connected = Boolean(configs.jira?.tokenConfigured || configs.gitlab?.tokenConfigured);
  const attentionScope = home || view === "Today";
  const showReviewAttention = !attentionScope || notificationPreferences.reviews !== false;
  const showDeadlineAttention = !attentionScope || notificationPreferences.deadlines !== false;
  const attentionReviews = showReviewAttention ? feed.mrs : [];
  const attentionDue = showDeadlineAttention ? due : [];
  const showDigest = home && notificationPreferences.digest !== false;
  const nextReview = attentionReviews[0];
  const nextIssue = !nextReview && attentionDue[0];
  const feedPlanDate = weekly ? quickDate || date : today;
  const availableBacklogAction = (object) => <button className="quiet-button" disabled={linkedPlan(object)?.date === ""} onClick={() => planObject(object, "")}>{linkedPlan(object)?.date === "" ? "In Backlog" : linkedPlan(object) ? "Move to Backlog" : "Backlog"}</button>;
  const carryoverRow = (task) => <div className="carryover-row" key={task.id}>
    <button className="carryover-title" onClick={() => task.object ? onOpen(task.object) : editTask({ ...task })}>{task.title}</button>
    <time dateTime={task.date}>{task.date}</time>
    <button className="btn" onClick={() => act(() => scheduleTasks([task], today, `Brought ${task.title} to Today.`))}>Bring to Today</button>
  </div>;
  const quickEntry = (<>
      <form className="plan-quick" onSubmit={add}>
        <Plus size={15} />
        <input
          ref={quickInput}
          aria-describedby="plan-quick-target"
          aria-label="Quick add personal work"
          placeholder="Prepare retry review tomorrow 2pm"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
        />
        <select
          aria-label="Personal item type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="task">Task</option>
          <option value="event">Event</option>
        </select>
        <button className="btn" disabled={!quick.trim()}>
          Add to plan
        </button>
      </form>
      <div id="plan-quick-target" className={`plan-quick-target ${quickError ? "has-error" : ""}`} aria-live="polite">
        {quickError || (quickPreview ? <>{quickPreview.linked ? "Linked Jira task" : kind === "event" ? "Personal event" : "Personal task"} · <b>{quickPreview.title}</b> · {quickPreview.existingDate ? `Move existing plan from ${quickPreview.existingDate} to ` : ""}{quickPreview.date || "Backlog"}{quickPreview.time && ` at ${quickPreview.time}`}</> : <>Adding to {view === "Backlog" ? "Backlog" : quickDate || date} · try “tomorrow 2pm” or a YYYY-MM-DD date</>)}
      </div>
      <details className="plan-boundary">
        <summary><Link2 size={11} /> Personal plan · saved on this device</summary>
        <p>Completing or scheduling items here does not change Jira status or due dates. Linked items open their original work context. Dooray calendars are not connected.</p>
      </details>
  </>);
  const availableWork = (
      <section className="live-inbox">
        <h2>
          Available work{" "}
          <span className="muted">
            {loading
              ? "Loading…"
              : `${feed.issues.length} ${feed.issues.length === 1 ? "issue" : "issues"} · ${feed.mrs.length} ${feed.mrs.length === 1 ? "review" : "reviews"}`}
          </span>
        </h2>
        {weekly && <p className="form-note available-plan-date">Plan work for <b>{feedPlanDate}</b> · choose a date above or “Plan here” in a day.</p>}
        {feed.issues.map((i) => (
          <div className="inbox-work" key={i.key} data-linked-work={i.key}>
            <button onClick={() => onOpen(issueObject(i))}>
              <code>{i.key}</code> {i.fields.summary}
            </button>
            <span className="pill">{i.fields.status?.name}</span>
            {i.fields.duedate && <span className="plan-due-badge">Jira due {i.fields.duedate}</span>}
            {linkedPlan(issueObject(i))?.date > i.fields.duedate && i.fields.duedate && <span className="plan-deadline-warning">Planned after deadline</span>}
            {planningAction(issueObject(i), false, feedPlanDate)}
            {availableBacklogAction(issueObject(i))}
          </div>
        ))}
        {feed.mrs.map((mr) => <div className="inbox-work available-review" key={`${mr.project_id}:${mr.iid}`} data-linked-work={`mr:${mr.project_id}:${mr.iid}`}>
          <button onClick={() => onOpen(mrObject(mr))}><GitPullRequest size={13} /><code>!{mr.iid}</code> {mr.title}</button>
          <span className="pill">Review requested</span>
          {planningAction(mrObject(mr), false, feedPlanDate)}
          {availableBacklogAction(mrObject(mr))}
        </div>)}
        {!configs.jira?.tokenConfigured && (
          <button className="btn" onClick={onSettings}>
            Connect Jira to see assigned issues
          </button>
        )}
        <details className="plan-boundary available-work-details"><summary>About this work feed</summary><p>Shows up to 50 items per service. Search Projects and My Reviews for all work. Attention items use service data; no AI request runs automatically.</p></details>
      </section>
  );
  return (
    <div ref={rootRef} className={`page daily-connected ${home ? "daily-command-center" : ""} ${attentionScope ? "daily-cockpit" : ""} ${home ? "home-cockpit" : view === "Today" ? "today-cockpit" : ""}`}>

      <header className="page-heading">
        <div>
          <span className="eyebrow">
            {home ? "Workspace" : "My work"}
          </span>
          <h1>{home ? "Your workday" : view}</h1>
          <p>
            {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            {attentionScope ? "" : date === today ? " · Personal planning" : " · Planning ahead"}
          </p>


        </div>
        <div className="inline">
          {connectedFeed && <SyncStatus sync={sync} />}
          <button className="btn" disabled={loading || sync.syncing} onClick={() => sync.run()}>
            Refresh work
          </button>
        </div>
      </header>
      <div className="view-toolbar">
        <div className="segmented">
          {["Today", "This Week", "Backlog", "Calendar", "My Activity"].map(
            (v) => (
              <button
                key={v}
                className={!home && view === v ? "active" : ""}
                onClick={() => {if(v === "Today")setDate(today);onNavigate("My Work", v);}}
              >
                {v}
              </button>
            ),
          )}
        </div>
        {returnRange && view === "Calendar" && mode === "Day" && <button className="quiet-button planning-return" onClick={() => {
          setDate(returnRange.date); setMode(returnRange.mode);
          if (returnRange.view !== "Calendar") onNavigate("My Work", returnRange.view);
          const selectedDay = returnRange.selectedDay;
          setReturnRange(null);
          requestAnimationFrame(() => {
            const button = [...(rootRef.current?.querySelectorAll("[data-plan-day]") || [])].find((item) => item.dataset.planDay === selectedDay);
            button?.focus({ preventScroll: true });
            button?.scrollIntoView({ block: "nearest" });
          });
        }}><ChevronLeft size={13} />Back to {returnRange.view === "This Week" ? "week" : returnRange.mode.toLowerCase()}</button>}
        {date !== today && <button className="btn" aria-label="Return to today" onClick={() => { setDate(today); setReturnRange(null); }}>Today</button>}
        <button
          className="icon-button"
          aria-label="Previous planning period"
          onClick={() =>
            setDate(view === "Calendar" && mode === "Month" ? shiftMonth(date,-1) : shiftDay(date,view === "This Week" || (view === "Calendar" && mode === "Week") ? -7 : -1))
          }
        >
          <ChevronLeft size={15} />
        </button>
        <input
          aria-label="Planning date"
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        <button
          className="icon-button"
          aria-label="Next planning period"
          onClick={() =>
            setDate(view === "Calendar" && mode === "Month" ? shiftMonth(date,1) : shiftDay(date,view === "This Week" || (view === "Calendar" && mode === "Week") ? 7 : 1))
          }
        >
          <ChevronRight size={15} />
        </button>
        {view === "Calendar" && (
          <select
            aria-label="Calendar range"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            {["Day", "Week", "Month"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
      </div>
      {!attentionScope && quickEntry}
      {error && !editing && (
        <div role="alert" className="connection-error">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="plan-notice">
          {notice}
        </p>
      )}
      {completionUndo && <div role="status" className="plan-undo completion-undo">
        <span>{completionUndo.after.done ? "Completed" : "Reopened"} {completionUndo.before.title} · locally</span>
        <button className="quiet-button" onClick={() => act(() => {
          let restored = false;
          planChange(p => ({ ...p, tasks: p.tasks.map(task => {
            if (task.id !== completionUndo.after.id || JSON.stringify(task) !== JSON.stringify(completionUndo.after)) return task;
            restored = true; return { ...completionUndo.before };
          }) }));
          setCompletionUndo(null); setNotice(restored ? "Completion undone in your personal plan." : "This item changed after completion. Its current details were kept.");
        })}><Undo2 size={13} />Undo completion</button>
        <button className="quiet-button" aria-label="Dismiss completion undo" onClick={() => setCompletionUndo(null)}>Dismiss</button>
      </div>}
      {scheduleUndo && <div role="status" className="plan-undo schedule-undo">
        <span>Moved {scheduleUndo.moves.length} {scheduleUndo.moves.length === 1 ? "task" : "tasks"} · local schedule only</span>
        <button className="quiet-button" onClick={undoSchedule}><Undo2 size={13} />Undo schedule move</button>
        <button className="quiet-button" aria-label="Dismiss schedule undo" onClick={() => setScheduleUndo(null)}>Dismiss</button>
      </div>}
      {removed && <div role="status" className="plan-undo">
        <span>Removed <b>{removed.task.title}</b> from your plan.</span>
        <button className="quiet-button" onClick={() => act(() => {
          let replacement = false;
          planChange((p) => {
            if (p.tasks.some((task) => task.id === removed.task.id)) return p;
            if (!removed.task.done && removed.task.object && p.tasks.some((task) => !task.done && objectKey(task.object) === objectKey(removed.task.object))) {
              replacement = true;
              return p;
            }
            const tasks = [...p.tasks];
            tasks.splice(Math.min(removed.index, tasks.length), 0, removed.task);
            return { ...p, tasks };
          });
          setNotice(replacement ? "This linked work was added again. Kept its current plan; the removed copy was not restored." : `Restored ${removed.task.title}`);
          setRemoved(null);
        })}><Undo2 size={13} /> Undo removal</button>
        <button className="quiet-button" aria-label="Dismiss undo removal" onClick={() => setRemoved(null)}>Dismiss</button>
      </div>}
      {feed.errors.map((e, i) => (
        <div key={i} role="alert" className="connection-error">
          {e} <button onClick={onSettings}>Settings</button>
        </div>
      ))}
      {showCarryover && <section className="plan-carryover" aria-label="Unfinished from earlier days">
        <header><div><h2>Unfinished from earlier days <span className="pill">{carryover.length}</span></h2><p>Earlier local schedule dates · Jira deadlines are unchanged</p></div>
          {carryover.length > 1 && <button className="btn" onClick={() => act(() => scheduleTasks(carryover, today, `Brought ${carryover.length} tasks to Today.`))}>Bring all {carryover.length} to Today</button>}
        </header>
        {carryover.slice(0, 3).map(carryoverRow)}
        {carryover.length > 3 && <details><summary>Show {carryover.length - 3} more earlier tasks</summary>{carryover.slice(3).map(carryoverRow)}</details>}
      </section>}
      {view === "My Activity" ? (
        <div className="plan-activity">
          {plan.activity.length ? (
            plan.activity.map((a) => (
              <p key={a.id}>
                <time>{new Date(a.at).toLocaleString()}</time> {a.text}
              </p>
            ))
          ) : (
            <p>No local planning activity yet.</p>
          )}
        </div>
      ) : weekly ? (
        <>
          {view === "This Week" && <div className="planning-week-toolbar">
            <p>Whole week <span>· {weekItems.length} planned · {weekItems.filter(task => task.done).length} completed</span></p>
            <div>
              {weekLayout === "workweek" && weekendItems.length > 0 && <button className="quiet-button" onClick={() => {
                setWeekLayout("full");
                requestAnimationFrame(() => {
                  const heading = rootRef.current?.querySelector(`[data-plan-day="${weekendItems[0].date}"]`);
                  heading?.focus({preventScroll:true}); heading?.scrollIntoView({block:"nearest",inline:"nearest"});
                });
              }} aria-label={`Show ${weekendItems.length} weekend ${weekendItems.length === 1 ? "item" : "items"}`}>{weekendItems.length} on weekend</button>}
              <select aria-label="Week layout" value={weekLayout} onChange={event => setWeekLayout(event.target.value)}>
                <option value="workweek">Workweek · 5 days</option>
                <option value="full">Full week · 7 days</option>
              </select>
            </div>
          </div>}
          <div
            className={`planning-grid ${mode === "Month" && view === "Calendar" ? "month" : ""} ${mode === "Day" && view === "Calendar" ? "day" : ""}`}
            style={view === "This Week" ? { gridTemplateColumns: `repeat(${days.length}, minmax(125px, 1fr))` } : undefined}
          >
            {days.map((d) => (
              <section
                key={d}
                className={d === today ? "is-today" : ""}
                aria-label={`Plan for ${d}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  movePlanTask(e.dataTransfer.getData("text/orbit-task"), d);
                }}
              >
                <h3 className="planning-day-heading"><button data-plan-day={d} aria-label={`Open day ${d}`} onClick={() => openDay(d)}>
                  {new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                  {dayTasks(d).length > 0 && <span title="Planned items">{dayTasks(d).length}</span>}
                </button></h3>
                {dayTasks(d).map(taskRow)}
                <button
                  className="day-add"
                  onClick={() => {
                    setQuickDate(d);
                    quickInput.current?.focus();
                    quickInput.current?.scrollIntoView({ block: "nearest" });
                  }}
                >
                  + Plan here
                </button>
              </section>
            ))}
          </div>
          <section className="planning-backlog-drop" aria-label="Unscheduled work" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            movePlanTask(event.dataTransfer.getData("text/orbit-task"), "");
          }}>
            <h3>Unscheduled <span className="muted">Drag into a day, or drop here to unschedule</span></h3>
            {plan.tasks.filter((task) => !task.date && !task.done).map(taskRow)}
            {!plan.tasks.some((task) => !task.date && !task.done) && <p className="form-note">No unscheduled work. Drop a planned task here to return it to your backlog.</p>}
          </section>
        </>
      ) : (
        <div className={`daily-columns ${showDigest ? "has-daily-digest" : ""}`}>
          <aside className="daily-brief" aria-label="Work queue">
            <div className="attention-content">
            <h2>
              {attentionScope ? "Work queue" : "Needs your attention"}{" "}
              <span className="pill">{attentionReviews.length + attentionDue.length}</span>
            </h2>
            <p className="form-note queue-description">{showReviewAttention && showDeadlineAttention ? "Reviews waiting on you and deadlines coming up." : showReviewAttention ? "Reviews waiting on you." : showDeadlineAttention ? "Deadlines coming up." : "Attention notifications are off. Your available work stays below."}</p>
            {attentionReviews.slice(0, expandedAttention ? undefined : 5).map((m) => (
              <div key={m.id} className={`attention-row review-queue-row ${attentionScope && m === nextReview ? "attention-recommended" : ""}`}>
                <span className="queue-source review-source" role="img" aria-label="GitLab"><GitPullRequest size={15} /></span>
                <button className="queue-work-title" onClick={() => onOpen(mrObject(m))}>
                  <span className="queue-identity"><code>!{m.iid}</code><b>{m.title}</b></span>
                  <small><span className="queue-status">Review requested</span><span>{m.author?.name || "GitLab"}</span></small>
                </button>
                {attentionScope && m === nextReview && <button className="btn primary attention-review" onClick={() => onOpen(mrObject(m))}>Review changes <ArrowUpRight size={12} /></button>}
                {planningAction(mrObject(m), true)}
              </div>
            ))}
            {attentionDue.slice(0, expandedAttention ? undefined : 5).map((i) => (
              <div key={i.key} className={`attention-row deadline-queue-row ${i.fields.duedate < today ? "is-overdue" : ""} ${attentionScope && i === nextIssue ? "attention-recommended" : ""}`}>
                <span className="queue-source issue-source" role="img" aria-label="Jira"><CalendarDays size={15} /></span>
                <button className="queue-work-title" onClick={() => onOpen(issueObject(i))}>
                  <span className="queue-identity"><code>{i.key}</code><b>{i.fields.summary}</b></span>
                  <small><span className="queue-status">{i.fields.duedate < today ? "Overdue" : "Jira due"} {i.fields.duedate}</span><span>{i.fields.status?.name || "Jira issue"}</span></small>
                </button>
                {planningAction(issueObject(i), true)}
              </div>
            ))}
            {(attentionReviews.length > 5 || attentionDue.length > 5) && <button className="quiet-button attention-expand" onClick={() => setExpandedAttention(!expandedAttention)}>{expandedAttention ? "Show fewer attention items" : `Show ${Math.max(0, attentionReviews.length - 5) + Math.max(0, attentionDue.length - 5)} more attention items`}</button>}
            {(attentionReviews.length || attentionDue.length) > 0 && <p className="form-note attention-coverage">Loaded attention items · open My Reviews or Projects for all service results.</p>}
            {!attentionReviews.length && !attentionDue.length && !loading && !feed.errors.length && (
              <div className="attention-clear"><CheckCircle2 size={20} />
                <b>{connected ? showReviewAttention || showDeadlineAttention ? "Nothing urgent in loaded work" : "Attention notifications are off" : "Your work, in one place"}</b>
                <p>{connected ? showReviewAttention || showDeadlineAttention ? "No urgent items in enabled attention categories. Your plan is ready when you are." : "Find issues and reviews in Available work, Projects and My Reviews." : "Connect your tools to surface review requests and upcoming deadlines here."}</p>
              </div>
            )}
            </div>
            {home && availableWork}
          </aside>
          <section className="daily-plan">
            <div className="agenda-content" role="region" aria-label="Personal agenda">
            <h2>
              {attentionScope ? "Personal agenda" : home
                ? date === today
                  ? "Today"
                  : date
                : view === "Backlog"
                  ? "Unscheduled"
                  : "Your plan"}{" "}
              <span className="muted">
                {tasks.filter((t) => !t.done).length} remaining
              </span>
            </h2>
          {attentionScope && <div className="daily-day-summary" aria-label="Daily summary">
            <span><span className="summary-dot" />{remaining.length} planned {remaining.length === 1 ? "item" : "items"}</span>
            <span><CheckCircle2 size={12} />{completed.length} completed locally</span>
          </div>}
            {attentionScope && quickEntry}
            {view === "Backlog" && <div className="backlog-toolbar">
              <input type="search" aria-label="Search backlog" placeholder="Find a task or issue…" value={backlogQuery} onChange={(event) => setBacklogQuery(event.target.value)} />
              <label className="backlog-completed"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />Show completed{backlogCompleted > 0 && ` (${backlogCompleted})`}</label>
              {remaining.length > 0 && <button className="btn" onClick={() => act(() => scheduleTasks(remaining, date, `Scheduled ${remaining.length} shown ${remainingNoun}${remaining.length === 1 ? "" : "s"} for ${date}.`))}>Schedule {remaining.length} shown {remainingNoun}{remaining.length === 1 ? "" : "s"} for {date}</button>}
            </div>}
            {tasks.length ? (
              tasks.map(taskRow)
            ) : (
              <div className="plan-empty">
                <div className="plan-empty-icon"><CalendarDays size={22} strokeWidth={1.5} /></div>
                <h3>{view === "Backlog" && backlogQuery.trim() ? "No matching unscheduled work" : view === "Backlog" ? "A place for your next ideas" : attentionScope ? "No items planned" : "Start with one thing"}</h3>
                <p>{view === "Backlog" && backlogQuery.trim() ? "Try another title or issue key, or clear your search to see the rest of your backlog." : connected ? "Add your own work, or plan an issue or review from the queue." : "Add a task now. Connect Jira and GitLab when you’re ready to bring issues and reviews into the same view."}</p>
                {view === "Backlog" && backlogQuery.trim() && <button className="btn" onClick={() => setBacklogQuery("")}>Clear backlog search</button>}
                <button className="btn primary" onClick={() => quickInput.current?.focus()}><Plus size={13} /> Plan your first item</button>
                {!connected && <button className="quiet-button" onClick={onSettings}>Connect your tools <ArrowUpRight size={12} /></button>}
                {!attentionScope && <small>Try “Review retry policy tomorrow 2pm”</small>}
              </div>
            )}
            {view !== "Backlog" && tasks.some((t) => !t.done && t.kind !== "event") && (
              <div className="plan-rollover">
                <button className="btn" onClick={() => act(() => {
                  const nextDate = shiftDay(date, 1);
                  scheduleTasks(tasks.filter((task) => !task.done && task.kind !== "event"), nextDate, "Unfinished tasks moved to the next day.");
                  setDate(nextDate);
                })}>Move unfinished to next day</button>
                <small>Unfinished tasks only · events keep their date</small>
              </div>
            )}
            </div>
            {attentionScope && !home && availableWork}
            {showDigest && <div className="daily-digest"><AssistantBrief onOpen={onOpen} onNavigate={onNavigate} configVersion={configVersion} /></div>}
          </section>
        </div>
      )}
      {!attentionScope && availableWork}
      {editing && (
        <Dialog.Root open onOpenChange={(v) => !v && closeEditor()}>
          <Dialog.Portal>
            <Dialog.Overlay className="live-command-overlay" />
            <Dialog.Content className="live-command">
              <Dialog.Title>Edit personal work</Dialog.Title>
              <Dialog.Description>
                Changes stay in your personal plan on this device.
              </Dialog.Description>
              {draftRestored && <p className="form-note" role="status">Your unsaved personal work draft was restored. Save it or Cancel to discard.</p>}
              {error && <p role="alert" className="connection-error">{error}</p>}
              {editorConflict && <section className="plan-editor-conflict" aria-label="Latest saved personal work">
                <b>Latest saved work</b><p>{editorConflict.title} · {editorConflict.date || "Backlog"}{editorConflict.time && ` · ${editorConflict.time}`}</p>
                <small>The fields below contain your draft. Applying them replaces the saved title, date, time and type shown here.</small>
                <div className="inline"><button type="button" className="btn" onClick={() => { editorDrafts.delete(editing.id); editTask(editorConflict); }}>Discard draft and load latest</button>
                <button type="button" className="btn" disabled={!editing.title.trim()} onClick={() => saveEditor(editorConflict)}>Apply these edits to latest work</button></div>
              </section>}
              <form
                className="live-create"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEditor();
                }}
              >
                <label>
                  Title
                  <input
                    autoFocus
                    aria-label="Personal work title"
                    value={editing.title}
                    onChange={(e) =>
                      setEditing((t) => ({ ...t, title: e.target.value }))
                    }
                  />
                </label>
                <div className="create-target">
                  <label>
                    Date
                    <input
                      aria-label="Personal work date"
                      type="date"
                      value={editing.date}
                      onChange={(e) =>
                        setEditing((t) => ({ ...t, date: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Time
                    <input
                      aria-label="Personal work time"
                      type="time"
                      value={editing.time}
                      onChange={(e) =>
                        setEditing((t) => ({ ...t, time: e.target.value }))
                      }
                    />
                  </label>
                </div>
                <label>
                  Type
                  <select
                    value={editing.kind}
                    onChange={(e) =>
                      setEditing((t) => ({ ...t, kind: e.target.value }))
                    }
                  >
                    <option value="task">Task</option>
                    <option value="event">Event</option>
                  </select>
                </label>
                <div className="inline">
                  <button
                    className="btn primary"
                    disabled={!editing.title.trim()}
                  >
                    Save personal work
                  </button>
                  <button type="button" className="btn" onClick={() => closeEditor(true)}>Cancel</button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      act(() => {
                        const index = plan.tasks.findIndex((t) => t.id === editing.id);
                        const task = plan.tasks[index];
                        planChange((p) => ({
                          ...p,
                          tasks: p.tasks.filter((t) => t.id !== editing.id),
                        }));
                        if (task) setRemoved({ task, index });
                        setNotice("");
                        editorDrafts.delete(editing.id); setDraftRestored(false); setEditing(null);
                      })
                    }
                  >
                    Delete personal work
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
