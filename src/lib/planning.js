import { useSyncExternalStore } from "react";
const KEY = "orbit.connected.plan.v1";
const EMPTY = { tasks: [], recent: [], favorites: [], activity: [] };
let current;
const listeners = new Set();
function read() {
  if (!current) {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      current =
        data && Array.isArray(data.tasks) ? { ...EMPTY, ...data } : EMPTY;
    } catch {
      current = EMPTY;
    }
  }
  return current;
}
export function usePlan() {
  return useSyncExternalStore((fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, read);
}
export function planChange(fn) {
  const next = fn(read());
  // Persist first: failure must not look like a successful save.
  localStorage.setItem(KEY, JSON.stringify(next));
  current = next;
  listeners.forEach((fn) => fn());
}
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDay(day, n) {
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
export function shiftMonth(day, delta) {
  const d=new Date(day+'T12:00:00'), original=d.getDate();
  d.setDate(1);d.setMonth(d.getMonth()+delta);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(original,last));return dayKey(d);
}
export function parseQuick(text, fallback = dayKey()) {
  let title = text.trim(),
    date = fallback,
    time = "";
  if (/\b(tomorrow)\b|내일/i.test(title)) {
    date = shiftDay(dayKey(), 1);
    title = title.replace(/\btomorrow\b|내일/gi, "");
  } else if (/\btoday\b|오늘/i.test(title)) {
    date = dayKey();
    title = title.replace(/\btoday\b|오늘/gi, "");
  }
  const iso = title.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) {
    const d = new Date(iso[1] + "T12:00:00");
    if (Number.isNaN(+d) || dayKey(d) !== iso[1])
      throw Error("Enter a valid date in YYYY-MM-DD format.");
    date = iso[1];
    title = title.replace(iso[0], "");
  }
  const at = title.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/i,
  );
  if (at) {
    let h = Number(at[1] ?? at[4]),
      m = Number(at[2] ?? at[5] ?? 0);
    if (at[3]) {
      if (h < 1 || h > 12) throw Error("Enter a valid time, such as 14:00 or 2pm.");
      h = (h % 12) + (/pm/i.test(at[3]) ? 12 : 0);
    }
    if (h > 23 || m > 59) throw Error("Enter a valid time, such as 14:00 or 2pm.");
    time = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    title = title.replace(at[0], "");
  }
  title = title.replace(/\s+/g, " ").trim();
  if (!title) throw Error("Enter a task title.");
  return { title, date, time };
}
export function addPlanTask(task) {
  let result;
  planChange((p) => {
    const existing =
      task.object &&
      p.tasks.find(
        (t) => objectKey(t.object) === objectKey(task.object) && !t.done,
      );
    result = existing
      ? { ...existing, date: task.date ?? dayKey() }
      : {
          id: crypto.randomUUID(),
          kind: "task",
          date: dayKey(),
          time: "",
          done: false,
          ...task,
        };
    return {
      ...p,
      tasks: existing
        ? p.tasks.map((t) => (t.id === existing.id ? result : t))
        : [...p.tasks, result],
    };
  });
  return result;
}
export function updateTask(id, changes) {
  planChange((p) => ({
    ...p,
    tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    activity: [
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        text: `${p.tasks.find((t) => t.id === id)?.title}: ${changes.done === true ? "Completed" : changes.done === false ? "Reopened" : changes.date ? "Scheduled " + changes.date : "Updated"}`,
      },
      ...p.activity,
    ].slice(0, 100),
  }));
}
export function moveTask(id, date, before) {
  planChange((p) => {
    const t = p.tasks.find((t) => t.id === id);
    if (!t) return p;
    const rest = p.tasks.filter((t) => t.id !== id);
    const index = before ? rest.findIndex((t) => t.id === before) : -1;
    rest.splice(index < 0 ? rest.length : index, 0, { ...t, date });
    return { ...p, tasks: rest };
  });
}
export function objectKey(o) {
  return o
    ? [o.type, o.origin, o.key || o.id, o.projectId, o.iid].join(":")
    : "";
}
export function rememberObject(object) {
  planChange((p) => ({
    ...p,
    recent: [
      object,
      ...p.recent.filter((o) => objectKey(o) !== objectKey(object)),
    ].slice(0, 30),
  }));
}
export function favoriteObject(object) {
  planChange((p) => ({
    ...p,
    favorites: p.favorites.some((o) => objectKey(o) === objectKey(object))
      ? p.favorites.filter((o) => objectKey(o) !== objectKey(object))
      : [object, ...p.favorites],
  }));
}
