import React, { useMemo } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Workflow } from 'lucide-react';

const searchText = flow => [flow.title, flow.label, flow.subtitle, ...(flow.paths || []), ...(flow.sharedPaths || [])].join(' ').toLowerCase();
const displayTitle = flow => `${flow?.title || flow?.label || 'Changed files'}${flow?.section ? ` · ${flow.section.index}/${flow.section.count}` : ''}`;

export function ReviewFlowPicker({ flows, activeFlow, viewed, reviewedFlows = [], query, onQuery, onChoose, pickerRef }) {
  if (flows.length < 2) return <span className="review-single-flow" title={activeFlow?.reason}>1 review flow</span>;
  const matches = flows.filter(flow => searchText(flow).includes(query.toLowerCase()));
  return <details className="review-flow-picker" ref={pickerRef}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
    onToggle={event => { if (event.currentTarget.open) requestAnimationFrame(() => pickerRef.current?.querySelector('input')?.focus()); }}
    onKeyDown={event => {
      if (event.key === 'Escape' && pickerRef.current?.open) {
        event.preventDefault(); event.stopPropagation(); pickerRef.current.open = false; pickerRef.current.querySelector('summary')?.focus();
      }
    }}>
    <summary aria-label="Choose review flow" onClick={() => { if (!pickerRef.current?.open) onQuery(''); }}>
      <Workflow size={14}/><span className="review-flow-trigger-text"><b>{displayTitle(activeFlow)}</b><small>{activeFlow?.entrypoint?.label || activeFlow?.label}</small></span>
      <span className="review-flow-trigger-count">{flows.findIndex(flow => flow.id === activeFlow?.id) + 1}/{flows.length}</span><ChevronDown size={12}/>
    </summary>
    <div className="review-flow-menu">
      <div className="review-flow-menu-heading"><b>What do you want to review?</b><small>{flows.length} review scopes · all changed files included</small></div>
      <input aria-label="Search review flows" placeholder="Search a change, component or file…" value={query} onChange={event => onQuery(event.target.value)}
        onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); pickerRef.current?.querySelector('.review-flow-options button')?.focus(); } }}/>
      <div className="review-flow-options" onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const buttons = [...event.currentTarget.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
        event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }}>
        {matches.map(flow => {
          const completed = flow.api ? Number(reviewedFlows.includes(flow.id)) : flow.paths.filter(path => viewed.includes(path)).length;
          const total = flow.api ? 1 : flow.paths.length;
          const accessibleTitle = flows.filter(item => item.label === flow.label).length > 1 ? displayTitle(flow) : flow.label;
          return <button key={flow.id} aria-label={`Review flow ${accessibleTitle}`} aria-pressed={activeFlow?.id === flow.id} onClick={() => onChoose(flow)}>
            <span className="review-flow-option-body"><b>{displayTitle(flow)}</b><small className="review-flow-route">{flow.subtitle || `${flow.paths.length} changed files`}</small>
              <small className="review-flow-option-meta">{flow.paths.length} files{flow.sharedPaths.length ? ` + ${flow.sharedPaths.length} shared` : ''} · {flow.api ? 'API method flow' : flow.kind === 'flow' ? 'Linked code' : 'File group'}</small></span>
            <span className="review-flow-option-progress">{completed === total ? <Check size={13}/> : null}{flow.api ? completed ? 'Reviewed' : 'To review' : `${completed}/${flow.paths.length}`}<small>{flow.api ? `${flow.ranges.length} methods` : 'viewed'}</small></span>
          </button>;
        })}
        {!matches.length && <p className="review-flow-empty">No matching scopes. Try a file or component name.</p>}
      </div>
      <p className="review-flow-menu-note">{flows.some(flow => flow.api) ? 'API flows follow methods from request entry to handler return. Shared classes may appear in multiple flows; comments stay attached to their code.' : 'File groups follow source links and directory context. Shared files keep one canonical comment draft.'}</p>
    </div>
  </details>;
}

export function ReviewFlowContext({ flows, activeFlow, viewed, onChoose, onSelect, graph }) {
  const readingPath = useMemo(() => {
    if (!activeFlow?.entrypoint) return [];
    const allowed = new Set([...activeFlow.paths, ...activeFlow.sharedPaths]);
    const path = [activeFlow.entrypoint.path], seen = new Set(path);
    while (path.length < 4) {
      const edge = graph?.dependencies?.find(edge => edge.evidence === 'code' && edge.from === path.at(-1) && allowed.has(edge.to) && !seen.has(edge.to));
      if (!edge) break;
      path.push(edge.to); seen.add(edge.to);
    }
    return path.length > 1 ? path : [];
  }, [activeFlow, graph]);
  if (!activeFlow) return null;
  const index = flows.findIndex(flow => flow.id === activeFlow.id);
  return <div className="review-flow-context" aria-label="Current review scope">
    <div className="review-flow-context-heading"><strong>{displayTitle(activeFlow)}</strong>{flows.length > 1 && <div className="review-flow-paging">
      <button className="icon-button" aria-label="Previous review flow" onClick={() => onChoose(flows[(index + flows.length - 1) % flows.length])}><ArrowLeft size={13}/></button>
      <span>{index + 1}/{flows.length}</span><button className="icon-button" aria-label="Next review flow" onClick={() => onChoose(flows[(index + 1) % flows.length])}><ArrowRight size={13}/></button>
    </div>}</div>
    {readingPath.length > 0 ? <div className="review-flow-import-path" aria-label="Verified import reading path"><div>{readingPath.map((path, index) => <React.Fragment key={path}>{index > 0 && <ArrowRight size={10}/>}<button onClick={() => onSelect(path)} title={path}>{path.split('/').at(-1).replace(/\.[^.]+$/, '')}</button></React.Fragment>)}</div></div> : <p className="review-flow-context-route">{activeFlow.subtitle || 'Review these changed files together.'}</p>}
    <div className="review-flow-context-meta"><span>{activeFlow.paths.filter(path => viewed.includes(path)).length}/{activeFlow.paths.length} viewed{activeFlow.sharedPaths.length ? ` · ${activeFlow.sharedPaths.length} shared` : ''}</span>
      {activeFlow.entrypoint?.endpoint && <code className="review-flow-endpoint">{activeFlow.entrypoint.endpoint.method || 'Route'} {activeFlow.entrypoint.endpoint.path}</code>}
      {activeFlow.entrypoint && <button className="quiet-button" onClick={() => onSelect(activeFlow.entrypoint.path)} title={activeFlow.entrypoint.path}>Start here <ArrowRight size={11}/></button>}
    </div>
    <details className="review-flow-explanation"><summary>Why these files?</summary><p>{activeFlow.evidenceSummary || activeFlow.evidence || activeFlow.reason}</p>
      <ul>{activeFlow.paths.map(path => <li key={path}><button onClick={() => onSelect(path)}>{path}</button></li>)}</ul>
    </details>
  </div>;
}
