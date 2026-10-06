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
let planningUndo = { removed: null, scheduleUndo: null };
function PlanTask({ task, tasks, today, act, onOpen, onEdit, onMove, onComplete, due }) {
  const siblings = tasks.filter((item) => item.date === task.date && (item.time || "") === (task.time || ""));
  const index = siblings.findIndex((item) => item.id === task.id);
  return (
    <div
      className={`plan-task ${task.done ? "done" : ""} ${task.kind}`}
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
        onClick={() => onComplete(task)}
      >
        {task.done ? (
          <Check size={13} />
        ) : task.kind === "event" ? (
          <CalendarDays size={13} />
        ) : null}
      </button>
      <div className="plan-task-main">
        <button
          onClick={() =>
            task.object ? onOpen(task.object) : onEdit({ ...task })
          }
        >
          {task.time && <time>{task.time}</time>}
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
      <div className="plan-task-actions">
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
        <button
          title="Edit personal plan"
          aria-label={`Edit plan for ${task.title}`}
          onClick={() => onEdit({ ...task })}
        >
          <Pencil size={12} />
        </button>
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
      </div>
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
}) {
  const plan = usePlan(),
    today = dayKey();
  const planningSession = planningSessions.get(planningKey);
  const rememberedRange = planningSession?.ranges?.[view];
  const ranges = useRef({ ...planningSession?.ranges });
  const explicitRange = useRef(null);
  const [editing, setEditing] = useState(null);
  const [removed, setRemoved] = useState(() => planningUndo.removed);
  const [scheduleUndo, setScheduleUndo] = useState(() => planningUndo.scheduleUndo);
  const [returnRange, setReturnRange] = useState(() => planningSession?.returnRange || null);
  const quickInput = useRef(null);
  const rootRef = useRef(null);
  const [quickDate, setQuickDate] = useState(() => planningSession?.quickDate || null);
  const [backlogQuery, setBacklogQuery] = useState(() => planningSession?.backlogQuery || "");
  const [showCompleted, setShowCompleted] = useState(() => planningSession?.showCompleted || false);
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
    planningSessions.set(planningKey, { ...currentRange, ranges: { ...ranges.current }, quick, kind, quickDate, returnRange, backlogQuery, showCompleted });
    planningUndo = { removed, scheduleUndo };
  }, [planningKey, view, date, mode, quick, kind, quickDate, returnRange, removed, scheduleUndo, backlogQuery, showCompleted]);
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
  const taskRow = (task) => <PlanTask key={task.id} task={task} tasks={plan.tasks} today={today} act={act} onOpen={onOpen} onEdit={setEditing} onMove={movePlanTask} onComplete={completePlanTask} due={taskDue(task)} />;
  function completePlanTask(task) {
    act(() => {
      updateTask(task.id, { done: !task.done });
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
  const nextReview = feed.mrs[0];
  const nextIssue = !nextReview && due[0];
  const feedPlanDate = weekly ? quickDate || date : today;
  const availableBacklogAction = (object) => <button className="quiet-button" disabled={linkedPlan(object)?.date === ""} onClick={() => planObject(object, "")}>{linkedPlan(object)?.date === "" ? "In Backlog" : linkedPlan(object) ? "Move to Backlog" : "Backlog"}</button>;
  const carryoverRow = (task) => <div className="carryover-row" key={task.id}>
    <button className="carryover-title" onClick={() => task.object ? onOpen(task.object) : setEditing({ ...task })}>{task.title}</button>
    <time dateTime={task.date}>{task.date}</time>
    <button className="btn" onClick={() => act(() => scheduleTasks([task], today, `Brought ${task.title} to Today.`))}>Bring to Today</button>
  </div>;
  return (
    <div ref={rootRef} className={`page daily-connected ${home ? "daily-command-center" : ""}`}>

      <header className="page-heading">
        <div>
          <span className="eyebrow">
            {home ? "Daily command center" : "My work"}
          </span>
          <h1>{home ? "A clear start to your day" : view}</h1>
          <p>
            {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            · {date === today ? "Make room for what matters." : "Plan ahead with a clear view."}
          </p>
          {home && <div className="daily-day-summary" aria-label="Daily summary">
            <span><span className="summary-dot" />{remaining.length} planned {remaining.length === 1 ? "item" : "items"}</span>
            <span><GitPullRequest size={12} />{!configs.gitlab?.tokenConfigured ? "GitLab not connected" : loading ? "Checking reviews…" : `${feed.mrs.length} ${feed.mrs.length === 1 ? "review" : "reviews"} requested`}</span>
            <span><CheckCircle2 size={12} />{completed.length} completed locally</span>
          </div>}

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
          <div
            className={`planning-grid ${mode === "Month" && view === "Calendar" ? "month" : ""} ${mode === "Day" && view === "Calendar" ? "day" : ""}`}
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
        <div className="daily-columns">
          <section>
            <h2>
              {home
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
                <h3>{view === "Backlog" && backlogQuery.trim() ? "No matching unscheduled work" : view === "Backlog" ? "A place for your next ideas" : "Start with one thing"}</h3>
                <p>{view === "Backlog" && backlogQuery.trim() ? "Try another title or issue key, or clear your search to see the rest of your backlog." : connected ? "Bring an issue or review into your day, or make space for work of your own." : "Add a task now. Connect Jira and GitLab when you’re ready to bring issues and reviews into the same view."}</p>
                {view === "Backlog" && backlogQuery.trim() && <button className="btn" onClick={() => setBacklogQuery("")}>Clear backlog search</button>}
                <button className="btn primary" onClick={() => quickInput.current?.focus()}><Plus size={13} /> Plan your first item</button>
                {!connected && <button className="quiet-button" onClick={onSettings}>Connect your tools <ArrowUpRight size={12} /></button>}
                <small>Try “Review retry policy tomorrow 2pm”</small>
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
          </section>
          <aside className="daily-brief">
            {home && <AssistantBrief onOpen={onOpen} onNavigate={onNavigate} configVersion={configVersion} />}
            <h2>
              Needs your attention{" "}
              <span className="pill">{feed.mrs.length + due.length}</span>
            </h2>
            <p className="form-note">Reviews waiting on you and deadlines coming up.</p>
            {feed.mrs.slice(0, expandedAttention ? undefined : 5).map((m) => (
              <div key={m.id} className={`attention-row ${home && m === nextReview ? "attention-recommended" : ""}`}>
                {home && m === nextReview && <span className="attention-kicker">A good place to start <ArrowUpRight size={12} /></span>}
                <GitPullRequest size={16} />
                <button onClick={() => onOpen(mrObject(m))}>
                  <b>
                    !{m.iid} {m.title}
                  </b>
                  <small>Review requested · {m.author?.name || "GitLab"}</small>
                </button>
                {home && m === nextReview && <button className="btn primary attention-review" onClick={() => onOpen(mrObject(m))}>Review changes <ArrowUpRight size={12} /></button>}
                {planningAction(mrObject(m), true)}
              </div>
            ))}
            {due.slice(0, expandedAttention ? undefined : 5).map((i) => (
              <div key={i.key} className={`attention-row ${home && i === nextIssue ? "attention-recommended" : ""}`}>
                {home && i === nextIssue && <span className="attention-kicker">Coming up next <ArrowUpRight size={12} /></span>}
                <button onClick={() => onOpen(issueObject(i))}>
                  <b>
                    {i.key} {i.fields.summary}
                  </b>
                  <small>{i.fields.duedate < today ? "Overdue" : "Jira due"} {i.fields.duedate}</small>
                </button>
                {planningAction(issueObject(i), true)}
              </div>
            ))}
            {(feed.mrs.length > 5 || due.length > 5) && <button className="quiet-button attention-expand" onClick={() => setExpandedAttention(!expandedAttention)}>{expandedAttention ? "Show fewer attention items" : `Show ${Math.max(0, feed.mrs.length - 5) + Math.max(0, due.length - 5)} more attention items`}</button>}
            {(feed.mrs.length || due.length) > 0 && <p className="form-note attention-coverage">Loaded attention items · open My Reviews or Projects for all service results.</p>}
            {!feed.mrs.length && !due.length && !loading && !feed.errors.length && (
              <div className="attention-clear"><CheckCircle2 size={20} />
                <b>{connected ? "Nothing urgent in loaded work" : "Your work, in one place"}</b>
                <p>{connected ? "No pending reviews or imminent deadlines in loaded results. Your plan is ready when you are." : "Connect your tools to surface review requests and upcoming deadlines here."}</p>
              </div>
            )}
          </aside>
        </div>
      )}
      <section className="live-inbox">
        <h2>
          Available work{" "}
          <span className="muted">
            {loading
              ? "Loading…"
              : `${feed.issues.length} issues · ${feed.mrs.length} reviews`}
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
      {editing && (
        <Dialog.Root open onOpenChange={(v) => !v && setEditing(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="live-command-overlay" />
            <Dialog.Content className="live-command">
              <Dialog.Title>Edit personal work</Dialog.Title>
              <Dialog.Description>
                Changes stay in your personal plan on this device.
              </Dialog.Description>
              {error && <p role="alert" className="connection-error">{error}</p>}
              <form
                className="live-create"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() => {
                    updateTask(editing.id, {
                      title: editing.title.trim(),
                      date: editing.date,
                      time: editing.time,
                      kind: editing.kind,
                    });
                    setEditing(null);
                  });
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
                  <Dialog.Close className="btn">Cancel</Dialog.Close>
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
                        setEditing(null);
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
