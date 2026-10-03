import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { invoke } from "../lib/integration-client";
import { addPlanTask } from "../lib/planning";
function Pending() {
  return <p className="form-note">Loading issue…</p>;
}
function adfText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";
  return (node.content || [])
    .map(adfText)
    .join(["doc", "bulletList", "orderedList"].includes(node.type) ? "\n" : "");
}
export default function JiraIssue({
  item,
  onClose,
  onChanged,
  onContext,
  origin,
  onOpen,
  configs,
}) {
  const [issue, setIssue] = useState(null),
    [transitions, setTransitions] = useState([]),
    [transition, setTransition] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [people, setPeople] = useState([]),
    [personQuery, setPersonQuery] = useState(""),
    [account, setAccount] = useState(""),
    [due, setDue] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (issue) {
      setAccount(issue.fields.assignee?.accountId || "");
      setDue(issue.fields.duedate || "");
    }
  }, [issue]);
  async function searchPeople() {
    try {
      setPeople(
        await invoke("jira.assignees", { key: item.key, query: personQuery }),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  async function editField(field) {
    setBusy(true);
    setError("");
    try {
      await invoke("jira.edit", {
        key: item.key,
        ...(field === "assignee" ? { accountId: account } : { due }),
      });
      setNotice("Saved in Jira");
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const [meta, setMeta] = useState(null),
    [boards, setBoards] = useState([]),
    [sprints, setSprints] = useState([]),
    [sprint, setSprint] = useState(""),
    [priority, setPriority] = useState("");
  async function loadPlanning() {
    setError("");
    try {
      const [m, b] = await Promise.all([
        invoke("jira.editMetadata", { key: item.key }),
        invoke("jira.boards", {
          project: issue.fields.project?.key || item.key.split("-")[0],
        }),
      ]);
      setMeta(m);
      setBoards(b.values || []);
      setPriority(issue.fields.priority?.id || "");
    } catch (e) {
      setError(e.message);
    }
  }
  async function chooseBoard(id) {
    setSprints([]);
    setSprint("");
    if (!id) return;
    try {
      setSprints((await invoke("jira.sprints", { boardId: id })).values || []);
    } catch (e) {
      setError(e.message);
    }
  }
  async function savePlanning(kind) {
    setBusy(true);
    setError("");
    try {
      if (kind === "sprint")
        await invoke("jira.moveSprint", { key: item.key, sprintId: sprint });
      else await invoke("jira.edit", { key: item.key, priorityId: priority });
      setNotice(
        kind === "sprint"
          ? "Sprint updated in Jira"
          : "Priority updated in Jira",
      );
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    const [i, t] = await Promise.all([
      invoke("jira.issue", { key: item.key }),
      invoke("jira.transitions", { key: item.key }),
    ]);
    setIssue(i);
    setTransitions(t);
    onContext?.(JSON.stringify({ key: i.key, ...i.fields }));
  }
  useEffect(() => {
    let alive = true;
    Promise.all([
      invoke("jira.issue", { key: item.key }),
      invoke("jira.transitions", { key: item.key }),
    ])
      .then(([i, t]) => {
        if (alive) {
          setIssue(i);
          setTransitions(t);
          onContext?.(JSON.stringify({ key: i.key, ...i.fields }));
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [item.key]);
  async function update(kind) {
    setBusy(true);
    setError("");
    try {
      if (kind === "comment") {
        await invoke("jira.comment", { key: item.key, body: text });
        setText("");
      } else
        await invoke("jira.transition", {
          key: item.key,
          transitionId: transition,
        });
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="live-inspector" aria-label="Live issue inspector">
      <div className="inspector-header">
        <b>{item.key}</b>
        <button
          className="icon-button push-right"
          aria-label="Close live issue"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      {issue ? (
        <div className="live-inspector-body">
          <h2>{issue.fields.summary}</h2>
          <div className="inline">
            <span className="pill">{issue.fields.status?.name}</span>
            <span>{issue.fields.assignee?.displayName || "Unassigned"}</span>
          </div>
          <p className="live-description">
            {adfText(issue.fields.description) || "No description"}
          </p>
          <label>
            Status transition
            <select
              aria-label="Jira status transition"
              value={transition}
              onChange={(e) => setTransition(e.target.value)}
            >
              <option value="">Choose a transition</option>
              {transitions.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            disabled={!transition || busy}
            onClick={() => update("status")}
          >
            Apply in Jira
          </button>
          <div className="issue-edit-grid">
            <label>
              Assignee search
              <input
                aria-label="Find Jira assignee"
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
              />
            </label>
            <button className="btn" disabled={busy} onClick={searchPeople}>
              Find people
            </button>
            <select
              aria-label="Jira assignee"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">Unassigned</option>
              {issue.fields.assignee?.accountId &&
                !people.some(
                  (p) => p.accountId === issue.fields.assignee.accountId,
                ) && (
                  <option value={issue.fields.assignee.accountId}>
                    {issue.fields.assignee.displayName}
                  </option>
                )}
              {people.map((p) => (
                <option key={p.accountId} value={p.accountId}>
                  {p.displayName}
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={busy}
              onClick={() => editField("assignee")}
            >
              Save assignee in Jira
            </button>
            <label>
              Jira due date
              <input
                type="date"
                aria-label="Jira due date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <button
              className="btn"
              disabled={busy}
              onClick={() => editField("due")}
            >
              Save due date in Jira
            </button>
          </div>
          <details className="issue-planning-details">
            <summary>Sprint & priority</summary>
            <button className="btn" onClick={loadPlanning}>
              Load project options
            </button>
            {meta && (
              <>
                <label>
                  Priority
                  <select
                    aria-label="Jira priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="">Choose priority</option>
                    {(meta.fields?.priority?.allowedValues || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn"
                  disabled={!priority || busy}
                  onClick={() => savePlanning("priority")}
                >
                  Save priority in Jira
                </button>
                <label>
                  Scrum board
                  <select
                    aria-label="Jira scrum board"
                    onChange={(e) => chooseBoard(e.target.value)}
                    defaultValue=""
                  >
                    <option value="">Choose board</option>
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sprint
                  <select
                    aria-label="Jira sprint"
                    value={sprint}
                    onChange={(e) => setSprint(e.target.value)}
                  >
                    <option value="">Choose active or future sprint</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.state}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn"
                  disabled={!sprint || busy}
                  onClick={() => savePlanning("sprint")}
                >
                  Move to sprint in Jira
                </button>
                <p className="form-note">
                  최대 50개 보드·스프린트. 프로젝트 권한과 Jira 설정에 따라
                  선택지가 제한될 수 있습니다.
                </p>
              </>
            )}
          </details>
          <button
            className="btn"
            onClick={() => {
              try {
                addPlanTask({
                  title: `${item.key} ${issue.fields.summary}`,
                  object: {
                    type: "issue",
                    key: item.key,
                    title: `${item.key} ${issue.fields.summary}`,
                    origin,
                  },
                });
                setNotice("Added to Today · local plan");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Add to Today
          </button>
          {notice && (
            <p className="connection-success" role="status">
              {notice}
            </p>
          )}
          {onOpen && (
            <section className="issue-related">
              <h3>Related context</h3>
              <button
                className="btn"
                onClick={() =>
                  onOpen({
                    type: "related",
                    query: item.key,
                    title: `Related to ${item.key}`,
                  })
                }
              >
                Find linked MR & wiki
              </button>
              {issue.fields.issuelinks?.map((l, i) => {
                const target = l.outwardIssue || l.inwardIssue;
                return (
                  target && (
                    <button
                      className="linked-object"
                      key={i}
                      onClick={() =>
                        onOpen({
                          type: "issue",
                          key: target.key,
                          title: target.fields?.summary || target.key,
                          origin,
                        })
                      }
                    >
                      {target.key} · {target.fields?.summary}
                    </button>
                  )
                );
              })}
            </section>
          )}
          <h3>Comments</h3>
          {issue.fields.comment?.comments?.map((c) => (
            <div className="component-comment" key={c.id}>
              <b>{c.author?.displayName}</b>
              <p>{adfText(c.body)}</p>
            </div>
          ))}
          <textarea
            aria-label="Live Jira comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Jira에 남길 댓글…"
          />
          <button
            className="btn primary"
            disabled={!text.trim() || busy}
            onClick={() => update("comment")}
          >
            Post to Jira
          </button>
        </div>
      ) : (
        !error && <Pending />
      )}
      {error && (
        <div className="connection-error" role="alert">
          {error}
        </div>
      )}
    </aside>
  );
}
