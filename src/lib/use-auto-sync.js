import { useEffect, useRef, useState } from "react";

// Visible work stays fresh. Sleep/hidden/offline periods do not accumulate work.
export function useAutoSync({ key, services = [], enabled = true, refresh, interval = 60000 }) {
  const latest = useRef({ key, enabled, refresh });
  latest.current = { key, enabled, refresh };
  const lastSuccess = useRef(0);
  const lastAttempt = useRef(0);
  const controls = useRef(null);
  const [state, setState] = useState({ syncing: false, lastSynced: null, error: "", offline: !navigator.onLine });
  const servicesKey = services.join(",");
  const markSynced = () => {
    lastSuccess.current = Date.now();
    setState(s => ({ ...s, lastSynced: lastSuccess.current, error: "" }));
  };
  useEffect(() => {
    lastSuccess.current = 0; lastAttempt.current = 0;
    setState({ syncing: false, lastSynced: null, error: "", offline: !navigator.onLine });
  }, [key]);
  useEffect(() => {
    let active = true, busy = false, failures = 0, timer, invalidation, rerun = false;
    const current = () => active && latest.current.key === key && latest.current.enabled;
    const available = () => current() && navigator.onLine && document.visibilityState !== "hidden";
    const delay = () => Math.min(300000, interval * 2 ** Math.min(failures, 3));
    function schedule(ms = delay()) {
      clearTimeout(timer);
      if (available()) timer = setTimeout(() => run(), ms);
    }
    async function run() {
      if (!available()) return;
      if (busy) { rerun = true; return; }
      busy = true; lastAttempt.current = Date.now(); clearTimeout(timer);
      setState(s => ({ ...s, syncing: true, offline: false }));
      try {
        await latest.current.refresh(current);
        if (!current()) return;
        failures = 0; lastSuccess.current = Date.now();
        setState(s => ({ ...s, lastSynced: lastSuccess.current, error: "" }));
      } catch (error) {
        if (current()) { failures++; setState(s => ({ ...s, error: error.message || "Sync unavailable" })); }
      } finally {
        busy = false;
        if (current()) {
          setState(s => ({ ...s, syncing: false }));
          schedule(rerun ? 250 : delay()); rerun = false;
        }
      }
    }
    function resume() {
      setState(s => ({ ...s, offline: !navigator.onLine }));
      if (!available()) { clearTimeout(timer); return; }
      if (Date.now() - Math.max(lastSuccess.current, lastAttempt.current) >= 15000) {
        if (!busy) void run();
      } else schedule();
    }
    function online() { setState(s => ({ ...s, offline: false })); if (!busy) void run(); }
    function invalidate(event) {
      if (!services.includes(event.detail?.service)) return;
      clearTimeout(invalidation);
      invalidation = setTimeout(() => { if (busy) rerun = true; else void run(); }, 250);
    }
    setState(s => ({ ...s, syncing: false }));
    controls.current = run;
    if (enabled) schedule();
    window.addEventListener("focus", resume);
    window.addEventListener("online", online);
    window.addEventListener("offline", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("worklane:integration-changed", invalidate);
    return () => {
      active = false; clearTimeout(timer); clearTimeout(invalidation);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("worklane:integration-changed", invalidate);
    };
  }, [key, enabled, interval, servicesKey]);
  return { ...state, syncing: enabled && state.syncing, run: () => controls.current?.(), markSynced };
}
