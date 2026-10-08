import React, {useEffect, useRef, useState} from 'react';
import {Sparkles, ArrowRight, MessageSquare, Check, ChevronDown, ChevronUp} from 'lucide-react';
import {basename} from '../lib/review-model.mjs';

export default function ReviewGuidePanel({guide, files, mr, live, endpoint, guidelines, onGuidelines, busy, analyzing = false, refreshing = false, error, onGenerate, selectedPath, activeFinding, findingKey, canLocate, onSelect, onDraft, decisions, onDecision, flowPaths, flowLabel, apiFlow, canCollapse = false, collapsed = false, onToggle}) {
  const [scope,setScope]=useState(flowPaths ? 'flow' : 'all');
  useEffect(() => { if (!flowPaths && scope === 'flow') setScope('all'); }, [flowPaths, scope]);
  const body = useRef(null);
  const railToggle = useRef(null);
  useEffect(() => {
    if (collapsed || !activeFinding || !body.current) return;
    const panel = body.current;
    const reveal = () => {
      const item = panel.querySelector('.ai-checkpoint.active');
      if (!item) return;
      const bounds = panel.getBoundingClientRect(), target = item.getBoundingClientRect();
      if (target.top < bounds.top || target.bottom > bounds.bottom)
        panel.scrollTop += target.top - bounds.top - 8;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [activeFinding, scope, collapsed]);
  const findings=guide?.findings || [];
  const visible=findings.filter(f=>scope==='all'||(scope==='flow' ? flowPaths?.includes(f.path) : f.path===selectedPath));
  const reviewed=findings.filter(f=>['checked','dismissed'].includes(decisions[findingKey(f)])).length;
  return <aside className="ai-review-rail" aria-label="AI review alongside code" onKeyDown={event => {
    if (event.key === 'Escape' && canCollapse && !collapsed) {
      event.preventDefault(); event.stopPropagation(); onToggle?.(); railToggle.current?.focus();
    }
  }}>
    <div className="ai-rail-heading"><Sparkles size={16}/><h2>AI review</h2><span className="pill">{busy ? "Analyzing…" : guide ? `${findings.length} checks` : "Optional guide"}</span>{canCollapse && <button ref={railToggle} className="icon-button" aria-label={collapsed ? "Expand AI review" : "Collapse AI review"} aria-expanded={!collapsed} onClick={onToggle}>{collapsed ? <ChevronDown size={15}/> : <ChevronUp size={15}/>}</button>}</div>
    <div className="ai-review-guide" hidden={collapsed} ref={body}>
      <p className="ai-review-intro">Inspect the evidence. Make your own call.</p>
      <details className="guideline-settings"><summary>Guidelines & shared context</summary>
        <textarea aria-label="Team review guidelines" value={guidelines} disabled={busy} onChange={e=>onGuidelines(e.target.value)} placeholder="Prioritize idempotency, error handling, and missing tests."/>
        <p className="ai-transmission-note">{live?`Generating sends ${apiFlow ? "this flow’s method code, unchanged context and call metadata" : flowPaths ? "this review flow’s diff" : "this MR’s diff"} and your guidelines to ${endpoint || 'your configured Claude endpoint'}.`:'Sample guide only. Connected workspace uses your configured Claude endpoint.'}</p>
      </details>
      {busy && <p className="guide-generating" role="status">{apiFlow ? "Reviewing this flow’s methods… Keep exploring the code." : "Reviewing this diff… Keep exploring the code."}</p>}
      {error && <div className="connection-error" role="alert">{error}{guide && <p>Your previous guide remains below.</p>}</div>}
      {!guide ? <div className="guide-empty"><h3>A second perspective on this change</h3><p>Generate checkpoints, inspect the code, then write your own review.</p><button className="btn primary" disabled={busy || refreshing || analyzing} onClick={onGenerate}><Sparkles size={13}/>{busy?'Analyzing…':'Generate review guide'}</button><small>Nothing is posted or approved automatically.</small></div> : <>
        <details className="ai-summary" open><summary>Change summary</summary><p className="guide-summary">{guide.summary}</p></details>
        {flowPaths && <p className="form-note">Review scope: {flowLabel} · {flowPaths.length} files{apiFlow ? ` · ${apiFlow.ranges.length} methods` : ""}</p>}
        <div className="guide-coverage">{guide.model || 'AI'} · {mr.diff_refs.head_sha.slice(0,8)}<br/>{guide.coverage?.includedFiles ?? files.length} / {guide.coverage?.totalFiles ?? files.length} files{["api", "method"].includes(guide.coverage?.scope) ? " including source context" : ""}{guide.coverage?.mrTotalFiles ? ` in scope / ${guide.coverage.mrTotalFiles} in MR` : ""} · {["api", "method"].includes(guide.coverage?.scope) ? "Method source" : "Diff-based"}{guide.coverage?.truncated?' · Partial coverage':''}{guide.rejectedReferences?` · ${guide.rejectedReferences} invalid references omitted`:''}</div>
        <div className="ai-checkpoint-heading"><h3>Review checkpoints</h3><span>{reviewed}/{findings.length} reviewed</span></div>
        <div className="ai-checkpoint-filter" role="group" aria-label="Filter AI checkpoints">{flowPaths && <button aria-pressed={scope==='flow'} onClick={()=>setScope('flow')}>This flow</button>}<button aria-pressed={scope==='all'} onClick={()=>setScope('all')}>All checks</button><button aria-pressed={scope==='file'} onClick={()=>setScope('file')}>This file</button></div>
        <p className="checkpoint-boundary">Your assessment stays on this device. It does not approve the MR.</p>
        {visible.map((f,i)=>{const key=findingKey(f), valid=canLocate(f), state=decisions[key] || 'open';return <article className={`ai-checkpoint ${activeFinding===key?'active':''} ${state}`} key={key}>
          <button className="guide-finding" aria-pressed={activeFinding===key} disabled={!valid} onClick={()=>onSelect(f)}>
            <span className={`finding-severity ${f.severity}`}>{state!=='open'?<Check size={11}/>:null}{f.severity} priority</span><b>{f.title}</b><p>{f.reason}</p><code>{basename(f.path)}:{f.line}<ArrowRight size={12}/></code>
          </button>
          {!valid && <small className="checkpoint-unavailable">{apiFlow ? "Reference outside this flow’s method ranges." : "Reference not available in this diff."}</small>}
          <div className="checkpoint-actions"><button className="btn" disabled={!valid} onClick={()=>onDraft(f)} aria-label={`Draft comment for ${f.title}`}><MessageSquare size={12}/>Draft comment</button>
            <select aria-label={`Your assessment of ${f.title}`} value={state} onChange={e=>onDecision(f,e.target.value)}><option value="open">To check</option><option value="checked">Checked</option><option value="dismissed">Not relevant</option></select></div>
        </article>;})}
        {!visible.length && <p className="checkpoint-empty">{findings.length?`No AI checkpoints for this ${scope === 'flow' ? 'flow' : 'file'}. Your review may still find issues.`:'No additional checks suggested. Continue your own review; this is not an approval.'}</p>}
        <details className="ai-reading-order"><summary>Suggested reading order</summary><ol className="reading-order">{(guide.readingOrder || []).map((r,i)=><li key={i}><button disabled={!canLocate(r)} onClick={()=>onSelect(r)}><span className="step-number">{i+1}</span><div><b>{basename(r.path)}:{r.line}</b><p>{r.reason}</p></div><ArrowRight size={12}/></button></li>)}</ol></details>
      </>}
    </div>
  </aside>;
}
