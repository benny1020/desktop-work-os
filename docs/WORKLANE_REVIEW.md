# Worklane usability and correctness review

Review date: 2026-10-03. Three specialist agents independently checked planning usability, integration/context correctness, and review productivity. The primary agent integrated fixes, reviewed diffs, operated the UI and ran combined verification. This is an engineering usability review, not a study with external participants.

## Reproduced problems and resulting behavior

| Area | Problem | Result |
| --- | --- | --- |
| Planning | Editing a time or completing work recreated task controls and lost keyboard focus. | Stable task components retain focus; same-time items have accessible up/down actions. |
| Weekly calendar | Always-visible scheduling controls consumed most of a small day column. | Controls disclose on hover or keyboard focus; tasks remain compact. |
| Calendar quick add | Plan here selected a date without focusing entry, and adjacent-month selection changed the visible month. | Focus goes to quick add with the chosen date; the displayed month stays in place. |
| Linked work | Opening linked work gave no route to edit/remove its local plan entry. | A separate Edit plan action changes the local entry without changing the linked service. |
| Jira/MR comments | A successful delayed response erased newer text typed while posting. | Only the submitted draft is cleared. Later edits and failed submissions retain their text. |
| Assistant context | Closing an issue or moving Home could leave the previous issue selected for Claude. | Navigation/close resets context. Nested previews keep a separate assistant context and restore the underlying workspace. Late issue refreshes cannot repopulate a closed context. |
| Assistant conversation | The UI showed earlier answers but sent only the latest question. | Up to three successful exchanges are included with validated roles and bounded text. A failed question is restored to the composer. |
| Source review | Selecting source outside the diff gave the assistant no selected source text. | The request includes a maximum 21-line excerpt, line numbers, code mode, side, commit SHA and truncation marker. |
| Review progress | Diagram review lacked a resumable file checklist. | Viewed and Next unreviewed persist per MR origin and diff references, separately from approval. |

## Source comparison

GitLab and Microsoft's VS Code Pull Requests extension were inspected at fixed commits, including actual reviewed-state and navigation code. [Exact files, line ranges, licenses and deliberate differences](REVIEW_REFERENCES.md) are documented. No source from those projects was copied. The Claude conversation contract follows the official [Messages API](https://platform.claude.com/docs/en/api/messages/create).

## Verification

- Browser workflow suite: **64 passing tests**, including **17 new regressions**. No skipped or flaky tests in the final combined run.
- Node adapter suite: **24 passing tests**, including bounded conversation validation and rejection of privileged history.
- Rename compatibility: a synthetic profile created under the old app name retained its encrypted token, authenticated fixture request, local plan, theme and workspace mode after launch as Worklane.
- Native Electron vault check: product name Worklane, preload, HTTPS adapter/auth, encrypted token persistence, 0600 permissions, redacted config, HTTP rejection and diagrams passed.
- Native connected workflow: **7 checks**, **37 requests**, **0 console errors**, using the real main-process adapters against isolated HTTPS fixtures.
- Production build and `git diff --check` passed.
- UI operated directly: Home → MR review → Viewed → Next unreviewed → sequence, with screenshot inspection. Planning and assistant layouts inspected at 1440×900.
- README: five screenshots and three GIFs recaptured from actual Worklane UI, entirely synthetic data. AI and API responses in these media are fixtures.

Reproduce with `npm test`, `npm run test:adapters`, `npm run test:desktop`, and `npm run test:connected-desktop`. Generated evidence remains local under `artifacts/` and `research/`; committed tests and fixture sources are reproducible.

## Limits

No real company endpoint or token was used, and no external issue/comment/approval was changed. Human review speed, accessibility across all screen readers, Windows/Linux native behavior, signing and production synchronization remain unverified. Diagram inference is not runtime tracing. Review progress and planning are local to the Electron profile, not server-synchronized. Dooray is a menu placeholder and Observe remains a mock.
