import React, { useEffect, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { invoke } from "../lib/integration-client";
import { addPlanTask } from "../lib/planning";
export default function ConnectedAttention({ onClose, onOpen }) {
  const [items, setItems] = useState([]),
    [errors, setErrors] = useState([]),
    [busy, setBusy] = useState(true),
    [refresh, setRefresh] = useState(0),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setErrors([]);
    async function load() {
      const c = await invoke("config.list");
      const requests = [];
      if (c.jira?.tokenConfigured)
        requests.push(
          invoke("jira.issues", {
            jql: 'assignee = currentUser() AND statusCategory != Done AND duedate <= endOfDay("+1d") ORDER BY duedate ASC',
          }).then((d) =>
            d.issues.map((i) => ({
              type: "issue",
              key: i.key,
              title: `${i.key} ${i.fields.summary}`,
              origin: c.jira.url,
              detail: `Due ${i.fields.duedate || "soon"}`,
            })),
          ),
        );
      if (c.gitlab?.tokenConfigured)
        requests.push(
          invoke("gitlab.mrs", { mine: true }).then((d) =>
            d.items.map((m) => ({
              type: "mr",
              iid: m.iid,
              projectId: m.project_id,
              title: `!${m.iid} ${m.title}`,
              origin: c.gitlab.url,
              detail: "Review requested",
            })),
          ),
        );
      const results = await Promise.allSettled(requests);
      if (alive) {
        setItems(
          results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
        );
        setErrors(
          results.flatMap((r) =>
            r.status === "rejected" ? [r.reason.message] : [],
          ),
        );
      }
    }
    load()
      .catch((e) => alive && setErrors([e.message]))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [refresh]);
  return (
    <aside
      className="connected-attention"
      aria-label="Connected attention center"
    >
      <header>
        <h2>Needs your attention</h2>
        <button
          className="icon-button"
          aria-label="Refresh attention"
          disabled={busy}
          onClick={() => setRefresh((x) => x + 1)}
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
      <p className="form-note">
        기한이 임박한 이슈와 리뷰 요청을 모았습니다. 서비스별 첫 50개
        결과입니다.
      </p>
      {busy && <p>Loading…</p>}
      {items.map((o, i) => (
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
      {!items.length && !busy && <p>No urgent work in connected results.</p>}
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
