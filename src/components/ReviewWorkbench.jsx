import React, { useEffect, useMemo, useRef, useState } from "react";
import "../review-polish.css";
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
// Collapse strongly connected components before layering: cycles stay together,
// while every edge between groups flows from an earlier layer to a later one.
function dependencyLayout(graph) {
  const adjacency = new Map(graph.nodes.map((n) => [n.id, []]));
  graph.dependencies.forEach((edge) => {
    if (adjacency.has(edge.from) && adjacency.has(edge.to)) adjacency.get(edge.from).push(edge.to);
  });
  let nextIndex = 0;
  const indices = new Map(), low = new Map(), stack = [], active = new Set(), groups = [];
  function visit(id) {
    indices.set(id, nextIndex); low.set(id, nextIndex++); stack.push(id); active.add(id);
    for (const target of adjacency.get(id)) {
      if (!indices.has(target)) { visit(target); low.set(id, Math.min(low.get(id), low.get(target))); }
      else if (active.has(target)) low.set(id, Math.min(low.get(id), indices.get(target)));
    }
    if (low.get(id) === indices.get(id)) {
      const group = []; let member;
      do { member = stack.pop(); active.delete(member); group.push(member); } while (member !== id);
      groups.push(group);
    }
  }
  graph.nodes.forEach((n) => { if (!indices.has(n.id)) visit(n.id); });
  const groupOf = new Map(groups.flatMap((group, i) => group.map((id) => [id, i])));
  const parents = groups.map(() => new Set());
  graph.dependencies.forEach((edge) => {
    const from = groupOf.get(edge.from), to = groupOf.get(edge.to);
    if (from !== undefined && to !== undefined && from !== to) parents[to].add(from);
  });
  const depths = new Map();
  function depth(i) {
    if (!depths.has(i)) depths.set(i, parents[i].size ? Math.max(...[...parents[i]].map(depth)) + 1 : 0);
    return depths.get(i);
  }
  const layers = [];
  graph.nodes.forEach((node) => { const d = depth(groupOf.get(node.id)); (layers[d] ||= []).push(node); });
  const nodeW = 204, nodeH = 76, gap = 40;
  const width = Math.max(480, ...layers.map((layer) => layer.length * (nodeW + gap) + gap));
  const positions = new Map();
  layers.forEach((layer, i) => layer.forEach((node, j) => positions.set(node.id, {
    x: (width - (layer.length * (nodeW + gap) - gap)) / 2 + j * (nodeW + gap),
    y: 36 + i * 134,
    layer: i,
    cyclic: groups[groupOf.get(node.id)].length > 1,
  })));
  return { positions, layers, nodeW, nodeH, width, height: Math.max(200, layers.length * 134 + 12) };
}
function diagramKeys(event, onActivate) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onActivate(); return; }
  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const nodes = [...event.currentTarget.closest("svg").querySelectorAll('[role="button"]')];
  const index = nodes.indexOf(event.currentTarget);
  const next = event.key === "Home" ? 0 : event.key === "End" ? nodes.length - 1
    : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + nodes.length) % nodes.length;
  event.preventDefault(); nodes[next]?.focus();
}
function DependencyDiagram({ graph, selected, onSelect, zoom, layout }) {
  const { positions, layers, nodeW, nodeH, width: w, height: h } = layout;
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
        {layers.map((layer, index) => (
          <g key={index} className="dependency-layer" aria-hidden="true">
            <text x="20" y={22 + index * 134}>{graph.dependencies.length ? index === 0 ? "Root components" : `Dependency layer ${index}` : "Changed components"}</text>
            <line x1="20" x2={w - 20} y1={29 + index * 134} y2={29 + index * 134} />
          </g>
        ))}
        {graph.dependencies.map((e, i) => {
          const a = positions.get(e.from),
            b = positions.get(e.to);
          if (!a || !b) return null;
          const sameRow = a.layer === b.layer;
          const startX = a.x + nodeW / 2,
            startY = a.y + nodeH,
            endX = b.x + nodeW / 2,
            endY = b.y;
          const d = sameRow
            ? `M ${startX} ${startY} C ${startX} ${startY + 34}, ${endX} ${startY + 34}, ${endX} ${startY}`
            : `M ${startX} ${startY} C ${startX} ${startY + 36}, ${endX} ${endY - 36}, ${endX} ${endY}`;
          return (
            <g
              key={i}
              className={`dependency-edge ${e.evidence}`}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${basename(e.from)} ${e.label} ${basename(e.to)}`}
              onClick={() => onSelect(e.path, e.line)}
              onKeyDown={(event) => diagramKeys(event, () => onSelect(e.path, e.line))}
            >
              <path className="edge-hit-area" d={d} />
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
              aria-pressed={selected === n.id}
              data-dependency-layer={p.layer}
              onClick={() => onSelect(n.path)}
              onKeyDown={(event) => diagramKeys(event, () => onSelect(n.path))}
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
                {p.cyclic ? "Cyclic dependency" : n.change} · {n.lines} changed lines
              </text>
              <title>{n.path}</title>
            </g>
          );
        })}
      </svg>
      {!graph.dependencies.length && (
        <p className="diagram-empty-note">
          No file dependencies were resolved from this diff. Open a component
          to inspect its code, or generate an AI guide to explore possible relationships.
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
              aria-pressed={selected === n.id}
              onKeyDown={(event) => diagramKeys(event, () => onSelect(n.path))}
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
              onKeyDown={(event) => diagramKeys(event, () => onSelect(e.path, e.line))}
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
          No call sequence was found in this diff. Generate an AI guide to explore
          a possible sequence. This is static analysis, not a runtime trace.
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
  const [autoFit, setAutoFit] = useState(true);
  const mapPanel = useRef(null);
  const [discussions, setDiscussions] = useState(snapshot.discussions || []);
  const [configs, setConfigs] = useState({});
  const [approved, setApproved] = useState(mr.status === "Approved");
  const [confirmApproval, setConfirmApproval] = useState(false);
  const progressKey = `orbit-visual-viewed:${JSON.stringify([
    live ? "live" : "demo", mr.web_url || mr.project_id, mr.iid,
    mr.diff_refs.base_sha, mr.diff_refs.start_sha, mr.diff_refs.head_sha,
  ])}`;
  const [progress, setProgress] = useState(() => {
    try {
      const paths = JSON.parse(localStorage.getItem(progressKey) || "[]");
      return { key: progressKey, paths: Array.isArray(paths) ? paths : [] };
    } catch {
      return { key: progressKey, paths: [] };
    }
  });
  const viewed = progress.key === progressKey ? progress.paths : [];
  const viewedCount = files.filter((f) => viewed.includes(f.path)).length;
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
  const layout = useMemo(() => dependencyLayout(graph), [graph]);
  const changeStats = useMemo(() => files.reduce((stats, item) => {
    for (const row of item.rows || []) {
      if (row.kind === "added") stats.added++;
      if (row.kind === "removed") stats.removed++;
    }
    return stats;
  }, { added: 0, removed: 0 }), [files]);
  useEffect(() => {
    if (!autoFit || tab === "AI guide") return;
    const canvas = mapPanel.current?.querySelector(".diagram-scroll");
    if (!canvas) return;
    function fit() {
      const svg = canvas.querySelector("svg");
      if (svg) setZoom(Math.min(1, Math.max(0.15, (canvas.clientWidth - 24) / svg.viewBox.baseVal.width)));
    }
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [autoFit, tab, layout]);
  useEffect(() => {
    const content = source[file?.path];
    const sourceLines = typeof content === "string" ? content.split("\n") : null;
    const start = Math.max(0, (line || 1) - 11);
    const end = sourceLines ? Math.min(sourceLines.length, start + 21) : 0;
    onContext?.(
      JSON.stringify({
        type: "merge_request",
        title: mr.title,
        project: mr.project_id,
        iid: mr.iid,
        headSha: mr.diff_refs.head_sha,
        file: file?.path,
        line,
        codeMode,
        side: codeMode === "Source" ? (file?.deleted_file ? "old" : "new") : side,
        source: codeMode === "Source" && sourceLines ? {
          ref: file?.deleted_file ? mr.diff_refs.base_sha : mr.diff_refs.head_sha,
          fromLine: start + 1,
          toLine: end,
          excerpt: sourceLines.slice(start, end).map((text, i) => `${start + i + 1}: ${text.slice(0, 500)}`).join("\n"),
          truncated: start > 0 || end < sourceLines.length || sourceLines.slice(start, end).some(text => text.length > 500),
        } : null,
        diff: file?.diff?.slice(0, 12000),
        guide: guide?.summary,
      }),
    );
  }, [file?.path, file?.diff, line, side, codeMode, source, mr.id, mr.diff_refs.head_sha, guide?.summary]);
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
  function markViewed(checked) {
    const paths = checked
      ? [...new Set([...viewed, file.path])]
      : viewed.filter((path) => path !== file.path);
    setProgress({ key: progressKey, paths });
    try {
      localStorage.setItem(progressKey, JSON.stringify(paths));
    } catch {
      setNotice("Progress could not be saved on this device. It is retained while this view stays open.");
    }
  }
  function nextUnreviewed() {
    const index = files.findIndex((f) => f.path === file.path);
    const remaining = [...files.slice(index + 1), ...files.slice(0, index + 1)]
      .find((f) => !viewed.includes(f.path));
    if (remaining) select(remaining.path);
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
    const submittedDraft = draft;
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
        setDrafts((d) => d[submittedKey] === submittedDraft
          ? { ...d, [submittedKey]: "" }
          : d);
        setNotice(
          live
            ? "Review comment posted to GitLab."
            : "Demo review comment added.",
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
          ? "Approval submitted to GitLab. The MR has not been merged."
          : "Demo MR approved.",
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
              {mr.source_branch} <ArrowRight size={12} /> {mr.target_branch}
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
        <div className="review-reading-path" aria-label="Review reading path">
          <div className="review-change-summary">
            <span>{files.length} files</span>
            <b className="added">+{changeStats.added}</b><b className="removed">−{changeStats.removed}</b>
            <span>{discussions.filter((d) => d.notes?.some((n) => !n.system)).length} threads</span>
          </div>
          <span className="reading-path-label">Read by dependency</span>
          <div className="reading-path-files">
            {layout.layers.flat().map((node) => (
              <button key={node.id} className={selected === node.id ? "active" : ""}
                aria-label={`Read ${basename(node.path)}`} aria-pressed={selected === node.id}
                title={node.path} onClick={() => select(node.path)}>
                {viewed.includes(node.path) ? <Check size={11} /> : <FileCode2 size={11} />}
                {node.label}
              </button>
            ))}
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
          Some diffs were omitted or exceeded GitLab’s size limit. This view
          does not cover the entire repository.
        </div>
      )}
      <div className="visual-review-grid">
        <section className="visual-map-panel" ref={mapPanel}>
          <div className="review-file-progress">
            <div>
              <strong role="status">{viewedCount} / {files.length} files viewed</strong>
              <small>Saved on this device · current diff only</small>
            </div>
            <progress aria-label="Files viewed" max={files.length} value={viewedCount} />
            <button className="btn" onClick={nextUnreviewed} disabled={viewedCount === files.length}>
              Next unreviewed <ArrowRight size={12} />
            </button>
          </div>
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
                      ? "Dependency map"
                      : "Interaction sequence"}
                  </strong>
                  {tab === "Dependency flow" && <span className="diagram-evidence-count">{graph.dependencies.filter((e) => e.evidence === "code").length} resolved · {graph.dependencies.filter((e) => e.evidence !== "code").length} inferred</span>}
                  <small>
                    {tab === "Dependency flow"
                      ? "Changed files only. Solid imports; dashed inferred references."
                      : "Static code / AI inferred · not a runtime trace"}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label="Zoom out diagram"
                  onClick={() => { setAutoFit(false); setZoom((z) => Math.max(0.15, z - 0.1)); }}
                >
                  <ZoomOut size={15} />
                </button>
                <button className={`quiet-button ${autoFit ? "is-fitted" : ""}`} aria-label="Fit diagram to panel" title="Fit to panel" onClick={() => setAutoFit(true)}>
                  Fit <span>{Math.round(zoom * 100)}%</span>
                </button>
                <button
                  className="icon-button"
                  aria-label="Zoom in diagram"
                  onClick={() => { setAutoFit(false); setZoom((z) => Math.min(1.5, z + 0.1)); }}
                >
                  <ZoomIn size={15} />
                </button>
              </div>
              {tab === "Dependency flow" ? (
                <DependencyDiagram
                  graph={graph}
                  layout={layout}
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
                  Solid: resolved import · Dashed: inferred reference. Arrows navigate; Enter opens code.
                </small>
              </div>
              <div className="review-component-list">
                {files.map((f) => (
                  <button
                    className={f.path === selected ? "selected" : ""}
                    key={f.path}
                    onClick={() => select(f.path)}
                  >
                    {viewed.includes(f.path)
                      ? <Check size={13} className="review-file-viewed" aria-label="Viewed" />
                      : <FileCode2 size={13} />}
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
                      : "Understand the change and decide what to check next"}
                  </p>
                </div>
              </div>
              <details className="guideline-settings">
                <summary>Team review guidelines</summary>
                <textarea
                  aria-label="Team review guidelines"
                  value={guidelines}
                  onChange={(e) => setGuidelines(e.target.value)}
                  placeholder="Prioritize transaction boundaries, idempotency, error handling, and missing tests."
                />
              </details>
              <p className="ai-transmission-note">
                {live
                  ? `Generate AI guide sends this MR’s diff and your guidelines to ${configs.claude?.url || "your configured Claude endpoint"}.`
                  : "This is a sample guide. Use Connected workspace to generate a guide with Claude."}
              </p>
              {!guide ? (
                <div className="guide-empty">
                  <Network size={30} />
                  <h3>Build a review plan from the code</h3>
                  <p>
                    Connect the change summary, dependencies, inferred sequences, and
                    suggested tests to specific files and lines.
                  </p>
                  <button
                    className="btn primary"
                    disabled={!!busy}
                    onClick={generate}
                  >
                    {busy === "guide" ? "Analyzing…" : "Generate review guide"}
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
                      No additional checks were suggested for this diff. Continue your
                      review; this does not establish that the change is defect-free.
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
            <label className="review-viewed-toggle">
              <input type="checkbox" checked={viewed.includes(file.path)}
                onChange={(e) => markViewed(e.target.checked)}
                aria-label={`Mark ${file.path} as viewed`} />
              Viewed
            </label>
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
                  Full source is not available for this sample. Open the Diff tab
                  to inspect the supplied changes.
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
              placeholder="Leave a review comment on the selected code…"
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
              <small>Draft saved locally · ⌘ / Ctrl + Enter</small>
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
                <span>Approve the changes in this commit?</span>
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
                  Approve when your review is complete. This does not merge the MR.
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
