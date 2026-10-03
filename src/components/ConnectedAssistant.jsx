import React, { useState } from "react";
import { X } from "lucide-react";
import { invoke } from "../lib/integration-client";
import { usePlan, updateTask, dayKey, shiftDay } from "../lib/planning";
function Pending() {
  return <p role="status">Claude is responding…</p>;
}
export default function ConnectedAssistant({ context, onClose, onSettings }) {
  const plan = usePlan();
  const [proposal, setProposal] = useState(null);
  const [input, setInput] = useState(""),
    [messages, setMessages] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function send(e) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const question = input;
    if (
      /tomorrow|내일/i.test(question) &&
      /move|옮|미뤄|미루/i.test(question)
    ) {
      const target = plan.tasks.find(
        (t) =>
          !t.done &&
          (t.object?.key
            ? question.includes(t.object.key)
            : question.includes(t.title)),
      );
      if (target) {
        setProposal({
          id: target.id,
          title: target.title,
          from: target.date || "Backlog",
          to: shiftDay(dayKey(), 1),
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
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: (result.content || [])
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n"),
        },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="assistant-panel live-assistant">
      <div className="inspector-header">
        <b>Claude assistant</b>
        <span className="pill">Connected</span>
        <button
          className="icon-button push-right"
          aria-label="Close assistant"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </div>
      <div className="live-assistant-body">
        <p className="form-note">
          질문·선택한 업무·개인 계획을 설정한 Claude로 전송합니다. 외부 상태
          변경·댓글 등록은 실행하지 않습니다. “PAY-382 내일로 옮겨줘”는 확인 후
          로컬 계획만 변경합니다.
        </p>
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
                    updateTask(proposal.id, { date: proposal.to });
                    setMessages((m) => [
                      ...m,
                      {
                        role: "assistant",
                        text: `개인 계획의 ${proposal.title}을 ${proposal.to}로 옮겼습니다.`,
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
        {busy && <Pending />}
        {error && (
          <div className="connection-error" role="alert">
            {error}
            <button className="quiet-button" onClick={onSettings}>
              Integration settings
            </button>
          </div>
        )}
      </div>
      <form className="live-assistant-compose" onSubmit={send}>
        <textarea
          aria-label="Ask Claude"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="선택한 코드나 업무에 대해 물어보세요…"
        />
        <button className="btn primary" disabled={!input.trim() || busy}>
          Send to Claude
        </button>
      </form>
    </aside>
  );
}
