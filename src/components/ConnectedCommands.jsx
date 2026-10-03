import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { X, Search, Plus } from "lucide-react";
import { invoke } from "../lib/integration-client";
import { usePlan, parseQuick, addPlanTask } from "../lib/planning";
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
    [kind, setKind] = useState("task"),
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
  useEffect(() => {
    let alive = true;
    invoke("config.list")
      .then((c) => {
        if (alive) setConfigs(c);
      })
      .catch((e) => setErrors([e.message]));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    if (kind === "issue")
      invoke("jira.projects")
        .then((d) => alive && setProjects(d.values || []))
        .catch((e) => alive && setErrors([e.message]));
    if (kind === "document")
      invoke("confluence.spaces")
        .then((d) => alive && setSpaces(d.results || []))
        .catch((e) => alive && setErrors([e.message]));
    return () => {
      alive = false;
    };
  }, [kind]);
  useEffect(() => {
    let alive = true;
    setType("");
    setTypes([]);
    if (project)
      invoke("jira.issueTypes", { project })
        .then((d) => alive && setTypes(d.issueTypes || d.values || []))
        .catch((e) => alive && setErrors([e.message]));
    return () => {
      alive = false;
    };
  }, [project]);
  useEffect(() => {
    if (create) return;
    const ticket = ++version.current;
    setResults([]);
    setErrors([]);
    if (query.trim().length < 2) {
      setLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.trim(),
        calls = [];
      const term = q.replace(/[^\p{L}\p{N} _-]/gu, " ").trim();
      if (configs.jira?.tokenConfigured)
        calls.push([
          "Jira",
          invoke("jira.issues", {
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
            })),
        ]);
      if (configs.gitlab?.tokenConfigured) {
        calls.push([
          "Merge requests",
          invoke("gitlab.mrs", { search: q }),
          (d) =>
            d.items.map((m) => ({
              type: "mr",
              projectId: m.project_id,
              iid: m.iid,
              title: `!${m.iid} ${m.title}`,
              origin: configs.gitlab.url,
            })),
        ]);
        calls.push([
          "Repositories",
          invoke("gitlab.projects", { search: q }),
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
          invoke("confluence.search", { query: q }),
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
      const all = await Promise.allSettled(calls.map((c) => c[1]));
      if (ticket !== version.current) return;
      setResults(
        all.flatMap((r, i) =>
          r.status === "fulfilled"
            ? calls[i][2](r.value).map((o) => ({ ...o, group: calls[i][0] }))
            : [],
        ),
      );
      setErrors(
        all.flatMap((r, i) =>
          r.status === "rejected"
            ? [`${calls[i][0]}: ${r.reason.message}`]
            : [],
        ),
      );
      setLoading(false);
    }, 300);
    return () => {
      clearTimeout(timer);
      version.current++;
    };
  }, [query, configs, create]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      if (kind === "task") {
        const task = parseQuick(title);
        addPlanTask(task);
        setSuccess("Saved to your local plan.");
        setTitle("");
      } else if (kind === "issue") {
        const issue = await invoke("jira.create", {
          project,
          issueType: type,
          summary: title,
          description: body,
        });
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
    }
  }
  function choose(o) {
    if (o.type === "task") {
      onNavigate("My Work", "Today");
    } else onOpen(o);
    onClose();
  }
  return (
    <Dialog.Root open onOpenChange={(v) => !v && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="live-command-overlay" />
        <Dialog.Content
          className="live-command"
          onEscapeKeyDown={(e) => busy && e.preventDefault()}
        >
          <Dialog.Title>
            {create ? "Quick create" : "Search your workspace"}
          </Dialog.Title>
          <Dialog.Description>
            {create
              ? "개인 업무는 로컬 저장, 이슈·문서는 선택한 서비스에 생성합니다."
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
                  autoFocus
                  aria-label="New work title"
                  value={title}
                  maxLength={255}
                  onChange={(e) => setTitle(e.target.value)}
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
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
              )}
              {kind !== "task" && (
                <p className="form-note">
                  {kind === "issue"
                    ? configs.jira?.url
                    : configs.confluence?.url}
                  에 생성됩니다. 실패하면 입력은 유지되며 자동 재시도하지
                  않습니다.
                </p>
              )}
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
              <Command.List>
                {loading && (
                  <div className="form-note">Searching connected services…</div>
                )}
                {query.length < 2 ? (
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
                    <Command.Group heading="Personal plan">
                      {plan.tasks
                        .filter((t) =>
                          t.title.toLowerCase().includes(query.toLowerCase()),
                        )
                        .map((t) => (
                          <Command.Item
                            value={t.id}
                            key={t.id}
                            onSelect={() =>
                              choose(t.object || { type: "task" })
                            }
                          >
                            {t.title}
                            <small>{t.date || "Backlog"}</small>
                          </Command.Item>
                        ))}
                    </Command.Group>
                    {["Jira", "Merge requests", "Repositories", "Wiki"].map(
                      (group) => (
                        <Command.Group key={group} heading={group}>
                          {results
                            .filter((o) => o.group === group)
                            .map((o, i) => (
                              <Command.Item
                                value={group + i}
                                key={i}
                                onSelect={() => choose(o)}
                              >
                                {o.title}
                              </Command.Item>
                            ))}
                        </Command.Group>
                      ),
                    )}
                    {!loading && !results.length && (
                      <p className="form-note">
                        No remote matches in the first result page.
                      </p>
                    )}
                  </>
                )}
              </Command.List>
              <footer>↑ ↓ Navigate · Enter Open preview · Esc Close</footer>
            </Command>
          )}
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
