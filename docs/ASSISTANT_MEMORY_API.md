# Durable assistant contract

All calls use the existing `orbit:integration` bridge. Available only in Electron with OS encrypted storage. Every request except initial `state` includes the last `{scope, epoch}`. Scope is an opaque digest of saved service identities and credentials. Token/account changes isolate archives. Clear, forget, editing memory and pausing/resuming rotate epoch; refresh state after each mutation. A late response cannot restore erased or paused memory.

## Memory

`invoke('assistant.memory', {op, scope?, epoch?, ...})`

- `state`: `{scope,epoch,enabled,notificationsEnabled,memories,stats:{conversations,memories},reminders}`. Each memory: `{id,text,kind,sourceQuote,sourceContext,createdAt,updatedAt}`.
- `history`: `{contextKey,offset?:0,limit?:20}` returns `{entries:[{id,question,answer,contextKey,createdAt}],total}`. Latest first; limit at most 100.
- `search`: `{query}` returns `{memories,episodes}`. Bounded excerpts with IDs and source metadata; not the complete archive.
- `remember`: `{text,kind?:'note'}`. Explicit user memory. Returns fresh state.
- `update`: `{id,text}`. Preserves the record ID and creation time. A changed fact retires its prior quote, matching duplicate facts, supporting archive episodes and episodes that recalled that fact. The replacement is attributed to your explicit edit; the old quote cannot be automatically re-learned. Returns fresh state with a rotated epoch.
- `forget`: Removes the selected memory and any exact supporting archive episodes; automatic re-learning of the same quote is suppressed. An explicit `remember` may restore it. `{id,type:'memory'|'conversation'}`. Returns fresh state.
- `clear`: Clearing memories also removes matching supporting archive episodes. `{target:'all'|'conversations'|'memories'}`. `all` also clears reminders. Returns fresh state.
- `enabled`: `{enabled:boolean}` pauses/resumes automatic retrieval, archive and fact capture; explicit saved notes and reminders remain available. Returns fresh state.
- `notifications`: `{enabled:boolean}` opt-in desktop reminders. Returns fresh state.

## Reminders

`invoke('assistant.reminders',{op,scope,epoch,...})`

- `list` → `{reminders}`.
- `create`: `{title,dueAt,taskId?}`.
- `snooze`: `{id,dueAt}`.
- `dismiss`: `{id}`.
- Mutations return `{reminders}`. Entries are `{id,title,dueAt,taskId?,state:'scheduled'|'due'|'dismissed',createdAt,notifiedAt?}`. Times are ISO timestamps; new/snoozed dates must be in the future.

The app checks due reminders on startup, resume and while its Electron process is alive. OS notification delivery is opt-in and once per scheduled occurrence; no background Claude calls. Quitting the app stops checks; overdue entries remain visible on reopening. OS notification availability is separate from due state.

## Claude chat

Legacy calls without `memory` retain their response contract. Opt-in durable calls add:

```
{message,context,history?,memory:{scope,epoch,contextKey}}
```

The backend captures Claude configuration before sending, retrieves relevant/recent memory within a 9,000-character JSON budget, and forces one `worklane_reply` structured tool result:

```
{answer,memories:[{text,kind,sourceQuote}],suggestions:[
 {type:'create_task'|'reschedule_task'|'complete_task'|'reminder',taskId?,title?,date?,time?,dueAt?,reason}
]}
```

Automatic memory must quote an exact nonempty substring of the current USER question; inferred or context-only facts are discarded. Suggestions do not execute. Response keeps `content:[{type:'text',text:answer}]` and adds `suggestions`, `memory:{saved,used,stats,scope,epoch,error?}`. Always display `memory.error` when present, including `saved:true,partial:true` when only the conversation was saved but a fact write failed. Archive failure does not hide an already generated answer; `saved:false,error` is explicit. Invalid/unfinished tool responses fail rather than reporting success.

Storage is safeStorage-encrypted, atomic and permission 0600; `basic_text` and unavailable keychain fail closed. Full archives are never silently pruned. Limits: 24 MiB per account archive, 200,000 characters per saved message, 10,000 per memory, 4,000 per reminder; over-limit writes fail without replacing the prior archive. Configured credentials and recognizable auth/token patterns are redacted before persistence. Export is not implemented.

Design references: [Anthropic memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool), [context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing). Worklane owns encrypted typed storage; it does not expose file operations or autonomous memory-tool writes to Claude.
