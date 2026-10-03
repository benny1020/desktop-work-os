import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import DocumentReader from "./DocumentReader";
import PipelineSummary from "./PipelineSummary";
import { X, ChevronLeft, Star } from "lucide-react";
import { invoke } from "../lib/integration-client";
import {
  rememberObject,
  favoriteObject,
  addPlanTask,
  usePlan,
  objectKey,
} from "../lib/planning";
import JiraIssue from "./LiveIssue";
import ReviewWorkbench from "./ReviewWorkbench";
import AssistantAvatar from "./AssistantAvatar";
import ConnectedAssistant from "./ConnectedAssistant";
export function MRLinks({ mr, onOpen, origin, pending = false }) {
  const [pipelines, setPipelines] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const keys = [
    ...new Set(
      `${mr.title} ${mr.description || ""} ${mr.source_branch || ""}`.match(
        /\b[A-Z][A-Z0-9_]+-\d+\b/g,
      ) || [],
    ),
  ];
  async function load() {
    setBusy(true);
    setError("");
    try {
      setPipelines(
        await invoke("gitlab.mrPipelines", {
          projectId: mr.project_id,
          iid: mr.iid,
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mr-linked-context">
      <span>Context</span>
      {keys.map((key) => (
        <button
          className="linked-chip"
          key={key}
          disabled={pending}
          onClick={() => onOpen({ type: "issue", key, title: key })}
        >
          {key}
        </button>
      ))}
      <button className="linked-chip" disabled={busy || pending} onClick={load}>
        Pipeline {busy ? "…" : ""}
      </button>
      {pipelines?.map((p) => (
        <button
          className="linked-chip"
          key={p.id}
          disabled={pending}
          onClick={() =>
            onOpen({
              type: "pipeline",
              id: p.id,
              projectId: mr.project_id,
              title: `Pipeline #${p.id}`,
              origin,
            })
          }
        >
          #{p.id} · {p.status}
        </button>
      ))}
      {pipelines?.length === 0 && <small>No MR pipelines</small>}
      <button
        className="linked-chip"
        onClick={() => {
          try {
            addPlanTask({
              title: `!${mr.iid} ${mr.title}`,
              object: {
                type: "mr",
                iid: mr.iid,
                projectId: mr.project_id,
                title: mr.title,
                origin,
              },
            });
            setNotice("Added to Today");
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        Add review to Today
      </button>
      {notice && <small role="status">{notice}</small>}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
function RemoteObject({ object, configs, onOpen, onContext, onBack, onReady, initialReviewState, onReviewState, pending, onPendingChange }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(false),
    [notice, setNotice] = useState("");
  const plan = usePlan(),
    service =
      object.type === "doc"
        ? "confluence"
        : object.type === "issue"
          ? "jira"
          : "gitlab";
  const mismatch = object.origin && configs[service]?.url !== object.origin;
  useEffect(() => { if (data && object.type !== "mr") onReady?.(); }, [data]);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    if (mismatch || object.type === "issue") return;
    setLoading(true);
    async function load() {
      if (object.type === "mr")
        return invoke("gitlab.mr", {
          projectId: object.projectId,
          iid: object.iid,
        });
      if (object.type === "doc")
        return invoke("confluence.page", { id: object.id });
      if (object.type === "pipeline")
        return invoke("gitlab.pipeline", {
          projectId: object.projectId,
          id: object.id,
        });
      if (object.type === "repository")
        return invoke("gitlab.mrs", { projectId: object.projectId });
      if (object.type === "related") {
        const entries = [
          [
            "Merge requests",
            "gitlab",
            () => invoke("gitlab.mrs", { search: object.query }),
          ],
          [
            "Wiki",
            "confluence",
            () => invoke("confluence.search", { query: object.query }),
          ],
        ];
        return Promise.all(
          entries.map(async ([label, s, fn]) => {
            if (!configs[s]?.tokenConfigured)
              return { label, error: "Integration not configured" };
            try {
              return { label, data: await fn() };
            } catch (e) {
              return { label, error: e.message };
            }
          }),
        );
      }
    }
    load()
      .then((d) => {
        if (alive) {
          setData(d);
          if (object.type === "doc")
            onContext?.(
              JSON.stringify({
                type: "doc",
                id: d.id,
                origin: configs.confluence.url,
                title: d.title,
                body: d.body?.storage?.value?.slice(0, 16000),
              }),
            );
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [object, refresh, mismatch]);
  if (mismatch)
    return (
      <div className="connection-error" role="alert">
        This item belongs to a different service URL. Reconnect to{" "}
        {object.origin} in Settings to open it.
      </div>
    );
  if (object.type === "issue")
    return (
      <JiraIssue
        item={object}
        origin={configs.jira?.url}
        configs={configs}
        onOpen={onOpen}
        onContext={(value) => { onContext?.(value); onReady?.(); }}
        onClose={onBack}
      />
    );
  if (object.type === "mr" && data)
    return (
      <div className="context-mr">
        <MRLinks mr={data.mr} origin={configs.gitlab?.url} onOpen={onOpen} pending={pending} />
        <ReviewWorkbench
          key={data.mr.diff_refs.head_sha}
          snapshot={data}
          initialReviewState={initialReviewState}
          onReviewState={onReviewState}
          onPendingChange={onPendingChange}
          onReady={onReady}
          live
          onBack={onBack}
          onRefresh={() => setRefresh((x) => x + 1)}
          onContext={onContext}
          externalError={error}
          refreshing={loading}
        />
      </div>
    );
  return (
    <div className="object-detail">
      {loading && <p role="status">Loading {object.type}…</p>}
      {error && (
        <div role="alert" className="connection-error">
          {error}
          <button className="btn" onClick={() => setRefresh((x) => x + 1)}>
            Retry
          </button>
        </div>
      )}
      {object.type === "doc" && data && (
        <>
          <div className="view-toolbar">
            <span className="pill">Confluence · v{data.version?.number}</span>
            <button
              className="btn"
              onClick={() => {
                try {
                  favoriteObject({
                    ...object,
                    title: data.title,
                    origin: configs.confluence.url,
                  });
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              {plan.favorites.some(
                (o) =>
                  objectKey(o) ===
                  objectKey({ ...object, origin: configs.confluence.url }),
              )
                ? "Remove favorite"
                : "Favorite"}
            </button>
          </div>
          <h1>{data.title}</h1>
          <DocumentReader key={data.id} html={data.body?.storage?.value} onOpen={onOpen}
            jiraOrigin={configs.jira?.url} jiraConfigured={configs.jira?.tokenConfigured} />
        </>
      )}
      {object.type === "pipeline" && data && (
        <>
          <span className="pill">{data.status}</span>
          <h1>Pipeline #{data.id}</h1>
          <p>
            {data.ref} · <code>{data.sha?.slice(0, 12)}</code>
          </p>
          <PipelineSummary pipeline={data} />
        </>
      )}
      {object.type === "repository" && data && (
        <>
          <h1>{object.title}</h1>
          <h3>Open merge requests</h3>
          {data.items.map((m) => (
            <button
              className="related-result"
              key={m.id}
              onClick={() =>
                onOpen({
                  type: "mr",
                  projectId: m.project_id,
                  iid: m.iid,
                  title: `!${m.iid} ${m.title}`,
                  origin: configs.gitlab.url,
                })
              }
            >
              !{m.iid} {m.title}
            </button>
          ))}
        </>
      )}
      {object.type === "related" && data && (
        <>
          <h1>{object.title}</h1>
          <p className="form-note">
            These results mention the issue key in their title or content.
            They may be related; the links have not been verified.
          </p>
          {data.map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              {group.error ? (
                <p role="alert" className="connection-error">
                  {group.error}
                </p>
              ) : group.label === "Merge requests" ? (
                <>
                  {group.data.items.map((m) => (
                    <button
                      className="related-result"
                      key={m.id}
                      onClick={() =>
                        onOpen({
                          type: "mr",
                          projectId: m.project_id,
                          iid: m.iid,
                          title: `!${m.iid} ${m.title}`,
                          origin: configs.gitlab.url,
                        })
                      }
                    >
                      !{m.iid} {m.title}
                    </button>
                  ))}
                  {!group.data.items.length && <p>No matching MR.</p>}
                </>
              ) : (
                <>
                  {(group.data.results || [])
                    .filter((r) => r.content?.id)
                    .map((r) => (
                      <button
                        className="related-result"
                        key={r.content.id}
                        onClick={() =>
                          onOpen({
                            type: "doc",
                            id: r.content.id,
                            title: r.content.title,
                            origin: configs.confluence.url,
                          })
                        }
                      >
                        {r.content.title}
                      </button>
                    ))}
                  {!group.data.results?.length && <p>No matching wiki page.</p>}
                </>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
export default function ConnectedObjects({
  object,
  onClose,
  onContext,
  onSettings,
  returnFocusRef,
}) {
  const [stack, setStack] = useState([object]),
    [configs, setConfigs] = useState(null),
    [error, setError] = useState("");
  const [assistant, setAssistant] = useState(false),
    [context, setContext] = useState("");
  const [reviewPending, setReviewPending] = useState("");
  useEffect(() => {
    if (!reviewPending) return;
    // Disabling the clicked post button can move focus to body. Capture at the
    // document so command shortcuts still cannot replace a pending review.
    const guardCommands = (event) => {
      if ((event.metaKey || event.ctrlKey) && ["k", "n"].includes(event.key.toLowerCase())) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    document.addEventListener("keydown", guardCommands, true);
    return () => document.removeEventListener("keydown", guardCommands, true);
  }, [reviewPending]);
  const assistantTrigger = useRef(null);
  const viewport = useRef(null);
  const scrollPositions = useRef(new Map());
  const reviewStates = useRef(new Map());
  const pendingRestore = useRef(null);
  const scrollSelectors = [".object-detail", ".live-inspector", ".visual-code-scroll", ".visual-code-panel", ".visual-map-panel", ".diagram-scroll"];
  const current = stack.at(-1);
  const contextKey = (item) => item.type === "related" ? `related:${item.query || ""}` : objectKey(item);
  function saveScroll() {
    const root = viewport.current;
    if (!root) return;
    scrollPositions.current.set(contextKey(current), {
      main: [root.scrollLeft, root.scrollTop],
      children: Object.fromEntries(scrollSelectors.map((selector) => {
        const element = root.querySelector(selector);
        return [selector, element ? [element.scrollLeft, element.scrollTop] : null];
      })),
    });
  }
  function restoreScroll() {
    const key = contextKey(current);
    requestAnimationFrame(() => {
      if (pendingRestore.current !== key || !viewport.current) return;
      const saved = scrollPositions.current.get(key);
      viewport.current.scrollTo(...(saved?.main || [0, 0]));
      for (const [selector, position] of Object.entries(saved?.children || {})) {
        if (position) viewport.current.querySelector(selector)?.scrollTo(...position);
      }
      pendingRestore.current = null;
    });
  }
  function openContext(item) { if (reviewPending) return; saveScroll(); setStack((items) => [...items, item]); }
  function receiveContext(value) {
    setContext(value);
    onContext?.(value);
  }

  useEffect(() => {
    let alive = true;
    invoke("config.list")
      .then((c) => alive && setConfigs(c))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (reviewPending) return;
    if (contextKey(current) !== contextKey(object)) saveScroll();
    setStack((items) => {
      return contextKey(items.at(-1)) === contextKey(object) ? items : [...items, object];
    });
  }, [object]);
  useEffect(() => {
    pendingRestore.current = contextKey(current);
    viewport.current?.scrollTo(0, 0);
    setContext(JSON.stringify(current));
    if (current.type !== "related") {
      try {
        rememberObject(current);
      } catch (e) {
        setError(e.message);
      }
    }
  }, [current]);
  function back() {
    if (reviewPending) return;
    if (stack.length > 1) { saveScroll(); setStack((s) => s.slice(0, -1)); }
    else onClose();
  }
  return (
    <Dialog.Root open onOpenChange={(v) => !v && !reviewPending && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="object-overlay" />
        <Dialog.Content
          className={`object-panel ${current.type === "mr" || assistant ? "wide" : ""}`}
          onEscapeKeyDown={(event) => {
            if (reviewPending) { event.preventDefault(); return; }
            if (assistant) {
              event.preventDefault();
              setAssistant(false);
              requestAnimationFrame(() => assistantTrigger.current?.focus());
            }
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocusRef?.current?.isConnected) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
          onKeyDown={(e) => {
            if (reviewPending && (e.metaKey || e.ctrlKey) && ["k", "n"].includes(e.key.toLowerCase())) { e.preventDefault(); e.stopPropagation(); return; }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
              e.preventDefault();
              e.stopPropagation();
              setAssistant((v) => !v);
            }
          }}
          aria-describedby="object-context-description"
        >
          <header className="object-panel-header">
            <button
              className="icon-button"
              aria-label="Back in context"
              disabled={!!reviewPending}
              onClick={back}
            >
              <ChevronLeft size={16} />
            </button>
            <Dialog.Title>{current.title || current.key}</Dialog.Title>
            <span>
              {stack.length > 1 ? `${stack.length} contexts` : "Quick preview"}
            </span>
            <button ref={assistantTrigger} aria-label="Assistant" className="btn" onClick={() => setAssistant((v) => !v)}>
              <AssistantAvatar size={18}/> Assistant
            </button>
            <Dialog.Close
              className="icon-button"
              aria-label="Close context preview"
              disabled={!!reviewPending}
            >
              <X size={16} />
            </Dialog.Close>
          </header>
          <Dialog.Description
            id="object-context-description"
            className="sr-only"
          >
            Connected object preview. Closing returns to your original
            workspace.
          </Dialog.Description>
          {error && <p role="alert">{error}</p>}
          <div
            className={`object-content-grid ${assistant ? "with-assistant" : ""}`}
          >
            <div className="object-content-main" ref={viewport}>
              {configs && (
                <RemoteObject
                  key={contextKey(current)}
                  object={current}
                  configs={configs}
                  onOpen={openContext}
                  onContext={receiveContext}
                  onBack={back}
                  onReady={restoreScroll}
                  pending={!!reviewPending}
                  onPendingChange={setReviewPending}
                  initialReviewState={reviewStates.current.get(contextKey(current))}
                  onReviewState={(state) => {
                    const key = contextKey(current);
                    const previous = reviewStates.current.get(key);
                    if (previous && previous.version !== state.version) scrollPositions.current.delete(key);
                    reviewStates.current.set(key, state);
                  }}
                />
              )}
            </div>
            {assistant && (
              <ConnectedAssistant
                context={context || JSON.stringify(current)}
                onClose={() => setAssistant(false)}
                onSettings={() => {
                  if (reviewPending) return;
                  onClose();
                  onSettings?.();
                }}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
