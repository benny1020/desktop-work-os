import React, {useEffect, useRef, useState} from 'react';
import {Brain, Search, Pencil, Trash2, Check, Clock3} from 'lucide-react';
import {invoke} from '../lib/integration-client';

export default function AssistantMemoryPanel({memory, onChanged, contextKey}) {
  const [query,setQuery]=useState(''), [results,setResults]=useState(null), [text,setText]=useState(''),
    [editing,setEditing]=useState(null), [busy,setBusy]=useState(false), [searching,setSearching]=useState(false), [error,setError]=useState(''), [confirm,setConfirm]=useState(false);
  const request=useRef(0), mounted=useRef(true), pendingMutation=useRef(false), previousScope=useRef(memory.scope);
  const leaseKey=`${memory.scope}:${memory.epoch}`, activeLease=useRef(leaseKey);activeLease.current=leaseKey;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++;};},[]);
  useEffect(()=>{
    request.current++;setSearching(false);setResults(null);setEditing(null);setConfirm(false);setError('');
    if(previousScope.current!==memory.scope){setText('');setQuery('');previousScope.current=memory.scope;}
  },[memory.scope,memory.epoch]);
  const auth={scope:memory.scope,epoch:memory.epoch};
  async function act(args) {
    if(pendingMutation.current)return;pendingMutation.current=true;setBusy(true);setError('');request.current++;setSearching(false);
    try {
      await invoke('assistant.memory',{...args,...auth});
      if(!mounted.current||activeLease.current!==leaseKey)return;
      if(args.op==='remember')setText('');
      if(args.op==='update'||args.op==='forget')setEditing(null);
      setConfirm(false);setResults(null);await onChanged();
    } catch(e){if(mounted.current&&activeLease.current===leaseKey)setError(e.message);}
    finally{pendingMutation.current=false;if(mounted.current)setBusy(false);}
  }
  async function search(event) {
    event.preventDefault();if(busy)return;
    const ticket=++request.current;setSearching(true);setError('');
    try{const value=await invoke('assistant.memory',{op:'search',query,...auth});if(mounted.current&&ticket===request.current&&activeLease.current===leaseKey)setResults({...value,query});}
    catch(e){if(mounted.current&&ticket===request.current&&activeLease.current===leaseKey)setError(e.message);}
    finally{if(mounted.current&&ticket===request.current)setSearching(false);}
  }
  const records=results?.memories || memory.memories || [];
  return <section className="assistant-memory-manager" aria-label="Assistant memory">
    <div className="memory-explainer"><Brain size={17}/><div><b>A memory you can inspect</b><p>Conversations and useful facts are encrypted on this device. Relevant memories travel with your next question to Claude.</p></div></div>
    <div className="memory-setting"><span>Remember conversations</span><button className="btn" aria-pressed={memory.enabled} disabled={busy} onClick={()=>act({op:'enabled',enabled:!memory.enabled})}>{memory.enabled?'Pause memory':'Resume memory'}</button></div>
    <small>Pausing keeps existing memories but stops saving and recalling them in chat.</small>
    <div className="memory-setting"><span>Desktop reminders</span><button className="btn" aria-pressed={!!memory.notificationsEnabled} disabled={busy} onClick={()=>act({op:'notifications',enabled:!memory.notificationsEnabled})}>{memory.notificationsEnabled?'Disable notifications':'Enable notifications'}</button></div>
    <small>Notifications require OS permission and Worklane to be running. Due reminders are checked when the app reopens.</small>
    <form className="memory-search" onSubmit={search}><Search size={13}/><input aria-label="Search assistant memory" disabled={busy} value={query} onChange={event=>{request.current++;setSearching(false);setQuery(event.target.value);setResults(null);}} placeholder="Find a decision, preference or past conversation"/><button className="btn" disabled={busy||searching}>{searching?'Searching…':'Search'}</button></form>
    {results&&<div className="inline"><small>Results for “{results.query || 'all memories'}”</small><button className="quiet-button" onClick={()=>{request.current++;setResults(null);setQuery('');}}>Clear search</button></div>}
    <form className="memory-add" onSubmit={event=>{event.preventDefault();act({op:'remember',text,kind:'note',sourceContext:contextKey});}}>
      <textarea aria-label="New assistant memory" disabled={busy} value={text} onChange={event=>setText(event.target.value)} placeholder="Remember: I prefer reviewing critical changes before lunch." maxLength={2000}/>
      <button className="btn" disabled={busy||!text.trim()}>Remember this</button>
    </form>
    <div className="memory-list-heading"><h3>{results?'Matching knowledge':'Saved knowledge'}</h3><span>{memory.stats?.memories ?? records.length} memories · {memory.stats?.conversations ?? 0} conversations</span></div>
    {!records.length&&<p className="memory-empty">{results?'No matching saved facts.':'No saved facts yet. Tell your assistant what matters, or add a note above.'}</p>}
    {records.map(record=><article className="memory-record" key={record.id}>
      <div className="memory-record-meta"><span>{record.kind || 'Note'}</span><time>{record.updatedAt||record.createdAt||record.at?new Date(record.updatedAt||record.createdAt||record.at).toLocaleDateString():''}</time></div>
      {editing?.id===record.id?<><textarea aria-label="Edit assistant memory" disabled={busy} value={editing.text} onChange={event=>setEditing({...editing,text:event.target.value})}/><div className="inline"><button className="btn" disabled={busy||!editing.text.trim()} onClick={()=>act({op:'update',id:record.id,text:editing.text})}><Check size={12}/>Save memory</button><button className="btn" disabled={busy} onClick={()=>setEditing(null)}>Cancel edit</button></div></>:<p>{record.text}</p>}
      {record.sourceQuote&&<details><summary>Why I remember this</summary><blockquote>{record.sourceQuote}</blockquote><small>{record.sourceContext||record.contextKey||'Your conversation'}</small></details>}
      <div className="memory-record-actions"><button className="quiet-button" disabled={busy} aria-label={`Edit memory ${record.text}`} onClick={()=>setEditing(record)}><Pencil size={12}/>Edit</button><button className="quiet-button" aria-label={`Forget memory ${record.text}`} disabled={busy} onClick={()=>act({op:'forget',id:record.id,type:'memory'})}><Trash2 size={12}/>Forget</button></div>
    </article>)}
    {results?.episodes?.length>0&&<><h3>Past conversations</h3>{results.episodes.map(item=><article key={item.id} className="memory-record"><small><Clock3 size={11}/> {item.createdAt?new Date(item.createdAt).toLocaleString():''}</small><b>{item.question}</b><p>{item.answer}</p><button className="quiet-button" disabled={busy} onClick={()=>act({op:'forget',type:'conversation',id:item.id})}>Forget this conversation</button></article>)}</>}
    <div className="memory-forget-all">{confirm?<><p>Delete saved conversations, facts, and reminders for this connected profile? This cannot be undone.</p><button className="btn" disabled={busy} onClick={()=>act({op:'clear',target:'all'})}>Confirm forget all</button><button className="quiet-button" disabled={busy} onClick={()=>setConfirm(false)}>Keep memories</button></>:<button className="quiet-button" disabled={busy} onClick={()=>setConfirm(true)}>Forget all memories</button>}</div>
    {error&&<p className="connection-error" role="alert">{error}</p>}
  </section>;
}
