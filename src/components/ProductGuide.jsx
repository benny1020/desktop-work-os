import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, GitPullRequest, Link2, Radio, X, Keyboard } from 'lucide-react';
export function WorklaneMark({size=24}) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M5 7 10 25 16 12 22 25 27 7" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 7h8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/>
  </svg>;
}
const journeys = [
  {id:'context', icon:Link2, title:'Follow the work, not the tabs', detail:'Open an issue, read its wiki, inspect the MR and follow the pipeline. Your starting point stays right there.', trail:'Issue · Wiki · Merge request · Pipeline', action:'Follow PAY-382'},
  {id:'review', icon:GitPullRequest, title:'See the change before the code', detail:'Navigate a dependency map, trace a sequence, then select the exact source line to leave a review.', trail:'Structure · Source · Comment · Approval', action:'Start visual review'},
  {id:'incident', icon:Radio, title:'From a signal to its context', detail:'Inspect an alert, keep your log query, and follow the related deployment. This workflow uses mock observability data.', trail:'Alert · Logs · Deployment · Incident', action:'Investigate the alert'},
];
export default function ProductGuide({onClose,onPick}) {
  return <Dialog.Root open onOpenChange={open=>!open&&onClose()}><Dialog.Portal>
    <Dialog.Overlay className="guide-overlay"/>
    <Dialog.Content className="product-guide" aria-describedby="guide-description">
      <header><span className="guide-wordmark"><WorklaneMark size={24}/> worklane</span><Dialog.Close className="icon-button" aria-label="Close product guide"><X size={17}/></Dialog.Close></header>
      <Dialog.Title>Less switching. More understanding.</Dialog.Title>
      <Dialog.Description id="guide-description">Three ways to try your connected workday. Sample data, no setup.</Dialog.Description>
      <div className="guide-journeys">{journeys.map(({id,icon:Icon,title,detail,trail,action})=><button key={id} className="guide-journey" onClick={()=>onPick(id)}>
        <span className="guide-journey-icon"><Icon size={19}/></span><span><strong>{title}</strong><span className="guide-detail">{detail}</span><small>{trail}</small><b className="guide-action">{action}<ArrowRight size={13}/></b></span>
      </button>)}</div>
      <footer><Keyboard size={15}/><span>Find anything with <kbd>⌘ / Ctrl K</kbd></span><span>Close with <kbd>Esc</kbd></span></footer>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
