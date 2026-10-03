import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { assistantContextKey, assistantEndpointScope, useAssistantSession } from "../lib/assistant-session";
import { X, Focus, ArrowUpRight } from "lucide-react";
import { invoke } from "../lib/integration-client";
import { usePlan, updateTask, dayKey, shiftDay } from "../lib/planning";
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
  const sessionKey = `${endpointScope || "loading"}:${assistantContextKey(context)}`;
  const { state, set, isBusy } = useAssistantSession(sessionKey);
  const { proposal, history, input, messages, busy, error } = state;
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
  useEffect(() => { if (endpointScope) inputRef.current?.focus(); }, [endpointScope]);
  useLayoutEffect(() => { followLatest.current = true; }, [sessionKey]);
  useLayoutEffect(() => {
    if (followLatest.current && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [sessionKey, messages, busy, error, proposal]);
  async function send(e) {
    e.preventDefault();
    if (!endpointScope || !input.trim() || isBusy()) return;
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
        context: JSON.stringify({
          selected: context,
          personalPlan: plan.tasks.map((t) => ({
            title: t.title,
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
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
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
    <aside ref={panelRef} className="assistant-panel live-assistant">
      <div className="inspector-header">
        <b>Claude assistant</b>
        <span className="pill">On demand</span>
        <button
          className="icon-button push-right"
          aria-label="Close assistant"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </div>
      <div className="assistant-context" aria-label="Assistant selected context">
        <Focus size={13} /><span title={currentContext.label}>{currentContext.label}</span><span className="pill">Read & draft</span>
      </div>
      <div className="live-assistant-body" ref={bodyRef} onScroll={event => {
        const body = event.currentTarget;
        followLatest.current = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
      }}>
        <p className="form-note">Ask about the work in front of you. You decide what happens next. Conversation and drafts stay in memory for this app session, separately for each work item.</p>
        <details className="form-note"><summary>What is shared with Claude?</summary><p>Your question, up to three recent exchanges, selected work, and personal plan are sent to your configured endpoint. The assistant does not post comments or change external services. Local rescheduling requires confirmation.</p></details>
        {!messages.length && <div className="assistant-suggestions" aria-label="Suggested assistant prompts">
          {currentContext.prompts.map((prompt) => <button key={prompt} type="button" disabled={!endpointScope || busy} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}>{prompt}<ArrowUpRight size={12} /></button>)}
        </div>}
        {messages.map((m, i) => (
          <div key={i} className={`live-chat-message ${m.role}`}>
            <b>{m.role === "user" ? "You" : "Claude"}</b>
            <p>{m.text}</p>
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
          disabled={!endpointScope}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this code or your work…"
        />
        <button className="btn primary" disabled={!endpointScope || !input.trim() || busy}>
          Send to Claude
        </button>
      </form>
    </aside>
  );
}
