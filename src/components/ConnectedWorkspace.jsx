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
import JiraProjectPicker from "./JiraProjectPicker";
import DailyWorkspace from "./DailyWorkspace";
import { MRLinks } from "./ConnectedObjects";
import { jiraScopes, jiraWorkspaceQuery, jiraFilterDefaults, jiraStatusChoices, jiraAssigneeChoices, jiraDeadlineChoices, nextAgilePage, requiredTransitionFields } from "../lib/jira-workspace.mjs";
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
      <button className="btn primary" onClick={() => onSettings(service)}>
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
    setBusy(true); setError(""); setOptions(null);
    try { setOptions(await invoke("jira.transitions", { key: issue.key })); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function apply(transition) {
    if (busy || requiredTransitionFields(transition).length) return;
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
      {options?.map(option => <div key={option.id}><button className="btn" disabled={busy || requiredTransitionFields(option).length > 0} onClick={() => apply(option)}>Apply {option.name}</button>
        {requiredTransitionFields(option).length > 0 && <small>{requiredTransitionFields(option).join(", ")} required. <button className="quiet-button" onClick={() => invoke("jira.openIssue", { key: issue.key }).catch(e => setError(e.message))}>Open in Jira</button></small>}</div>)}
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
  notificationPreferences,
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
    [query, setQuery] = useState("");
  const plan = usePlan();
  const requestId = useRef(0);
  const jiraControls = useRef(null);
  const issueTrigger = useRef(null);
  const [configAttempt, setConfigAttempt] = useState(0);
  const loadedPages = useRef(1);
  const appliedFilters = useRef({ query: "", jql: jiraWorkspaceQuery() });
  const [filterVersion, setFilterVersion] = useState(0);
  const lastView = useRef("");
  const [jiraFilters, setJiraFilters] = useState({ scope: view === "Sprint" ? "sprint" : "recent", project: "", search: "", status: "", assignee: "", deadline: "" });
  const appliedJiraFilters = useRef(jiraFilters);
  const [jiraProjects, setJiraProjects] = useState([]);
  const [jiraBoards, setJiraBoards] = useState([]), [jiraSprints, setJiraSprints] = useState([]),
    [jiraBoard, setJiraBoard] = useState(""), [jiraTarget, setJiraTarget] = useState(""),
    [boardMore, setBoardMore] = useState(null), [sprintMore, setSprintMore] = useState(null),
    [boardBusy, setBoardBusy] = useState(false), [sprintBusy, setSprintBusy] = useState(false),
    [scopeError, setScopeError] = useState(""), [scopeErrorSource, setScopeErrorSource] = useState("boards"), [requestedJiraScope, setRequestedJiraScope] = useState(null),
    [loadedJiraScopeLabel, setLoadedJiraScopeLabel] = useState(""), [requestedJiraScopeLabel, setRequestedJiraScopeLabel] = useState("");
  const sprintView = section === "Projects" && view === "Sprint";
  const boardRequest = useRef(0), sprintOptionsRequest = useRef(0), previousSprintProject = useRef("");
  const metadataScope = `${configVersion}:${configs?.jira?.url}:${jiraFilters.project}:${sprintView}`;
  const metadataScopeRef = useRef(metadataScope); metadataScopeRef.current = metadataScope;
  const scopeFilters = () => sprintView ? { boardId: jiraBoard, sprintId: jiraTarget === "backlog" ? "" : jiraTarget, backlog: jiraTarget === "backlog" } : {};
  const resultScopeMismatch = requestedJiraScope && JSON.stringify(requestedJiraScope) !== JSON.stringify(appliedFilters.current);
  const service =
    section === "Code" ? "gitlab" : section === "Docs" ? "confluence" : "jira";
  useEffect(() => {
    if (section !== "Projects") return;
    const dismiss = event => jiraControls.current?.querySelectorAll(".jira-project-lookup[open], .jira-visual-filters[open]").forEach(popover => {
      if (!popover.contains(event.target)) popover.open = false;
    });
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [section]);
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
    setError("");
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
  }, [configVersion, configAttempt]);
  useEffect(() => {
    if (section !== "Projects" || !selected) onContext?.("");
    setSnapshot(null);
    if (section !== "Projects") setSelected(null);
    setPage(null);
    if (lastView.current !== `${section}:${view}:${configVersion}`) { setItems([]); setNext(null); }
    const viewChanged = lastView.current !== `${section}:${view}:${configVersion}`;
    lastView.current = `${section}:${view}:${configVersion}`;
    if (viewChanged) loadedPages.current = 1;
    setQuery("");
    if (
      configs?.[service]?.tokenConfigured &&
      !["Home", "My Work"].includes(section)
    )
      if (section === "Projects") {
        const filters = { ...appliedJiraFilters.current, scope: viewChanged ? view === "Sprint" ? "sprint" : appliedJiraFilters.current.scope === "sprint" ? "recent" : appliedJiraFilters.current.scope : appliedJiraFilters.current.scope };
        appliedJiraFilters.current = filters;
        setJiraFilters(previous => ({ ...filters, search: previous.search }));
        const nextJql = jiraWorkspaceQuery({ ...filters, project: sprintView ? "" : filters.project, scopedSprint: sprintView });
        load(null, "", nextJql);
      } else load(null, "");
  }, [section, view, project, space, configs, jiraBoard, jiraTarget]);
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
    return () => { alive = false; };
  }, [configs, section]);
  useEffect(() => {
    if (!sprintView || !configs?.jira?.tokenConfigured) return;
    if (!jiraFilters.project && jiraProjects.length === 1) applyJiraFilters({ project: jiraProjects[0].key, scope: appliedJiraFilters.current.scope }, false);
  }, [sprintView, jiraProjects, jiraFilters.project, configs]);
  useEffect(() => {
    if (!sprintView || !configs?.jira?.tokenConfigured) { setBoardBusy(false); return; }
    if (previousSprintProject.current !== `${configVersion}:${configs?.jira?.url}:${jiraFilters.project}`) {
      previousSprintProject.current = `${configVersion}:${configs?.jira?.url}:${jiraFilters.project}`;
      setJiraBoard(""); setJiraTarget(""); setJiraSprints([]); setJiraBoards([]);
    }
    if (jiraFilters.project) readBoards();
    else { setBoardBusy(false); setBoardMore(null); }
    return () => { boardRequest.current++; };
  }, [sprintView, jiraFilters.project, configs]);
  useEffect(() => {
    if (!sprintView || !jiraBoard) { setSprintBusy(false); setSprintMore(null); return; }
    readSprints();
    return () => { sprintOptionsRequest.current++; };
  }, [sprintView, jiraBoard, configs]);
  async function readBoards(startAt = 0) {
    const ticket = ++boardRequest.current, scope = metadataScope;
    setBoardBusy(true); setScopeError(""); setScopeErrorSource("boards");
    try {
      const result = await invoke("jira.boards", { project: jiraFilters.project, startAt });
      if (ticket !== boardRequest.current || metadataScopeRef.current !== scope) return;
      const values = result.values || [];
      setJiraBoards(previous => startAt ? [...new Map([...previous, ...values].map(board => [board.id, board])).values()] : [...values, ...previous.filter(board => String(board.id) === jiraBoard && !values.some(value => value.id === board.id))]);
      setBoardMore(nextAgilePage(result));
      if (!startAt && !jiraBoard && values.length === 1 && result.isLast !== false) setJiraBoard(String(values[0].id));
    } catch (e) { if (ticket === boardRequest.current && metadataScopeRef.current === scope) setScopeError(e.message); }
    finally { if (ticket === boardRequest.current && metadataScopeRef.current === scope) setBoardBusy(false); }
  }
  async function readSprints(startAt = 0) {
    const ticket = ++sprintOptionsRequest.current, scope = metadataScope, board = jiraBoard;
    setSprintBusy(true); setScopeError(""); setScopeErrorSource("sprints");
    try {
      const result = await invoke("jira.sprints", { boardId: board, startAt });
      if (ticket !== sprintOptionsRequest.current || metadataScopeRef.current !== scope) return;
      const values = result.values || [];
      setJiraSprints(previous => startAt ? [...new Map([...previous, ...values].map(sprint => [sprint.id, sprint])).values()] : [...values, ...previous.filter(sprint => String(sprint.id) === jiraTarget && !values.some(value => value.id === sprint.id))]);
      setSprintMore(nextAgilePage(result));
      if (!jiraTarget && result.isLast !== false) {
        const active = values.filter(sprint => sprint.state === "active");
        if (active.length === 1) setJiraTarget(String(active[0].id));
        else if (values.length === 0) setJiraTarget("backlog");
      }
    } catch (e) { if (ticket === sprintOptionsRequest.current && metadataScopeRef.current === scope) setScopeError(e.message); }
    finally { if (ticket === sprintOptionsRequest.current && metadataScopeRef.current === scope) setSprintBusy(false); }
  }
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
      if (Object.hasOwn(filters, "boardId")) {
        if (!filters.boardId || (!filters.backlog && !filters.sprintId)) return { rows: [], more: null };
        data = await invoke(filters.backlog ? "jira.backlog" : "jira.sprintIssues", { boardId: filters.boardId,
          ...(!filters.backlog ? { sprintId: filters.sprintId } : {}), jql: filters.jql, nextPageToken: cursor || undefined });
      } else data = await invoke("jira.issues", { jql: filters.jql, nextPageToken: cursor || undefined });
      rows = data.issues; more = data.nextPageToken;
    }
    return { rows: rows || [], more: more || null };
  }
  async function load(cursor = null, searchQuery = query, queryOverride = appliedFilters.current.jql, scopeOverride = scopeFilters(), displayScope = null) {
    const ticket = ++requestId.current;
    const filters = cursor ? { ...appliedFilters.current } : { query: searchQuery, jql: queryOverride, ...scopeOverride };
    const scopeLabel = displayScope || (filters.boardId ? `${jiraBoards.find(board => String(board.id) === String(filters.boardId))?.name || `Board ${filters.boardId}`} / ${filters.backlog ? "Backlog" : jiraSprints.find(sprint => String(sprint.id) === String(filters.sprintId))?.name || `Sprint ${filters.sprintId}`}` : jiraFilters.project ? `Project ${jiraFilters.project}` : "All projects");
    if (!cursor && section === "Projects") { setRequestedJiraScope(filters); setRequestedJiraScopeLabel(scopeLabel); }
    if (!cursor) setFilterVersion(version => version + 1);
    setLoading(true);
    setError("");
    try {
      const { rows, more } = await fetchRows(cursor, filters);
      if (requestId.current === ticket) {
        if (!cursor) {
          appliedFilters.current = filters;
          if (section === "Projects") setLoadedJiraScopeLabel(scopeLabel);
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
    const filters = { ...jiraFilters, ...(changes.scope ? { status: "", assignee: "", deadline: "" } : {}), search: includeSearchDraft ? jiraFilters.search : appliedJiraFilters.current.search, ...changes };
    if (sprintView && filters.project !== jiraFilters.project) { setJiraBoard(""); setJiraTarget(""); setScopeError(""); }
    appliedJiraFilters.current = filters;
    const nextJql = jiraWorkspaceQuery({ ...filters, project: sprintView ? "" : filters.project, scopedSprint: sprintView });
    setJiraFilters(previous => ({ ...filters, search: includeSearchDraft ? filters.search : previous.search }));
    load(null, "", nextJql, sprintView && filters.project !== jiraFilters.project ? { boardId: "", sprintId: "", backlog: false } : scopeFilters());
  }
  function inspectIssue(issue) {
    issueTrigger.current = document.activeElement;
    setSelected(issue);
  }
  useEffect(() => {
    if (section !== "Projects" || !selected?.key) return;
    const frame = requestAnimationFrame(() => document.querySelector('.connected-workspace > .live-inspector [aria-label="Close live issue"]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [section, selected?.key]);
  function closeIssue() {
    setSelected(null); onContext?.("");
    requestAnimationFrame(() => {
      if (issueTrigger.current?.isConnected) issueTrigger.current.focus();
      else document.querySelector('.jira-issue-table .object-key')?.focus();
    });
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
      <div className="page connected-empty">
        <Plug size={28} /><h2>Your connections could not be loaded</h2>
        <p className="connection-error" role="alert">{error}</p>
        <p>Your work has not changed. Retry here or check your saved connections.</p>
        <div className="inline"><button className="btn primary" onClick={() => setConfigAttempt(value => value + 1)}>Retry connections</button>
        <button className="btn" onClick={() => onSettings(service)}>Integration settings</button></div>
      </div>
    ) : (
      <Pending />
    );
  if (["Home", "My Work"].includes(section))
    return (
      <DailyWorkspace
        configVersion={configVersion}
        notificationPreferences={notificationPreferences}
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
          : view === "Sprint" ? jiraTarget === "backlog" ? "Board backlog" : jiraSprints.find(sprint => String(sprint.id) === jiraTarget)?.name || "Sprint planning" : view === "Board" ? "Issue board" : view === "Roadmap" ? "Issue deadlines" : view === "Overview" ? "Project overview" : "Project issues";
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
          <div className="jira-filters" ref={jiraControls}>
            <form className="jira-quick-search" onSubmit={event => { event.preventDefault(); applyJiraFilters(); }}>
              <Search size={14} />
              <input aria-label="Find Jira issues" placeholder="Search issues or PAY-382…" value={jiraFilters.search}
                onChange={event => setJiraFilters(filters => ({ ...filters, search: event.target.value }))} />
              <button className="btn" disabled={loading}>Search issues</button>
            </form>
            <div className="jira-filter-controls">
              <JiraProjectPicker origin={configs.jira.url} configVersion={configVersion} value={jiraFilters.project}
                onChange={project => applyJiraFilters({ project }, false)} onProjects={setJiraProjects} sprintView={sprintView} />
              <label>Show <select aria-label="Jira work filter" value={jiraFilters.scope}
                onChange={event => applyJiraFilters({ scope: event.target.value }, false)}>
                {jiraScopes.map(scope => <option key={scope.id} value={scope.id}>{sprintView && scope.id === "sprint" ? "All scoped issues" : scope.label}</option>)}
              </select></label>
              <details className="jira-visual-filters" onKeyDown={event => {
                if (event.key === "Escape") { event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
              }}>
                <summary>Filters{[jiraFilters.status, jiraFilters.assignee, jiraFilters.deadline].filter(Boolean).length > 0 ? ` · ${[jiraFilters.status, jiraFilters.assignee, jiraFilters.deadline].filter(Boolean).length}` : ""}</summary>
                <div className="jira-filter-fields">
                  {[["status", "Status", jiraStatusChoices], ["assignee", "Assignee", jiraAssigneeChoices], ["deadline", "Deadline", jiraDeadlineChoices]].map(([key, label, choices]) => <label key={key}>{label}
                    <select aria-label={`Jira ${key} filter`} value={jiraFilters[key]} onChange={event => applyJiraFilters({ [key]: event.target.value }, false)}>
                      <option value="">{choices.find(choice => choice.id === jiraFilterDefaults(jiraFilters.scope)[key])?.label} · from view</option>
                      {choices.map(choice => <option value={choice.id} key={choice.id}>{choice.label}</option>)}
                    </select>
                  </label>)}
                  <small>Status groups include your project's custom workflow statuses.</small>
                </div>
              </details>
              <small aria-label="Jira result coverage">{items.length} loaded{next ? " · More available" : ""}{items.length > 0 && resultScopeMismatch ? " · Previous query results" : ""}</small>
              {requestedJiraScope && resultScopeMismatch && !loading && <button className="btn" onClick={() => load(null, "", requestedJiraScope.jql, requestedJiraScope, requestedJiraScopeLabel)}>Retry selected query</button>}
            </div>
            {sprintView && resultScopeMismatch && !loading && loadedJiraScopeLabel && <p className="jira-scope-mismatch" role="status">
              Showing previous results from <b>{loadedJiraScopeLabel}</b>. Selected scope <b>{requestedJiraScopeLabel}</b> has not loaded.
            </p>}
            {sprintView && <div className="jira-sprint-scope">
              <div className="jira-filter-controls">
                <label>Board <select aria-label="Jira planning board" value={jiraBoard} disabled={!jiraFilters.project || boardBusy}
                  onChange={event => { if (event.target.value === jiraBoard) return; setJiraBoard(event.target.value); setJiraTarget(""); setJiraSprints([]); setSprintMore(null); }}>
                  <option value="">{boardBusy ? "Loading boards…" : "Choose Scrum board"}</option>
                  {jiraBoards.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}
                </select></label>
                <label>Scope <select aria-label="Jira planning sprint" value={jiraTarget} disabled={!jiraBoard || sprintBusy}
                  onChange={event => setJiraTarget(event.target.value)}>
                  <option value="">{sprintBusy ? "Loading sprints…" : "Choose sprint or backlog"}</option>
                  <option value="backlog">Board backlog · outside active/future sprints</option>
                  {jiraSprints.map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name} · {sprint.state}</option>)}
                </select></label>
                {boardMore !== null && <button className="btn" disabled={boardBusy} onClick={() => readBoards(boardMore)}>Load more boards</button>}
                {sprintMore !== null && <button className="btn" disabled={sprintBusy} onClick={() => readSprints(sprintMore)}>Load more sprints</button>}
              </div>
              {scopeError && <div className="jira-filter-warning" role="alert">Planning options unavailable. {scopeError}
                <button className="btn" disabled={boardBusy || sprintBusy} onClick={() => scopeErrorSource === "sprints" ? readSprints() : readBoards()}>Retry planning options</button>
              </div>}
              {jiraTarget && <p>{jiraTarget === "backlog" ? "Jira board backlog" : (() => { const sprint = jiraSprints.find(sprint => String(sprint.id) === jiraTarget); return [sprint?.goal, sprint?.startDate && new Date(sprint.startDate).toLocaleDateString(), sprint?.endDate && `→ ${new Date(sprint.endDate).toLocaleDateString()}`].filter(Boolean).join(" · ") || "Selected Jira sprint"; })()}
                <span> · Show and search filters apply within this scope. Personal planning stays separate.</span></p>}
            </div>}
            <div className="jira-active-filters" aria-label="Selected Jira filters">
              {jiraFilters.scope !== (sprintView ? "sprint" : "recent") && <button className="jira-filter-chip" aria-label="Remove work view filter" onClick={() => applyJiraFilters({ scope: sprintView ? "sprint" : "recent", status: jiraFilters.status, assignee: jiraFilters.assignee, deadline: jiraFilters.deadline }, false)}>{jiraScopes.find(scope => scope.id === jiraFilters.scope)?.label}<X size={11} /></button>}
              {!sprintView && jiraFilters.project && <button className="jira-filter-chip" aria-label="Remove project filter" onClick={() => applyJiraFilters({ project: "" }, false)}>{jiraFilters.project}<X size={11} /></button>}
              {[["status", jiraStatusChoices], ["assignee", jiraAssigneeChoices], ["deadline", jiraDeadlineChoices]].map(([key, choices]) => jiraFilters[key] && <button key={key} className="jira-filter-chip" aria-label={`Remove ${key} filter`} onClick={() => applyJiraFilters({ [key]: "" }, false)}>{choices.find(choice => choice.id === jiraFilters[key])?.label}<X size={11} /></button>)}
              {appliedJiraFilters.current.search && <button className="jira-filter-chip" aria-label="Clear issue search" onClick={() => applyJiraFilters({ search: "" })}>Search: {appliedJiraFilters.current.search}<X size={11} /></button>}
              {(jiraFilters.scope !== (sprintView ? "sprint" : "recent") || (!sprintView && jiraFilters.project) || appliedJiraFilters.current.search || jiraFilters.status || jiraFilters.assignee || jiraFilters.deadline) && <button className="quiet-button" onClick={() => applyJiraFilters({ scope: sprintView ? "sprint" : "recent", project: sprintView ? jiraFilters.project : "", search: "", status: "", assignee: "", deadline: "" })}>Clear filters</button>}
            </div>
          </div>
        ) : null}
        {error && (
          <div className="connection-error" role="alert">
            {error}
          </div>
        )}
        {loading && <Pending />}
        {section === "Projects" && view !== "Issues" && !items.length && !loading && <div className="connected-empty">
          <h3>{view === "Sprint" ? !jiraFilters.project ? "Choose a project to plan its sprint" : !jiraBoard ? "Choose a Scrum board" : !jiraTarget ? "Choose an active/future sprint or board backlog" : "No issues in this planning scope" : "No matching Jira issues"}</h3>
          <p>{view === "Sprint" ? "Board and sprint define the work to plan. Show and search narrow that scope." : "Try another project or work filter, or clear your search."}</p>
          <button className="btn" onClick={() => applyJiraFilters({ scope: view === "Sprint" ? "sprint" : "recent", project: sprintView ? jiraFilters.project : "", search: "", status: "", assignee: "", deadline: "" })}>Reset issue filters</button>
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
                      items.filter((i) => (i.fields.status?.name || "Unknown") === status)
                        .length
                    }
                  </span>
                </h3>
                {items
                  .filter((i) => (i.fields.status?.name || "Unknown") === status)
                  .map((i) => (
                    <button
                      className="live-board-card"
                      key={i.key}
                      onClick={() => inspectIssue(i)}
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
                <button key={i.key} onClick={() => inspectIssue(i)}>
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
                    <button key={i.key} onClick={() => inspectIssue(i)}>
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
                        onClick={() => inspectIssue(i)}
                      >
                        {i.key}
                      </button>
                    </td>
                    <td>
                      <button onClick={() => inspectIssue(i)}>
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
                <button className="btn" onClick={() => applyJiraFilters({ scope: view === "Sprint" ? "sprint" : "recent", project: sprintView ? jiraFilters.project : "", search: "", status: "", assignee: "", deadline: "" })}>Reset issue filters</button>
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
              {resultScopeMismatch ? `Issues from the previous loaded scope (${loadedJiraScopeLabel}). ` : view === "Sprint" && jiraFilters.scope === "sprint" ? jiraTarget === "backlog" ? "Issues in the selected board backlog. " : "Issues in the selected sprint. " : "Issues from the current filter. "}
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
          onClose={closeIssue}
          onChanged={() => sync.run()}
          onContext={onContext}
        />
      )}
    </div>
  );
}
export { default as ConnectedAssistant } from "./ConnectedAssistant";
