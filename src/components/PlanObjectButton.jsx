import React, { useEffect, useState } from "react";
import { addPlanTask, usePlan, objectKey, dayKey, updateTask } from "../lib/planning";

// Linked work has one canonical local task. Rescheduling is explicit and reversible.
export default function PlanObjectButton({ object, title, addLabel = "Add to Today", onNotice, onError }) {
  const plan = usePlan(), [undo, setUndo] = useState(null), [notice, setNotice] = useState("");
  const [choosing, setChoosing] = useState(false), [targetDate, setTargetDate] = useState(dayKey());
  const scope = objectKey(object);
  useEffect(() => { setUndo(null); setNotice(""); setChoosing(false); }, [scope]);
  const existing = plan.tasks.find(task => !task.done && objectKey(task.object) === objectKey(object));
  const today = dayKey(), inToday = existing?.date === today;
  function announce(message) { setNotice(message); onNotice?.(message); }
  function schedule(target = today) {
    if (existing?.date === target) { setChoosing(false); return; }
    try {
      if (existing) {
        updateTask(existing.id, { date: target });
        setUndo({ id: existing.id, scope, from: existing.date, expected: JSON.stringify({ ...existing, date: target }) });
        announce(`Moved to ${target === today ? "Today" : target || "Backlog"} · local plan`);
      } else {
        addPlanTask({ title, object, date: target });
        setUndo(null); announce(`Added to ${target === today ? "Today" : target || "Backlog"} · local plan`);
      }
      setChoosing(false);
    } catch (error) { onError?.(error.message); }
  }
  function restore() {
    const current = plan.tasks.find(task => task.id === undo.id);
    if (undo.scope !== scope || !current || JSON.stringify(current) !== undo.expected) {
      setUndo(null); announce("Task changed after this move. Kept its current schedule."); return;
    }
    try { updateTask(undo.id, { date: undo.from }); setUndo(null); announce("Schedule restored · local plan"); }
    catch (error) { onError?.(error.message); }
  }
  const date = existing?.date && new Date(`${existing.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return <div className="plan-object-action">
    <button className="btn" disabled={inToday} onClick={() => schedule()}>{inToday ? "In Today" : existing ? "Move to Today" : addLabel}</button>
    <button className="quiet-button" aria-expanded={choosing} onClick={() => { setTargetDate(existing?.date || today); setChoosing(value => !value); }}>Plan…</button>
    <small>{existing ? `${date ? `Planned ${date}${existing.time ? ` · ${existing.time}` : ""}` : "In backlog"} · local plan` : `Personal schedule · ${object.type === "mr" ? "GitLab" : "Jira"} stays unchanged`}</small>
    {undo?.scope === scope && <button className="quiet-button" onClick={restore}>Undo schedule move</button>}
    {choosing && <form className="plan-object-popover" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setChoosing(false); } }} aria-label="Schedule linked work" onSubmit={event => { event.preventDefault(); schedule(targetDate); }}>
      <b>Personal plan</b><label>Date <input autoFocus type="date" aria-label="Local planning date" value={targetDate} onChange={event => setTargetDate(event.target.value)} /></label>
      <small>{targetDate ? `Schedule for ${targetDate}` : "No date · keep in personal backlog"}. Source tool status, sprint, and due date stay unchanged.</small>
      <div className="inline"><button className="btn primary" disabled={Boolean(existing) && existing.date === targetDate}>{existing ? "Move in local plan" : "Add to local plan"}</button><button type="button" className="quiet-button" onClick={() => setChoosing(false)}>Cancel</button></div>
    </form>}
    {!onNotice && notice && <small role="status">{notice}</small>}
  </div>;
}
