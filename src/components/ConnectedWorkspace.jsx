import React, { useEffect, useRef, useState } from "react";
import DocumentReader from "./DocumentReader";
import { useAutoSync } from "../lib/use-auto-sync";
import SyncStatus from "./SyncStatus";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  FileText,
  GitPullRequest,
  Loader2,
  Plug,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { invoke, isDesktop } from "../lib/integration-client";
import SyncedReview from "./SyncedReview";
import JiraIssue from "./LiveIssue";
import DailyWorkspace from "./DailyWorkspace";
import { MRLinks } from "./ConnectedObjects";
import { jiraScopes, jiraWorkspaceQuery } from "../lib/jira-workspace.mjs";
import "../jira-workflow.css";
import {
  usePlan,
  objectKey,
  favoriteObject,
  rememberObject,
  updateTask,
  dayKey,
  shiftDay,
} from "../lib/planning";
function Pending() {
  return (
    <div className="connected-loading">
      <Loader2 size={23} className="spin" /> Loading connected work…
    </div>
  );
}
function Missing({ service, onSettings }) {
  return (
    <div className="connected-empty">
      <Plug size={32} />
      <h2>Connect {({ jira: "Jira", gitlab: "GitLab", confluence: "Confluence" })[service] || service}</h2>
      <p>Add your service URL and token, then test the connection.</p>
      <button className="btn primary" onClick={onSettings}>
        Open integration settings
      </button>
    </div>
  );
}
function IssueStatus({ issue, onChanged }) {
  const popup = useRef(null);
  const [options, setOptions] = useState(null), [busy, setBusy] = useState(false),
    [error, setError] = useState(""), [position, setPosition] = useState({}), [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened) return;
    const close = event => {
      if (event.type === "pointerdown" && popup.current?.contains(event.target)) return;
      if (event.type === "scroll" && event.target?.closest?.(".jira-status-options")) return;
      if (popup.current) popup.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [opened]);
  async function read() {
    setOpened(Boolean(popup.current?.open));
    if (!popup.current?.open) return;
    const bounds = popup.current.querySelector("summary").getBoundingClientRect();
    setPosition({ left: Math.min(bounds.left, window.innerWidth - 230), top: Math.min(bounds.bottom + 7, window.innerHeight - 180) });
    if (busy) return;
    setBusy(true); setError("");
    try { setOptions(await invoke("jira.transitions", { key: issue.key })); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function apply(transition) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await invoke("jira.transition", { key: issue.key, transitionId: transition.id });
      if (popup.current) popup.current.open = false;
      setOptions(null); onChanged?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <details ref={popup} className="jira-status-popover" onToggle={read}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); popup.current.open = false; popup.current.querySelector("summary")?.focus(); } }}>
    <summary aria-label={`Change status of ${issue.key}`}><span className="pill">{issue.fields.status?.name || "Unknown"}</span></summary>
    <div className="jira-status-options" style={position} aria-label={`Status options for ${issue.key}`}>
      <b>{issue.key} · Change in Jira</b>
      {busy && <small role="status">Loading…</small>}
      {options?.map(option => <button className="btn" key={option.id} disabled={busy} onClick={() => apply(option)}>Apply {option.name}</button>)}
      {options?.length === 0 && <small>No transitions available for this issue.</small>}
      {error && <><small role="alert">{error}</small><button className="btn" disabled={busy} onClick={read}>Retry status options</button></>}
    </div>
  </details>;
}
export default function ConnectedWorkspace({
  section,
  view,
  onSettings,
  onNavigate,
  onContext,
  configVersion,
  onOpen,
  focusDate,
  focusTaskId,
  focusRequestId,
  onReviewPendingChange,
}) {
  const [reviewPending, setReviewPending] = useState("");
  const [configs, setConfigs] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [items, setItems] = useState([]),
    [next, setNext] = useState(null),
    [selected, setSelected] = useState(null),
    [snapshot, setSnapshot] = useState(null),
    [page, setPage] = useState(null),
    [spaces, setSpaces] = useState([]),
    [space, setSpace] = useState(""),
    [project, setProject] = useState(""),
    [projects, setProjects] = useState([]),
    [query, setQuery] = useState(""),
    [jql, setJql] = useState(
      section === "My Work"
        ? "assignee = currentUser() ORDER BY updated DESC"
        : "updated >= -30d ORDER BY updated DESC",
    );
  const plan = usePlan();
  const requestId = useRef(0);
  const loadedPages = useRef(1);
  const appliedFilters = useRef({ query: "", jql });
  const [filterVersion, setFilterVersion] = useState(0);
  const [jiraFilters, setJiraFilters] = useState({ scope: view === "Sprint" ? "sprint" : "recent", project: "", search: "" });
  const appliedJiraFilters = useRef(jiraFilters);
  const [jiraProjects, setJiraProjects] = useState([]), [jiraProjectError, setJiraProjectError] = useState(""),
    [customJql, setCustomJql] = useState(false), [requestedJiraQuery, setRequestedJiraQuery] = useState("");
  const service =
    section === "Code" ? "gitlab" : section === "Docs" ? "confluence" : "jira";
  const savedDocsView = section === "Docs" && ["Recent", "Favorites"].includes(view);
  const savedPages = (view === "Recent" ? plan.recent : plan.favorites)
    .filter((object) => object.type === "doc" && object.origin === configs?.confluence?.url)
    .map((object) => ({ id: object.id, title: object.title }));
  const visiblePages = savedDocsView
    ? savedPages.filter((object) => !query.trim() || object.title.toLowerCase() === query.trim().toLowerCase())
    : items;
  const sync = useAutoSync({
    key: `workspace:${configVersion}:${service}:${section}:${view}:${project}:${space}:${filterVersion}`,
    services: [service],
    enabled: Boolean(configs?.[service]?.tokenConfigured) && !["Home", "My Work"].includes(section) && !snapshot && !loading,
    refresh: async (isCurrent) => {
      const ticket = requestId.current;
      const filters = { ...appliedFilters.current };
      let cursor = null, merged = [], more = null;
      for (let index = 0; index < loadedPages.current; index++) {
        const result = await fetchRows(cursor, filters);
        if (!isCurrent() || requestId.current !== ticket) return;
        merged.push(...result.rows);
        more = result.more;
        if (!more) break;
        cursor = more;
      }
      if (!isCurrent() || requestId.current !== ticket) return;
      setItems([...new Map(merged.map(row => [row.id || row.key, row])).values()]);
      setNext(more);
      setError("");
      if (section === "Docs" && selected) {
        const refreshed = await invoke("confluence.page", { id: selected });
        if (!isCurrent() || requestId.current !== ticket) return;
        setPage(refreshed);
        onContext?.(JSON.stringify({ type: "doc", id: refreshed.id, origin: configs.confluence.url,
          title: refreshed.title, body: refreshed.body?.storage?.value?.slice(0, 16000) }));
      }
      if (section === "Docs") {
        const metadata = await invoke("confluence.spaces");
        if (isCurrent() && requestId.current === ticket) setSpaces(metadata.results || []);
      } else if (section === "Code") {
        const metadata = await invoke("gitlab.projects", {});
        if (isCurrent() && requestId.current === ticket) setProjects(metadata.items || []);
      }
    },
  });
  useEffect(() => {
    let alive = true;
    if (isDesktop())
      invoke("config.list")
        .then((c) => {
          if (alive) setConfigs(c);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    else setConfigs({});
    return () => {
      alive = false;
      requestId.current++;
    };
  }, [configVersion]);
  useEffect(() => {
    if (section !== "Projects" || !selected) onContext?.("");
    setSnapshot(null);
    if (section !== "Projects") setSelected(null);
    setPage(null);
    setItems([]);
    setNext(null);
    loadedPages.current = 1;
    setQuery("");
    if (
      configs?.[service]?.tokenConfigured &&
      !["Home", "My Work"].includes(section)
    )
      if (section === "Projects") {
        const filters = { ...appliedJiraFilters.current, scope: view === "Sprint" ? "sprint" : appliedJiraFilters.current.scope === "sprint" ? "recent" : appliedJiraFilters.current.scope };
        appliedJiraFilters.current = filters;
        setJiraFilters(previous => ({ ...filters, search: previous.search }));
        const nextJql = customJql ? appliedFilters.current.jql : jiraWorkspaceQuery(filters);
        if (!customJql) setJql(nextJql);
        load(null, "", nextJql);
      } else load(null, "");
  }, [section, view, project, space, configs]);
  useEffect(() => {
    let alive = true;
    if (configs?.confluence?.tokenConfigured && section === "Docs")
      invoke("confluence.spaces")
        .then(d => { if (alive) setSpaces(d.results || []); })
        .catch(e => { if (alive) setError(e.message); });
    if (configs?.gitlab?.tokenConfigured && section === "Code")
      invoke("gitlab.projects", {})
        .then(d => { if (alive) setProjects(d.items || []); })
        .catch(e => { if (alive) setError(e.message); });
    if (configs?.jira?.tokenConfigured && section === "Projects")
      invoke("jira.projects")
        .then(d => { if (alive) { setJiraProjects(d.values || []); setJiraProjectError(""); } })
        .catch(e => { if (alive) setJiraProjectError(e.message); });
    return () => { alive = false; };
  }, [configs, section]);
  async function fetchRows(cursor, filters) {
    let data, rows, more;
    if (section === "Code") {
      if (view === "Repositories") {
        data = await invoke("gitlab.projects", { page: cursor || 1, search: filters.query });
        rows = data.items; more = data.nextPage;
      } else if (view === "Pipelines") {
        rows = project ? await invoke("gitlab.pipelines", { projectId: project }) : [];
      } else {
        data = await invoke("gitlab.mrs", { projectId: project || undefined,
          mine: view === "My Reviews", page: cursor || 1 });
        rows = data.items; more = data.nextPage;
      }
    } else if (section === "Docs") {
      if (savedDocsView) rows = savedPages;
      else {
        data = await invoke("confluence.pages", { spaceId: space || undefined,
          cursor: cursor || undefined, title: filters.query || undefined });
        rows = data.results; more = data.nextCursor;
      }
    } else {
      data = await invoke("jira.issues", { jql: filters.jql, nextPageToken: cursor || undefined });
      rows = data.issues; more = data.nextPageToken;
    }
    return { rows: rows || [], more: more || null };
  }
  async function load(cursor = null, searchQuery = query, queryOverride = jql) {
    const ticket = ++requestId.current;
    const filters = cursor ? { ...appliedFilters.current } : { query: searchQuery, jql: queryOverride };
    if (!cursor && section === "Projects") setRequestedJiraQuery(filters.jql);
    if (!cursor) setFilterVersion(version => version + 1);
    setLoading(true);
    setError("");
    try {
      const { rows, more } = await fetchRows(cursor, filters);
      if (requestId.current === ticket) {
        if (!cursor) {
          appliedFilters.current = filters;
          loadedPages.current = 1;
        }
        setItems(old => cursor ? [...new Map([...old, ...rows].map(row => [row.id || row.key, row])).values()] : rows);
        setNext(more);
        if (cursor) loadedPages.current++;
        sync.markSynced();
      }
    } catch (e) {
      if (requestId.current === ticket) setError(e.message);
    } finally {
      if (requestId.current === ticket) setLoading(false);
    }
  }
  function applyJiraFilters(changes = {}, includeSearchDraft = true) {
    const filters = { ...jiraFilters, search: includeSearchDraft ? jiraFilters.search : appliedJiraFilters.current.search, ...changes };
    appliedJiraFilters.current = filters;
    const nextJql = jiraWorkspaceQuery(filters);
    setJiraFilters(previous => ({ ...filters, search: includeSearchDraft ? filters.search : previous.search })); setCustomJql(false); setJql(nextJql);
    load(null, "", nextJql);
  }
  async function openMR(mr, refresh = false) {
    const ticket = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const data = await invoke("gitlab.mr", {
        projectId: mr.project_id,
        iid: mr.iid,
        refresh,
      });
      if (requestId.current === ticket) setSnapshot(data);
    } catch (e) {
      if (requestId.current === ticket) setError(e.message);
    } finally {
      if (requestId.current === ticket) setLoading(false);
    }
  }
  async function openPage(item) {
    const ticket = ++requestId.current;
    setSelected(item.id);
    onContext?.("");
    setPage(null);
    setLoading(true);
    setError("");
    try {
      const data = await invoke("confluence.page", { id: item.id });
      if (requestId.current === ticket) {
        setPage(data);
        rememberObject({
          type: "doc",
          id: data.id,
          title: data.title,
          origin: configs.confluence.url,
        });
        onContext?.(
          JSON.stringify({
            type: "doc",
            id: data.id,
            origin: configs.confluence.url,
            title: data.title,
            body: data.body?.storage?.value?.slice(0, 16000),
          }),
        );
      }
    } catch (e) {
      if (requestId.current === ticket) setError(e.message);
    } finally {
      if (requestId.current === ticket) setLoading(false);
    }
  }
  if (!configs)
    return error ? (
      <div className="page connection-error" role="alert">
        {error}
      </div>
    ) : (
      <Pending />
    );
  if (["Home", "My Work"].includes(section))
    return (
      <DailyWorkspace
        configVersion={configVersion}
        section={section}
        view={view}
        configs={configs}
        onOpen={onOpen}
        onNavigate={onNavigate}
        onSettings={onSettings}
        focusDate={focusDate}
        focusTaskId={focusTaskId}
        focusRequestId={focusRequestId}
      />
    );
  if (!configs[service]?.tokenConfigured)
    return <Missing service={service} onSettings={onSettings} />;
  if (snapshot && section === "Code")
    return (
      <div className="context-mr">
        <MRLinks
          mr={snapshot.mr}
          pending={!!reviewPending}
          origin={configs.gitlab?.url}
          onOpen={onOpen}
        />
        <SyncedReview
          key={`${snapshot.mr.project_id}:${snapshot.mr.iid}`}
          snapshot={snapshot}
          onPendingChange={(pending) => { setReviewPending(pending); onReviewPendingChange?.(pending); }}
          externalError={error}
          onSynchronized={() => setError("")}
          refreshing={loading}
          live
          onBack={() => {
            if (reviewPending) return;
            requestId.current++;
            setLoading(false);
            setError("");
            setSnapshot(null);
            onContext?.("");
          }}
          onRefresh={() => openMR(snapshot.mr, true)}
          onContext={onContext}
        />
      </div>
    );
  const title =
    section === "Docs"
      ? "Confluence wiki"
      : section === "Code"
        ? view
        : section === "My Work"
          ? "My Jira issues"
          : view === "Sprint" ? "Active sprint" : view === "Board" ? "Issue board" : view === "Roadmap" ? "Issue deadlines" : view === "Overview" ? "Project overview" : "Project issues";
  return (
    <div
      className={`connected-workspace ${selected && section !== "Docs" ? "has-selection" : ""}`}
    >
      <div className="connected-content">
        <header className="page-heading">
          <div>
            <h1>{title}</h1>
            <p>{configs[service].url} · Live data</p>
          </div>
          <div className="inline">
            <SyncStatus sync={sync} />
            <button className="btn" disabled={loading || sync.syncing} onClick={() => sync.run()}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </header>
        {section === "Code" && (
          <div className="view-toolbar">
            <label>
              Repository{" "}
              <select
                aria-label="GitLab repository"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">All repositories</option>
                {projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.path_with_namespace || p.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="muted">
              {items.length} loaded{next ? " · More available" : ""}
            </span>
          </div>
        )}
        {section === "Docs" ? (
          <div className="view-toolbar">
            <select
              aria-label="Confluence space"
              value={space}
              onChange={(e) => setSpace(e.target.value)}
            >
              <option value="">All spaces</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <form
              className="search-field"
              onSubmit={(e) => {
                e.preventDefault();
                load();
              }}
            >
              <Search size={14} />
              <input
                aria-label="Find Confluence page"
                placeholder="Exact page title…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="btn">Search</button>
            </form>
          </div>
        ) : section !== "Code" ? (
          <div className="jira-filters">
            <form className="jira-quick-search" onSubmit={event => { event.preventDefault(); applyJiraFilters(); }}>
              <Search size={14} />
              <input aria-label="Find Jira issues" placeholder="Search issues or PAY-382…" value={jiraFilters.search}
                onChange={event => setJiraFilters(filters => ({ ...filters, search: event.target.value }))} />
              <button className="btn" disabled={loading}>Search issues</button>
            </form>
            <div className="jira-filter-controls">
              <label>Project <select aria-label="Jira project filter" value={jiraFilters.project}
                onChange={event => applyJiraFilters({ project: event.target.value }, false)}>
                <option value="">All projects</option>
                {jiraProjects.map(project => <option key={project.id || project.key} value={project.key}>{project.key} · {project.name}</option>)}
              </select></label>
              <label>Show <select aria-label="Jira work filter" value={customJql ? "custom" : jiraFilters.scope}
                onChange={event => applyJiraFilters({ scope: event.target.value }, false)}>
                {customJql && <option value="custom">Custom JQL</option>}
                {jiraScopes.map(scope => <option key={scope.id} value={scope.id}>{scope.label}</option>)}
              </select></label>
              <small aria-label="Jira result coverage">{items.length} loaded{next ? " · More available" : ""}{items.length > 0 && requestedJiraQuery !== appliedFilters.current.jql ? " · Previous query results" : ""}</small>
              {requestedJiraQuery && requestedJiraQuery !== appliedFilters.current.jql && !loading && <button className="btn" onClick={() => load(null, "", requestedJiraQuery)}>Retry selected query</button>}
            </div>
            {jiraProjectError && <small className="jira-filter-warning" role="status">Project list unavailable. Search and JQL still work.</small>}
            {jiraProjects.length >= 50 && <small className="jira-filter-warning">Showing up to 50 accessible projects. Use JQL for a project not listed here.</small>}
            <details className="jira-advanced"><summary>Advanced JQL{customJql ? " · Custom filter" : ""}</summary><form
            className="jql-search"
            onSubmit={(e) => {
              e.preventDefault();
              setCustomJql(true);
              load();
            }}
          >
            <label>
              JQL
              <input
                aria-label="Jira query"
                value={jql}
                onChange={(e) => setJql(e.target.value)}
              />
            </label>
            <button className="btn" disabled={loading}>
              Run query
            </button>
          </form></details>
          </div>
        ) : null}
        {error && (
          <div className="connection-error" role="alert">
            {error}
          </div>
        )}
        {loading && <Pending />}
        {section === "Projects" && view !== "Issues" && !items.length && !loading && <div className="connected-empty">
          <h3>{view === "Sprint" ? "No issues in this sprint filter" : "No matching Jira issues"}</h3>
          <p>{view === "Sprint" ? "Check that your project has an active sprint, or choose another work filter." : "Try another project or work filter, or clear your search."}</p>
          <button className="btn" onClick={() => applyJiraFilters({ scope: view === "Sprint" ? "sprint" : "recent", project: "", search: "" })}>Reset issue filters</button>
        </div>}
        {section === "Docs" && view === "Spaces" ? (
          <div className="wiki-spaces">
            {spaces.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSpace(String(s.id));
                  onNavigate("Docs", "Home");
                }}
              >
                <BookOpen size={20} />
                <b>{s.name}</b>
                <small>{s.key || s.id}</small>
              </button>
            ))}
          </div>
        ) : section === "Docs" ? (
          <div className="connected-docs">
            <aside>
              {visiblePages.map((p) => (
                <button
                  key={p.id}
                  className={selected === p.id ? "active" : ""}
                  onClick={() => openPage(p)}
                >
                  <FileText size={14} />
                  {p.title}
                </button>
              ))}
              {!visiblePages.length && !loading && (
                <p className="muted">No pages found.</p>
              )}
            </aside>
            <article>
              {page ? (
                <>
                  <span className="pill">
                    Confluence · v{page.version?.number}
                  </span>
                  <div className="inline">
                    <h1>{page.title}</h1>
                    <button
                      className="btn"
                      onClick={() => {
                        try {
                          favoriteObject({
                            type: "doc",
                            id: page.id,
                            title: page.title,
                            origin: configs.confluence.url,
                          });
                        } catch (error) {
                          setError(error.message);
                        }
                      }}
                    >
                      {plan.favorites.some(
                        (o) =>
                          o.id === page.id &&
                          o.origin === configs.confluence.url,
                      )
                        ? "Remove favorite"
                        : "Favorite"}
                    </button>
                  </div>
                  <DocumentReader key={page.id} html={page.body?.storage?.value} onOpen={onOpen}
                    jiraOrigin={configs.jira?.url} jiraConfigured={configs.jira?.tokenConfigured} />
                </>
              ) : (
                <div className="connected-empty">
                  <BookOpen size={28} />
                  <h2>Select a page</h2>
                  <p>Choose a page to read it here.</p>
                </div>
              )}
            </article>
          </div>
        ) : section === "Code" ? (
          <div className="connected-table table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    {view === "Repositories"
                      ? "Repository"
                      : view === "Pipelines"
                        ? "Pipeline"
                        : "Merge request"}
                  </th>
                  <th>Author / Ref</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <button
                        className="connected-object"
                        onClick={() => {
                          if (view === "Repositories") {
                            setProject(String(m.id));
                            onNavigate("Code", "Merge Requests");
                          } else if (view === "Pipelines")
                            onOpen({
                              type: "pipeline",
                              projectId: project,
                              id: m.id,
                              title: `Pipeline #${m.id}`,
                              origin: configs.gitlab.url,
                            });
                          else openMR(m);
                        }}
                      >
                        <GitPullRequest size={15} />
                        <span>
                          <b>
                            {m.title || m.path_with_namespace || `#${m.id}`}
                          </b>
                          <small>
                            {m.iid
                              ? "!" + m.iid
                              : m.description || m.sha?.slice(0, 8)}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>{m.author?.name || m.ref || "—"}</td>
                    <td>
                      <span className="pill">
                        {m.state || m.status || m.visibility}
                      </span>
                    </td>
                    <td>
                      {m.updated_at
                        ? new Date(m.updated_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && !loading && (
              <div className="connected-empty">
                <h3>
                  {view === "Pipelines" && !project
                    ? "Choose a repository to see pipelines"
                    : "No results"}
                </h3>
                <p>Browse your accessible repositories and open merge requests.</p>
              </div>
            )}
          </div>
        ) : ["Board", "Sprint"].includes(view) ? (
          <div className="live-board">
            {[
              ...new Set(items.map((i) => i.fields.status?.name || "Unknown")),
            ].map((status) => (
              <section key={status}>
                <h3>
                  {status}{" "}
                  <span className="pill">
                    {
                      items.filter((i) => i.fields.status?.name === status)
                        .length
                    }
                  </span>
                </h3>
                {items
                  .filter((i) => i.fields.status?.name === status)
                  .map((i) => (
                    <button
                      className="live-board-card"
                      key={i.key}
                      onClick={() => setSelected(i)}
                    >
                      <code>{i.key}</code>
                      <b>{i.fields.summary}</b>
                      <small>
                        {i.fields.assignee?.displayName || "Unassigned"} ·{" "}
                        {i.fields.priority?.name || "—"}
                      </small>
                      {i.fields.duedate && <small>Due {i.fields.duedate}</small>}
                    </button>
                  ))}
              </section>
            ))}
          </div>
        ) : view === "Roadmap" ? (
          <div className="live-roadmap">
            {[...items]
              .sort((a, b) =>
                (a.fields.duedate || "9999").localeCompare(
                  b.fields.duedate || "9999",
                ),
              )
              .map((i) => (
                <button key={i.key} onClick={() => setSelected(i)}>
                  <time>{i.fields.duedate || "Unscheduled"}</time>
                  <code>{i.key}</code>
                  <b>{i.fields.summary}</b>
                  <span className="pill">{i.fields.status?.name}</span>
                </button>
              ))}
          </div>
        ) : view === "Overview" ? (
          <div className="live-projects">
            {[
              ...new Set(items.map((i) => i.fields.project?.key || "Project")),
            ].map((key) => (
              <section key={key}>
                <h2>{key}</h2>
                {items
                  .filter((i) => (i.fields.project?.key || "Project") === key)
                  .map((i) => (
                    <button key={i.key} onClick={() => setSelected(i)}>
                      <code>{i.key}</code> {i.fields.summary}{" "}
                      <span className="pill">{i.fields.status?.name}</span>
                    </button>
                  ))}
              </section>
            ))}
          </div>
        ) : (
          <div className="table-wrap jira-issue-table">
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Issue</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr
                    key={i.id}
                    className={selected?.key === i.key ? "selected-row" : ""}
                  >
                    <td>
                      <button
                        className="object-key"
                        onClick={() => setSelected(i)}
                      >
                        {i.key}
                      </button>
                    </td>
                    <td>
                      <button onClick={() => setSelected(i)}>
                        {i.fields.summary}
                      </button>
                    </td>
                    <td>
                      <IssueStatus issue={i} onChanged={() => sync.run()} />
                    </td>
                    <td>{i.fields.assignee?.displayName || "Unassigned"}</td>
                    <td>{i.fields.priority?.name || "—"}</td>
                    <td><time className="jira-due" dateTime={i.fields.duedate || undefined}>{i.fields.duedate || "—"}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && !loading && (
              <div className="connected-empty">
                <h3>No matching Jira issues</h3>
                <p>Try another project or work filter, or clear your search.</p>
                <button className="btn" onClick={() => applyJiraFilters({ scope: view === "Sprint" ? "sprint" : "recent", project: "", search: "" })}>Reset issue filters</button>
              </div>
            )}
          </div>
        )}
        {next && (
          <button
            className="btn load-more"
            disabled={loading}
            onClick={() => load(next)}
          >
            Load more
          </button>
        )}
        {section !== "Code" &&
          section !== "Docs" &&
          view !== "Issues" &&
          view !== "Today" && (
            <p className="live-mode-note">
              {view === "Sprint" && !customJql && jiraFilters.scope === "sprint" ? "Issues in active sprints. " : "Issues from the current filter. "}
              {next ? "These counts cover loaded issues; load more for the remaining results. " : ""}
              {view === "Roadmap" ? "Ordered by issue due date; this is a deadline view." : "Open an issue for details and linked work."}
            </p>
          )}
      </div>
      {selected && section !== "Docs" && section !== "Code" && (
        <JiraIssue
          key={selected.key}
          item={selected}
          origin={configs.jira?.url}
          onOpen={onOpen}
          configs={configs}
          onClose={() => { setSelected(null); onContext?.(""); }}
          onChanged={() => sync.run()}
          onContext={onContext}
        />
      )}
    </div>
  );
}
export { default as ConnectedAssistant } from "./ConnectedAssistant";
