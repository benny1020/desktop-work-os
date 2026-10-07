import React, { useEffect, useRef } from 'react';
import { Check, GitBranch } from 'lucide-react';

export default function ApiFlowContext({ flow, reviewed, onReviewed, onSelect }) {
  const details = useRef(null);
  useEffect(() => { if (details.current) details.current.open = false; }, [flow.id]);
  const rootReturns = flow.endings.filter(end => end.root && end.kind === 'return');
  const exceptions = flow.endings.filter(end => end.kind === 'throw');
  function openSource(path, line) {
    details.current.open = false;
    details.current.querySelector('summary')?.focus();
    onSelect(path, line);
  }
  return <div className="api-flow-context" aria-label={flow.api ? "Current API flow" : "Current business flow"}>
    <div className="api-flow-title"><strong title={flow.title}>{flow.title}</strong><label><input type="checkbox" checked={reviewed} onChange={event => onReviewed(event.target.checked)} aria-label={flow.api ? "Mark API flow reviewed" : "Mark business flow reviewed"}/>{reviewed ? <Check size={11}/> : null}Reviewed</label></div>
    <button className="api-entry-point" onClick={() => onSelect(flow.entrypoint.path, flow.entrypoint.line)} title={`${flow.entrypoint.path}:${flow.entrypoint.line}`}>
      <small>{flow.api ? "Request entry" : flow.kind === "core" ? "Changed core method" : flow.kind === "kafka" ? "Kafka message entry" : ["scheduled", "job"].includes(flow.kind) ? "Job entry" : "Message entry"}</small><b>{flow.entrypoint.label}</b>
    </button>
    {flow.trigger && <p className="api-trigger-declaration" title={`${flow.trigger.detail}\n${flow.trigger.declaration}`}>{flow.trigger.detail}</p>}
    {flow.kind === "core" && <p className="api-analysis-warning">Change scope · runtime entry not established</p>}
    <div className="api-context-actions">
      <details className="api-flow-details" ref={details} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={event => {
        if (event.key === 'Escape' && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
      }}>
        <summary aria-label="Flow details">Flow details <small>{flow.ranges.length} methods</small></summary>
        <div className="api-flow-details-list">
          <p>{flow.ranges.length} connected methods · shared classes repeat across flows. Static source paths, not a runtime trace.</p>
          {!!flow.contracts?.length && <details className="api-contracts"><summary>{flow.contracts.length} related data contracts</summary>{flow.contracts.map(path => <button key={path} onClick={() => openSource(path, 1)}>{path.split("/").at(-1)}</button>)}</details>}
          <div className="api-return-points"><span>{flow.api ? "Handler return" : "Completion / return"}</span>{rootReturns.map((end, index) => <button key={index} onClick={() => openSource(end.path, end.line)} title={end.branch || 'Source return'}>L{end.line}{end.branch ? ` · ${end.branch}` : ''}</button>)}{!rootReturns.length && <small>Implicit completion · inspect final statement</small>}</div>
          <details className="api-flow-boundaries"><summary><GitBranch size={11}/> {exceptions.length} exception exits · {flow.boundaries.length} call boundaries</summary>
            <div className="api-boundary-list">
              <p>Possible branches are included; dispatch and runtime types are not proven.</p>
              {exceptions.map((end, index) => <button key={`e${index}`} onClick={() => openSource(end.path, end.line)}>Throw · {end.method}():{end.line}{end.branch ? ` · ${end.branch}` : ''}</button>)}
              {flow.boundaries.map((call, index) => <button key={`b${index}`} onClick={() => openSource(call.path, call.line)}><b>{call.label} · L{call.line}</b><small>{call.reason}{call.branch ? ` · ${call.branch}` : ''}</small></button>)}
            </div>
          </details>
        </div>
      </details>
      {rootReturns[0] && <button className="api-flow-end" title={`${flow.api ? 'Handler return' : 'Completion / return'} · ${rootReturns[0].path}:${rootReturns[0].line}`} onClick={() => onSelect(rootReturns[0].path, rootReturns[0].line)}>End L{rootReturns[0].line}{rootReturns.length > 1 ? ` +${rootReturns.length - 1}` : ''}</button>}
    </div>
    {(flow.coverage.truncated || flow.coverage.omittedFiles || flow.coverage.failedFiles) ? <p className="api-analysis-warning">Partial analysis · {flow.coverage.omittedFiles || 0} source files omitted · {flow.coverage.failedFiles || 0} not parsed. Unresolved boundaries stay visible.</p> : null}
  </div>;
}
