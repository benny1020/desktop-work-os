import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { X, Search, Plus } from "lucide-react";
import "../command-workflow.css";
import { invoke } from "../lib/integration-client";
import { usePlan, parseQuick, addPlanTask } from "../lib/planning";
// Text drafts live only for this renderer session; credentials and submitted drafts are never retained here.
const createDrafts = new Map();
let lastCreateKind = "task";
let credentialScope = 0;
export function advanceCommandCredentialScope() { credentialScope++; }
function draftScope(kind, configs) {
  const config = configs[kind === "issue" ? "jira" : "confluence"];
  return kind === "task" ? "task" : JSON.stringify([credentialScope, kind, config?.url, config?.email, config?.cloudId]);
}
export default function ConnectedCommands({
  mode,
  onClose,
  onOpen,
  onNavigate,
}) {
  const plan = usePlan(),
    [query, setQuery] = useState(""),
    [configs, setConfigs] = useState({}),
    [results, setResults] = useState([]),
    [errors, setErrors] = useState([]),
    [loading, setLoading] = useState(false),
    [kind, setKind] = useState(lastCreateKind),
    [configured, setConfigured] = useState(false),
    [configError, setConfigError] = useState(""),
    [configAttempt, setConfigAttempt] = useState(0),
    [optionError, setOptionError] = useState(""),
    [sourceStates, setSourceStates] = useState({}),
    [metadataVersion, setMetadataVersion] = useState(0),
    [project, setProject] = useState(""),
    [type, setType] = useState(""),
    [space, setSpace] = useState(""),
    [projects, setProjects] = useState([]),
    [types, setTypes] = useState([]),
    [spaces, setSpaces] = useState([]),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  const version = useRef(0),
    create = mode !== "search";
  const commandPanel = useRef(null), titleInput = useRef(null), searches = useRef([]);
  const scope = draftScope(kind, configs);
  function editDraft(changes) {
    const next = {title, body, ...changes};
    createDrafts.set(scope, next);
    setTitle(next.title); setBody(next.body); setSuccess("");
  }
  useEffect(() => {
    if ((!configured && kind !== "task") || !create) return;
    const saved = createDrafts.get(scope);
    setTitle(saved?.title || ""); setBody(saved?.body || "");
    requestAnimationFrame(() => titleInput.current?.focus());
  }, [scope, configured, create]);
  async function searchSource(source, ticket) {
    const [label, fetch, convert] = source;
    setSourceStates(states => ({...states, [label]: {status:"loading"}}));
    try {
      const data = await fetch();
      if (ticket !== version.current) return;
      const items = convert(data).map(o => ({...o, group:label}));
      setResults(previous => [...previous.filter(o => o.group !== label), ...items]);
      setSourceStates(states => ({...states, [label]: {status:"done", count:items.length}}));
    } catch (error) {
      if (ticket !== version.current) return;
      setSourceStates(states => ({...states, [label]: {status:"error", message:error.message}}));
    }
  }
  useEffect(() => {
    let alive = true;
    setConfigError("");
    invoke("config.list")
      .then((c) => {
        if (alive) { setConfigs(c); setConfigured(true); }
      })
      .catch((e) => alive && setConfigError(e.message));
    return () => {
      alive = false;
    };
  }, [configAttempt]);
  useEffect(() => {
    let alive = true;
    if (!create) return;
    setOptionError("");
    if (kind === "issue")
      invoke("jira.projects")
        .then((d) => alive && setProjects(d.values || []))
        .catch((e) => alive && setOptionError(e.message));
    if (kind === "document")
      invoke("confluence.spaces")
        .then((d) => alive && setSpaces(d.results || []))
        .catch((e) => alive && setOptionError(e.message));
    return () => {
      alive = false;
    };
  }, [kind, metadataVersion, create]);
  useEffect(() => {
    let alive = true;
    setType("");
    setTypes([]);
    if (project && create)
      invoke("jira.issueTypes", { project })
        .then((d) => alive && setTypes(d.issueTypes || d.values || []))
        .catch((e) => alive && setOptionError(e.message));
    return () => {
      alive = false;
    };
  }, [project, metadataVersion, create]);
  useEffect(() => {
    if (create) return;
    const ticket = ++version.current;
    setResults([]);
    setSourceStates({});
    setErrors([]);
    if (query.trim().length < 2) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      const q = query.trim(),
        calls = [];
      const term = q.replace(/[^\p{L}\p{N} _-]/gu, " ").trim();
      if (configs.jira?.tokenConfigured)
        calls.push([
          "Jira",
          () => invoke("jira.issues", {
            jql: /^[A-Z][A-Z0-9_]*-\d+$/i.test(q)
              ? `key = "${q.toUpperCase()}"`
              : `text ~ "${term}" ORDER BY updated DESC`,
          }),
          (d) =>
            d.issues.map((i) => ({
              type: "issue",
              key: i.key,
              title: `${i.key} ${i.fields.summary}`,
              origin: configs.jira.url,
              detail: [i.fields.status?.name, i.fields.assignee?.displayName].filter(Boolean).join(" · "),
            })),
        ]);
      if (configs.gitlab?.tokenConfigured) {
        calls.push([
          "Merge requests",
          () => invoke("gitlab.mrs", { search: q }),
          (d) =>
            d.items.map((m) => ({
              type: "mr",
              projectId: m.project_id,
              iid: m.iid,
              title: `!${m.iid} ${m.title}`,
              origin: configs.gitlab.url,
              detail: [m.source_branch, m.author?.name].filter(Boolean).join(" · "),
            })),
        ]);
        calls.push([
          "Repositories",
          () => invoke("gitlab.projects", { search: q }),
          (d) =>
            d.items.map((p) => ({
              type: "repository",
              id: p.id,
              projectId: p.id,
              title: p.path_with_namespace || p.name,
              origin: configs.gitlab.url,
            })),
        ]);
      }
      if (configs.confluence?.tokenConfigured)
        calls.push([
          "Wiki",
          () => invoke("confluence.search", { query: q }),
          (d) =>
            (d.results || [])
              .filter((r) => r.content?.id)
              .map((r) => ({
                type: "doc",
                id: r.content.id,
                title: r.content.title || r.title,
                origin: configs.confluence.url,
              })),
        ]);
      searches.current = calls;
      calls.forEach(source => searchSource(source, ticket));
      setLoading(false);
    }, 300);
    return () => {
      clearTimeout(timer);
      version.current++;
    };
  }, [query, configs, create]);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    commandPanel.current?.focus();
    setErrors([]);
    try {
      if (kind === "task") {
        const task = parseQuick(title);
        addPlanTask(task);
        setSuccess("Saved to your local plan.");
        setTitle("");
        createDrafts.delete(scope);
      } else if (kind === "issue") {
        const issue = await invoke("jira.create", {
          project,
          issueType: type,
          summary: title,
          description: body,
        });
        createDrafts.delete(scope);
        onOpen({
          type: "issue",
          key: issue.key,
          title: `${issue.key} ${title}`,
          origin: configs.jira.url,
        });
        onClose();
      } else {
        const page = await invoke("confluence.create", {
          spaceId: space,
          title,
          body,
        });
        createDrafts.delete(scope);
        onOpen({
          type: "doc",
          id: page.id,
          title: page.title,
          origin: configs.confluence.url,
        });
        onClose();
      }
    } catch (e) {
      setErrors([e.message]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => titleInput.current?.focus());
    }
  }
  const remoteConfigured = ["jira", "gitlab", "confluence"].some(service => configs[service]?.tokenConfigured);
  const localMatches = plan.tasks.filter(t => t.title.toLowerCase().includes(query.trim().toLowerCase()));
  function choose(o) {
    if (o.type === "task") {
      onNavigate("My Work", o.date ? "Today" : "Backlog", {
        planDate: o.date,
        taskId: o.id,
      });
    } else onOpen(o);
    onClose();
  }
  return (
    <Dialog.Root open onOpenChange={(v) => !v && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="live-command-overlay" />
        <Dialog.Content
          ref={commandPanel}
          className="live-command"
          onEscapeKeyDown={(e) => busy && e.preventDefault()}
          onKeyDown={(event) => {
            if (busy && (event.metaKey || event.ctrlKey) && ["k", "n"].includes(event.key.toLowerCase())) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <Dialog.Title>
            {create ? "Quick create" : "Search your workspace"}
          </Dialog.Title>
          <Dialog.Description>
            {create
              ? "Tasks stay on this device. Issues and documents are created in the selected service."
              : "Jira · GitLab · Confluence · Personal plan"}
          </Dialog.Description>
          <Dialog.Close
            className="icon-button command-close"
            aria-label="Close connected command"
            disabled={busy}
          >
            <X size={16} />
          </Dialog.Close>
          {create ? (
            <form className="live-create" onSubmit={submit}>
              <div className="segmented">
                {[
                  ["task", "Task"],
                  ["issue", "Jira issue"],
                  ["document", "Wiki document"],
                ].map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={kind === id ? "active" : ""}
                    onClick={() => {
                      lastCreateKind = id;
                      setKind(id);
                      setSuccess("");
                      setErrors([]);
                    }}
                    disabled={busy}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {kind === "issue" && (
                <div className="create-target">
                  <label>
                    Project
                    <select
                      aria-label="New issue project"
                      disabled={busy}
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                    >
                      <option value="">Choose project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.key}>
                          {p.key} · {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Issue type
                    <select
                      aria-label="New issue type"
                      disabled={busy}
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="">Choose type</option>
                      {types
                        .filter((t) => !t.subtask)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              )}
              {kind === "document" && (
                <label>
                  Confluence space
                  <select
                    aria-label="New document space"
                    disabled={busy}
                    value={space}
                    onChange={(e) => setSpace(e.target.value)}
                  >
                    <option value="">Choose space</option>
                    {spaces.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                {kind === "task" ? "Task · optional tomorrow 2pm" : "Title"}
                <input
                  ref={titleInput}
                  autoFocus
                  aria-label="New work title"
                  disabled={busy || (kind !== "task" && !configured)}
                  value={title}
                  maxLength={255}
                  onChange={(e) => editDraft({title:e.target.value})}
                  placeholder={
                    kind === "task"
                      ? "Review payment retry tomorrow 2pm"
                      : "A clear, specific title"
                  }
                />
              </label>
              {kind !== "task" && (
                <label>
                  {kind === "issue"
                    ? "Description"
                    : "Document body · plain text"}
                  <textarea
                    aria-label="New work body"
                    disabled={busy || (kind !== "task" && !configured)}
                    rows={6}
                    value={body}
                    onChange={(e) => editDraft({body:e.target.value})}
                  />
                </label>
              )}
              <div className="create-actions">
              {kind !== "task" && <p className="form-note create-destination">Destination: {kind === "issue" ? configs.jira?.url : configs.confluence?.url}. Your text stays here if submission fails.</p>}
              <div className="create-draft-note"><span>Text draft kept while the app is open.</span><button type="button" className="quiet-button" disabled={busy || (!title && !body)} onClick={() => { createDrafts.delete(scope); setTitle(""); setBody(""); titleInput.current?.focus(); }}>Discard draft</button></div>
              <button
                className="btn primary"
                disabled={
                  busy ||
                  !title.trim() ||
                  (kind === "issue" && (!project || !type)) ||
                  (kind === "document" && (!space || !body.trim()))
                }
              >
                {busy
                  ? "Submitting…"
                  : kind === "task"
                    ? "Save local task"
                    : kind === "issue"
                      ? "Create in Jira"
                      : "Publish to Confluence"}
              </button>
              {success && (
                <p role="status" className="connection-success">
                  {success}
                </p>
              )}
              </div>
            </form>
          ) : (
            <Command label="Connected global search" shouldFilter={false}>
              <div className="live-search-input">
                <Search size={16} />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search an issue, review, wiki page…"
                  aria-label="Connected global search"
                  autoFocus
                />
              </div>
              {!remoteConfigured && configured && <p className="form-note">Search your local plan, or <button className="quiet-button" onClick={() => {onNavigate("Settings", "Integrations");onClose();}}>Connect tools</button> to include Jira, GitLab and Confluence.</p>}
              <Command.List>
                {(loading || Object.values(sourceStates).some(s=>s.status === "loading")) && (
                  <div className="form-note" role="status">Searching connected services… Available results are ready to open.</div>
                )}
                {query.trim().length < 2 ? (
                  <>
                    <Command.Group heading="Navigate">
                      {[
                        ["Home", "Home"],
                        ["My Work", "Today"],
                        ["Projects", "Issues"],
                        ["Code", "My Reviews"],
                        ["Docs", "Home"],
                      ].map(([s, v]) => (
                        <Command.Item
                          key={s}
                          value={s}
                          onSelect={() => {
                            onNavigate(s, v);
                            onClose();
                          }}
                        >
                          {s} <small>{v}</small>
                        </Command.Item>
                      ))}
                    </Command.Group>
                    <Command.Group heading="Recently viewed">
                      {plan.recent.slice(0, 6).map((o, i) => (
                        <Command.Item
                          key={i}
                          value={`recent-${i}`}
                          onSelect={() => choose(o)}
                        >
                          {o.title}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  </>
                ) : (
                  <>
                    {localMatches.length > 0 && <Command.Group heading="Personal plan">
                      {localMatches.map((t) => (
                          <Command.Item
                            value={t.id}
                            key={t.id}
                            onSelect={() =>
                              choose(t.object || { type: "task", id: t.id, date: t.date })
                            }
                          >
                            {t.title}
                            <small>{t.date || "Backlog"}</small>
                          </Command.Item>
                        ))}
                    </Command.Group>}
                    {["Jira", "Merge requests", "Repositories", "Wiki"].map(
                      (group) => results.some(o => o.group === group) && (
                        <Command.Group key={group} heading={group}>
                          {results
                            .filter((o) => o.group === group)
                            .map((o, i) => (
                              <Command.Item
                                value={group + i}
                                key={i}
                                onSelect={() => choose(o)}
                              >
                                <span className="search-result-text"><span>{o.title}</span>{o.detail && <small>{o.detail}</small>}</span>
                              </Command.Item>
                            ))}
                        </Command.Group>
                      ),
                    )}
                    {!loading && remoteConfigured && !Object.values(sourceStates).some(s=>s.status === "loading" || s.status === "error") && !results.length && (
                      <p className="form-note">
                        No remote matches in the first result page.
                      </p>
                    )}
                  </>
                )}
              </Command.List>
              {query.trim().length >= 2 && <div className="search-source-status" aria-label="Search service status">
                {Object.entries(sourceStates).map(([name, source]) => <div key={name} className={source.status === "error" ? "search-source-error" : ""}>
                  <span>{name} · {source.status === "loading" ? "Searching…" : source.status === "error" ? "Unavailable" : `${source.count} found`}</span>
                  {source.status === "error" && <><small role="alert">{name}: {source.message}</small><button className="quiet-button" onClick={() => {const current=searches.current.find(s=>s[0]===name);if(current)searchSource(current, version.current);}}>Retry {name}</button></>}
                </div>)}
              </div>}
              <footer>↑ ↓ Navigate · Enter Open preview · Esc Close</footer>
            </Command>
          )}
          {configError && <div role="alert" className="connection-error">{configError}<button className="quiet-button" onClick={() => setConfigAttempt(v=>v+1)}>Retry connections</button></div>}
          {create && optionError && <div role="alert" className="connection-error">{optionError}<button className="quiet-button" onClick={() => {setOptionError("");setMetadataVersion(v=>v+1);}}>Retry form options</button></div>}
          {errors.map((e, i) => (
            <div key={i} role="alert" className="connection-error">
              {e}
            </div>
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
