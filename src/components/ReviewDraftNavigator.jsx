import React, { useRef } from 'react';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { listReviewDrafts } from '../lib/review-drafts.mjs';

export default function ReviewDraftNavigator({ drafts, files, diffVersion, onOpen }) {
  const root = useRef(null);
  const entries = listReviewDrafts(drafts, files, diffVersion);
  if (!entries.length) return null;
  const current = entries.filter(item => item.current), earlier = entries.filter(item => !item.current);
  function open(item) {
    root.current.open = false;
    root.current.querySelector('summary')?.focus();
    onOpen(item);
  }
  return <details className="review-draft-navigator" ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
    onKeyDown={event => {
      if (event.key === 'Escape' && root.current.open) {
        event.preventDefault(); event.stopPropagation(); root.current.open = false; root.current.querySelector('summary')?.focus();
      }
    }}>
    <summary aria-label="Review drafts"><MessageSquare size={13}/><b>{entries.length} unposted {entries.length === 1 ? 'draft' : 'drafts'}</b><span>Review your comments</span></summary>
    <div className="review-draft-menu">
      <p>Private notes saved on this device. Open a draft to inspect its code before posting.</p>
      {current.map(item => <button className="review-draft-item" key={item.key}
        aria-label={`Resume draft ${item.path}:${item.side}:${item.line || 'file'}`}
        title={item.path} onClick={() => open(item)}>
        <span><b>{item.path.split('/').at(-1)} · {item.line ? `${item.side} line ${item.line}` : 'File comment'}</b>
          <small>{item.path}</small><p>{item.text}</p></span><ArrowRight size={13}/>
      </button>)}
      {earlier.length > 0 && <section className="review-earlier-drafts" aria-label="Earlier revision drafts">
        <h3>{earlier.length} {earlier.length === 1 ? 'draft needs' : 'drafts need'} a revision check</h3>
        <p>These old-side notes belong to an earlier or unverified diff base. They are kept here for reference and are not reused or submitted automatically.</p>
        {earlier.map(item => <details key={item.key}><summary>{item.path} · {item.line ? `old line ${item.line}` : 'File comment'}</summary><pre>{item.text}</pre></details>)}
      </section>}
    </div>
  </details>;
}
