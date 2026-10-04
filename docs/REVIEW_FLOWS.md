# Review large changes in smaller flows

Worklane groups changed files into smaller reading scopes while keeping the diagram, code and AI review rail together. A flow is a navigation aid derived from changed-file paths and resolved imports. It is not a verified business process, runtime trace or complete repository architecture.

## Navigation contract

- A single group uses the existing direct review screen; no extra chooser is required.
- Multiple groups expose **Choose review flow**. Search by a group label or primary file path, use Arrow Down/Up and Enter, or select with the mouse. Escape closes the chooser and returns focus to its trigger without closing the MR preview.
- Each scope contains at most **12 primary files plus 6 related shared files**. Larger areas split into numbered parts. There is no 12-group limit: every changed path retains a primary owner.
- Every scope keeps the **Dependency flow** and **Sequence** tabs. Connections to other scopes appear as linked file chips; the file chooser remains the complete navigation path when boundary chips are abbreviated.
- Dependency siblings wrap into two columns. The initial diagram scale stays at least 65%; scroll and selected-node panning preserve access when it cannot all fit. The explicit **Fit** control can show the whole diagram at a smaller scale.
- **Next review flow** advances the reading scope. **Next unreviewed** and the main viewed counter still cover the entire MR. The smaller scope counter counts primary files only.
- Returning to a flow restores its selected file, line, Source/Diff mode, visualization, diagram zoom and reading position. A shared file uses the same canonical draft and viewed state wherever it appears.

The grouping model uses paths and resolved changed-file imports, not AI-generated edges. Directory areas, tests, documentation, configuration and explicitly unassigned files provide fallbacks when code relationships are not established. A shared dependency has its own primary group and may also appear in consuming groups. Group IDs derive from sorted primary paths, making them independent of input order.

## Complete manifest, bounded code loading

The local Git snapshot retains the complete changed-file manifest. Initial patch loading is bounded to 120 files and a 2 MiB patch budget. Deferred files remain searchable, count toward the global review denominator and are loaded from immutable local Git base/head objects when their scope opens. A failed local patch read shows **Retry flow code** without removing the file or clearing its draft.

This distinction matters: a file being listed does not mean its patch has already been loaded or analyzed. Binary, unavailable and oversized patches can remain unavailable; source and coverage messages must retain that limitation. Static graph edges can become more informative after deferred patches load. Scope membership stays based on the original snapshot so files do not move between groups while the reviewer reads.

## AI remains a second reader

Generating a guide is explicit. For a multi-flow MR, the request names the current primary and related shared paths; the adapter validates that every path belongs to the current MR and hydrates deferred patches before constructing the prompt. Merely choosing a flow, searching, retrying a local diff or marking a file viewed makes no Claude request and posts nothing.

The prompt has a 120,000-character code budget and a 24,000-character per-file limit. Coverage reports distinguish the selected scope, the full MR denominator, included files and omitted code. Finding coordinates are validated against complete lines actually sent to Claude. These guards do not turn AI suggestions into confirmed defects or prove whole-repository coverage.

Guides remain associated with their originating flow. If a guide finishes after the reviewer changes scopes, it is retained for the original scope. The AI rail can filter **This flow**, **All checks** or **This file**. A valid retained checkpoint outside the current scope navigates to its owning flow and code; **Draft comment** appends to the existing canonical draft. Posting to GitLab remains a separate human action.

Base, start and head references still define the review version. Automatic synchronization can prepare a new revision in the background, but switching code remains explicit. Flow navigation does not bypass stale-reference checks for guide generation, comments or approvals. See [automatic synchronization](AUTO_SYNC.md) and [local Git review](LOCAL_GIT_REVIEW.md).

## Validation

Final local run: **219/219 browser workflows**, **94/94 adapter/model tests**, production build, and **9 native Electron connected workflow checks** passed. The native checks use actual local Git objects/worktrees and HTTPS service fixtures. Independent review found and rechecked chooser Escape dismissal, overly small diagrams, cancelled lazy-read work, restored deferred-line scrolling and stale filter state.

![Flow picker in the actual interface, using synthetic service fixtures](media/review-flow-picker.png)

`tests/review-flows.spec.js` exercises the rendered connected-workspace UI with a fixture adapter:

1. A small MR adds no extra flow chooser.
2. Searching, keyboard dismissal, next-flow navigation and complete primary-file coverage.
3. Shared-file drafts and viewed state remain canonical; flow selection and Source mode restore.
4. A retained AI checkpoint crosses scopes, selects the correct code and appends to an existing draft without posting.
5. The 125th changed file remains searchable; a failed deferred local read retries against the expected base/head and preserves the draft.
6. Keyboard navigation works at 980 × 650 in dark mode while diagram, code and AI remain available together.
7. A delayed AI response returns to its originating flow after the reviewer switches scopes, with exactly one explicit generation request.
8. A delayed patch from the old base cannot overwrite code after base/start references change with the same head; the canonical file draft survives.

Run with:

```sh
npx playwright test tests/review-flows.spec.js --output=artifacts/review-flows-check --reporter=line
```

These browser cases validate UI behavior with controlled data. Real Git-object, full-manifest, path-validation and adapter provenance behavior are covered separately by the local Git and integration tests. They do not establish performance on every repository size or language, or validate live company credentials.
