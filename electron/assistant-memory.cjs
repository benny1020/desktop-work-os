const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SERVICES = ['claude', 'confluence', 'gitlab', 'jira'];
const MAX_STORE_BYTES = 24 * 1024 * 1024;
const cleanString = (value, name, max) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`${name} must contain 1–${max} characters.`);
  return value.trim();
};
function credentialScope(configs) {
  const identity = SERVICES.map((service) => {
    const c = configs[service] || {};
    return [service, c.url || '', c.email || '', c.cloudId || '', c.workspaceId || '', c.token || ''];
  });
  return crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}
function redactMemory(value, configs) {
  let text = String(value ?? '');
  const secrets = SERVICES.flatMap((service) => {
    const c = configs[service];
    if (!c?.token) return [];
    return [c.token, encodeURIComponent(c.token), c.email ? Buffer.from(`${c.email}:${c.token}`).toString('base64') : ''];
  }).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
  return text
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_.~=-]+/gi, '$1 [REDACTED]')
    .replace(/\b(?:sk-ant-[\w-]+|glpat-[\w-]+)\b/g, '[REDACTED]')
    .replace(/((?:api[_-]?key|access[_-]?token|private[_-]?token|authorization|password)\s*[=:]\s*["']?)[^\s"',;}]+/gi, '$1[REDACTED]');
}
function createAssistantMemoryStore({ directory, safeStorage, getConfigs, now = () => Date.now(), maxBytes = MAX_STORE_BYTES }) {
  function available() {
    if (!safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text') throw Error('OS encrypted storage is unavailable. Assistant memory was not read or saved.');
  }
  const currentScope = () => credentialScope(getConfigs());
  const filename = (scope) => path.join(directory, `assistant-memory-${scope}.enc`);
  const timestamp = () => new Date(now()).toISOString();
  function write(scope, state) {
    available();
    const serialized = JSON.stringify(state);
    if (Buffer.byteLength(serialized) > maxBytes) throw Error('Assistant memory is full. Nothing was discarded. Forget selected history or clear memory before saving more.');
    const encrypted = safeStorage.encryptString(serialized);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const destination = filename(scope), temporary = `${destination}.${crypto.randomUUID()}.tmp`;
    let fd;
    try {
      fd = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(fd, encrypted); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      fs.renameSync(temporary, destination);
      fs.chmodSync(destination, 0o600);
      const parent = fs.openSync(directory, 'r');
      try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  function read(scope = currentScope()) {
    available();
    if (scope !== currentScope()) throw Error('Assistant account changed. Reopen the assistant before continuing.');
    const file = filename(scope);
    if (!fs.existsSync(file)) {
      const state = { version: 1, scope, epoch: crypto.randomUUID(), remembering: true, notificationsEnabled: false, conversations: [], facts: [], reminders: [], forgottenDigests: [], updatedAt: timestamp() };
      write(scope, state); return state;
    }
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes * 2) throw Error('Invalid memory file');
      const state = JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
      if (state.version !== 1 || state.scope !== scope || typeof state.epoch !== 'string' || typeof state.remembering !== 'boolean' || !Array.isArray(state.conversations) || !Array.isArray(state.facts) || !Array.isArray(state.reminders)) throw Error('Invalid memory format');
      return state;
    } catch {
      throw Error('Cannot unlock saved assistant memory. Your archive was left unchanged. Check the OS keychain or restore a valid backup.');
    }
  }
  const leaseFor = (state) => ({ scope: state.scope, epoch: state.epoch });
  function checked(lease) {
    if (!lease || lease.scope !== currentScope()) throw Error('Assistant account changed. This late operation was not saved.');
    const state = read(lease.scope);
    if (state.epoch !== lease.epoch) throw Error('Assistant memory changed. This late operation was not saved.');
    return state;
  }
  function mutate(lease, change, { invalidate = false, allowPaused = true } = {}) {
    const state = checked(lease);
    if (!allowPaused && !state.remembering) return { saved: false, paused: true, lease: leaseFor(state) };
    const result = change(state);
    if (invalidate) state.epoch = crypto.randomUUID();
    state.updatedAt = timestamp(); write(state.scope, state);
    return { saved: true, lease: leaseFor(state), result };
  }
  const redact = (text) => redactMemory(text, getConfigs());
  const provenance = (source = {}) => Object.fromEntries(['conversationId', 'messageId', 'contextKey', 'title'].filter((key) => typeof source[key] === 'string').map((key) => [key, redact(cleanString(source[key], key, 1000))]));
  function getState() { const state = read(); return { ...state, lease: leaseFor(state) }; }
  function archive(lease, { conversationId, contextKey, title, messages, usedMemoryIds = [] }) {
    const id = cleanString(conversationId, 'Conversation ID', 200);
    if (!Array.isArray(messages) || !messages.length || messages.length > 500) throw Error('Provide between 1 and 500 conversation messages.');
    const entries = messages.map((m) => {
      if (!['user', 'assistant'].includes(m.role)) throw Error('Only user and assistant messages can be archived.');
      return { id: cleanString(m.id, 'Message ID', 200), role: m.role, text: redact(cleanString(m.text, 'Message', 200000)), createdAt: timestamp() };
    });
    return mutate(lease, (state) => {
      let conversation = state.conversations.find((c) => c.id === id);
      if (!conversation) {
        conversation = { id, contextKey: redact(cleanString(contextKey, 'Context key', 2000)), title: redact(cleanString(title || 'Conversation', 'Title', 1000)), messages: [], usedMemoryIds: Array.isArray(usedMemoryIds) ? usedMemoryIds.filter(id => typeof id === "string").slice(0, 20) : [], createdAt: timestamp() };
        state.conversations.push(conversation);
      }
      for (const entry of entries) {
        const existing = conversation.messages.find((m) => m.id === entry.id);
        if (existing && (existing.text !== entry.text || existing.role !== entry.role)) throw Error('A saved message cannot be replaced implicitly.');
        if (!existing) conversation.messages.push(entry);
      }
      conversation.updatedAt = timestamp(); return conversation.id;
    }, { allowPaused: false });
  }
  const digest = text => crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
  function retireFactEvidence(state, fact) {
    const quotes = [fact.text, fact.sourceQuote].filter(Boolean);
    const fingerprints = quotes.map(digest);
    const duplicates = state.facts.filter(item => [item.text, item.sourceQuote].filter(Boolean).some(text => fingerprints.includes(digest(text))));
    const duplicateIds = new Set(duplicates.map(item => item.id));
    state.facts = state.facts.filter(item => !duplicateIds.has(item.id));
    state.forgottenDigests = [...new Set([...(state.forgottenDigests || []), ...quotes.map(digest)])];
    state.conversations = state.conversations.filter(c => !duplicates.some(item => c.id === item.source?.conversationId) && !c.usedMemoryIds?.some(id => duplicateIds.has(id)) && !c.messages.some(m => quotes.some(quote => m.text.includes(quote))));
  }
  function saveFact(lease, { id, text, source, kind = "note", sourceQuote = "", sourceContext = "", automatic = false }) {
    const value = redact(cleanString(text, 'Memory', 10000));
    return mutate(lease, (state) => {
      const fingerprint = digest(value);
      if (automatic && state.forgottenDigests?.includes(fingerprint)) return null;
      if (automatic) { const existing = state.facts.find(f => digest(f.text) === fingerprint || (f.sourceQuote && digest(f.sourceQuote) === fingerprint)); if (existing) return existing; }
      const previous = id && state.facts.find((fact) => fact.id === id);
      if (id && !previous) throw Error('This memory no longer exists.');
      if (previous && value !== previous.text) {
        retireFactEvidence(state, previous);
        sourceQuote = value;
        sourceContext = 'Edited by you';
        source = {};
      }
      if (!automatic) state.forgottenDigests = (state.forgottenDigests || []).filter(item => item !== fingerprint);
      const fact = { id: previous?.id || crypto.randomUUID(), text: value, kind: redact(cleanString(kind, "Memory kind", 80)), sourceQuote: redact(String(sourceQuote || previous?.sourceQuote || "").slice(0, 12000)), sourceContext: redact(String(sourceContext || previous?.sourceContext || "").slice(0, 2000)), source: source ? provenance(source) : previous?.source || {}, createdAt: previous?.createdAt || timestamp(), updatedAt: timestamp() };
      state.facts = [...state.facts.filter((item) => item.id !== fact.id), fact]; return fact;
    }, { invalidate: !!id });
  }
  function forget(lease, { kind, id }) {
    const collection = { conversation: 'conversations', fact: 'facts', reminder: 'reminders' }[kind];
    if (!collection) throw Error('Choose a conversation, fact, or reminder.');
    return mutate(lease, (state) => {
      if (kind === 'fact') {
        const fact = state.facts.find(item => item.id === id);
        if (!fact) throw Error('This memory no longer exists.');
        retireFactEvidence(state, fact);
      }
      state[collection] = state[collection].filter((item) => item.id !== id);
    }, { invalidate: true });
  }
  function clear(lease, target = 'all') {
    if (!['all', 'conversations', 'memories'].includes(target)) throw Error('Invalid memory clear target.');
    return mutate(lease, (state) => {
      if (target !== 'memories') state.conversations = [];
      if (target !== 'conversations') {
        const quotes = state.facts.flatMap(f => [f.text, f.sourceQuote].filter(Boolean));
        state.forgottenDigests = [...new Set([...(state.forgottenDigests || []), ...quotes.map(digest)])];
        if (target === 'memories') state.conversations = state.conversations.filter(c => !c.usedMemoryIds?.some(id => state.facts.some(f => f.id === id)) && !c.messages.some(m => quotes.some(quote => m.text.includes(quote))));
        state.facts = [];
      }
      if (target === 'all') { state.reminders = []; state.forgottenDigests = []; }
    }, { invalidate: true });
  }
  function setNotifications(lease, enabled) {
    if (typeof enabled !== 'boolean') throw Error('Notifications must be enabled or disabled.');
    return mutate(lease, (state) => { state.notificationsEnabled = enabled; });
  }
  function setRemembering(lease, enabled) {
    if (typeof enabled !== 'boolean') throw Error('Remembering must be enabled or paused.');
    return mutate(lease, (state) => { state.remembering = enabled; }, { invalidate: true });
  }
  function saveReminder(lease, { id, text, dueAt, source, taskId }) {
    const due = new Date(dueAt).getTime();
    if (!Number.isFinite(due) || due <= now()) throw Error('Choose a reminder time in the future.');
    const value = redact(cleanString(text, 'Reminder', 4000));
    return mutate(lease, (state) => {
      const previous = id && state.reminders.find((r) => r.id === id);
      if (id && !previous) throw Error('This reminder no longer exists.');
      const reminder = { id: previous?.id || crypto.randomUUID(), text: value, dueAt: new Date(due).toISOString(), status: 'scheduled', revision: crypto.randomUUID(), taskId: taskId ? cleanString(taskId, 'Task ID', 200) : previous?.taskId, source: source ? provenance(source) : previous?.source || {}, createdAt: previous?.createdAt || timestamp(), updatedAt: timestamp() };
      state.reminders = [...state.reminders.filter((r) => r.id !== reminder.id), reminder]; return reminder;
    });
  }
  function updateReminder(lease, { id, status }) {
    if (!['delivered', 'done'].includes(status)) throw Error('Invalid reminder status.');
    return mutate(lease, (state) => {
      const reminder = state.reminders.find((r) => r.id === id);
      if (!reminder) throw Error('This reminder no longer exists.');
      reminder.status = status; reminder.revision = crypto.randomUUID(); if (status === "delivered") reminder.notifiedAt = timestamp(); reminder.updatedAt = timestamp(); return reminder;
    });
  }
  function dueReminders() { const state = read(); return { lease: leaseFor(state), items: state.reminders.filter((r) => r.status === 'scheduled' && Date.parse(r.dueAt) <= now()) }; }
  function retrieve(lease, { query = '', contextKey = '', maxChars = 9000 } = {}) {
    const state = checked(lease), budget = Math.min(16000, Math.max(0, Number.isFinite(maxChars) ? Math.floor(maxChars) : 9000));
    const terms = [...new Set(redact(query).toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) || [])];
    const candidates = [
      ...state.facts.map((f) => ({ kind: 'fact', id: f.id, text: f.text, source: f.source, at: f.updatedAt, rank: 4 })),
      ...state.conversations.flatMap((c) => c.messages.map((m) => ({ kind: 'message', id: m.id, text: m.text, role: m.role, source: { conversationId: c.id, contextKey: c.contextKey, title: c.title }, at: m.createdAt, rank: c.contextKey === contextKey ? 2 : 0 }))),
      ...state.reminders.filter((r) => r.status !== 'done').map((r) => ({ kind: 'reminder', id: r.id, text: r.text, source: r.source, dueAt: r.dueAt, at: r.updatedAt, rank: 3 })),
    ].map((item) => ({ ...item, rank: item.rank + terms.reduce((n, term) => n + (item.text.toLowerCase().includes(term) ? 5 : 0), 0) }))
      .sort((a, b) => b.rank - a.rank || b.at.localeCompare(a.at));
    // A strong relevance hit leads, but recent conversation evidence retains
    // space even when many older facts have a higher base weight.
    const recent = candidates.filter(item => item.kind === 'message').sort((a, b) => b.at.localeCompare(a.at)).slice(0, 2);
    const ordered = [...(candidates[0] ? [candidates[0]] : []), ...recent, ...candidates];
    const seen = new Set();
    const results = []; let used = 2;
    for (const candidate of ordered) {
      const identity = `${candidate.kind}:${candidate.source?.conversationId || ''}:${candidate.id}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const { rank, ...item } = candidate;
      const entry = { ...item, text: item.text.slice(0, 1400), excerpt: item.text.length > 1400 };
      const length = JSON.stringify(entry).length + (results.length ? 1 : 0);
      if (used + length > budget) continue;
      results.push(entry); used += length;
      if (results.length >= 20) break;
    }
    return { items: results, chars: used, totalCandidates: candidates.length, limited: results.length < candidates.length };
  }
  return { currentScope, getState, archive, saveFact, forget, clear, setRemembering, setNotifications, saveReminder, updateReminder, dueReminders, retrieve, validateLease: checked };
}
module.exports = { createAssistantMemoryStore, credentialScope, redactMemory };

function createReminderScheduler({ store, notify, onError = () => {} }) {
  let running = false;
  return { async tick() {
    if (running) return;
    running = true;
    try {
      const state = store.getState();
      if (!state.notificationsEnabled) return;
      const due = store.dueReminders();
      for (const candidate of due.items) {
        const current = store.validateLease(due.lease);
        if (!current.notificationsEnabled) break;
        const reminder = store.dueReminders().items.find(item => item.id === candidate.id);
        if (!reminder) continue;
        if (await notify(reminder)) {
          const latest = store.validateLease(due.lease);
          const pending = latest.reminders.find(item => item.id === reminder.id);
          if (latest.notificationsEnabled && pending?.status === 'scheduled' && pending.revision === reminder.revision && pending.dueAt === reminder.dueAt)
            store.updateReminder(due.lease, { id: reminder.id, status: 'delivered' });
        }
      }
    } catch (error) { onError(error); }
    finally { running = false; }
  }};
}
module.exports.createReminderScheduler = createReminderScheduler;
