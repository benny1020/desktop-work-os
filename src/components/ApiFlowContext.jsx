import React from 'react';
import { Check, GitBranch } from 'lucide-react';

export default function ApiFlowContext({ flow, reviewed, onReviewed, onSelect }) {
  const rootReturns = flow.endings.filter(end => end.root && end.kind === 'return');
  const exceptions = flow.endings.filter(end => end.kind === 'throw');
  return <div className="api-flow-context" aria-label={flow.api ? "Current API flow" : "Current business flow"}>
    <div className="api-flow-title"><strong>{flow.title}</strong><label><input type="checkbox" checked={reviewed} onChange={event => onReviewed(event.target.checked)} aria-label={flow.api ? "Mark API flow reviewed" : "Mark business flow reviewed"}/>{reviewed ? <Check size={11}/> : null}Reviewed</label></div>
    <button className="api-entry-point" onClick={() => onSelect(flow.entrypoint.path, flow.entrypoint.line)}>
      <small>{flow.api ? "Request entry" : flow.kind === "core" ? "Changed core method" : flow.kind === "kafka" ? "Kafka message entry" : ["scheduled", "job"].includes(flow.kind) ? "Job entry" : "Message entry"}</small><b>{flow.entrypoint.label}</b>
    </button>
    {flow.trigger && <p className="api-trigger-declaration" title={flow.trigger.declaration}>{flow.trigger.detail}</p>}
    {flow.kind === "core" && <p className="api-analysis-warning">Change scope · runtime entry not established</p>}
    {!!flow.contracts?.length && <details className="api-contracts"><summary>{flow.contracts.length} related data contracts</summary>{flow.contracts.map(path => <button key={path} onClick={() => onSelect(path, 1)}>{path.split("/").at(-1)}</button>)}</details>}
    <div className="api-method-path"><small>{flow.ranges.length} connected methods · shared classes repeat across flows</small></div>
    <div className="api-return-points"><span>{flow.api ? "Handler return" : "Completion / return"}</span>{rootReturns.map((end, index) => <button key={index} onClick={() => onSelect(end.path, end.line)}>L{end.line}{end.branch ? ` · ${end.branch}` : ''}</button>)}{!rootReturns.length && <small>Implicit completion · inspect final statement</small>}</div>
    <details className="api-flow-boundaries" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); event.stopPropagation(); } }}><summary><GitBranch size={11}/> {exceptions.length} exception exits · {flow.boundaries.length} call boundaries</summary>
      <div className="api-boundary-list"><p>Source call paths, including possible branches. Execution order, dispatch and runtime types are not proven.</p>
      {exceptions.map((end, index) => <button key={`e${index}`} onClick={() => onSelect(end.path, end.line)}>Throw · {end.method}():{end.line}{end.branch ? ` · ${end.branch}` : ''}</button>)}
      {flow.boundaries.map((call, index) => <button key={`b${index}`} onClick={() => onSelect(call.path, call.line)}><b>{call.label} · L{call.line}</b><small>{call.reason}{call.branch ? ` · ${call.branch}` : ''}</small></button>)}
      </div>
    </details>
    {(flow.coverage.truncated || flow.coverage.omittedFiles || flow.coverage.failedFiles) ? <p className="api-analysis-warning">Partial analysis · {flow.coverage.omittedFiles || 0} source files omitted · {flow.coverage.failedFiles || 0} not parsed. Unresolved boundaries stay visible.</p> : null}
  </div>;
}
