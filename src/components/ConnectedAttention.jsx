import React, { useEffect, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { invoke } from "../lib/integration-client";
import { addPlanTask } from "../lib/planning";
import { useAutoSync } from "../lib/use-auto-sync";
import SyncStatus from "./SyncStatus";
export default function ConnectedAttention({ onClose, onOpen, onSettings, notificationPreferences = {} }) {
  const [items, setItems] = useState([]),
    [configured, setConfigured] = useState(false),
    [errors, setErrors] = useState([]),
    [busy, setBusy] = useState(true),
    [notice, setNotice] = useState("");
  const sync = useAutoSync({ key: "attention", services: ["jira", "gitlab"], enabled: !busy, refresh: load });
  async function load(isCurrent) {
    const c = await invoke("config.list");
    if (!isCurrent()) return;
    setConfigured(Boolean(c.jira?.tokenConfigured || c.gitlab?.tokenConfigured));
    const [jira, gitlab] = await Promise.allSettled([
      c.jira?.tokenConfigured
        ? invoke("jira.issues", { jql: 'assignee = currentUser() AND statusCategory != Done AND duedate <= endOfDay("+1d") ORDER BY duedate ASC' })
          .then(d => d.issues.map(i => ({ type: "issue", key: i.key,
            title: `${i.key} ${i.fields.summary}`, origin: c.jira.url, detail: `Due ${i.fields.duedate || "soon"}` })))
        : Promise.resolve([]),
      c.gitlab?.tokenConfigured
        ? invoke("gitlab.mrs", { mine: true }).then(d => d.items.map(m => ({ type: "mr", iid: m.iid,
            projectId: m.project_id, title: `!${m.iid} ${m.title}`, origin: c.gitlab.url, detail: "Review requested" })))
        : Promise.resolve([]),
    ]);
    if (!isCurrent()) return;
    const failures = [["Jira", jira], ["GitLab", gitlab]].flatMap(([service, result]) => result.status === "rejected" ? [`${service}: ${result.reason.message}`] : []);
    setItems(previous => [
      ...(jira.status === "fulfilled" ? jira.value : previous.filter(item => item.type === "issue" && item.origin === c.jira?.url)),
      ...(gitlab.status === "fulfilled" ? gitlab.value : previous.filter(item => item.type === "mr" && item.origin === c.gitlab?.url)),
    ]);
    setErrors(failures);
    if (failures.length) throw new Error(failures.join(" · "));
  }
  useEffect(() => {
    let alive = true;
    load(() => alive)
      .then(() => { if (alive) sync.markSynced(); })
      .catch(e => { if (alive) setErrors([e.message]); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);
  const visibleItems = items.filter(item => item.type === "mr" ? notificationPreferences.reviews !== false : notificationPreferences.deadlines !== false);
  return (
    <aside
      className="connected-attention"
      id="attention-popover"
      tabIndex={-1}
      aria-label="Connected attention center"
    >
      <header>
        <h2>Needs your attention</h2>
        <button
          className="icon-button"
          aria-label="Refresh attention"
          disabled={busy || sync.syncing}
          onClick={() => sync.run()}
        >
          <RefreshCw size={14} />
        </button>
        <button
          className="icon-button"
          aria-label="Close attention"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </header>
      <SyncStatus sync={sync} />
      <p className="form-note">
        Due issues and review requests, up to the first 50 results per service.
      </p>
      {busy && <p>Loading…</p>}
      {visibleItems.map((o, i) => (
        <div className="attention-row" key={i}>
          <button
            onClick={() => {
              onOpen(o);
              onClose();
            }}
          >
            <b>{o.title}</b>
            <small>{o.detail}</small>
          </button>
          <button
            className="btn"
            onClick={() => {
              try {
                addPlanTask({ title: o.title, object: o });
                setNotice("Added to Today");
              } catch (e) {
                setErrors([e.message]);
              }
            }}
          >
            Today
          </button>
        </div>
      ))}
      {!visibleItems.length && !busy && !errors.length && (configured
        ? <p>{items.length ? "Attention categories are hidden by your preferences. Your issue and review lists remain available." : "No urgent work in connected results."}</p>
        : <div><p>Connect Jira or GitLab to see due issues and review requests.</p><button className="btn" onClick={onSettings}>Connect tools</button></div>)}
      {!busy && errors.length > 0 && <p>{items.length ? "Some services could not be checked. Results may be incomplete. Last available results are kept." : "Attention could not be checked. Retrying automatically; you can also refresh."}</p>}
      {errors.map((e, i) => (
        <p className="connection-error" role="alert" key={i}>
          {e}
        </p>
      ))}
      {notice && (
        <p className="plan-notice" role="status">
          {notice}
        </p>
      )}
    </aside>
  );
}
