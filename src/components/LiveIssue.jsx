import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { invoke } from "../lib/integration-client";
import PlanObjectButton from "./PlanObjectButton";
import CrossToolContext from "./CrossToolContext";
import { useAutoSync } from "../lib/use-auto-sync";
import SyncStatus from "./SyncStatus";
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
  const draftKey = `worklane:jira-comment:${origin || "unconfigured"}:${item.key}`;
  const scopeKey = `${origin || "unconfigured"}:${configs?.jira?.email || ""}:${item.key}`;
  const mounted = useRef(false);
  const activeKey = useRef(scopeKey);
  const requestVersion = useRef(0);
  const mutationBusy = useRef(false);
  const peopleRequest = useRef(0);
  const planningRequest = useRef(0);
  const draftOwner = useRef(draftKey);
  const sprintRequest = useRef(0);
  const transitionRequest = useRef(0);
  const fieldSnapshot = useRef(null);
  activeKey.current = scopeKey;
  const isActive = (scope = scopeKey) => mounted.current && activeKey.current === scope;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current++;
    };
  }, []);
  const [issue, setIssue] = useState(null),
    [transitions, setTransitions] = useState([]),
    [transition, setTransition] = useState(""),
    [text, setText] = useState(() => {
      try { return localStorage.getItem(draftKey) || ""; } catch { return ""; }
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [readError, setReadError] = useState(""),
    [initialSettled, setInitialSettled] = useState(false);
  const [people, setPeople] = useState([]),
    [personQuery, setPersonQuery] = useState(""),
    [account, setAccount] = useState(""),
    [due, setDue] = useState(""),
    [notice, setNotice] = useState("");
  const [peopleBusy, setPeopleBusy] = useState(false), [planningBusy, setPlanningBusy] = useState(false),
    [transitionError, setTransitionError] = useState(""), [transitionLoading, setTransitionLoading] = useState(false);
  useEffect(() => {
    if (draftOwner.current !== draftKey) return;
    try {
      if (text) localStorage.setItem(draftKey, text);
      else localStorage.removeItem(draftKey);
    } catch {
      setError("Your comment draft could not be saved on this device. Keep this issue open to preserve it.");
    }
  }, [text, draftKey]);
  useEffect(() => {
    if (issue) {
      const previous = fieldSnapshot.current;
      const next = { account: issue.fields.assignee?.accountId || "", due: issue.fields.duedate || "", priority: issue.fields.priority?.id || "" };
      // A comment/status refresh may finish while another field is being edited.
      // Only pristine fields follow the server; pending user edits stay intact.
      setAccount((current) => !previous || current === previous.account ? next.account : current);
      setDue((current) => !previous || current === previous.due ? next.due : current);
      setPriority((current) => !previous || current === previous.priority ? next.priority : current);
      fieldSnapshot.current = next;
    }
  }, [issue]);
  async function searchPeople() {
    const ticket = ++peopleRequest.current;
    setPeopleBusy(true); setError("");
    try {
      const result = await invoke("jira.assignees", { key: item.key, query: personQuery });
      if (isActive() && ticket === peopleRequest.current) setPeople(result);
    } catch (e) {
      if (isActive() && ticket === peopleRequest.current) setError(e.message);
    } finally {
      if (isActive() && ticket === peopleRequest.current) setPeopleBusy(false);
    }
  }
  function beginMutation() {
    if (mutationBusy.current) return false;
    mutationBusy.current = true;
    requestVersion.current++; // An older background response must never overwrite a confirmed mutation.
    setBusy(true);
    setError("");
    setNotice("");
    return true;
  }
  function endMutation() {
    if (!isActive()) return;
    mutationBusy.current = false;
    setBusy(false);
  }
  async function editField(field) {
    if (!beginMutation()) return;
    try {
      await invoke("jira.edit", {
        key: item.key,
        ...(field === "assignee" ? { accountId: account } : { due }),
      });
      if (!isActive()) return;
      setNotice("Saved in Jira");
      if (await load(() => true, true)) onChanged?.();
    } catch (e) {
      if (isActive()) setError(e.message);
    } finally {
      endMutation();
    }
  }
  const [meta, setMeta] = useState(null),
    [boards, setBoards] = useState([]),
    [sprints, setSprints] = useState([]),
    [sprint, setSprint] = useState(""),
    [priority, setPriority] = useState("");
  async function loadPlanning() {
    if (planningBusy) return;
    const ticket = ++planningRequest.current;
    setPlanningBusy(true);
    setError("");
    try {
      const [m, b] = await Promise.allSettled([
        invoke("jira.editMetadata", { key: item.key }),
        invoke("jira.boards", {
          project: issue.fields.project?.key || item.key.split("-")[0],
        }),
      ]);
      if (!isActive() || ticket !== planningRequest.current) return;
      if (m.status === "fulfilled") setMeta(m.value);
      if (b.status === "fulfilled") setBoards(b.value.values || []);
      const failures = [m, b].filter(result => result.status === "rejected");
      if (failures.length) setError(failures.map(result => result.reason.message).join(" · "));
    } catch (e) {
      if (isActive() && ticket === planningRequest.current) setError(e.message);
    } finally {
      if (isActive() && ticket === planningRequest.current) setPlanningBusy(false);
    }
  }
  async function chooseBoard(id) {
    const ticket = ++sprintRequest.current;
    const key = scopeKey;
    setSprints([]);
    setSprint("");
    setError("");
    if (!id) return;
    try {
      const result = await invoke("jira.sprints", { boardId: id });
      if (mounted.current && activeKey.current === key && sprintRequest.current === ticket)
        setSprints(result.values || []);
    } catch (e) {
      if (mounted.current && activeKey.current === key && sprintRequest.current === ticket)
        setError(e.message);
    }
  }
  async function savePlanning(kind) {
    if (!beginMutation()) return;
    try {
      if (kind === "sprint")
        await invoke("jira.moveSprint", { key: item.key, sprintId: sprint });
      else await invoke("jira.edit", { key: item.key, priorityId: priority });
      if (!isActive()) return;
      setNotice(
        kind === "sprint"
          ? "Sprint updated in Jira"
          : "Priority updated in Jira",
      );
      if (await load(() => true, true)) onChanged?.();
    } catch (e) {
      if (isActive()) setError(e.message);
    } finally {
      endMutation();
    }
  }
  async function load(isCurrent = () => true, afterMutation = false) {
    if (!isActive() || (mutationBusy.current && !afterMutation)) return false;
    const ticket = ++requestVersion.current;
    const optionTicket = ++transitionRequest.current;
    try {
      const [issueResult, transitionResult] = await Promise.allSettled([
        invoke("jira.issue", { key: item.key }),
        invoke("jira.transitions", { key: item.key }),
      ]);
      if (!isActive() || !isCurrent() || ticket !== requestVersion.current || (mutationBusy.current && !afterMutation)) return false;
      if (issueResult.status === "rejected") throw issueResult.reason;
      const i = issueResult.value;
      setIssue(i);
      if (optionTicket === transitionRequest.current) {
        setTransitions(transitionResult.status === "fulfilled" ? transitionResult.value : []);
        if (transitionResult.status === "fulfilled") setTransition(current => transitionResult.value.some(option => String(option.id) === current) ? current : "");
        setTransitionError(transitionResult.status === "rejected" ? transitionResult.reason.message : "");
        if (transitionResult.status === "rejected") setTransition("");
      }
      setReadError("");
      sync.markSynced();
      onContext?.(JSON.stringify({ key: i.key, ...i.fields }));
      return true;
    } finally {
      // A background read can supersede a manual status retry. Its owner must
      // release the shared loading state even when the issue read fails or goes stale.
      if (isActive() && optionTicket === transitionRequest.current) setTransitionLoading(false);
    }
  }
  async function retryTransitions() {
    const ticket = ++transitionRequest.current;
    setTransitionLoading(true);
    try {
      const options = await invoke("jira.transitions", { key: item.key });
      if (isActive() && ticket === transitionRequest.current && !mutationBusy.current) {
        setTransitions(options); setTransitionError("");
        setTransition(current => options.some(option => String(option.id) === current) ? current : "");
      }
    } catch (e) {
      if (isActive() && ticket === transitionRequest.current) setTransitionError(e.message);
    } finally {
      if (isActive() && ticket === transitionRequest.current) setTransitionLoading(false);
    }
  }
  const sync = useAutoSync({
    key: `jira-issue:${scopeKey}`,
    services: ["jira"],
    enabled: initialSettled && !busy,
    refresh: (isCurrent) => load(isCurrent),
  });
  useEffect(() => {
    let alive = true;
    fieldSnapshot.current = null;
    mutationBusy.current = false;
    setBusy(false);
    setInitialSettled(false);
    setIssue(null);
    setTransitions([]);
    setTransitionError(""); setTransitionLoading(false); transitionRequest.current++;
    setTransition("");
    setPeople([]);
    setPeopleBusy(false); setPlanningBusy(false);
    peopleRequest.current++; planningRequest.current++; sprintRequest.current++;
    setMeta(null);
    setBoards([]);
    setSprints([]);
    setSprint("");
    setError("");
    setReadError("");
    setNotice("");
    if (draftOwner.current !== draftKey) {
      draftOwner.current = draftKey;
      try { setText(localStorage.getItem(draftKey) || ""); } catch { setText(""); }
    }
    load(() => alive).catch((e) => {
      if (alive && isActive()) setReadError(e.message);
    }).finally(() => {
      if (alive && isActive()) setInitialSettled(true);
    });
    return () => { alive = false; requestVersion.current++; };
  }, [scopeKey]);
  async function update(kind) {
    if (!beginMutation()) return;
    let accepted = false;
    try {
      if (kind === "comment") {
        const submittedText = text;
        await invoke("jira.comment", { key: item.key, body: submittedText });
        if (!isActive()) return;
        accepted = true;
        setNotice("Comment posted to Jira.");
        try {
          if (localStorage.getItem(draftKey) === submittedText) localStorage.removeItem(draftKey);
        } catch {
          if (isActive()) setError("Your comment was posted, but its saved draft could not be cleared.");
        }
        setText((current) => (current === submittedText ? "" : current));
      } else {
        await invoke("jira.transition", {
          key: item.key,
          transitionId: transition,
        });
        if (!isActive()) return;
        accepted = true;
        setTransition(""); setTransitions([]);
        setNotice("Status updated in Jira.");
      }
      if (await load(() => true, true)) onChanged?.();
    } catch (e) {
      if (isActive()) {
        if (accepted) setReadError(`Update saved in Jira. Issue refresh failed: ${e.message}`);
        else setError(e.message);
      }
    } finally {
      endMutation();
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
      {(notice || error || readError) && <div className="issue-feedback">
        {notice && <p className="connection-success" role="status">{notice}</p>}
        {readError && <div className="connection-error" role="alert">{readError}<button className="btn" disabled={busy || sync.syncing} onClick={() => sync.run()}>Retry issue refresh</button></div>}
        {error && <div className="connection-error" role="alert">{error}</div>}
      </div>}
      {issue ? (
        <div className="live-inspector-body">
          <SyncStatus sync={sync} />
          <h2>{issue.fields.summary}</h2>
          <div className="inline">
            <span className="pill">{issue.fields.status?.name}</span>
            <span>{issue.fields.assignee?.displayName || "Unassigned"}</span>
            <span className="pill">{issue.fields.priority?.name || "No priority"}</span>
          </div>
          <PlanObjectButton title={`${item.key} ${issue.fields.summary}`}
            object={{ type: "issue", key: item.key, title: `${item.key} ${issue.fields.summary}`, origin }}
            onNotice={setNotice} onError={setError} />
          <p className="live-description">
            {adfText(issue.fields.description) || "No description"}
          </p>
          {onOpen && <CrossToolContext issueKey={item.key} configs={configs} onOpen={onOpen} />}
          <label>
            Status transition
            <select
              aria-label="Jira status transition"
              value={transition}
              disabled={busy || transitionLoading || Boolean(transitionError)}
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
          {transitionError && <div className="connection-error" role="alert">Status options unavailable. {transitionError}
            <button className="btn" disabled={busy || transitionLoading} onClick={retryTransitions}>Retry status options</button>
          </div>}
          <button
            className="btn"
            disabled={!transition || busy || transitionLoading || Boolean(transitionError)}
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
                onKeyDown={event => { if (event.key === "Enter" && !busy && !peopleBusy) { event.preventDefault(); searchPeople(); } }}
              />
            </label>
            <button className="btn" disabled={busy || peopleBusy} onClick={searchPeople}>
              {peopleBusy ? "Finding…" : "Find people"}
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
              disabled={busy || account === (issue.fields.assignee?.accountId || "")}
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
              disabled={busy || due === (issue.fields.duedate || "")}
              onClick={() => editField("due")}
            >
              Save due date in Jira
            </button>
          </div>
          <details className="issue-planning-details" onToggle={event => { if (event.currentTarget.open && !meta && !planningBusy) loadPlanning(); }}>
            <summary>Sprint & priority</summary>
            <button className="btn" disabled={planningBusy || busy} onClick={loadPlanning}>
              Refresh project options
            </button>
            {planningBusy && <p className="form-note" role="status">Loading priority and sprint options…</p>}
            {(meta || boards.length > 0) && (
              <>
                <label>
                  Priority
                  <select
                    aria-label="Jira priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="">Choose priority</option>
                    {(meta?.fields?.priority?.allowedValues || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn"
                  disabled={!priority || busy || priority === issue.fields.priority?.id}
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
                  Showing up to 50 boards and sprints. Available options depend
                  on your project access and Jira settings.
                </p>
              </>
            )}
          </details>
          {onOpen && issue.fields.issuelinks?.length > 0 && (
            <section className="issue-related">
              <h3>Linked Jira issues</h3>
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
          {issue.fields.subtasks?.length > 0 && <section className="issue-related">
            <h3>Subtasks</h3>
            {issue.fields.subtasks.map(task => <button key={task.key} className="linked-object" disabled={!onOpen}
              onClick={() => onOpen?.({ type: "issue", key: task.key, title: task.fields?.summary || task.key, origin })}>
              <code>{task.key}</code> {task.fields?.summary}<small>{task.fields?.status?.name}</small>
            </button>)}
          </section>}
          <h3>Comments</h3>
          {issue.fields.comment?.total > (issue.fields.comment?.comments?.length || 0) && <p className="form-note">
            Showing {issue.fields.comment.comments?.length || 0} of {issue.fields.comment.total} comments returned by Jira. Older comments remain in Jira.
          </p>}
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
            onKeyDown={event => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && text.trim() && !busy) {
                event.preventDefault(); event.stopPropagation(); update("comment");
              }
            }}
            placeholder="Write a comment for Jira…"
          />
          <small className="form-note">Draft saved on this device · ⌘/Ctrl + Enter to post</small>
          <button
            className="btn primary"
            disabled={!text.trim() || busy}
            onClick={() => update("comment")}
          >
            Post to Jira
          </button>
        </div>
      ) : (
        !error && !readError && <Pending />
      )}
      {!issue && initialSettled && <div className="form-note"><SyncStatus sync={sync} /></div>}
    </aside>
  );
}
