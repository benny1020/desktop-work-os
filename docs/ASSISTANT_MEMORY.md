# A personal assistant that remembers work

Implemented October 4, 2026. Worklane's assistant now separates conversation history, user-sourced knowledge, current work context and scheduled reminders. The existing Claude/Anthropic-compatible endpoint remains the model provider. No third-party memory service or additional account is required.

## Using it

1. Open **Assistant** or press **Cmd/Ctrl J** from Home, an issue, a document or a merge request.
2. Keep it docked for a quick question, or choose **Expand assistant workspace** to read and think in a wider companion space. Docking preserves the draft and selected work context. This is an in-app workspace, not a separate operating-system window.
3. Ask a question. Relevant saved knowledge is retrieved when you explicitly send; expand **View sources** to inspect the evidence used.
4. Use **Memory** to add a note, search prior conversations, edit knowledge, pause remembering, forget records or enable desktop reminder notifications.
5. Review proposed task changes or reminders and explicitly confirm. Local task actions do not edit Jira or send messages.
6. Home's **Assistant brief** groups earlier unfinished work, planned tasks, upcoming personal events and reminders. It uses the same local task dataset as Today, Week and Calendar.

The small original Worklane robot is a visual identity and response indicator. It is not Anthropic's logo. Its motion respects reduced-motion preferences.

## Storage and recall

| Layer | Stored content | Purpose |
| --- | --- | --- |
| Conversation archive | Completed user/assistant exchanges, timestamps and work context | Resume after an application restart and find previous decisions |
| Saved knowledge | Explicit notes and exact user quotations selected from the current question | Remember preferences and commitments without converting model speculation into facts |
| Current work | Selected issue, MR/file/line, document or route plus current personal tasks | Answer in the context of the work in front of the user |
| Reminders | Title, optional task ID, due timestamp and delivery state | Deterministic scheduling independent of Claude |

Encrypted memory archives live in the Electron profile and use the operating system's `safeStorage`. Writes are atomic and permission `0600`; insecure or unavailable OS storage fails closed. The browser-only demo cannot provide this durable storage. Task plans and review drafts retain their existing, separate local storage.

The backend derives an opaque namespace from saved endpoint/account credentials. A token or account change selects a separate archive. The model cannot choose a tenant namespace. A forgotten or paused memory rotates a lease; responses from the previous lease cannot restore it. Model changes alone preserve the namespace.

Retrieval combines object context, keyword matches, recency and record type. At most 20 excerpts within a 9,000-character serialized budget are supplied to a chat request. This is lexical/contextual retrieval, not vector semantic search. The complete archive is not injected into every prompt. There is a 24 MiB archive limit per namespace; reaching it produces a visible save error rather than silently dropping old records.

Configured tokens and recognizable credential patterns are redacted before persistence. Redaction cannot guarantee recognition of every arbitrary sensitive string. The selected context, question, recent conversation and retrieved excerpts are transmitted to the user's configured Claude endpoint only on explicit send.

## Remembering is not authority to act

The model returns one typed reply containing its answer, candidate user quotations and proposed local actions. It has no filesystem access or arbitrary tool execution. Automatic knowledge capture requires an exact quotation from the current user question; the stored fact uses that quotation rather than an AI paraphrase. Repeated identical knowledge is deduplicated.

Creating, scheduling and completing local tasks, and setting reminders, require an explicit confirmation. Task proposals capture the original task state and are rejected if the task has changed before confirmation. Unknown task IDs and invalid dates/times are rejected. External Jira/GitLab/Confluence writes keep their existing direct submission flows.

Forgetting a saved fact also removes its supporting and dependent recalled conversation records, including duplicate copies, so retrieval does not immediately reconstruct it. Forgetting only a conversation does not automatically remove a separately saved fact: use the Saved knowledge list or Forget all for that. Forget all also deletes reminders for the current connected profile. Deletion is an application-level removal, not a guarantee about OS backups or storage forensic recovery.

## Reminders and proactive help

The brief is deterministic: opening Home, reading memory or polling reminders does not call Claude. The desktop process checks reminders on startup, resume and every 30 seconds. Dismiss, snooze and notification opt-out are revalidated before delivery so stale checks cannot revive an obsolete reminder.

Desktop notifications are opt-in. Fully quitting Worklane stops its scheduler; overdue reminders are caught up when it reopens. This implementation does not include a background cloud agent, LaunchAgent, cross-device sync or unattended external actions. A remembered intention is not shown as a scheduled reminder unless it has a durable due timestamp.

## Research translated into implementation

- [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) motivated bounded retrieval instead of endlessly growing prompt history. [Anthropic memory documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) clarifies that persistence belongs to the application. Worklane uses an ordinary structured tool response and its own encrypted storage; it does not expose Claude's filesystem memory tool.
- Letta supplied the layered-memory and bounded-recall pattern; Mem0 supplied useful tenant and memory-lifecycle comparisons; LangMem supplied typed-record and namespace patterns. The [source review](../research/ASSISTANT_MEMORY_REPOS.md) records exact inspected commits, files, licenses and adoption decisions. No framework code was copied or package installed.
- [Muse's product design](https://introducing.muse.ai/) influenced the companion identity, inspectable memory and explicit action cards. [Muse's product description](https://ai.meta.com/muse/) also describes background autonomy; Worklane does not claim to implement Muse's dedicated VM, arbitrary app operation or closed-app cloud execution.

The assistant remembers what Worklane has actually recorded. It does not automatically know every company record, earlier conversations in unrelated apps, or unconnected services. Conflicting preferences can be inspected and edited; model recall is not guaranteed to be complete or infallible.

## Verification

See the [API contract](ASSISTANT_MEMORY_API.md), `tests/assistant-memory*.spec.js`, `tests/assistant-brief.spec.js`, `tests/integration/assistant-*.test.mjs` and `scripts/test-assistant-memory-desktop.mjs`.

The native memory gate runs the actual Electron renderer/preload/main bridge, OS encryption and intercepted HTTPS responses through three launches of the same isolated profile. It checks restart recall in the next model request, encrypted bytes and permissions, reminder persistence, forgetting original and dependent records, and clearing without resurrection. It does not call real company services, a live Claude model, or send real OS notifications.

### Final local gate

- 185/185 browser workflow tests passed, including memory restart UI, explicit task confirmation, stale search/history, pause, notification preference, reminder lease refresh and existing review workflows.
- 57/57 adapter and deterministic-rule tests passed, including 20 memory/storage/scheduler cases.
- Native connected workflow: 7/7 checks, 39 intercepted HTTPS requests, zero renderer console errors.
- Native memory lifecycle: 5/5 checks across three launches of an isolated profile, including editing a fact without recalling the superseded wording.
- Six new 1440×900 workflow captures produced with synthetic fixtures and zero page errors. Expanded controls were also verified at 980×650.
- Independent review found and resolved stale reminder delivery, duplicate-fact forgetting, early draft loss, paused-history recall, stale search responses and partial-save error visibility. A final correction test caught obsolete facts remaining after editing; supporting records and provenance now update together.

These results establish behavior in the tested scope, not universal absence of defects. The screenshot/GIF answers and company records are fixtures. Real endpoint compatibility, model quality, operating-system notification delivery, Windows/Linux and cross-device behavior remain outside this run.
