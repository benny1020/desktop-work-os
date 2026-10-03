import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  GitPullRequest,
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
      const t = parseQuick(quick, view === "Backlog" ? "" : date);
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
  function Task({ task }) {
    return (
      <div
        className={`plan-task ${task.done ? "done" : ""} ${task.kind}`}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/orbit-task", task.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
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
              task.object ? onOpen(task.object) : setEditing({ ...task })
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
            onClick={() => {
              const same = plan.tasks.filter((t) => t.date === task.date);
              const index = same.findIndex((t) => t.id === task.id);
              if (index > 0)
                act(() => moveTask(task.id, task.date, same[index - 1].id));
            }}
          >
            <ArrowUp size={12} />
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
  return (
    <div className="page daily-connected">
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
            · Personal plan + connected work
          </p>
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
      <div className="plan-boundary">
        개인 계획은 이 기기에 저장됩니다. 체크·날짜 이동은 Jira 상태나 기한을
        변경하지 않습니다. Dooray 일정은 연동하지 않습니다.
      </div>
      {error && (
        <div role="alert" className="connection-error">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="plan-notice">
          {notice}
        </p>
      )}
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
                {dayTasks(d).map((task) => (
                  <Task key={task.id} task={task} />
                ))}
                <button
                  className="day-add"
                  onClick={() => {
                    setDate(d);
                    setNotice(`Quick add date: ${d}`);
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
            .map((t) => (
              <Task key={t.id} task={t} />
            ))}
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
              tasks.map((t) => <Task key={t.id} task={t} />)
            ) : (
              <div className="plan-empty">
                계획된 업무가 없습니다. 아래 실제 업무를 Today에 추가하거나 개인
                업무를 입력하세요.
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
                    setNotice("미완료 업무를 다음 날로 옮겼습니다.");
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
            <p className="form-note">
              리뷰 요청과 임박한 기한을 모았습니다. AI를 자동 호출하지 않습니다.
            </p>
            {feed.mrs.slice(0, 5).map((m) => (
              <div key={m.id} className="attention-row">
                <GitPullRequest size={16} />
                <button onClick={() => onOpen(mrObject(m))}>
                  <b>
                    !{m.iid} {m.title}
                  </b>
                  <small>Review requested · {m.author?.name}</small>
                </button>
                <button className="btn" onClick={() => planObject(mrObject(m))}>
                  Today
                </button>
              </div>
            ))}
            {due.slice(0, 5).map((i) => (
              <div key={i.key} className="attention-row">
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
              <p className="muted">
                No pending reviews or imminent deadlines in loaded results.
              </p>
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
        <p className="form-note">
          서비스별 최대 50개를 우선 표시합니다. 전체 업무는 Projects와 My
          Reviews에서 검색하세요.
        </p>
      </section>
      {editing && (
        <Dialog.Root open onOpenChange={(v) => !v && setEditing(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="live-command-overlay" />
            <Dialog.Content className="live-command">
              <Dialog.Title>Edit personal work</Dialog.Title>
              <Dialog.Description>
                이 기기의 개인 계획만 변경합니다.
              </Dialog.Description>
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
                        planChange((p) => ({
                          ...p,
                          tasks: p.tasks.filter((t) => t.id !== editing.id),
                        }));
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
