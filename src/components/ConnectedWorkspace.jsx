import React, { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
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
import ReviewWorkbench from "./ReviewWorkbench";
import JiraIssue from "./LiveIssue";
import DailyWorkspace from "./DailyWorkspace";
import { MRLinks } from "./ConnectedObjects";
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
      <Loader2 size={23} className="spin" /> 실제 서비스에서 불러오는 중…
    </div>
  );
}
function Missing({ service, onSettings }) {
  return (
    <div className="connected-empty">
      <Plug size={32} />
      <h2>{service} 연결이 필요합니다</h2>
      <p>서비스 주소와 토큰을 저장한 뒤 연결을 확인하세요.</p>
      <button className="btn primary" onClick={onSettings}>
        Open integration settings
      </button>
    </div>
  );
}
export default function ConnectedWorkspace({
  section,
  view,
  onSettings,
  onNavigate,
  onContext,
  configVersion,
  onOpen,
}) {
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
  const service =
    section === "Code" ? "gitlab" : section === "Docs" ? "confluence" : "jira";
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
    onContext?.("");
    setSnapshot(null);
    setSelected(null);
    setPage(null);
    setItems([]);
    setNext(null);
    setQuery("");
    if (
      configs?.[service]?.tokenConfigured &&
      !["Home", "My Work"].includes(section)
    )
      load();
  }, [section, view, project, space, configs]);
  useEffect(() => {
    if (configs?.confluence?.tokenConfigured && section === "Docs")
      invoke("confluence.spaces")
        .then((d) => setSpaces(d.results || []))
        .catch((e) => setError(e.message));
    if (configs?.gitlab?.tokenConfigured && section === "Code")
      invoke("gitlab.projects", {})
        .then((d) => setProjects(d.items || []))
        .catch((e) => setError(e.message));
  }, [configs, section]);
  async function load(cursor = null) {
    const ticket = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      let data, rows, more;
      if (section === "Code") {
        if (view === "Repositories") {
          data = await invoke("gitlab.projects", {
            page: cursor || 1,
            search: query,
          });
          rows = data.items;
          more = data.nextPage;
        } else if (view === "Pipelines") {
          if (!project) {
            setItems([]);
            return;
          }
          rows = await invoke("gitlab.pipelines", { projectId: project });
        } else {
          data = await invoke("gitlab.mrs", {
            projectId: project || undefined,
            mine: view === "My Reviews",
            page: cursor || 1,
          });
          rows = data.items;
          more = data.nextPage;
        }
      } else if (section === "Docs") {
        data = await invoke("confluence.pages", {
          spaceId: space || undefined,
          cursor: cursor || undefined,
          title: query || undefined,
        });
        rows = data.results;
        if (view === "Recent" || view === "Favorites") {
          rows = (view === "Recent" ? plan.recent : plan.favorites)
            .filter(
              (o) => o.type === "doc" && o.origin === configs.confluence.url,
            )
            .map((o) => ({ id: o.id, title: o.title }));
        }
        more =
          view === "Recent" || view === "Favorites" ? null : data.nextCursor;
      } else {
        data = await invoke("jira.issues", {
          jql,
          nextPageToken: cursor || undefined,
        });
        rows = data.issues;
        more = data.nextPageToken;
      }
      if (requestId.current === ticket) {
        setItems((old) => (cursor ? [...old, ...(rows || [])] : rows || []));
        setNext(more || null);
      }
    } catch (e) {
      if (requestId.current === ticket) setError(e.message);
    } finally {
      if (requestId.current === ticket) setLoading(false);
    }
  }
  async function openMR(mr) {
    const ticket = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const data = await invoke("gitlab.mr", {
        projectId: mr.project_id,
        iid: mr.iid,
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
        section={section}
        view={view}
        configs={configs}
        onOpen={onOpen}
        onNavigate={onNavigate}
        onSettings={onSettings}
      />
    );
  if (!configs[service]?.tokenConfigured)
    return <Missing service={service} onSettings={onSettings} />;
  if (snapshot && section === "Code")
    return (
      <div className="context-mr">
        <MRLinks
          mr={snapshot.mr}
          origin={configs.gitlab?.url}
          onOpen={onOpen}
        />
        <ReviewWorkbench
          key={`${snapshot.mr.project_id}:${snapshot.mr.iid}:${snapshot.mr.diff_refs.head_sha}`}
          snapshot={snapshot}
          externalError={error}
          refreshing={loading}
          live
          onBack={() => {
            setSnapshot(null);
            onContext?.("");
          }}
          onRefresh={() => openMR(snapshot.mr)}
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
          : "Project issues";
  const cleanHtml = page
    ? DOMPurify.sanitize(page.body?.storage?.value || "", {
        USE_PROFILES: { html: true },
        FORBID_TAGS: [
          "img",
          "iframe",
          "form",
          "input",
          "style",
          "video",
          "audio",
          "source",
          "link",
        ],
        FORBID_ATTR: ["style", "src", "srcset", "href", "action"],
      })
    : "";
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
          <button className="btn" disabled={loading} onClick={() => load()}>
            <RefreshCw size={13} /> Refresh
          </button>
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
          <form
            className="jql-search"
            onSubmit={(e) => {
              e.preventDefault();
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
          </form>
        ) : null}
        {error && (
          <div className="connection-error" role="alert">
            {error}
          </div>
        )}
        {loading && <Pending />}
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
              {items.map((p) => (
                <button
                  key={p.id}
                  className={selected === p.id ? "active" : ""}
                  onClick={() => openPage(p)}
                >
                  <FileText size={14} />
                  {p.title}
                </button>
              ))}
              {!items.length && !loading && (
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
                      onClick={() =>
                        favoriteObject({
                          type: "doc",
                          id: page.id,
                          title: page.title,
                          origin: configs.confluence.url,
                        })
                      }
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
                  <div
                    className="remote-document"
                    dangerouslySetInnerHTML={{ __html: cleanHtml }}
                  />
                </>
              ) : (
                <div className="connected-empty">
                  <BookOpen size={28} />
                  <h2>Select a page</h2>
                  <p>실제 위키 본문을 이 화면에서 읽을 수 있습니다.</p>
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
                <p>접근 가능한 저장소와 열린 MR만 표시됩니다.</p>
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Issue</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Priority</th>
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
                      <span className="pill">{i.fields.status?.name}</span>
                    </td>
                    <td>{i.fields.assignee?.displayName || "Unassigned"}</td>
                    <td>{i.fields.priority?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && !loading && (
              <div className="connected-empty">
                <h3>No matching Jira issues</h3>
                <p>JQL 조건과 프로젝트 접근 권한을 확인하세요.</p>
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
              현재 JQL로 불러온 {items.length}개 이슈를 표시합니다. Sprint는
              JQL에 sprint in openSprints()를 지정해 범위를 선택하세요. 상태
              변경은 이슈 Inspector에서 실행합니다.
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
          onChanged={() => load()}
          onContext={onContext}
        />
      )}
    </div>
  );
}
export { default as ConnectedAssistant } from "./ConnectedAssistant";
