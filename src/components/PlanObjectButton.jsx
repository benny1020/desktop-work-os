import React, { useEffect, useState } from "react";
import { addPlanTask, usePlan, objectKey, dayKey, updateTask } from "../lib/planning";

// Linked work has one canonical local task. Rescheduling is explicit and reversible.
export default function PlanObjectButton({ object, title, addLabel = "Add to Today", onNotice, onError }) {
  const plan = usePlan(), [undo, setUndo] = useState(null), [notice, setNotice] = useState("");
  const scope = objectKey(object);
  useEffect(() => { setUndo(null); setNotice(""); }, [scope]);
  const existing = plan.tasks.find(task => !task.done && objectKey(task.object) === objectKey(object));
  const today = dayKey(), inToday = existing?.date === today;
  function announce(message) { setNotice(message); onNotice?.(message); }
  function schedule() {
    if (inToday) return;
    try {
      if (existing) {
        updateTask(existing.id, { date: today });
        setUndo({ id: existing.id, scope, from: existing.date, expected: JSON.stringify({ ...existing, date: today }) });
        announce("Moved to Today · local plan");
      } else {
        addPlanTask({ title, object, date: today });
        setUndo(null); announce("Added to Today · local plan");
      }
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
    <button className="btn" disabled={inToday} onClick={schedule}>{inToday ? "In Today" : existing ? "Move to Today" : addLabel}</button>
    <small>{existing ? `${date ? `Planned ${date}${existing.time ? ` · ${existing.time}` : ""}` : "In backlog"} · local plan` : `Personal schedule · ${object.type === "mr" ? "GitLab" : "Jira"} stays unchanged`}</small>
    {undo?.scope === scope && <button className="quiet-button" onClick={restore}>Undo schedule move</button>}
    {!onNotice && notice && <small role="status">{notice}</small>}
  </div>;
}
