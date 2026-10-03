import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
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
} from "../lib/planning";
function PlanTask({ task, tasks, today, act, onOpen, onEdit }) {
  const siblings = tasks.filter((item) => item.date === task.date && (item.time || "") === (task.time || ""));
  const index = siblings.findIndex((item) => item.id === task.id);
  return (
    <div
      className={`plan-task ${task.done ? "done" : ""} ${task.kind}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/orbit-task", task.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.getData("text/orbit-task") === task.id) return;
        act(() =>
          moveTask(
            e.dataTransfer.getData("text/orbit-task"),
            task.date,
            task.id,
          ),
        );
      }}
    >
      <button
        className="plan-check"
        aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}
        onClick={() => act(() => updateTask(task.id, { done: !task.done }))}
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
            act(() => updateTask(task.id, { date: shiftDay(today, 1) }))
          }
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function DailyWorkspace({
  section,
  view,
  configs,
  onOpen,
  onNavigate,
  onSettings,
}) {
  const plan = usePlan(),
    today = dayKey();
  const [editing, setEditing] = useState(null);
  const [removed, setRemoved] = useState(null);
  const quickInput = useRef(null);
  const [quickDate, setQuickDate] = useState(null);
  const [date, setDate] = useState(today),
    [mode, setMode] = useState("Week"),
    [quick, setQuick] = useState(""),
    [kind, setKind] = useState("task"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [feed, setFeed] = useState({ issues: [], mrs: [], errors: [] }),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      configs.jira?.tokenConfigured
        ? invoke("jira.issues", {
            jql: "assignee = currentUser() AND statusCategory != Done ORDER BY duedate ASC, updated DESC",
          })
        : Promise.resolve({ issues: [] }),
      configs.gitlab?.tokenConfigured
        ? invoke("gitlab.mrs", { mine: true })
        : Promise.resolve({ items: [] }),
    ]).then(([j, g]) => {
      if (alive) {
        setFeed({
          issues: j.status === "fulfilled" ? j.value.issues : [],
          mrs: g.status === "fulfilled" ? g.value.items : [],
          errors: [j, g]
            .filter((r) => r.status === "rejected")
            .map((r) => r.reason.message),
        });
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [configs, refresh]);
  useEffect(() => { setQuickDate(null); }, [date, view]);
  const act = (fn) => {
    try {
      fn();
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  function add(e) {
    e.preventDefault();
    act(() => {
      const t = parseQuick(quick, view === "Backlog" ? "" : quickDate || date);
      addPlanTask({ ...t, kind });
      setQuick("");
      setNotice(`Saved locally · ${t.date || "Backlog"} ${t.time}`);
    });
  }
  function planObject(o) {
    act(() => {
      addPlanTask({ title: o.title, object: o, date: today });
      setNotice("Added to Today");
    });
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
  const taskRow = (task) => <PlanTask key={task.id} task={task} tasks={plan.tasks} today={today} act={act} onOpen={onOpen} onEdit={setEditing} />;
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
      view === "Backlog" ? plan.tasks.filter((t) => !t.date) : dayTasks(date);
  const due = feed.issues.filter(
    (i) => i.fields.duedate && i.fields.duedate <= shiftDay(today, 1),
  );
  const remaining = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);
  const connected = Boolean(configs.jira?.tokenConfigured || configs.gitlab?.tokenConfigured);
  const nextReview = feed.mrs[0];
  const nextIssue = !nextReview && due[0];
  return (
    <div className={`page daily-connected ${home ? "daily-command-center" : ""}`}>

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
        <button
          className="btn"
          disabled={loading}
          onClick={() => setRefresh((x) => x + 1)}
        >
          Refresh work
        </button>
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
      <div id="plan-quick-target" className="plan-quick-target">
        Adding to {view === "Backlog" ? "Backlog" : quickDate || date} · explicit dates in your text take priority
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
      {removed && <div role="status" className="plan-undo">
        <span>Removed <b>{removed.task.title}</b> from your plan.</span>
        <button className="quiet-button" onClick={() => act(() => {
          planChange((p) => {
            if (p.tasks.some((task) => task.id === removed.task.id)) return p;
            const tasks = [...p.tasks];
            tasks.splice(Math.min(removed.index, tasks.length), 0, removed.task);
            return { ...p, tasks };
          });
          setNotice(`Restored ${removed.task.title}`);
          setRemoved(null);
        })}><Undo2 size={13} /> Undo removal</button>
        <button className="quiet-button" aria-label="Dismiss undo removal" onClick={() => setRemoved(null)}>Dismiss</button>
      </div>}
      {feed.errors.map((e, i) => (
        <div key={i} role="alert" className="connection-error">
          {e} <button onClick={onSettings}>Settings</button>
        </div>
      ))}
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
                  act(() =>
                    moveTask(e.dataTransfer.getData("text/orbit-task"), d),
                  );
                }}
              >
                <h3>
                  {new Date(d + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                  })}
                </h3>
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
          <h3>Unscheduled · drag into a day</h3>
          {plan.tasks
            .filter((t) => !t.date && !t.done)
            .map(taskRow)}
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
            {tasks.length ? (
              tasks.map(taskRow)
            ) : (
              <div className="plan-empty">
                <div className="plan-empty-icon"><CalendarDays size={22} strokeWidth={1.5} /></div>
                <h3>{view === "Backlog" ? "A place for your next ideas" : "Start with one thing"}</h3>
                <p>{connected ? "Bring an issue or review into your day, or make space for work of your own." : "Add a task now. Connect Jira and GitLab when you’re ready to bring issues and reviews into the same view."}</p>
                <button className="btn primary" onClick={() => quickInput.current?.focus()}><Plus size={13} /> Plan your first item</button>
                {!connected && <button className="quiet-button" onClick={onSettings}>Connect your tools <ArrowUpRight size={12} /></button>}
                <small>Try “Review retry policy tomorrow 2pm”</small>
              </div>
            )}
            {tasks.some((t) => !t.done) && (
              <button
                className="btn"
                onClick={() =>
                  act(() => {
                    tasks
                      .filter((t) => !t.done)
                      .forEach((t) =>
                        updateTask(t.id, { date: shiftDay(date, 1) }),
                      );
                    setDate(shiftDay(date, 1));
                    setNotice("Unfinished work moved to the next day.");
                  })
                }
              >
                Move unfinished to next day
              </button>
            )}
          </section>
          <aside className="daily-brief">
            <h2>
              Needs your attention{" "}
              <span className="pill">{feed.mrs.length + due.length}</span>
            </h2>
            <p className="form-note">Reviews waiting on you and deadlines coming up.</p>
            {feed.mrs.slice(0, 5).map((m) => (
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
                <button className="btn" onClick={() => planObject(mrObject(m))}>
                  Today
                </button>
              </div>
            ))}
            {due.slice(0, 5).map((i) => (
              <div key={i.key} className={`attention-row ${home && i === nextIssue ? "attention-recommended" : ""}`}>
                {home && i === nextIssue && <span className="attention-kicker">Coming up next <ArrowUpRight size={12} /></span>}
                <button onClick={() => onOpen(issueObject(i))}>
                  <b>
                    {i.key} {i.fields.summary}
                  </b>
                  <small>Due {i.fields.duedate}</small>
                </button>
                <button
                  className="btn"
                  onClick={() => planObject(issueObject(i))}
                >
                  Today
                </button>
              </div>
            ))}
            {!feed.mrs.length && !due.length && !loading && (
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
        {feed.issues.map((i) => (
          <div className="inbox-work" key={i.key}>
            <button onClick={() => onOpen(issueObject(i))}>
              <code>{i.key}</code> {i.fields.summary}
            </button>
            <span className="pill">{i.fields.status?.name}</span>
            <button className="btn" onClick={() => planObject(issueObject(i))}>
              Add to Today
            </button>
            <button
              className="quiet-button"
              onClick={() =>
                act(() => {
                  addPlanTask({
                    title: issueObject(i).title,
                    object: issueObject(i),
                    date: "",
                  });
                  setNotice("Added to Backlog");
                })
              }
            >
              Backlog
            </button>
          </div>
        ))}
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
