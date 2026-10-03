# Iterative UI/UX review

2026-10-03. Three specialist agents and the primary agent alternated implementation and independent review. This record covers the desktop prototype and fixture-backed connected workflows; it does not certify live organization integrations.

## Release gate

The gate is no known unresolved critical/high-severity issue in the reviewed workflows, followed by an independent review and a full regression run. P0 means a critical unsafe action or unusable application; P1 means data loss, misleading code context, or a blocked core workflow. P2 covers recoverable context, focus, navigation and feedback defects. Passing tests alone does not establish the absence of all defects.

## Review cycles

| Cycle | Reviewer focus | Reproduced problems and changes |
| --- | --- | --- |
| 1 — parallel audit and repair | Daily planning/settings; MR review; Jira/wiki context; shell | Preserve unsaved provider drafts in memory and lock pending configuration actions. Reject stale schedule confirmations. Make bulk rescheduling atomic. Preserve correct old/new comment targets when switching to Source. Keep the review usable when draft storage fails or contains invalid data. Invalidate late MR refresh responses after Back. Clear hidden wiki search filters. Reject stale sprint responses. Retain Jira comment drafts across context changes. Open searched tasks on their actual date or in Backlog. Update saved wiki lists reactively. Restore exact demo MR identity in history; ignore duplicate route visits. Give utility popovers focus, outside dismissal and Escape restoration. Distinguish unavailable/disconnected attention data from an empty result. |
| 2 — reviewer rotation | Independent review of another agent's changes and actual light/dark screens | Key source cache by commit and path so deleted-file source matches its displayed base SHA and Assistant context. Avoid marking unselected deleted rows. Add source retry without discarding the draft; disable misleading Cancel while approval is being sent. Add proper arrow/Home/End review-tab navigation. Close a nested Assistant before its object context on Escape. Restore surviving notification/recent-view triggers after closing a preview. Allow global search/create above connected previews, retaining the context stack when a search result is opened. Disambiguate similarly named tasks and exact issue keys before a scheduling proposal. |
| 3 — final cross-review | Context workflows, source correctness, pending states and field drafts | Retain unsaved Jira due-date/assignee edits when a comment or status update refreshes the issue. Distinguish a successful comment post from a failed follow-up refresh. Re-selecting the same searched task restores its date. Keep the inspector close control visible while scrolling. Isolate old-side drafts by the complete diff refs, reset obsolete selection/guide/approval confirmation, and retain legacy drafts for explicit reuse. Lock quick-create fields and mode switching while a write is in flight. |
| 4 — independent release gate | Read-only re-review and combined regression | Recheck the final diff/source/draft fixes with another reviewer; run the complete browser suite and native Electron checks after edits settle. Report no remaining known P0/P1 only within the tested scope. |

## Reproducible regression evidence

New browser suites exercise user-visible behavior rather than snapshots of component implementation:

- `tests/shell-review.spec.js`: popover focus/dismissal, modal shortcut ownership, exact MR history and honest attention states.
- `tests/shell-independent.spec.js`: nested Escape, surviving return focus, search above a preview and return through its context stack.
- `tests/context-round1.spec.js`: pending refresh/Back, wiki filters, out-of-order sprint responses, persistent issue drafts, dated-task search and saved wiki lists.
- `tests/usability-round1.spec.js`: provider draft retention, pending save/test failure, stale schedule confirmation and atomic bulk planning.
- `tests/planning-independent.spec.js`: independent task-target and planning/configuration checks.
- `tests/review-audit.spec.js`: old/new source selection, malformed/full draft storage and failed approval retry.
- `tests/review-independent.spec.js`: changed-base source/Assistant consistency, source retry, late comment responses, pending approval and narrow-window keyboard operation.
- `tests/context-independent.spec.js`: independent context/field-draft checks.

The ignored local `artifacts/` directory retains failure-before traces, pass-after output and inspected screenshots. The test suites are committed so the checks can be reproduced without company credentials.

## Final verification

- **125/125 browser tests passed**, including **42 new regressions**. No skipped, unexpected or flaky results in the final combined run (`artifacts/ux-final-browser.log`).
- **24/24 adapter tests passed**.
- Production build passed. Native Electron profile-upgrade and encrypted-vault checks passed.
- **7/7 native connected workflow checks passed**, 37 main-process adapter requests, zero console errors (`artifacts/ux-final-native-connected.log`).
- Actual light/dark screens inspected at 1440×900 and narrow desktop sizes of 980–1000px, including 650px-height MR review.
- Final independent MR gate: 17/17 checks, read-only re-review. Final independent shell/context/planning gate: 39/39 checks. These are subsets/overlapping checks, not added to the 125-test total.
- **No known unresolved P0/P1/P2 remained among the reproduced findings in the reviewed scope.** The final full run followed all application edits; documentation changes afterward did not alter runtime code.

Run `npm test`, `npm run test:adapters`, `npm run test:desktop`, and `npm run test:connected-desktop` to repeat the checks.

## Boundaries

When device storage is full, the review keeps the text in memory and explicitly asks the user to copy it before leaving. It cannot promise persistence when storage is unavailable. Unsaved connection tokens remain only in component memory; they are never written to browser storage. Saved credentials continue to use the Electron encrypted vault.

All API behavior in these checks uses synthetic service responses. Dooray remains a placeholder, Observe remains a mock, and the review diagrams remain limited to the loaded change snapshot. Actual tenant permissions, human usability measurements, signed installers and Windows/Linux native behavior remain outside this run.
