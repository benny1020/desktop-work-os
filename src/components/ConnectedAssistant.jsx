import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { assistantContextKey, assistantEndpointScope, useAssistantSession } from "../lib/assistant-session";
import { X, Focus, ArrowUpRight, Maximize2, Minimize2, Brain } from "lucide-react";
import { invoke } from "../lib/integration-client";
import { usePlan, updateTask, dayKey, shiftDay, planChange } from "../lib/planning";
import AssistantAvatar from './AssistantAvatar';
import AssistantMemoryPanel from './AssistantMemoryPanel';
import {prepareAssistantActions,applyAssistantAction} from '../lib/assistant-actions';
import {currentBriefTask} from '../lib/assistant-planning';
import '../assistant-personal.css';
function describeContext(context) {
  let selected;
  try { selected = typeof context === "string" ? JSON.parse(context) : context; } catch { selected = null; }
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) return { label: "Current view", prompts: ["Help me prioritize my personal plan", "Summarize the selected context"] };
  const text = (value) => typeof value === "string" ? value.slice(0, 160) : "";
  if (["mr", "merge_request"].includes(selected.type) && (typeof selected.iid === "number" || typeof selected.iid === "string")) {
    const file = text(selected.file);
    const line = Number.isInteger(selected.line) && selected.line > 0 ? `:${selected.line}` : "";
    return { label: `MR !${selected.iid}${file ? ` · ${file}${line}` : ""}`, prompts: ["Summarize this change", "What should I review first?", "Explain the selected code"] };
  }
  if (text(selected.key)) return { label: text(selected.key), prompts: ["Summarize this issue", "What should I do next on this issue?", "Help me draft a review checklist"] };
  if (selected.type === "doc" || (text(selected.title) && selected.body)) return { label: text(selected.title) || "Selected document", prompts: ["Summarize this document", "Extract decisions and follow-up tasks"] };
  const section = text(selected.section);
  const view = text(selected.view);
  return { label: section ? `${section}${view && view !== section ? ` · ${view}` : ""}` : "Current view", prompts: ["Help me prioritize my personal plan", "What unfinished work should I plan next?"] };
}
function Pending() {
  return <p role="status">Claude is responding…</p>;
}
export default function ConnectedAssistant({ context, onClose, onSettings }) {
  const plan = usePlan();
  const inputRef = useRef(null);
  const bodyRef = useRef(null);
  const followLatest = useRef(true);
  const currentContext = describeContext(context);
  const panelRef = useRef(null);
  const [memory,setMemory]=useState(null), [memoryError,setMemoryError]=useState(''), [memoryReady,setMemoryReady]=useState(false);
  const [tab,setTab]=useState('conversation'), [expanded,setExpanded]=useState(false);
  const mounted=useRef(true), memoryRequest=useRef(0);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function refreshMemory() {
    const request=++memoryRequest.current;
    try {const next=await invoke('assistant.memory',{op:'state'});if(!next?.scope||!next?.epoch)throw Error('Memory storage is unavailable.');if(mounted.current&&request===memoryRequest.current){setMemory(next);setMemoryError('');}return next;}
    catch(e){if(mounted.current&&request===memoryRequest.current)setMemoryError(e.message);return null;}
    finally{if(mounted.current&&request===memoryRequest.current)setMemoryReady(true);}
  }
  useEffect(()=>{refreshMemory();const refresh=()=>refreshMemory();window.addEventListener('worklane:memory-changed',refresh);return()=>window.removeEventListener('worklane:memory-changed',refresh);},[]);
  const [endpointScope, setEndpointScope] = useState(null);
  const [configError, setConfigError] = useState("");
  const [configAttempt, setConfigAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setConfigError("");
    invoke("config.list").then(configs => {
      if (current) setEndpointScope(assistantEndpointScope(configs));
    }).catch(error => { if (current) setConfigError(error.message); });
    return () => { current = false; };
  }, [configAttempt]);
  const sessionKey = `${endpointScope || "loading"}:${memory?.scope || "session"}:${memory?.epoch || ""}:${assistantContextKey(context)}`;
  const { state, set, isBusy } = useAssistantSession(sessionKey);
  const { proposal, history, input, messages, busy, error } = state;
  const activeSession=useRef(sessionKey);activeSession.current=sessionKey;
  const previousDraft=useRef(null);
  useLayoutEffect(()=>{
    const previous=previousDraft.current;
    // A memory edit/pause changes the archive lease, not the user's unsent question.
    if(previous&&previous.key!==sessionKey&&previous.endpoint===endpointScope&&previous.scope===memory?.scope&&previous.context===assistantContextKey(context)&&previous.input&&!input)set('input',previous.input);
    previousDraft.current={key:sessionKey,endpoint:endpointScope,scope:memory?.scope,context:assistantContextKey(context),input};
  },[sessionKey,input,endpointScope,context,memory?.scope,set]);
  const contextKey=assistantContextKey(context);
  const memoryAuth=memory?{scope:memory.scope,epoch:memory.epoch,contextKey}:null;
  async function loadHistory(earlier=false) {
    if(!memoryAuth||!memory.enabled||state.archiveLoading)return;
    set('archiveLoading',true);set('archiveError','');
    const body=bodyRef.current, scroll=body?{top:body.scrollTop,height:body.scrollHeight}:null;
    try {
      const result=await invoke('assistant.memory',{op:'history',...memoryAuth,offset:earlier?state.archiveOffset:0,limit:20});
      const entries=[...result.entries].reverse();
      const restored=entries.flatMap(e=>[{role:'user',text:e.question,archiveId:e.id},{role:'assistant',text:e.answer,archiveId:e.id}]);
      if(activeSession.current!==sessionKey)return;
      set('messages',m=>earlier?[...restored,...m]:m.length?m:restored);
      if(!earlier)set('history',h=>h.length?h:entries.slice(-3).flatMap(e=>[{role:'user',content:e.question.slice(0,4000)},{role:'assistant',content:e.answer.slice(0,4000)}]));
      set('archiveOffset',(earlier?state.archiveOffset:0)+result.entries.length);set('archiveTotal',result.total);
      set('hydrated',true);
      if(earlier&&scroll)requestAnimationFrame(()=>{if(body===bodyRef.current&&activeSession.current===sessionKey)body.scrollTop=scroll.top+body.scrollHeight-scroll.height;});
    }catch(e){set('archiveError',e.message);}
    finally{set('archiveLoading',false);}
  }
  useEffect(()=>{if(memoryReady&&endpointScope&&!state.hydrated){if(memory?.enabled)loadHistory();else set('hydrated',true);}},[sessionKey,memoryReady,endpointScope]);
  async function confirmAction(messageIndex,action) {
    if(action.status!=='pending')return;
    const mark=status=>setMessages(all=>all.map((m,i)=>i===messageIndex?{...m,actions:m.actions.map(a=>a.id===action.id?{...a,status}:a)}:m));
    mark('saving');setError('');
    try {
      if(action.type==='reminder') {
        if(!memoryAuth)throw Error('Encrypted reminder storage is unavailable.');
        if(action.taskId)currentBriefTask(plan.tasks,{taskId:action.taskId,evidence:action.evidence});
        await invoke('assistant.reminders',{op:'create',...memoryAuth,title:action.title,dueAt:action.dueAt,taskId:action.taskId});
        window.dispatchEvent(new Event('worklane:memory-changed'));
      }else planChange(p=>applyAssistantAction(p,action));
      mark('applied');
    }catch(e){mark('failed');setError(e.message);}
  }
  const setProposal = value => set("proposal", value);
  const setHistory = value => set("history", value);
  const setInput = value => set("input", value);
  const setMessages = value => set("messages", value);
  const setBusy = value => set("busy", value);
  const setError = value => set("error", value);
  useLayoutEffect(() => {
    const previous = document.activeElement;
    const fallback = panelRef.current?.closest('.object-panel')?.querySelector('.object-panel-header .btn')
      || document.querySelector('button[title^="Assistant"]');
    return () => {
      requestAnimationFrame(() => {
        if (document.activeElement && ![document.body, previous].includes(document.activeElement) && document.activeElement.isConnected) return;
        (previous?.isConnected && previous !== document.body ? previous : fallback)?.focus();
      });
    };
  }, []);
  useEffect(() => { if (endpointScope&&memoryReady) inputRef.current?.focus(); }, [endpointScope,memoryReady]);
  useLayoutEffect(() => { followLatest.current = true; }, [sessionKey]);
  useLayoutEffect(() => {
    if (followLatest.current && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [sessionKey, messages, busy, error, proposal]);
  async function send(e) {
    e.preventDefault();
    if (!endpointScope || !memoryReady || !input.trim() || isBusy()) return;
    followLatest.current = true;
    const question = input;
    setProposal(null);
    if (
      /tomorrow|내일/i.test(question) &&
      /move|옮|미뤄|미루/i.test(question)
    ) {
      const issueKeys = (question.match(/\b[A-Z][A-Z0-9_]*-\d+\b/gi) || []).map((key) => key.toUpperCase());
      const candidates = plan.tasks.filter((task) => !task.done).map((task) => {
        const exactKey = task.object?.key && issueKeys.includes(task.object.key.toUpperCase());
        const title = task.title || "";
        const titlePattern = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const titleMatch = title && new RegExp(`(^|[^a-z0-9_])${titlePattern}(?=$|[^a-z0-9_])`, "i").test(question);
        const differentIssue = issueKeys.length && task.object?.key && !exactKey;
        return { task, score: exactKey ? Infinity : !differentIssue && titleMatch ? title.length : 0 };
      }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score);
      const best = candidates[0];
      const ambiguous = best && candidates.slice(1).some((match) =>
        match.score === best.score || (best.score !== Infinity && !best.task.title.toLowerCase().includes(match.task.title.toLowerCase())),
      );
      if (ambiguous) {
        setError("More than one task matches. Open My Work to choose which task to schedule.");
        return;
      }
      const target = candidates[0]?.task;
      if (target) {
        setError("");
        setProposal({
          id: target.id,
          title: target.title,
          from: target.date || "Backlog",
          to: shiftDay(dayKey(), 1),
          original: { date: target.date, title: target.title, done: target.done },
        });
        setInput("");
        return;
      }
    }
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    setError("");
    try {
      const result = await invoke("claude.chat", {
        message: question,
        history,
        ...(memoryAuth?{memory:memoryAuth}:{}),
        context: JSON.stringify({
          selected: context,
          personalPlan: plan.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            kind: t.kind,
            date: t.date,
            time: t.time,
            done: t.done,
          })),
        }),
      });
      const answer = (result.content || [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      if (!answer.trim()) throw Error("Claude returned no text. Please retry.");
      setMessages((m) => [...m, { role: "assistant", text: answer, sources:result.memory?.used || [], actions:prepareAssistantActions(result.suggestions,plan.tasks), memoryWarning:result.memory?.error || (result.memory?.saved===false?(memory?.enabled?'This exchange was not saved.':'Memory is paused.'):'') }]);
      if(result.memory)refreshMemory();
      // Only completed exchanges are sent back; failed/local action messages
      // must never masquerade as answers from the model.
      setHistory((h) => [...h,
        { role: "user", content: question.slice(0, 4000) },
        { role: "assistant", content: answer.slice(0, 4000) },
      ].slice(-6));
    } catch (e) {
      setError(e.message);
      setInput((current) => current || question);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside ref={panelRef} className={`assistant-panel live-assistant${expanded?" assistant-expanded":""}`} aria-label="Personal assistant">
      <div className="inspector-header">
        <div className="assistant-identity"><AssistantAvatar state={busy?'thinking':'idle'}/><div><b>Claude assistant</b><small>{memory?.enabled?'Your work, remembered':'Here to help with your work'}</small></div></div>
        <button className="icon-button push-right" aria-label={expanded?'Dock assistant':'Expand assistant workspace'} aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?<Minimize2 size={14}/>:<Maximize2 size={14}/>}</button>
        <button
          className="icon-button"
          aria-label="Close assistant"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </div>
      <div className="assistant-context" aria-label="Assistant selected context">
        <Focus size={13} /><span title={currentContext.label}>{currentContext.label}</span><span className="pill">Read & draft</span>
      </div>
      <div className="assistant-memory-tabs" role="tablist" aria-label="Assistant views" onKeyDown={event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const next=event.key==='Home'?'conversation':event.key==='End'?'memory':tab==='conversation'?'memory':'conversation';
        setTab(next);event.currentTarget.querySelectorAll('[role="tab"]')[next==='conversation'?0:1]?.focus();
      }}><button role="tab" tabIndex={tab==='conversation'?0:-1} aria-selected={tab==='conversation'} onClick={()=>setTab('conversation')}>Conversation</button><button role="tab" tabIndex={tab==='memory'?0:-1} aria-selected={tab==='memory'} onClick={()=>setTab('memory')}><Brain size={12}/> Memory {memory?.stats?.memories>0?memory.stats.memories:''}</button><span className="assistant-memory-status">{memory?(memory.enabled?'Encrypted on device':'Memory paused'):memoryReady?'Session only':'Loading memory…'}</span></div>
      {tab==='memory' ? (memory?<AssistantMemoryPanel memory={memory} onChanged={async()=>{await refreshMemory();window.dispatchEvent(new Event('worklane:memory-changed'));}} contextKey={contextKey}/>:<div className="assistant-memory-manager"><h3>Durable memory is unavailable</h3><p>{memoryError}</p><p>Open Worklane Desktop with OS encrypted storage to keep memories between sessions.</p><button className="btn" onClick={refreshMemory}>Retry memory</button></div>) : <>
      <div className="live-assistant-body" ref={bodyRef} onScroll={event => {
        const body = event.currentTarget;
        followLatest.current = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
      }}>
        {!messages.length&&<div className="assistant-greeting"><AssistantAvatar size={32}/><p>I can help you think through this work, remember what matters and prepare your next step. You decide what happens next.</p></div>}
        {memoryError&&<p className="assistant-memory-status">Conversation is available for this session. Durable memory is unavailable. <button className="quiet-button" onClick={()=>setTab('memory')}>Details</button></p>}
        <details className="form-note"><summary>What is shared with Claude?</summary><p>Your question, up to three recent exchanges, relevant saved memories, selected work, and personal plan are sent to your configured endpoint. No data is sent just by opening this panel. The assistant does not post comments or change external services. Local rescheduling requires confirmation.</p></details>
        {!messages.length && <div className="assistant-suggestions" aria-label="Suggested assistant prompts">
          {currentContext.prompts.map((prompt) => <button key={prompt} type="button" disabled={!endpointScope || !memoryReady || busy} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}>{prompt}<ArrowUpRight size={12} /></button>)}
        </div>}
        {state.archiveLoading&&<p role="status">Loading saved conversations…</p>}
        {state.archiveError&&<div role="alert" className="connection-error">{state.archiveError}<button className="quiet-button" disabled={state.archiveLoading} onClick={()=>loadHistory(state.hydrated)}>Retry conversation history</button></div>}
        {state.archiveOffset<state.archiveTotal&&<button className="assistant-history-more" disabled={state.archiveLoading||busy} onClick={()=>{followLatest.current=false;loadHistory(true);}}>Load earlier conversations</button>}
        {messages.map((m, i) => (
          <div key={i} className={`live-chat-message ${m.role}`}>
            <b className="inline">{m.role === 'assistant'&&<AssistantAvatar size={16}/>} {m.role === "user" ? "You" : "Claude"}</b>
            <p>{m.text}</p>
            {m.sources?.length>0&&<details className="assistant-recalled"><summary>Used {m.sources.length} memories · View sources</summary>{m.sources.map((source,j)=><p key={j}><b>{source.kind==='fact'?'Saved knowledge':source.kind==='reminder'?'Reminder':'Past conversation'}</b><br/>{source.text}<br/><small>{source.at?new Date(source.at).toLocaleString():''}</small></p>)}</details>}
            {m.memoryWarning&&<small className="assistant-memory-status">{m.memoryWarning}</small>}
            {m.actions?.map(action=><div className="assistant-action-card" key={action.id}><b>{action.type==='create_task'?'Add a task':action.type==='reschedule_task'?'Reschedule task':action.type==='complete_task'?'Complete task':'Set reminder'}</b><p>{action.title}<br/>{action.type==='reminder'?new Date(action.dueAt).toLocaleString():[action.date,action.time].filter(Boolean).join(' · ')}</p>{action.reason&&<small>{action.reason}</small>}<small>{action.type==='reminder'?'Checked while Worklane is running; caught up on reopening.':'Personal plan only · external services unchanged'}</small>{action.status==='pending'?<><button className="btn primary" onClick={()=>confirmAction(i,action)}>Confirm {action.type==='reminder'?'reminder':'change'}</button><button className="quiet-button" onClick={()=>setMessages(all=>all.map((msg,index)=>index===i?{...msg,actions:msg.actions.map(a=>a.id===action.id?{...a,status:'dismissed'}:a)}:msg))}>Dismiss</button></>:<span role="status">{action.status==='applied'?'Applied':action.status==='saving'?'Saving…':action.status==='failed'?'Not applied · ask again to refresh':'Dismissed'}</span>}</div>)}
          </div>
        ))}
        {proposal && (
          <div className="assistant-proposal">
            <b>{proposal.title}</b>
            <p>
              {proposal.from} → {proposal.to}
            </p>
            <small>Local plan only · Jira deadline unchanged</small>
            <div className="inline">
              <button
                className="btn primary"
                onClick={() => {
                  try {
                    const current = plan.tasks.find((task) => task.id === proposal.id);
                    if (!current || current.date !== proposal.original.date || current.title !== proposal.original.title || current.done !== proposal.original.done) {
                      setProposal(null);
                      throw Error("This task changed since the suggestion. Ask again to review its current schedule.");
                    }
                    updateTask(proposal.id, { date: proposal.to });
                    setMessages((m) => [
                      ...m,
                      {
                        role: "assistant",
                        text: `Moved ${proposal.title} to ${proposal.to} in your personal plan.`,
                      },
                    ]);
                    setProposal(null);
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Confirm schedule
              </button>
              <button className="btn" onClick={() => setProposal(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {!endpointScope && !configError && <p role="status">Loading assistant settings…</p>}
        {busy && <Pending />}
        {(error || configError) && (
          <div className="connection-error" role="alert">
            {error || configError}
            {configError && <button className="quiet-button" onClick={() => setConfigAttempt(value => value + 1)}>Retry assistant</button>}
            <button className="quiet-button" onClick={onSettings}>
              Integration settings
            </button>
          </div>
        )}
      </div>
      <form className="live-assistant-compose" onSubmit={send}>
        <textarea
          ref={inputRef}
          aria-label="Ask Claude"
          value={input}
          disabled={!endpointScope || !memoryReady}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this code or your work…"
        />
        <button className="btn primary" disabled={!endpointScope || !memoryReady || !input.trim() || busy}>
          Send to Claude
        </button>
      </form>
      </>}
    </aside>
  );
}
