import React, { useEffect, useRef } from 'react';
import { basename } from '../lib/review-model.mjs';

// Class arrows aggregate relationships; keep every method call inspectable.
export default function ReviewCallContext({ graph, selected, onInspect }) {
  const root = useRef(null);
  useEffect(() => { if (root.current) root.current.open = false; }, [selected, graph]);
  const calls = graph.sequence.map((step, index) => ({step, index})).filter(({step}) => step.from === selected || step.to === selected);
  if (!calls.length) return null;
  return <details ref={root} className="review-call-context" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={event => {
    if (event.key === 'Escape' && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
  }}>
    <summary aria-label="Calls for selected component">Calls <small>{calls.length}</small></summary>
    <div className="review-call-list" aria-label="Source calls for selected component">
      <p>Static call sites in this flow. Execution order is not a runtime trace.</p>
      {calls.map(({step, index}) => <button key={index} data-direction={step.from === selected ? 'outgoing' : 'incoming'} aria-label={`Inspect call ${step.label} at ${basename(step.path)}:${step.line}`} onClick={() => {
        root.current.open = false; root.current.querySelector('summary')?.focus(); onInspect(index);
      }}>
        <b>{step.label}</b><small>{step.from === selected ? 'Outgoing' : 'Incoming'} · {basename(step.path)}:{step.line} · {step.evidence === 'code' ? step.deferred ? 'deferred source call' : 'source call' : 'inferred'}</small>
      </button>)}
    </div>
  </details>;
}
