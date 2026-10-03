import { useCallback, useSyncExternalStore } from 'react';

// Renderer memory only: closing a panel must not discard work or duplicate a request.
const sessions = new Map();
let credentialEpoch = 0;
export function advanceAssistantCredentialScope() { credentialEpoch++; }
const empty = () => ({ proposal: null, history: [], input: '', messages: [], busy: false, error: '', hydrated: false, archiveOffset: 0, archiveTotal: 0 });
function session(key) {
  if (!sessions.has(key)) sessions.set(key, { value: empty(), listeners: new Set() });
  return sessions.get(key);
}
export function assistantContextKey(context) {
  let item;
  try { item = typeof context === 'string' ? JSON.parse(context) : context; } catch { item = null; }
  if (!item || typeof item !== 'object') return 'workspace';
  if (item.iid != null) return JSON.stringify(['mr', item.projectId ?? item.project ?? item.project_id, item.iid]);
  if (item.key) return JSON.stringify(['issue', item.key]);
  if (item.id != null) return JSON.stringify([item.type || (item.body ? 'doc' : 'object'), item.projectId, item.id]);
  return JSON.stringify([item.section || item.type || 'workspace', item.view || item.query || '']);
}
export function assistantEndpointScope(configs) {
  return JSON.stringify([credentialEpoch, ['jira', 'gitlab', 'confluence', 'claude'].map(name => [name, configs?.[name]?.url || '', configs?.[name]?.email || '', configs?.[name]?.cloudId || '', configs?.[name]?.workspaceId || ''])]);
}
export function useAssistantSession(key) {
  const subscribe = useCallback(listener => {
    const current = session(key);
    current.listeners.add(listener);
    return () => current.listeners.delete(listener);
  }, [key]);
  const snapshot = useCallback(() => session(key).value, [key]);
  const state = useSyncExternalStore(subscribe, snapshot);
  const set = useCallback((field, value) => {
    const current = session(key);
    current.value = { ...current.value, [field]: typeof value === 'function' ? value(current.value[field]) : value };
    current.listeners.forEach(listener => listener());
  }, [key]);
  const isBusy = useCallback(() => session(key).value.busy, [key]);
  return { state, set, isBusy };
}
