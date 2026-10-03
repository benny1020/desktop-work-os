# Workflow convenience review

2026-10-03. This pass extends the [AI co-review workspace](AI_COLLABORATIVE_REVIEW.md) to planning, connected issues/documents, search, creation and the assistant. Existing compact typography, color tokens and keyboard behavior are retained.

## Changes users can feel

| Workflow | Previous friction | Implemented behavior |
| --- | --- | --- |
| Morning planning | Tasks planned for earlier days disappeared from Today | Original dates and unfinished tasks appear together, with individual/bulk Bring to Today and guarded Undo |
| End of day | Moving unfinished work also moved events | Only unfinished tasks move; events retain their schedule; the move can be undone |
| Calendar | Date details required changing both range and date | A day header opens Day view; Back returns to the exact prior range, date and visible keyboard target |
| Issue investigation | Reading a related MR/wiki required an intermediate results screen | Compact candidate results appear beside the issue, independently per service, with direct context previews |
| Document reading | Finding a section required scrolling; issue references were inert | A heading outline and issue-key chips navigate to the section or issue |
| Pipeline investigation | Failing jobs were mixed into a long job list | Failure summary, failed-only filter and direct job focus preserve MR context |
| Global search | The slowest provider blocked all remote results | Each source appears as it completes; errors have targeted Retry, while successful results remain usable |
| Quick create | Closing the palette or changing creation type lost text | Separate text drafts survive closing in this app session; explicit discard, account scope and successful-submit clearing |
| Assistant | Closing discarded the conversation, follow-up draft and pending response | Per-work-item sessions survive folding; pending requests complete once; opening focuses the composer |
| Longer conversations | New answers could appear far below the visible viewport | Sending follows the new response; reading older messages is not forcibly interrupted |

![Earlier unfinished work with original dates and immediate planning actions](media/daily-carryover.png)

![Issue and related cross-tool evidence](media/issue-related-work.png)

![Wiki outline and issue context](media/wiki-reading-context.png)

![Independent search results with targeted provider recovery](media/search-progressive.png)

## Review method

Three agents and the primary implementer divided planning, connected context, assistant and search/creation. Each change was then inspected by someone other than its implementer. Tests covered user-visible behavior, keyboard access, pending and failed requests, stale replies, account changes and 1440×900 / 980×650 layouts.

The second pass found additional losses on menu navigation: calendar range/day/undo state, document reading position and MR review selection. It also found that a same-URL token replacement could reuse the old assistant session. These received regression coverage and corrections rather than being treated as successful first-pass completion. The next pass caught a calendar-date leak into Home and a duplicate-comment path when leaving an MR during submission. Home and My Work now retain separate view state; pending review writes keep their owning view mounted until success or failure, including keyboard, history and preview navigation.

Observe remains a mock. Its narrow-screen filters, log selection and Escape/focus recovery were inspected. Dooray remains a menu placeholder. Settings received narrow-window checks and credential-change session isolation; this pass adds no new provider integration.

## Boundaries

- Related objects are issue-key search candidates, not verified relationships.
- Planning edits and undo are local; they do not silently change Jira deadlines or status. Undo preserves intervening edits rather than overwriting them.
- Quick-create text and assistant conversations are retained in renderer memory for the current app session, not persisted to disk. Saved integration changes start a new credential scope for external drafts and conversations, including token-only replacement at the same URL.
- Comments, issue/document creation, approval and local assistant schedule proposals still require explicit user actions. Merely reopening a panel does not resend a request. MR navigation pauses only during comment/approval submission and resumes on success or failure; code/AI read requests remain navigable.
- Existing sanitized wiki rendering remains in place. Outline and issue links use only displayed document content.
- All published media and remote-service tests use synthetic responses. No live company account, external comment or issue was used in validation.

## Reproduction

Run the README's browser, adapter and native connected checks. Focused regression suites are `daily-workflow`, `command-convenience`, `command-independent-ux`, `assistant-session`, `assistant-independent-ux` and `context-ux`. Curated screenshots can be regenerated with `node scripts/capture-convenience.mjs` against the local Vite server.

Final application validation: **170/170 browser tests**, **30/30 adapter tests**, and **7/7 native connected workflows** passed. This adds 39 browser cases to the prior 131-test baseline. The native run made 39 requests through Electron adapters and reported zero renderer console errors. The production build passed.

Local evidence: `artifacts/convenience-final.log`, `artifacts/convenience-adapters.log`, `artifacts/convenience-native-final.log`, plus the independent review folders. Logs and raw captures stay local; curated synthetic screenshots and reproducible tests are published. See [local validation history](LOCAL_DEVELOPMENT.md); older review documents retain their historical counts.
