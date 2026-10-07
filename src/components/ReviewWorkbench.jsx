import React, { useEffect, useMemo, useRef, useState } from "react";
import "../review-polish.css";
import ReviewGuidePanel from "./ReviewGuidePanel";
import ReviewDraftNavigator from './ReviewDraftNavigator';
import { listReviewDrafts } from '../lib/review-drafts.mjs';
import { annotateTransactions, stepTransaction } from '../lib/review-transactions.mjs';
import '../review-transactions.css';
import { highlightCode, highlightDiff, codeLanguage } from '../lib/review-code.mjs';
import { ReviewFlowPicker, ReviewFlowContext } from "./ReviewFlowNavigator";
import "../review-collaboration.css";
import "../review-local-git.css";
import "../review-flows.css";
import { buildReviewFlows, scopeReviewGraph } from "../lib/review-flows.mjs";
import { annotateReviewGraph, architectureLayout } from "../lib/review-architecture.mjs";
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
function CodeText({ tokens }) {
  return tokens?.length ? tokens.map((token, index) =>
    token.types.length || token.depth !== null ? <span key={index}
      className={`review-code-token ${token.types.join(' ')}${token.depth !== null ? ` rainbow-bracket bracket-${token.depth % 6}` : ''}`}
      data-bracket-depth={token.depth ?? undefined}>{token.text}</span> : token.text
  ) : ' ';
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
  const columns = 2;
  const width = Math.max(480, ...layers.map((layer) => Math.min(columns, layer.length) * (nodeW + gap) + gap));
  const positions = new Map();
  const layerOffsets = [];
  let offset = 0;
  layers.forEach((layer, i) => {
    layerOffsets.push(offset);
    layer.forEach((node, j) => positions.set(node.id, {
      x: (width - (Math.min(columns, layer.length - Math.floor(j / columns) * columns) * (nodeW + gap) - gap)) / 2 + (j % columns) * (nodeW + gap),
      y: 36 + offset + Math.floor(j / columns) * 112,
      layer: i,
      cyclic: groups[groupOf.get(node.id)].length > 1,
    }));
    offset += Math.ceil(layer.length / columns) * 112 + 22;
  });
  return { positions, layers, layerOffsets, nodeW, nodeH, width, height: Math.max(200, offset + 12) };
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
function DependencyDiagram({ graph, selected, onSelect, zoom, layout, dependencyPositions, viewed }) {
  const { positions, layers, layerOffsets, nodeW, nodeH, width: w, height: h } = layout;
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
          <g key={index} className={`dependency-layer ${layout.semantic ? 'architecture-layer' : ''}`} data-role={layout.layerRoles?.[index]}>
            {layout.semantic && <rect className="architecture-band" x="10" y={layerOffsets[index] + 5} width={w - 20} height={(layerOffsets[index + 1] || h - 12) - layerOffsets[index] - 10} rx="6"/>}
            <text x="20" y={25 + layerOffsets[index]}>{layout.layerLabels?.[index] || (graph.dependencies.length ? index === 0 ? "Root components" : `Dependency layer ${index}` : "Changed components")}</text>
            <text className="architecture-layer-count" textAnchor="end" x={w - 20} y={25 + layerOffsets[index]}>{layer.length}</text>
            <line x1="20" x2={w - 20} y1={34 + layerOffsets[index]} y2={34 + layerOffsets[index]} />
          </g>
        ))}
        {graph.dependencies.map((e, i) => {
          const a = positions.get(e.from),
            b = positions.get(e.to);
          if (!a || !b) return null;
          const sameRow = a.layer === b.layer;
          const passOtherNodes = b.layer > a.layer && (b.layer > a.layer + 1 ||
            [...positions.values()].some(position => position.layer === a.layer && position.y > a.y));
          const routeLeft = a.x + nodeW / 2 < w / 2;
          const lane = routeLeft ? 12 : w - 12;
          const startX = a.x + nodeW / 2,
            startY = a.y + nodeH,
            endX = b.x + nodeW / 2,
            endY = b.y;
          const d = b.layer < a.layer
            ? `M ${a.x + nodeW} ${a.y + nodeH / 2} L ${w - 12} ${a.y + nodeH / 2} L ${w - 12} ${b.y + nodeH / 2} L ${b.x + nodeW} ${b.y + nodeH / 2}`
            : sameRow && a.y !== b.y
            ? `M ${a.x + nodeW} ${a.y + nodeH / 2} C ${w - 8} ${a.y + nodeH / 2}, ${w - 8} ${b.y + nodeH / 2}, ${b.x + nodeW} ${b.y + nodeH / 2}`
            : passOtherNodes
              ? `M ${routeLeft ? a.x : a.x + nodeW} ${a.y + nodeH / 2} L ${lane} ${a.y + nodeH / 2} L ${lane} ${endY - 18} L ${endX} ${endY - 18} L ${endX} ${endY}`
            : sameRow
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
              data-dependency-layer={dependencyPositions?.get(n.id)?.layer ?? p.layer}
              data-architecture-role={n.role || 'other'}
              data-architecture-layer={layout.semantic ? p.layer : undefined}
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
              <text className="node-label" x="15" y={layout.semantic ? 24 : 28}>
                {n.label.length > 23 ? n.label.slice(0, 22) + "…" : n.label}
              </text>
              <text className="node-path" x="15" y={layout.semantic ? 40 : 47}>
                {layout.semantic ? n.role === 'other' ? n.confidence === 'ambiguous' ? 'Role ambiguous' : 'Role unknown' : `${n.roleLabel}${n.confidence === 'code' ? ' · source evidence' : ' · convention'}` : basename(n.path).slice(0, 26)}
              </text>
              <text className="node-meta" x="15" y={layout.semantic ? 54 : 62}>
                {p.cyclic ? "Cyclic dependency" : viewed?.includes(n.path) ? "Viewed" : n.change} · {n.lines} changed lines
              </text>
              <title>{n.path}{n.evidence?.length ? `\n${n.evidence.map(item => item.detail).join('\n')}` : ''}</title>
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
const sequenceKey = step => JSON.stringify([step.from, step.to, step.path, step.line]);
function SequenceDiagram({ graph, selected, onSelect, onScopeSelect, zoom, compact = false, stepNumber = 1 }) {
  const participants = new Set(graph.sequence.flatMap((e) => [e.from, e.to]));
  const active = graph.sequence.length
    ? graph.nodes.filter((n) => participants.has(n.id))
    : graph.nodes;
  const context = stepTransaction(graph, graph.sequence[0]);
  const frames = (graph.transactions?.scopes || []).flatMap(scope => {
    const indices = graph.sequence.flatMap((step, index) => stepTransaction(graph, step).inside.some(item => item.id === scope.id) ? [index] : []);
    return indices.length ? [{ ...scope, first: indices[0], last: indices.at(-1) }] : [];
  });
  let extra = 0;
  const rowY = graph.sequence.map((step, index) => {
    if (compact) return 145;
    extra += frames.filter(frame => frame.first === index).length * 32;
    const y = 125 + index * 78 + extra;
    extra += frames.filter(frame => frame.last === index).length * 22;
    return y;
  });
  const column = 190,
    w = Math.max(compact ? 420 : 620, active.length * column + (compact ? 40 : 60)),
    h = Math.max(300, (rowY.at(-1) || 125) + 85 + (compact ? 0 : frames.filter(frame => frame.last === graph.sequence.length - 1).length * 22));
  const openScope = (scope, end = false) => onScopeSelect(scope.path, end ? scope.endLine : scope.startLine);
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
        {frames.filter(scope => !compact || scope.id === context.inside[0]?.id).map(scope => {
          const depth = compact ? 0 : frames.filter(parent => parent.id !== scope.id && parent.path === scope.path && parent.startOffset <= scope.startOffset && parent.endOffset >= scope.endOffset).length;
          const children = frames.filter(child => child.id !== scope.id && child.path === scope.path && child.startOffset >= scope.startOffset && child.endOffset <= scope.endOffset);
          const top = compact ? 88 : rowY[scope.first] - 57 - children.filter(child => child.first === scope.first).length * 32;
          const bottom = compact ? 205 : rowY[scope.last] + 45 + children.filter(child => child.last === scope.last).length * 22;
          const actors = graph.sequence.slice(scope.first, scope.last + 1).flatMap(step => [x(step.from), x(step.to)]);
          const left = compact ? 12 : Math.min(...actors) - 98 + depth * 8;
          const frameWidth = compact ? w - 24 : Math.max(...actors) + 98 - left - depth * 8;
          return <g key={scope.id} className="sequence-transaction-frame" data-transaction={scope.id}>
            <rect x={left} y={top} width={frameWidth} height={bottom - top} rx="4" />
            <g role="button" tabIndex={0} aria-label={`Open transaction start ${basename(scope.path)}:${scope.startLine}`}
              onClick={() => openScope(scope)} onKeyDown={event => diagramKeys(event, () => openScope(scope))}>
              <rect className="transaction-label-hit" x={left + 8} y={top + 2} width={frameWidth - 16} height="22" />
              <text className="transaction-caption" x={left + 12} y={top + 17}>
                {compact ? `TX scope · inside${context.inside.length > 1 ? ' · nested' : ''}` : 'TX · ' + scope.label.slice(0, Math.max(12, Math.floor((frameWidth - 140) / 6.6)))} · L{scope.startLine}–{scope.endLine}
              </text>
              <title>{scope.label} · {scope.path}:{scope.startLine}–{scope.endLine} · source boundary</title>
            </g>
            <g role="button" tabIndex={0} aria-label={`Open transaction end ${basename(scope.path)}:${scope.endLine}`}
              onClick={() => openScope(scope, true)} onKeyDown={event => diagramKeys(event, () => openScope(scope, true))}>
              <rect className="transaction-label-hit" x={left + 8} y={bottom - 23} width={frameWidth - 16} height="21" />
              <text className="transaction-caption transaction-end" x={left + 12} y={bottom - 9}>
                {scope.kind === 'callback' ? 'Callback ends' : 'Method ends'} · L{scope.endLine} ↗
              </text>
            </g>
          </g>;
        })}
        {compact && context.state !== 'inside' && <g className={`sequence-transaction-context ${context.state}`}>
          <text x={w / 2} y="100" textAnchor="middle" className="transaction-caption">
            {context.state === 'outside' ? 'Outside TX scope · source boundary' : context.state === 'boundary' ? 'TX boundary line · inspect source' : context.state === 'unavailable' ? 'Scope unavailable · open full source' : 'No boundary detected in source'}
          </text>
          {['outside', 'boundary'].includes(context.state) && <g role="button" tabIndex={0}
            aria-label={`Open transaction start ${basename(context.scopes[0].path)}:${context.scopes[0].startLine}`}
            onClick={() => openScope(context.scopes[0])} onKeyDown={event => diagramKeys(event, () => openScope(context.scopes[0]))}>
            <rect className="transaction-label-hit" x="20" y="174" width={w - 40} height="25" />
            <text x={w / 2} y="191" textAnchor="middle" className="transaction-caption">Declared scope · L{context.scopes[0].startLine}–{context.scopes[0].endLine} ↗</text>
          </g>}
        </g>}
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
          const y = rowY[i];
          const number = compact ? stepNumber : i + 1;
          return (
            <g
              key={i}
              className="sequence-step"
              role="button"
              tabIndex={0}
              aria-label={`Inspect sequence step ${number}: ${e.label}`}
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
                x={compact ? w / 2 : Math.min(x(e.from), x(e.to)) + 8}
                textAnchor={compact ? 'middle' : 'start'}
                y={y - 10}
                className="sequence-label"
              >
                {number}. {e.label.slice(0, 48)}{e.label.length > 48 ? '…' : ''}
              </text>
              <text
                x={compact ? w / 2 : Math.min(x(e.from), x(e.to)) + 8}
                textAnchor={compact ? 'middle' : 'start'}
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
  revisionPending = false,
  onBusyChange,
  syncStatus,
  onBack,
  onRefresh,
  onContext,
  onDemoComment,
  onDemoApprove,
  initialReviewState,
  onReviewState,
  onPendingChange,
  onReady,
}) {
  const { mr } = snapshot;
  const localCheckout = live && snapshot.local?.mode === "local-git" ? snapshot.local : null;
  const syncedDate = localCheckout?.syncedAt ? new Date(localCheckout.syncedAt) : null;
  const syncedLabel = syncedDate && !Number.isNaN(syncedDate.getTime())
    ? syncedDate.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  const viewVersion = JSON.stringify([live, mr.web_url || mr.project_id, mr.iid,
    mr.diff_refs.base_sha, mr.diff_refs.start_sha, mr.diff_refs.head_sha]);
  const [patches, setPatches] = useState({ version: viewVersion, items: {} });
  const files = useMemo(() => snapshot.files.map(item => ({ ...item,
    ...(patches.version === viewVersion ? patches.items[item.path] : null) })), [snapshot.files, patches, viewVersion]);
  const flowIndexGraph = useMemo(() => buildGraph(snapshot.files), [snapshot.files]);
  const flows = useMemo(() => buildReviewFlows(snapshot.files, flowIndexGraph), [snapshot.files, flowIndexGraph]);
  const [flowId, setFlowId] = useState(initialReviewState?.version === viewVersion ? initialReviewState.flowId || "" : "");
  const [flowQuery, setFlowQuery] = useState("");
  const flowPicker = useRef(null);
  const reviewRoot = useRef(null);
  const flowViews = useRef(initialReviewState?.version === viewVersion ? initialReviewState.flowViews || {} : {});
  const [patchAttempt, setPatchAttempt] = useState(0);
  const [patchState, setPatchState] = useState({ busy: false, error: "" });
  const guideRequestFlow = useRef("");
  // Session view state is valid only for this exact MR diff. Drafts have their
  // own durable storage; pending requests and approval confirmations never resume.
  const restored = initialReviewState?.version === viewVersion &&
    files.some((item) => item.path === initialReviewState.selected) ? initialReviewState : null;
  const [tab, setTab] = useState(restored?.tab || (initialTab === "Sequence" ? "Sequence" : "Dependency flow"));
  const [architectureMode, setArchitectureMode] = useState(restored?.architectureMode ?? true);
  const [sequenceMode, setSequenceMode] = useState(restored?.sequenceMode || 'auto');
  const [sequenceStep, setSequenceStep] = useState(restored?.sequenceStep || null);
  const [composerOpen, setComposerOpen] = useState(restored?.composerOpen ?? true);
  const [discussionsOpen, setDiscussionsOpen] = useState(false);
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [activeFinding, setActiveFinding] = useState(restored?.activeFinding || null);
  const commentInput = useRef(null);
  const [selected, setSelected] = useState(restored?.selected || files[0]?.path);
  const activeFlow = flows.find(flow => flow.id === flowId) || flows.find(flow => flow.paths.includes(selected)) || flows[0];
  const activeFlowRef = useRef(activeFlow?.id); activeFlowRef.current = activeFlow?.id;
  const flowPaths = useMemo(() => new Set([...(activeFlow?.paths || []), ...(activeFlow?.sharedPaths || [])]), [activeFlow]);
  const visibleFiles = useMemo(() => files.filter(item => flowPaths.has(item.path)), [files, flowPaths]);
  const [line, setLine] = useState(restored?.line ?? null);
  const [side, setSide] = useState(restored?.side || "new");
  const [codeMode, setCodeMode] = useState(restored?.codeMode || "Diff");
  const [source, setSource] = useState({});
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [guide, setGuide] = useState(restored?.guide || snapshot.guide || null);
  const [guidelines, setGuidelines] = useState(restored?.guidelines || "");
  const [busy, setBusy] = useState("");
  useEffect(() => { onBusyChange?.(!!busy || guideBusy); }, [busy, guideBusy, onBusyChange]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [zoom, setZoom] = useState(restored?.zoom || 0.85);
  const [autoFit, setAutoFit] = useState(restored?.autoFit ?? "readable");
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
  const [draftStorageError, setDraftStorageError] = useState("");
  const [drafts, setDrafts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) || "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved)
        ? Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === "string"))
        : {};
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
    try {
      localStorage.setItem(storeKey, JSON.stringify(drafts));
      setDraftStorageError("");
    } catch {
      setDraftStorageError("Draft could not be saved on this device. Keep this view open or copy your text before leaving.");
    }
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
  const sourceRef = file?.deleted_file ? mr.diff_refs.base_sha : mr.diff_refs.head_sha;
  const sourceKey = JSON.stringify([sourceRef, file?.deleted_file ? file?.old_path : file?.path]);
  const sourceCode = source[sourceKey];
  const highlightedSource = useMemo(() => highlightCode(sourceCode ?? '', file?.path), [sourceCode, file?.path]);
  const highlightedDiff = useMemo(() => highlightDiff(file || {}, file?.content ?? (file?.deleted_file ? undefined : sourceCode)), [file, sourceCode]);
  useEffect(() => {
    onReviewState?.({ version: viewVersion, selected, line, side, tab, codeMode,
      guide, guidelines, activeFinding, zoom, autoFit, architectureMode, sequenceMode, sequenceStep, composerOpen, flowId: activeFlow?.id, flowViews: flowViews.current });
  }, [viewVersion, selected, line, side, tab, codeMode, guide, guidelines, activeFinding, zoom, autoFit, architectureMode, sequenceMode, sequenceStep, composerOpen, activeFlow?.id]);
  useEffect(() => {
    if (codeMode === "Diff" || source[sourceKey] !== undefined || sourceError) onReady?.();
  }, [codeMode, source, sourceKey, sourceError]);
  const legacyDraftKey = `${file?.path}:${side}:${line || "file"}`;
  const diffVersion = JSON.stringify([mr.diff_refs.base_sha, mr.diff_refs.start_sha, mr.diff_refs.head_sha]);
  const currentDiffVersion = useRef(diffVersion);
  currentDiffVersion.current = diffVersion;
  const findingKey = (finding) => `checkpoint:${diffVersion}:${JSON.stringify([finding.path, finding.line, finding.title, finding.reason])}`;
  const canLocate = (finding) => {
    const target = files.find(item => item.path === finding.path);
    return !!target && Number.isInteger(finding.line) && (target.rows || []).some(row => row.kind !== "hunk" && (target.deleted_file ? row.oldLine : row.newLine) === finding.line);
  };
  function selectFinding(finding) {
    if (!canLocate(finding)) return;
    select(finding.path, finding.line);
    setCodeMode("Diff");
    setActiveFinding(findingKey(finding));
  }
  function draftFinding(finding) {
    if (!canLocate(finding)) return;
    const target = files.find(item => item.path === finding.path);
    const targetSide = target.deleted_file ? "old" : "new";
    const key = `${finding.path}:${targetSide}:${finding.line}${targetSide === "old" ? `:refs:${diffVersion}` : ""}`;
    const suggestion = `${finding.title}
${finding.reason}`;
    setDrafts(items => ({...items, [key]: items[key]?.includes(suggestion) ? items[key] : [items[key], suggestion].filter(Boolean).join("\n\n")}));
    selectFinding(finding);
    setNotice("AI suggestion added to your draft. Edit it before posting.");
    setComposerOpen(true);
    requestAnimationFrame(() => {
      commentInput.current?.focus({preventScroll:true});
      commentInput.current?.scrollIntoView({block:"nearest"});
    });
  }
  const draftKey = side === "old" ? `${legacyDraftKey}:refs:${diffVersion}` : legacyDraftKey;
  const draft = drafts[draftKey] || "";
  const pendingDrafts = useMemo(() => listReviewDrafts(drafts, files, diffVersion), [drafts, files, diffVersion]);
  const unverifiedDraft = side === "old" && !Object.hasOwn(drafts, draftKey) ? drafts[legacyDraftKey] : "";
  const previousDiffVersion = useRef(diffVersion);
  useEffect(() => {
    if (previousDiffVersion.current === diffVersion) return;
    previousDiffVersion.current = diffVersion;
    setLine(null);
    setSide(file?.deleted_file ? "old" : "new");
    setConfirmApproval(false);
    setGuide(null);
    setSequenceStep(null);
    flowViews.current = {};
    setActiveFinding(null);
    setGuideError("");
    setNotice("Diff base changed. Previous line drafts remain saved with their original version. Select a line to continue.");
  }, [diffVersion]);
  const transactionFiles = useMemo(() => files.map(item => {
    const cached = source[JSON.stringify([mr.diff_refs.head_sha, item.path])];
    return !item.deleted_file && typeof cached === 'string' ? { ...item, content: cached } : item;
  }), [files, source, mr.diff_refs.head_sha]);
  const fullGraph = useMemo(() => annotateTransactions(annotateReviewGraph(buildGraph(files, guide), files), transactionFiles), [files, guide, transactionFiles]);
  const graph = useMemo(() => scopeReviewGraph(fullGraph, activeFlow), [fullGraph, activeFlow]);
  const sequenceParticipants = new Set(graph.sequence.flatMap(step => [step.from, step.to]));
  const sequenceByStep = sequenceMode === 'step' || (sequenceMode === 'auto' && sequenceParticipants.size > 4);
  let sequenceIndex = graph.sequence.findIndex(step => sequenceKey(step) === sequenceStep);
  if (sequenceIndex < 0) {
    const relevant = graph.sequence.map((step, index) => ({ step, index }))
      .filter(({ step }) => step.path === selected);
    sequenceIndex = relevant.length
      ? relevant.reduce((nearest, next) => Math.abs(next.step.line - (line || 1)) < Math.abs(nearest.step.line - (line || 1)) ? next : nearest).index
      : Math.max(0, graph.sequence.findIndex(step => step.to === selected));
  }
  const currentInteraction = graph.sequence[sequenceIndex];
  const sequenceGraph = sequenceByStep && currentInteraction ? { ...graph,
    nodes: graph.nodes.filter(node => node.id === currentInteraction.from || node.id === currentInteraction.to),
    sequence: [currentInteraction] } : graph;
  const boundaryPaths = useMemo(() => [...new Set([...graph.boundaryDependencies, ...graph.boundarySequence]
    .map(edge => flowPaths.has(edge.from) ? edge.to : edge.from))], [graph, flowPaths]);
  const scopeKey = JSON.stringify([...flowPaths]);
  useEffect(() => {
    let current = true;
    const missing = files.filter(item => flowPaths.has(item.path) && item.deferred);
    setPatchState({ busy: !!missing.length, error: "" });
    if (!live || !missing.length) return () => { current = false; };
    (async () => {
      for (const item of missing) {
        if (!current) return;
        try {
          const loaded = await invoke("gitlab.diff", { projectId: mr.project_id,
            baseSha: mr.diff_refs.base_sha, headSha: mr.diff_refs.head_sha, path: item.path });
          if (!current) return;
          setPatches(old => ({ version: viewVersion, items: { ...(old.version === viewVersion ? old.items : {}), [item.path]: loaded } }));
        } catch (error) {
          if (!current) return;
          setPatchState(old => ({ ...old, error: error.message }));
        }
      }
      if (current) setPatchState(old => ({ ...old, busy: false }));
    })();
    return () => { current = false; };
  }, [scopeKey, viewVersion, patchAttempt, live]);
  const dependency = useMemo(() => dependencyLayout(graph), [graph]);
  const architecture = useMemo(() => architectureLayout(graph), [graph]);
  const layout = architectureMode && architecture ? architecture : dependency;
  const changeStats = useMemo(() => files.reduce((stats, item) => {
    for (const row of item.rows || []) {
      if (row.kind === "added") stats.added++;
      if (row.kind === "removed") stats.removed++;
    }
    return stats;
  }, { added: 0, removed: 0 }), [files]);
  useEffect(() => {
    if (!selected) return;
    let frame;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
      const panel = mapPanel.current;
      const node = panel?.querySelector(".diagram-node.selected");
      if (!node) return;
      const bounds = panel.getBoundingClientRect();
      const controls = panel.querySelector('.review-diagram-controls');
      const controlsHeight = controls?.getBoundingClientRect().height || 36;
      const controlsSize = `${controlsHeight}px`;
      if (panel.style.getPropertyValue('--review-controls-height') !== controlsSize)
        panel.style.setProperty('--review-controls-height', controlsSize);
      const progressHeight = panel.querySelector('.review-file-progress')?.getBoundingClientRect().height || 0;
      const safeTop = bounds.top + controlsHeight + progressHeight + 8;
      const canvas = node.closest('.diagram-scroll');
      if (!canvas) return;
      let target = node.getBoundingClientRect(), canvasBounds = canvas.getBoundingClientRect();
      if (target.bottom > bounds.bottom || target.top < safeTop) {
        panel.scrollTop += canvasBounds.top - safeTop;
        canvasBounds = canvas.getBoundingClientRect(); target = node.getBoundingClientRect();
      }
      if (target.left < canvasBounds.left || target.right > canvasBounds.right)
        canvas.scrollLeft += target.left - canvasBounds.left - Math.max(8, (canvasBounds.width - target.width) / 2);
      const visibleTop = Math.max(safeTop, canvasBounds.top), visibleBottom = Math.min(bounds.bottom, canvasBounds.bottom);
      if (target.top < visibleTop || target.bottom > visibleBottom)
        canvas.scrollTop += target.top - visibleTop - Math.max(8, (visibleBottom - visibleTop - target.height) / 2);
      const revealed = node.getBoundingClientRect();
      if (revealed.top < safeTop || revealed.bottom > bounds.bottom)
        canvas.scrollTop += revealed.top - safeTop;
      });
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    if (mapPanel.current) observer.observe(mapPanel.current);
    const controls = mapPanel.current?.querySelector('.review-diagram-controls');
    if (controls) observer.observe(controls);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [activeFinding, selected, tab, zoom, layout, sequenceByStep, sequenceStep]);
  useEffect(() => {
    if (!autoFit || tab === "AI guide") return;
    const canvas = mapPanel.current?.querySelector(".diagram-scroll");
    if (!canvas) return;
    function fit() {
      const svg = canvas.querySelector("svg");
      if (svg) setZoom(Math.min(1, Math.max(autoFit === true ? 0.15 : 0.65, (canvas.clientWidth - 24) / svg.viewBox.baseVal.width)));
    }
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [autoFit, tab, layout, sequenceByStep, sequenceStep]);
  useEffect(() => {
    const content = source[sourceKey];
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
        reviewFlow: activeFlow ? { label: activeFlow.label, paths: [...flowPaths] } : null,
      }),
    );
  }, [file?.path, file?.diff, line, side, codeMode, source, sourceKey, mr.id, mr.diff_refs.head_sha, guide?.summary, activeFlow?.id]);
  useEffect(() => {
    if (line !== null)
      requestAnimationFrame(() =>
        reviewRoot.current
          ?.querySelector(`[data-code-line="${side}-${line}"]`)
          ?.scrollIntoView({ block: "nearest" }),
      );
  }, [line, side, codeMode, source, file?.path, file?.rows]);
  useEffect(() => {
    setSourceLoading(false);
    setSourceError("");
    if (codeMode !== "Source" || !file || source[sourceKey] !== undefined)
      return;
    let current = true;
    if (!live) {
      setSource((s) => ({ ...s, [sourceKey]: file.content ?? null }));
      return;
    }
    setSourceLoading(true);
    invoke("gitlab.code", {
      projectId: mr.project_id,
      path: file.deleted_file ? file.old_path : file.path,
      ref: file.deleted_file ? mr.diff_refs.base_sha : mr.diff_refs.head_sha,
    })
      .then((data) => {
        if (current) setSource((s) => ({ ...s, [sourceKey]: data.content }));
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
  }, [codeMode, sourceKey, sourceAttempt, live]);
  function chooseFlow(flow, targetPath) {
    if (!flow) return;
    const scroll = Object.fromEntries([".visual-map-panel", ".visual-code-scroll", ".ai-review-guide"].map(selector => {
      const el = reviewRoot.current?.querySelector(selector); return [selector, el ? [el.scrollLeft, el.scrollTop] : [0, 0]];
    }));
    if (activeFlow) flowViews.current[activeFlow.id] = { selected, line, side, codeMode, tab, zoom, autoFit, architectureMode, sequenceMode, sequenceStep, composerOpen, guide, activeFinding, scroll };
    const saved = flowViews.current[flow.id];
    const path = targetPath || (saved && [...flow.paths, ...flow.sharedPaths].includes(saved.selected) ? saved.selected : flow.paths.find(path => !viewed.includes(path)) || flow.paths[0]);
    setFlowId(flow.id); setSelected(path); setLine(saved?.line || null);
    setSide(saved?.side || (files.find(item => item.path === path)?.deleted_file ? "old" : "new"));
    setCodeMode(saved?.codeMode || "Diff"); setTab(saved?.tab || "Dependency flow");
    setZoom(saved?.zoom || .85); setAutoFit(saved?.autoFit ?? "readable");
    setArchitectureMode(saved?.architectureMode ?? true);
    setSequenceMode(saved?.sequenceMode || 'auto'); setSequenceStep(saved?.sequenceStep || null);
    setComposerOpen(saved?.composerOpen ?? true); setDiscussionsOpen(false);
    setGuide(saved?.guide || snapshot.guide || null); setActiveFinding(saved?.activeFinding || null);
    setGuideError(""); setError(""); setNotice("");
    if (flowPicker.current?.open) { flowPicker.current.open = false; flowPicker.current.querySelector("summary")?.focus(); }
    requestAnimationFrame(() => {
      for (const [selector, pos] of Object.entries(saved?.scroll || scroll)) reviewRoot.current?.querySelector(selector)?.scrollTo(...(saved ? pos : [0,0]));
    });
  }
  function select(path, targetLine) {
    if (!flowPaths.has(path)) chooseFlow(flows.find(flow => flow.paths.includes(path)), path);
    else setFlowId(activeFlow.id);
    if (!currentInteraction || ![currentInteraction.from, currentInteraction.to].includes(path) ||
      (targetLine && (currentInteraction.path !== path || currentInteraction.line !== targetLine))) setSequenceStep(null);
    if (path !== selected) setDiscussionsOpen(false);
    setSelected(path);
    setLine(targetLine || null);
    setSide(files.find((item) => item.path === path)?.deleted_file ? "old" : "new");
    setError("");
    setNotice("");
  }
  function showInteraction(index) {
    const step = graph.sequence[index];
    if (!step) return;
    select(step.path, step.line);
    setSequenceStep(sequenceKey(step));
  }
  function openDraft(item) {
    if (!item.current) return;
    select(item.path, item.line);
    setSide(item.side);
    const target = files.find(file => file.path === item.path);
    setCodeMode(item.line && !reviewPosition(target, item.line, item.side, mr.diff_refs) &&
      (item.side === 'new' || target.deleted_file) ? 'Source' : 'Diff');
    setComposerOpen(true);
    requestAnimationFrame(() => commentInput.current?.focus({ preventScroll: true }));
  }
  function changeCodeMode(mode) {
    if (mode === "Source") {
      const sourceSide = file.deleted_file ? "old" : "new";
      if (side !== sourceSide) {
        const row = line === null ? null : file.rows.find((item) =>
          item.kind !== "hunk" && (side === "old" ? item.oldLine : item.newLine) === line);
        setLine(row ? (sourceSide === "old" ? row.oldLine : row.newLine) : null);
        setSide(sourceSide);
      }
    }
    setCodeMode(mode);
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
    const ordered = [...visibleFiles, ...files.filter(item => !flowPaths.has(item.path))];
    const index = ordered.findIndex((f) => f.path === file.path);
    const remaining = [...ordered.slice(index + 1), ...ordered.slice(0, index + 1)]
      .find((f) => !viewed.includes(f.path));
    if (remaining) select(remaining.path);
  }
  async function generate() {
    if (guideBusy || refreshing || revisionPending) return;
    const version = currentDiffVersion.current;
    const requestedFlow = activeFlow.id;
    guideRequestFlow.current = requestedFlow;
    setGuideBusy(true);
    setGuideError("");
    try {
      if (!live) {
        const sample = snapshot.demoGuide || {};
        setGuide({
          ...sample,
          ...(flows.length > 1 ? {
            findings: (sample.findings || []).filter(item => flowPaths.has(item.path)),
            readingOrder: (sample.readingOrder || []).filter(item => flowPaths.has(item.path)),
          } : {}),
          model: "Sample guide",
          headSha: mr.diff_refs.head_sha,
          coverage: {
            includedFiles: visibleFiles.length,
            totalFiles: visibleFiles.length,
            scope: flows.length > 1 ? "flow" : "mr",
            mrTotalFiles: files.length,
            truncated: false,
            diffOnly: true,
          },
        });

      } else {
        const result = await invoke("claude.review", {
          projectId: mr.project_id,
          iid: mr.iid,
          headSha: mr.diff_refs.head_sha,
          baseSha: mr.diff_refs.base_sha,
          startSha: mr.diff_refs.start_sha,
          guidelines,
          ...(flows.length > 1 ? { paths: [...flowPaths].slice(0, 24) } : {}),
        });
        if (alive.current) {
          if (currentDiffVersion.current !== version) throw Error("The diff changed during analysis. Generate a guide for the current version.");
          if (activeFlowRef.current === requestedFlow) setGuide(result);
          else flowViews.current[requestedFlow] = { ...flowViews.current[requestedFlow], guide: result };
        }
      }
    } catch (e) {
      if (alive.current && activeFlowRef.current === requestedFlow) setGuideError(e.message);
    } finally {
      if (alive.current) setGuideBusy(false);
    }
  }
  async function post() {
    const submittedKey = draftKey;
    const submittedDraft = draft;
    const text = draft.trim();
    if (!text || busy || refreshing || revisionPending) return;
    setBusy("comment");
    if (live) onPendingChange?.("comment");
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
          baseSha: mr.diff_refs.base_sha,
          startSha: mr.diff_refs.start_sha,
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
        onDemoComment?.(`${file.path}${line ? ":" + line : ""} — ${text}`, { path: file.path, line, side, body: text, position });
      }
      if (alive.current) {
        setDiscussions((d) => [...d, thread]);
        setDiscussionsOpen(true);
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
      if (live) onPendingChange?.("");
    }
  }
  async function approve() {
    if (busy || refreshing || revisionPending) return;
    setBusy("approve");
    if (live) onPendingChange?.("approve");
    setError("");
    try {
      if (live)
        await invoke("gitlab.approve", {
          projectId: mr.project_id,
          iid: mr.iid,
          headSha: mr.diff_refs.head_sha,
          baseSha: mr.diff_refs.base_sha,
          startSha: mr.diff_refs.start_sha,
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
      if (live) onPendingChange?.("");
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
        <p>{localCheckout ? "The local checkout contains no changes for this merge request. Refresh to fetch the latest revision." : "GitLab may still be preparing the diff. Refresh to try again."}</p>
        <button className="btn" disabled={refreshing} onClick={() => onRefresh?.({ refresh: true })}>
          Refresh
        </button>
      </div>
    );
  return (
    <div className="visual-review review-workbench" ref={reviewRoot}>
      <header className="visual-review-heading">
        <div className="inline">
          <button className="quiet-button" disabled={!!busy} onClick={onBack}>
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
            <div className="review-branch-context">
              <p>{mr.source_branch} <ArrowRight size={12} /> {mr.target_branch}</p>
              {localCheckout && (
                <details className="review-local-checkout" onKeyDown={(event) => {
                  if (event.key === "Escape" && event.currentTarget.open) {
                    event.stopPropagation();
                    event.currentTarget.open = false;
                    event.currentTarget.querySelector("summary")?.focus();
                  }
                }} onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
                }}>
                  <summary aria-label="Local checkout details">
                    <GitBranch size={12} /> Local checkout <ChevronDown size={11} />
                  </summary>
                  <div className="review-local-checkout-details">
                    <strong>{localCheckout.sourceBranch || mr.source_branch}</strong>
                    <span>Checked out at <code>{String(localCheckout.headSha || mr.diff_refs.head_sha).slice(0, 12)}</code></span>
                    {syncedLabel && <span>Last synced <time dateTime={syncedDate.toISOString()}>{syncedLabel}</time></span>}
                    <p>Diffs and source are read from this local checkout. Refresh fetches the latest commits and review metadata.</p>
                    <small>Repository files are stored on disk, outside the encrypted assistant memory.</small>
                    {localCheckout.worktreePath && <code className="review-local-path">{localCheckout.worktreePath}</code>}
                  </div>
                </details>
              )}
              {syncStatus}
            </div>
          </div>
          <div className="inline">
            <button
              className="btn"
              disabled={!!busy || guideBusy || refreshing}
              title={localCheckout ? "Fetch latest commits and refresh review metadata" : "Refresh review"}
              aria-busy={refreshing}
              onClick={() => onRefresh?.({ refresh: true })}
            >
              <RefreshCw size={13} className={refreshing ? "spin" : ""} />{" "}
              Refresh
            </button>
            <button
              className="btn primary"
              disabled={guideBusy || refreshing || revisionPending}
              onClick={generate}
            >
              {guideBusy ? (
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
          <ReviewFlowPicker flows={flows} activeFlow={activeFlow} viewed={viewed} query={flowQuery}
            onQuery={setFlowQuery} onChoose={chooseFlow} pickerRef={flowPicker}/>
          <ReviewDraftNavigator drafts={drafts} files={files} diffVersion={diffVersion} onOpen={openDraft}/>
          <span className="reading-path-label">{layout.semantic ? 'Read by layer' : 'Read by dependency'}</span>
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
      {refreshing && <p className="review-pending-notice" role="status">Refreshing checkout and review context… You can keep reading and editing your draft.</p>}
      {guideBusy && guideRequestFlow.current !== activeFlow?.id && <p className="review-pending-notice" role="status">Generating the AI guide for {flows.find(flow => flow.id === guideRequestFlow.current)?.label || "another flow"}. It will be saved with that flow.</p>}
      {live && busy && <p className="review-pending-notice" role="status">{busy === "comment" ? "Posting review comment…" : "Submitting approval…"} Keep this review open until GitLab responds. You can keep reading and editing your draft.</p>}
      {externalError && (
        <div role="alert" className="connection-error">
          {externalError}
        </div>
      )}
      {(snapshot.truncated || files.some((f) => f.unavailable)) && (
        <div className="review-notice">
          Some patches are deferred or unavailable. All returned changed-file names remain listed; open a flow to load its local diffs. This view does not cover the entire repository.
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
          <ReviewFlowContext flows={flows} activeFlow={activeFlow} viewed={viewed} onChoose={chooseFlow} onSelect={select} graph={flowIndexGraph}/>
          <div className="review-diagram-controls">
          <div
            className="visual-tabs"
            role="tablist"
            aria-label="Review visualization"
          >
            {[
              ["Dependency flow", Network],
              ["Sequence", Workflow],
            ].map(([name, Icon]) => (
              <button
                key={name}
                role="tab"
                aria-selected={tab === name}
                tabIndex={tab === name ? 0 : -1}
                className={tab === name ? "active" : ""}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const tabs = [...event.currentTarget.parentElement.querySelectorAll('[role="tab"]')];
                  const index = tabs.indexOf(event.currentTarget);
                  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                  tabs[next]?.focus();
                  tabs[next]?.click();
                }}
                onClick={() => setTab(name)}
              >
                <Icon size={14} />
                {name}
              </button>
            ))}
          </div>
          <>
              <div className="diagram-toolbar">
                <div>
                  <strong>
                    {tab === "Dependency flow"
                      ? layout.semantic ? "Architecture layers" : "Dependency map"
                      : "Interaction sequence"}
                  </strong>
                  {tab === "Dependency flow" && <span className="diagram-evidence-count">{graph.dependencies.filter((e) => e.evidence === "code").length} resolved · {graph.dependencies.filter((e) => e.evidence !== "code").length} inferred</span>}
                  <small>
                    {tab === "Dependency flow"
                      ? layout.semantic ? "Roles from source and conventions. Arrows show code links." : "Changed files only. Solid imports; dashed inferred references."
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
                <button className="quiet-button" aria-label="Read diagram at 100%" title="Read at 100%" onClick={() => { setAutoFit(false); setZoom(1); }}>100%</button>
                <button
                  className="icon-button"
                  aria-label="Zoom in diagram"
                  onClick={() => { setAutoFit(false); setZoom((z) => Math.min(1.5, z + 0.1)); }}
                >
                  <ZoomIn size={15} />
                </button>
              </div>
              {tab === 'Dependency flow' && architecture && <div className="review-map-mode" role="group" aria-label="Diagram layout">
                <button aria-pressed={architectureMode} onClick={() => { setArchitectureMode(true); setAutoFit('readable'); }}>By role</button>
                <button aria-pressed={!architectureMode} onClick={() => { setArchitectureMode(false); setAutoFit('readable'); }}>By dependency</button>
                <small>{layout.semantic ? 'Role groups' : 'Import depth'}</small>
              </div>}
              {tab === 'Sequence' && graph.sequence.length > 0 && <>
                <div className="sequence-scope-controls" role="group" aria-label="Sequence detail">
                  <button aria-pressed={sequenceByStep} onClick={() => { setSequenceMode('step'); setAutoFit('readable'); }}>Step by step</button>
                  <button aria-pressed={!sequenceByStep} onClick={() => { setSequenceMode('whole'); setAutoFit('readable'); }}>Whole flow</button>
                  <small>{graph.sequence.length} static interactions</small>
                </div>
                {sequenceByStep && <div className="sequence-step-navigation">
                  <button className="icon-button" aria-label="Previous interaction" disabled={sequenceIndex === 0} onClick={() => showInteraction(sequenceIndex - 1)}><ArrowLeft size={12}/></button>
                  <select aria-label="Sequence interaction" value={sequenceIndex} onChange={event => showInteraction(Number(event.target.value))}>
                    {graph.sequence.map((step, index) => <option key={sequenceKey(step)} value={index}>{index + 1}/{graph.sequence.length}. {basename(step.from)} → {basename(step.to)} · {basename(step.path)}:{step.line}</option>)}
                  </select>
                  <button className="icon-button" aria-label="Next interaction" disabled={sequenceIndex === graph.sequence.length - 1} onClick={() => showInteraction(sequenceIndex + 1)}><ArrowRight size={12}/></button>
                </div>}
              </>}
          </>
          </div>
          <>
              {tab === "Dependency flow" ? (
                <DependencyDiagram
                  graph={graph}
                  layout={layout}
                  selected={selected}
                  onSelect={select}
                  zoom={zoom}
                  dependencyPositions={dependency.positions}
                  viewed={viewed}
                />
              ) : (
                <SequenceDiagram
                  graph={sequenceGraph}
                  selected={selected}
                  onSelect={(path, targetLine) => { select(path, targetLine); if (sequenceByStep && currentInteraction) setSequenceStep(sequenceKey(currentInteraction)); }}
                  onScopeSelect={(path, targetLine) => { select(path, targetLine); setCodeMode('Source'); if (currentInteraction) setSequenceStep(sequenceKey(currentInteraction)); }}
                  zoom={zoom}
                  compact={sequenceByStep}
                  stepNumber={sequenceIndex + 1}
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
                  {tab === 'Sequence' ? 'TX shading: declared source scope. Click its start/end to inspect. Calls are static evidence; runtime commit, rollback and propagation are not inferred.' : 'Solid: resolved import · Dashed: inferred reference. Arrows navigate; Enter opens code.'}
                </small>
              </div>
              {boundaryPaths.length > 0 && <div className="review-flow-boundaries"><small>Connected outside this flow</small>{boundaryPaths.slice(0, 8).map(path => <button key={path} className="linked-chip" onClick={() => select(path)} title={path}>{basename(path)} <ArrowRight size={10}/></button>)}{boundaryPaths.length > 8 && <details><summary>{boundaryPaths.length - 8} more connections</summary>{boundaryPaths.slice(8).map(path => <button key={path} className="linked-chip" onClick={() => select(path)} title={path}>{basename(path)} <ArrowRight size={10}/></button>)}</details>}</div>}
              <div className="review-component-list">
                {visibleFiles.map((f) => (
                  <button
                    className={f.path === selected ? "selected" : ""}
                    key={f.path}
                    onClick={() => select(f.path)}
                  >
                    {viewed.includes(f.path)
                      ? <Check size={13} className="review-file-viewed" aria-label="Viewed" />
                      : <FileCode2 size={13} />}
                    {f.path}{activeFlow?.sharedPaths.includes(f.path) && <small>Shared</small>}
                    <span>
                      {(f.rows || []).filter((r) => r.kind === "added").length}{" "}
                      additions
                    </span>
                  </button>
                ))}
              </div>
          </>
        </section>
        <section className="visual-code-panel" aria-label="Code and your review">
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
                  onClick={() => changeCodeMode(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="code-provenance">
            <div>{localCheckout ? "Local Git code" : live ? "Repository code" : "Sample fixture"} ·{" "}
            {codeMode === "Source"
              ? (file.deleted_file ? "base" : "head") +
                " " +
                (file.deleted_file
                  ? mr.diff_refs.base_sha
                  : mr.diff_refs.head_sha
                ).slice(0, 8)
              : "Old / New line numbers"}
            <span className="code-language" title="Language syntax colors and matching bracket colors">{codeMode === 'Source' ? highlightedSource.label : codeLanguage(file.path)[1]}</span></div>
            {line && (
              <span>
                Selected {side === "old" ? "old" : "new"} line {line}
              </span>
            )}
          </div>
          {patchState.error && <div className="connection-error" role="alert">{patchState.error}<button className="btn" onClick={() => setPatchAttempt(value => value + 1)}>Retry flow code</button></div>}
          <div className="visual-code-scroll" aria-label="Component code">
            {file.deferred && codeMode === "Diff" && <p className="code-state">{patchState.busy ? "Loading this flow’s local diffs…" : "Diff not loaded yet."}</p>}
            {sourceLoading && (
              <div className="code-state">
                <Loader2 className="spin" size={20} /> Loading source…
              </div>
            )}
            {sourceError && (
              <div role="alert" className="connection-error">
                {sourceError}
                <button className="btn" onClick={() => setSourceAttempt((n) => n + 1)}>Retry source</button>
                <button className="btn" onClick={() => setCodeMode("Diff")}>
                  View diff
                </button>
              </div>
            )}
            {codeMode === "Source" && !sourceLoading && !sourceError ? (
              typeof source[sourceKey] === "string" ? (
                source[sourceKey].split("\n").map((text, i) => (
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
                      <CodeText tokens={highlightedSource.lines[i]} />
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
                    className={`visual-code-line ${r.kind} ${line !== null && line === (side === "old" ? r.oldLine : r.newLine) ? "selected" : ""}`}
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
                      <CodeText tokens={highlightedDiff[i]} />
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
          <div className={`visual-comment-panel${composerOpen ? '' : ' is-collapsed'}`}>
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
              <button className="review-composer-toggle" aria-label={composerOpen ? 'Collapse review composer' : 'Expand review composer'} aria-expanded={composerOpen} onClick={() => setComposerOpen(open => !open)}>{composerOpen ? 'Hide editor' : draft ? 'Edit draft' : 'Write review'}</button>
            </div>
            {composerOpen && <>
            {unverifiedDraft && (
              <details className="legacy-review-draft">
                <summary>Earlier draft needs a base revision check</summary>
                <p>This draft has no saved base revision. Check the current code before reusing it.</p>
                <pre>{unverifiedDraft}</pre>
                <button className="btn" onClick={() => setDrafts((items) => ({ ...items, [draftKey]: unverifiedDraft }))}>
                  Use text for this version
                </button>
              </details>
            )}
            <div className="your-review-label"><b>Your review</b><span>Private draft · post when ready</span></div>
            <textarea
              ref={commentInput}
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
              <small>{draftStorageError ? "Draft not saved" : "Draft saved locally"} · ⌘ / Ctrl + Enter</small>
              <button
                className="btn primary"
                disabled={!draft.trim() || !!busy || refreshing || revisionPending}
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
            </>}
            {draftStorageError && <div className="connection-error" role="alert">{draftStorageError}</div>}
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
            {composerOpen && notes.length > 0 && <details className="review-existing-discussions" open={discussionsOpen} onToggle={event => setDiscussionsOpen(event.currentTarget.open)}>
            <summary>Discussion · {notes.length} {notes.length === 1 ? 'comment' : 'comments'}</summary>
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
            </details>}
          </div>
          <div className="visual-review-approval">
            {confirmApproval ? (
              <>
                <span>Approve this commit? {viewedCount}/{files.length} files viewed · {pendingDrafts.length} unposted {pendingDrafts.length === 1 ? 'draft' : 'drafts'}.{pendingDrafts.length > 0 && ' Drafts remain private and are not posted by approval.'}</span>
                <button
                  className="btn"
                  disabled={busy === "approve"}
                  onClick={() => setConfirmApproval(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
                  disabled={!!busy || refreshing || revisionPending}
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
                  disabled={approved || !!busy || refreshing || revisionPending}
                  onClick={() => setConfirmApproval(true)}
                >
                  <Check size={13} />
                  {approved ? "Approved" : "Approve MR"}
                </button>
              </>
            )}
          </div>
        </section>
        <ReviewGuidePanel guide={guide} files={files} mr={mr} live={live}
          flowPaths={flows.length > 1 ? [...flowPaths] : null} flowLabel={`${activeFlow?.title || activeFlow?.label || 'Changed files'}${activeFlow?.section ? ` · ${activeFlow.section.index}/${activeFlow.section.count}` : ''}`}
          endpoint={configs.claude?.url} guidelines={guidelines} onGuidelines={setGuidelines}
          busy={guideBusy && guideRequestFlow.current === activeFlow?.id} refreshing={refreshing || revisionPending || guideBusy} error={guideError} onGenerate={generate} selectedPath={file.path}
          activeFinding={activeFinding} findingKey={findingKey} canLocate={canLocate}
          onSelect={selectFinding} onDraft={draftFinding} decisions={drafts}
          onDecision={(finding,value)=>setDrafts(items=>({...items,[findingKey(finding)]:value}))}/>
      </div>
    </div>
  );
}
