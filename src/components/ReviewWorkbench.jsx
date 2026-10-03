import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  FileCode2,
  GitBranch,
  GitPullRequest,
  Loader2,
  MessageSquare,
  Network,
  RefreshCw,
  Send,
  Sparkles,
  Workflow,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { buildGraph, basename, reviewPosition } from "../lib/review-model.mjs";
import { invoke, isDesktop } from "../lib/integration-client";
function CodeText({ text }) {
  const pattern =
    /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:async|await|class|const|let|var|return|if|else|try|catch|throw|new|export|import|from|interface|type|public|private|protected|readonly|static|extends|implements|function|void|boolean|number|string|package)\b|\b\d+\b)/g;
  const pieces = String(text).split(pattern);
  return (
    <>
      {pieces.map((part, i) => {
        const type =
          /^\/\//.test(part) || /^\/\*/.test(part)
            ? "comment"
            : /^["']/.test(part)
              ? "string"
              : /^\d+$/.test(part)
                ? "number"
                : /^[a-z]+$/.test(part) && i % 2 === 1
                  ? "keyword"
                  : "";
        return type ? (
          <span key={i} className={"syntax-" + type}>
            {part}
          </span>
        ) : (
          part
        );
      })}
    </>
  );
}
function DependencyDiagram({ graph, selected, onSelect, zoom }) {
  const columns = 3,
    nodeW = 194,
    nodeH = 74,
    gapX = 48,
    gapY = 58;
  const positions = new Map(
    graph.nodes.map((n, i) => [
      n.id,
      {
        x: 28 + (i % columns) * (nodeW + gapX),
        y: 36 + Math.floor(i / columns) * (nodeH + gapY),
      },
    ]),
  );
  const w = columns * (nodeW + gapX) + 8,
    h = Math.max(
      280,
      Math.ceil(graph.nodes.length / columns) * (nodeH + gapY) + 60,
    );
  return (
    <div className="diagram-scroll">
      <svg
        role="img"
        aria-label="Dependency flow diagram"
        width={w * zoom}
        height={h * zoom}
        viewBox={`0 0 ${w} ${h}`}
        className="dependency-svg"
      >
        <defs>
          <marker
            id="dep-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {graph.dependencies.map((e, i) => {
          const a = positions.get(e.from),
            b = positions.get(e.to);
          if (!a || !b) return null;
          const sameRow = a.y === b.y;
          const startX = a.x + nodeW / 2,
            startY = a.y + nodeH,
            endX = b.x + nodeW / 2,
            endY = b.y;
          const d = sameRow
            ? `M ${a.x + nodeW} ${a.y + nodeH / 2} C ${a.x + nodeW + 30} ${a.y + nodeH / 2}, ${b.x - 30} ${b.y + nodeH / 2}, ${b.x} ${b.y + nodeH / 2}`
            : `M ${startX} ${startY} C ${startX} ${startY + 36}, ${endX} ${endY - 36}, ${endX} ${endY}`;
          return (
            <g
              key={i}
              className={`dependency-edge ${e.evidence}`}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${basename(e.from)} ${e.label} ${basename(e.to)}`}
              onClick={() => onSelect(e.path, e.line)}
              onKeyDown={(k) => {
                if (k.key === "Enter") onSelect(e.path, e.line);
              }}
            >
              <path d={d} markerEnd="url(#dep-arrow)" />
              <title>{`${e.label} · ${e.path}:${e.line} · ${e.evidence}`}</title>
            </g>
          );
        })}
        {graph.nodes.map((n) => {
          const p = positions.get(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              className={`diagram-node ${selected === n.id ? "selected" : ""} ${n.change}`}
              role="button"
              tabIndex={0}
              aria-label={`Open component ${basename(n.path)}`}
              onClick={() => onSelect(n.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(n.path);
                }
              }}
            >
              <rect width={nodeW} height={nodeH} rx="6" />
              <rect
                className="node-change-bar"
                width="3"
                height={nodeH - 20}
                x="0"
                y="10"
              />
              <text className="node-label" x="15" y="28">
                {n.label.length > 23 ? n.label.slice(0, 22) + "…" : n.label}
              </text>
              <text className="node-path" x="15" y="47">
                {basename(n.path).slice(0, 26)}
              </text>
              <text className="node-meta" x="15" y="62">
                {n.change} · {n.lines} changed lines
              </text>
              <title>{n.path}</title>
            </g>
          );
        })}
      </svg>
      {!graph.dependencies.length && (
        <p className="diagram-empty-note">
          현재 diff에서 파일 간 의존성을 확정할 수 없습니다. 컴포넌트를 눌러
          코드를 확인하거나 AI guide로 관계를 분석하세요.
        </p>
      )}
    </div>
  );
}
function SequenceDiagram({ graph, selected, onSelect, zoom }) {
  const participants = new Set(graph.sequence.flatMap((e) => [e.from, e.to]));
  const active = graph.sequence.length
    ? graph.nodes.filter((n) => participants.has(n.id))
    : graph.nodes;
  const column = 190,
    w = Math.max(620, active.length * column + 60),
    h = Math.max(300, graph.sequence.length * 78 + 160);
  const x = (id) => 50 + active.findIndex((n) => n.id === id) * column + 70;
  return (
    <div className="diagram-scroll">
      <svg
        role="img"
        aria-label="Sequence diagram"
        width={w * zoom}
        height={h * zoom}
        viewBox={`0 0 ${w} ${h}`}
        className="sequence-svg"
      >
        <defs>
          <marker
            id="seq-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {active.map((n) => (
          <g key={n.id}>
            <line
              className="lifeline"
              x1={x(n.id)}
              x2={x(n.id)}
              y1="83"
              y2={h - 30}
            />
            <g
              className={`diagram-node ${selected === n.id ? "selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`Open component ${basename(n.path)}`}
              onClick={() => onSelect(n.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(n.path);
              }}
            >
              <rect x={x(n.id) - 80} y="25" width="160" height="55" rx="5" />
              <text
                className="node-label"
                x={x(n.id)}
                y="49"
                textAnchor="middle"
              >
                {n.label.slice(0, 21)}
              </text>
              <text
                className="node-path"
                x={x(n.id)}
                y="65"
                textAnchor="middle"
              >
                {n.change}
              </text>
            </g>
          </g>
        ))}
        {graph.sequence.map((e, i) => {
          const y = 125 + i * 78;
          return (
            <g
              key={i}
              className="sequence-step"
              role="button"
              tabIndex={0}
              aria-label={`Inspect sequence step ${i + 1}: ${e.label}`}
              onClick={() => onSelect(e.path, e.line)}
              onKeyDown={(k) => {
                if (k.key === "Enter") onSelect(e.path, e.line);
              }}
            >
              <rect
                className="step-hit"
                x={Math.min(x(e.from), x(e.to)) - 15}
                y={y - 28}
                width={Math.abs(x(e.to) - x(e.from)) + 30}
                height="55"
              />
              <line
                x1={x(e.from)}
                x2={x(e.to)}
                y1={y}
                y2={y}
                markerEnd="url(#seq-arrow)"
              />
              <text
                x={Math.min(x(e.from), x(e.to)) + 8}
                y={y - 10}
                className="sequence-label"
              >
                {i + 1}. {e.label.slice(0, 48)}
              </text>
              <text
                x={Math.min(x(e.from), x(e.to)) + 8}
                y={y + 17}
                className="node-meta"
              >
                {basename(e.path)}:{e.line} · inferred
              </text>
              <title>{e.label}</title>
            </g>
          );
        })}
      </svg>
      {!graph.sequence.length && (
        <p className="diagram-empty-note">
          호출 순서를 구성할 근거가 아직 없습니다. AI guide에서 diff 기반
          시퀀스를 생성할 수 있습니다. 런타임 추적 결과는 아닙니다.
        </p>
      )}
    </div>
  );
}
const draftStoreKey = (live, mr) =>
  `orbit-visual-drafts:${live ? "live" : "demo"}:${mr.web_url || mr.project_id}:${mr.iid}:${mr.diff_refs.head_sha}`;
export default function ReviewWorkbench({
  snapshot,
  live = false,
  initialTab = "Dependency flow",
  externalError = "",
  refreshing = false,
  onBack,
  onRefresh,
  onContext,
  onDemoComment,
  onDemoApprove,
}) {
  const { mr, files } = snapshot;
  const [tab, setTab] = useState(initialTab);
  const [selected, setSelected] = useState(files[0]?.path);
  const [line, setLine] = useState(null);
  const [side, setSide] = useState("new");
  const [codeMode, setCodeMode] = useState("Diff");
  const [source, setSource] = useState({});
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [guide, setGuide] = useState(snapshot.guide || null);
  const [guidelines, setGuidelines] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [zoom, setZoom] = useState(0.85);
  const [discussions, setDiscussions] = useState(snapshot.discussions || []);
  const [configs, setConfigs] = useState({});
  const [approved, setApproved] = useState(mr.status === "Approved");
  const [confirmApproval, setConfirmApproval] = useState(false);
  const storeKey = draftStoreKey(live, mr);
  const [drafts, setDrafts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) || "{}");
    } catch {
      return {};
    }
  });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    localStorage.setItem(storeKey, JSON.stringify(drafts));
  }, [drafts, storeKey]);
  useEffect(() => {
    if (live) setDiscussions(snapshot.discussions || []);
  }, [snapshot, live]);
  useEffect(() => {
    if (isDesktop())
      invoke("config.list")
        .then(setConfigs)
        .catch(() => {});
  }, []);
  const file = files.find((f) => f.path === selected) || files[0];
  const draftKey = `${file?.path}:${side}:${line || "file"}`;
  const draft = drafts[draftKey] || "";
  const graph = useMemo(() => buildGraph(files, guide), [files, guide]);
  useEffect(() => {
    onContext?.(
      JSON.stringify({
        type: "merge_request",
        title: mr.title,
        project: mr.project_id,
        iid: mr.iid,
        headSha: mr.diff_refs.head_sha,
        file: file?.path,
        line,
        diff: file?.diff?.slice(0, 12000),
        guide: guide?.summary,
      }),
    );
  }, [file?.path, line, mr.id, guide?.summary]);
  useEffect(() => {
    if (line !== null)
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-code-line="${side}-${line}"]`)
          ?.scrollIntoView({ block: "nearest" }),
      );
  }, [line, side, codeMode, source]);
  useEffect(() => {
    setSourceLoading(false);
    setSourceError("");
    if (codeMode !== "Source" || !file || source[file.path] !== undefined)
      return;
    let current = true;
    if (!live) {
      setSource((s) => ({ ...s, [file.path]: file.content ?? null }));
      return;
    }
    setSourceLoading(true);
    invoke("gitlab.code", {
      projectId: mr.project_id,
      path: file.deleted_file ? file.old_path : file.path,
      ref: file.deleted_file ? mr.diff_refs.base_sha : mr.diff_refs.head_sha,
    })
      .then((data) => {
        if (current) setSource((s) => ({ ...s, [file.path]: data.content }));
      })
      .catch((e) => {
        if (current) setSourceError(e.message);
      })
      .finally(() => {
        if (current) setSourceLoading(false);
      });
    return () => {
      current = false;
    };
  }, [codeMode, file?.path, live, mr.diff_refs.head_sha]);
  function select(path, targetLine) {
    setSelected(path);
    setLine(targetLine || null);
    setSide("new");
    setError("");
    setNotice("");
  }
  async function generate() {
    setBusy("guide");
    setError("");
    try {
      if (!live) {
        setGuide({
          ...snapshot.demoGuide,
          model: "Sample guide",
          headSha: mr.diff_refs.head_sha,
          coverage: {
            includedFiles: files.length,
            totalFiles: files.length,
            truncated: false,
            diffOnly: true,
          },
        });
        setTab("AI guide");
      } else {
        const result = await invoke("claude.review", {
          projectId: mr.project_id,
          iid: mr.iid,
          headSha: mr.diff_refs.head_sha,
          guidelines,
        });
        if (alive.current) {
          setGuide(result);
          setTab("AI guide");
        }
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy("");
    }
  }
  async function post() {
    const submittedKey = draftKey;
    const text = draft.trim();
    if (!text) return;
    setBusy("comment");
    setError("");
    setNotice("");
    try {
      const position = reviewPosition(file, line, side, mr.diff_refs);
      let thread;
      if (live)
        thread = await invoke("gitlab.comment", {
          projectId: mr.project_id,
          iid: mr.iid,
          headSha: mr.diff_refs.head_sha,
          path: file.path,
          line,
          side,
          mode: position ? "inline" : "file",
          body: text,
        });
      else {
        thread = {
          id: crypto.randomUUID(),
          notes: [
            {
              id: Date.now(),
              body: text,
              author: { name: "Alex Kim" },
              position: position || { new_path: file.path },
              created_at: new Date().toISOString(),
            },
          ],
        };
        onDemoComment?.(`${file.path}${line ? ":" + line : ""} — ${text}`);
      }
      if (alive.current) {
        setDiscussions((d) => [...d, thread]);
        setDrafts((d) => ({ ...d, [submittedKey]: "" }));
        setNotice(
          live
            ? "GitLab에 리뷰 댓글을 등록했습니다."
            : "데모 리뷰 댓글을 등록했습니다.",
        );
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy("");
    }
  }
  async function approve() {
    setBusy("approve");
    setError("");
    try {
      if (live)
        await invoke("gitlab.approve", {
          projectId: mr.project_id,
          iid: mr.iid,
          headSha: mr.diff_refs.head_sha,
        });
      if (!live) onDemoApprove?.();
      setApproved(true);
      setConfirmApproval(false);
      setNotice(
        live
          ? "GitLab에 승인을 등록했습니다. MR은 merge하지 않았습니다."
          : "데모 MR을 승인했습니다.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const notes = discussions
    .flatMap((d) => d.notes || [])
    .filter(
      (n) =>
        !n.system &&
        (n.position?.new_path === file?.path ||
          n.position?.old_path === file?.old_path ||
          (!n.position && n.body?.startsWith(file?.path))),
    );
  if (!file)
    return (
      <div className="page">
        <button className="btn" onClick={onBack}>
          Back
        </button>
        <h2>No changed files</h2>
        <p>GitLab may still be preparing the diff. Refresh to try again.</p>
        <button className="btn" onClick={onRefresh}>
          Refresh
        </button>
      </div>
    );
  return (
    <div className="visual-review">
      <header className="visual-review-heading">
        <div className="inline">
          <button className="quiet-button" onClick={onBack}>
            <ArrowLeft size={14} />{" "}
            {live ? "Merge requests" : "Review overview"}
          </button>
          <span className="object-key">
            !{mr.iid} · {mr.diff_refs.head_sha.slice(0, 8)}
          </span>
          <span className={`pill ${live ? "green" : ""}`}>
            {live ? "GitLab · live" : "Demo code"}
          </span>
        </div>
        <div className="visual-review-title">
          <div>
            <h1>{mr.title}</h1>
            <p>
              {mr.source_branch} <ArrowRight size={12} /> {mr.target_branch} ·{" "}
              {files.length} changed files
            </p>
          </div>
          <div className="inline">
            <button
              className="btn"
              disabled={!!busy || refreshing}
              onClick={onRefresh}
            >
              <RefreshCw size={13} className={refreshing ? "spin" : ""} />{" "}
              Refresh
            </button>
            <button
              className="btn primary"
              disabled={!!busy}
              onClick={generate}
            >
              {busy === "guide" ? (
                <Loader2 className="spin" size={14} />
              ) : (
                <Sparkles size={14} />
              )}{" "}
              {live ? "Generate AI guide" : "Preview AI guide"}
            </button>
          </div>
        </div>
      </header>
      {externalError && (
        <div role="alert" className="connection-error">
          {externalError}
        </div>
      )}
      {(snapshot.truncated || files.some((f) => f.unavailable)) && (
        <div className="review-notice">
          일부 diff가 생략되었거나 GitLab의 크기 제한에 걸렸습니다. 전체
          저장소를 분석한 결과가 아닙니다.
        </div>
      )}
      <div className="visual-review-grid">
        <section className="visual-map-panel">
          <div
            className="visual-tabs"
            role="tablist"
            aria-label="Review visualization"
          >
            {[
              ["Dependency flow", Network],
              ["Sequence", Workflow],
              ["AI guide", Sparkles],
            ].map(([name, Icon]) => (
              <button
                key={name}
                role="tab"
                aria-selected={tab === name}
                className={tab === name ? "active" : ""}
                onClick={() => setTab(name)}
              >
                <Icon size={14} />
                {name}
              </button>
            ))}
          </div>
          {tab !== "AI guide" ? (
            <>
              <div className="diagram-toolbar">
                <div>
                  <strong>
                    {tab === "Dependency flow"
                      ? "Change structure"
                      : "Interaction sequence"}
                  </strong>
                  <small>
                    {tab === "Dependency flow"
                      ? "Solid: resolved import · Dashed: inferred"
                      : "Static code / AI inferred · not a runtime trace"}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label="Zoom out diagram"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                >
                  <ZoomOut size={15} />
                </button>
                <button className="quiet-button" aria-label="Fit diagram to panel" title="Fit to panel" onClick={e => { const panel=e.currentTarget.closest(".diagram-toolbar")?.parentElement;const canvas=panel?.querySelector(".diagram-scroll");const svg=canvas?.querySelector("svg");if(canvas&&svg)setZoom(Math.min(1,(canvas.clientWidth-16)/svg.viewBox.baseVal.width)); }}>
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  className="icon-button"
                  aria-label="Zoom in diagram"
                  onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
                >
                  <ZoomIn size={15} />
                </button>
              </div>
              {tab === "Dependency flow" ? (
                <DependencyDiagram
                  graph={graph}
                  selected={selected}
                  onSelect={select}
                  zoom={zoom}
                />
              ) : (
                <SequenceDiagram
                  graph={graph}
                  selected={selected}
                  onSelect={select}
                  zoom={zoom}
                />
              )}
              <div className="diagram-legend">
                <span>
                  <i className="added" /> Added
                </span>
                <span>
                  <i className="changed" /> Changed
                </span>
                <span>
                  <i className="removed" /> Removed
                </span>
                <small>
                  컴포넌트·화살표를 클릭하면 코드 위치로 이동합니다.
                </small>
              </div>
              <div className="review-component-list">
                {files.map((f) => (
                  <button
                    className={f.path === selected ? "selected" : ""}
                    key={f.path}
                    onClick={() => select(f.path)}
                  >
                    <FileCode2 size={13} />
                    {f.path}
                    <span>
                      {(f.rows || []).filter((r) => r.kind === "added").length}{" "}
                      additions
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="ai-review-guide">
              <div className="guide-heading">
                <Sparkles size={18} />
                <div>
                  <h2>Review guide</h2>
                  <p>
                    {guide
                      ? `${guide.model || "AI"} · ${mr.diff_refs.head_sha.slice(0, 8)}`
                      : "변경 의도부터 확인할 위험 지점까지"}
                  </p>
                </div>
              </div>
              <details className="guideline-settings">
                <summary>팀 리뷰 가이드라인</summary>
                <textarea
                  aria-label="Team review guidelines"
                  value={guidelines}
                  onChange={(e) => setGuidelines(e.target.value)}
                  placeholder="예: 트랜잭션 경계, 멱등성, 오류 처리, 테스트 누락을 우선 확인"
                />
              </details>
              <p className="ai-transmission-note">
                {live
                  ? `Generate AI guide를 누르면 MR diff와 가이드라인을 ${configs.claude?.url || "설정한 Claude 엔드포인트"}로 보냅니다.`
                  : "샘플 가이드입니다. 실제 Claude 호출은 Connected workspace에서 수행합니다."}
              </p>
              {!guide ? (
                <div className="guide-empty">
                  <Network size={30} />
                  <h3>코드에 근거한 리뷰 순서를 만드세요</h3>
                  <p>
                    변경 요약, 의존 관계, 추정 시퀀스, 점검할 테스트를 파일·줄과
                    연결합니다.
                  </p>
                  <button
                    className="btn primary"
                    disabled={!!busy}
                    onClick={generate}
                  >
                    {busy === "guide" ? "분석 중…" : "Generate review guide"}
                  </button>
                </div>
              ) : (
                <>
                  <p className="guide-summary">{guide.summary}</p>
                  <div className="guide-coverage">
                    {guide.coverage?.includedFiles || files.length} /{" "}
                    {guide.coverage?.totalFiles || files.length} files ·
                    Diff-based analysis
                    {guide.coverage?.truncated ? " · Partial coverage" : ""}
                    {guide.rejectedReferences
                      ? ` · ${guide.rejectedReferences} invalid references omitted`
                      : ""}
                  </div>
                  <h3>Recommended reading order</h3>
                  <ol className="reading-order">
                    {(guide.readingOrder || []).map((r, i) => (
                      <li key={i}>
                        <button onClick={() => select(r.path, r.line)}>
                          <span className="step-number">{i + 1}</span>
                          <div>
                            <b>
                              {basename(r.path)}:{r.line}
                            </b>
                            <p>{r.reason}</p>
                          </div>
                          <ArrowRight size={14} />
                        </button>
                      </li>
                    ))}
                  </ol>
                  <h3>
                    Review checkpoints{" "}
                    <small>AI suggestions · verify in code</small>
                  </h3>
                  {(guide.findings || []).map((f, i) => (
                    <button
                      className="guide-finding"
                      key={i}
                      onClick={() => select(f.path, f.line)}
                    >
                      <span className={`finding-severity ${f.severity}`}>
                        {f.severity}
                      </span>
                      <b>{f.title}</b>
                      <p>{f.reason}</p>
                      <code>
                        {f.path}:{f.line}
                      </code>
                    </button>
                  ))}
                  {!guide.findings?.length && (
                    <p className="muted">
                      제공된 diff에서 추가 점검 제안이 없습니다. 결함이 없음을
                      보증하지는 않습니다.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </section>
        <section className="visual-code-panel">
          <div className="visual-code-heading">
            <FileCode2 size={15} />
            <strong title={file.path}>{file.path}</strong>
            <div className="segmented">
              {["Diff", "Source"].map((t) => (
                <button
                  key={t}
                  className={codeMode === t ? "active" : ""}
                  onClick={() => setCodeMode(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="code-provenance">
            {live ? "Repository code" : "Sample fixture"} ·{" "}
            {codeMode === "Source"
              ? (file.deleted_file ? "base" : "head") +
                " " +
                (file.deleted_file
                  ? mr.diff_refs.base_sha
                  : mr.diff_refs.head_sha
                ).slice(0, 8)
              : "Old / New line numbers"}
            {line && (
              <span>
                Selected {side === "old" ? "old" : "new"} line {line}
              </span>
            )}
          </div>
          <div className="visual-code-scroll" aria-label="Component code">
            {sourceLoading && (
              <div className="code-state">
                <Loader2 className="spin" size={20} /> Loading source…
              </div>
            )}
            {sourceError && (
              <div role="alert" className="connection-error">
                {sourceError}
                <button className="btn" onClick={() => setCodeMode("Diff")}>
                  View diff
                </button>
              </div>
            )}
            {codeMode === "Source" && !sourceLoading && !sourceError ? (
              typeof source[file.path] === "string" ? (
                source[file.path].split("\n").map((text, i) => (
                  <button
                    key={i}
                    data-code-line={`${file.deleted_file ? "old" : "new"}-${i + 1}`}
                    className={`visual-code-line ${line === i + 1 ? "selected" : ""}`}
                    aria-label={`Select source line ${i + 1}`}
                    onClick={() => {
                      setLine(i + 1);
                      setSide(file.deleted_file ? "old" : "new");
                    }}
                  >
                    <span className="code-number">{i + 1}</span>
                    <code>
                      <CodeText text={text || " "} />
                    </code>
                  </button>
                ))
              ) : (
                <div className="code-state">
                  전체 원문이 없는 샘플입니다. Diff 탭에서 제공된 변경 코드를
                  확인하세요.
                </div>
              )
            ) : codeMode === "Diff" ? (
              file.rows.map((r, i) =>
                r.kind === "hunk" ? (
                  <div className="visual-hunk" key={i}>
                    {r.text}
                  </div>
                ) : (
                  <button
                    key={i}
                    data-code-line={`${r.newLine !== null ? "new" : "old"}-${r.newLine ?? r.oldLine}`}
                    className={`visual-code-line ${r.kind} ${line === (side === "old" ? r.oldLine : r.newLine) ? "selected" : ""}`}
                    aria-label={`Select ${r.kind === "removed" ? "old" : "new"} line ${r.newLine ?? r.oldLine}`}
                    onClick={() => {
                      setLine(r.newLine ?? r.oldLine);
                      setSide(r.newLine !== null ? "new" : "old");
                    }}
                  >
                    <span className="code-number">{r.oldLine}</span>
                    <span className="code-number">{r.newLine}</span>
                    <span className="code-sign">
                      {r.kind === "added"
                        ? "+"
                        : r.kind === "removed"
                          ? "−"
                          : " "}
                    </span>
                    <code>
                      <CodeText text={r.text || " "} />
                    </code>
                  </button>
                ),
              )
            ) : null}
            {codeMode === "Diff" && !file.rows.length && (
              <div className="code-state">
                Diff unavailable or binary file. Try Source.
              </div>
            )}
          </div>
          <div className="visual-comment-panel">
            <div className="comment-target">
              <MessageSquare size={14} />
              <b>
                {line ? `${basename(file.path)}:${line}` : basename(file.path)}
              </b>
              <span>
                {reviewPosition(file, line, side, mr.diff_refs)
                  ? "Inline review comment"
                  : "File-level review comment"}
              </span>
            </div>
            <textarea
              aria-label="Diagram review comment"
              value={draft}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, [draftKey]: e.target.value }))
              }
              placeholder="선택한 코드에 리뷰 의견을 남기세요…"
              onKeyDown={(e) => {
                if (
                  (e.ctrlKey || e.metaKey) &&
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing &&
                  !busy
                ) {
                  e.preventDefault();
                  post();
                }
              }}
            />
            <div className="visual-comment-actions">
              <small>초안 자동 저장 · ⌘ / Ctrl + Enter</small>
              <button
                className="btn primary"
                disabled={!draft.trim() || !!busy}
                onClick={post}
              >
                <Send size={12} />
                {busy === "comment"
                  ? "Posting…"
                  : live
                    ? "Post to GitLab"
                    : "Add demo comment"}
              </button>
            </div>
            {error && (
              <div className="connection-error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="connection-success" role="status">
                {notice}
              </div>
            )}
            <div className="component-discussions">
              {notes.map((n, i) => (
                <div className="component-comment" key={n.id || i}>
                  <b>
                    {n.author?.name || "Reviewer"}
                    <small>
                      {n.position?.new_line || n.position?.old_line
                        ? `Line ${n.position.new_line || n.position.old_line}`
                        : "File comment"}
                    </small>
                  </b>
                  <p>{n.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="visual-review-approval">
            {confirmApproval ? (
              <>
                <span>현재 커밋의 변경을 승인할까요?</span>
                <button
                  className="btn"
                  onClick={() => setConfirmApproval(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
                  disabled={!!busy}
                  onClick={approve}
                >
                  Confirm approval
                </button>
              </>
            ) : (
              <>
                <small>
                  검토 후 명시적으로 승인합니다. Merge는 실행하지 않습니다.
                </small>
                <button
                  className="btn"
                  disabled={approved || !!busy}
                  onClick={() => setConfirmApproval(true)}
                >
                  <Check size={13} />
                  {approved ? "Approved" : "Approve MR"}
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
