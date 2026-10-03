# Automatic connected-workspace synchronization

This document records the synchronization contract and validation for Worklane's connected views. It concerns reads of connected data. It does not authorize posting comments, changing issues, approving merge requests or generating Claude replies automatically.

Visible connected views check every **60 seconds**. Focus/visibility return refreshes when the latest attempt or success is at least **15 seconds** old; reconnect triggers a check. Failed automatic reads retry after **2, 4, then at most 5 minutes**. Identical in-flight reads share one request. Hidden/offline views pause periodic requests; this is app-level synchronization, not an always-running daemon or webhook service. Manual Refresh remains an optional recovery action.

## Keep the current work stable

A background update should feel like fresh information arriving, not like navigating away. Preserve the existing content while fetching; show the last successful synchronization time and a recoverable error when a refresh fails. Do not clear useful rows or replace a document with a blank loading screen just because a periodic request starts.

| Surface | Automatic behavior | State to preserve |
|---|---|---|
| Connected lists / Home attention | Refresh scoped metadata on the configured interval, relevant mutation, focus or reconnection. | Search, filters, selected object, scroll and the loaded pagination range |
| Open issue | Refresh fields and activity without resetting the inspector. | Comment draft, dirty assignee/due/sprint inputs, focus |
| MR with unchanged base/start/head | Refresh metadata and discussions. | Current code, selected diagram node, review draft, generated guide and viewed state; no new local Git snapshot |
| MR with changed diff references | Prepare the new local Git snapshot in the background and stage it. | Keep the old reviewed code and draft visible until **Review new revision** is selected; block writes against stale context |
| Failed or offline read | Retain the last successful data, expose the error and allow recovery. | Never present an unavailable result as an empty successful response |

An unchanged `head_sha` alone is insufficient: `base_sha` or `start_sha` can change while head stays the same. Treat the complete reference tuple as the review version. The server-side comment/approval checks remain necessary even after a client has just synchronized.

## Hook and request lifetime

The shared hook contract is:

```js
useAutoSync({
  key, services = [], enabled = true,
  refresh, // async (isCurrent) => { ... }; throw on read failure
  interval = 60000,
})
// { syncing, lastSynced, error, offline, run, markSynced }
```

The synchronization key identifies the authorized endpoint/account and the current query/object. It must change on a credential-scope change even when the domain is unchanged. The refresh callback checks `isCurrent()` before committing state. Cleanup, a new key, disabling the view, and later requests must prevent stale responses from replacing newer data.

Avoid overlapping periodic, focus, online and mutation-triggered requests for the same active hook. Pause background polling while the view is hidden or offline; returning to a visible online view should reconcile once. A successful explicit load can call `markSynced`; a failed request must not move `lastSynced` forward.

Successful mutations should invalidate the relevant service scope. Failed mutations must not broadcast success. Polling that started before a mutation cannot roll the new local/server state back when it finishes later. Comment and approval buttons retain their existing explicit action and pending-operation guards.

## Pagination and drafts

Refreshing only page one must not discard pages the user already loaded. A list can revalidate its loaded range or preserve the range and show an intentional refresh transition, but must not mix incompatible server cursor generations. Deduplicate records by stable service IDs, not their visible title or array position. Changing search/filter/project scope invalidates the old request generation.

Background issue updates follow server values only for fields the user has not modified. Automatic responses are scoped to the active view and connection; existing Jira comment drafts retain their service-URL/issue storage scope. Review drafts also retain their commit/diff provenance: staging a new revision does not silently attach an old line comment to new code. Failed refreshes retain the current draft and evidence.

## Native acceptance scenario

`scripts/test-connected-desktop.mjs` runs the real Electron UI, preload, main-process adapters and Git store with isolated HTTPS metadata fixtures and a real temporary Git repository. The automatic-sync scenario advances renderer time, changes fixture metadata and then creates a real new commit:

1. With a source file open and a review draft present, change only the MR title and advance one poll interval. The title should update, draft remain, and local snapshot count stay unchanged.
2. Create a new commit and update the MR ref/metadata. Advance another interval. The new snapshot should prepare once, while the old code and draft stay visible and posting against stale evidence is disabled.
3. Confirm **Review new revision**. The already prepared revision should appear, with no second snapshot request for the switch.
4. Confirm polling produced no comment, approval or Claude POST. Continue the existing explicit review workflow to verify it still works.

The native fixture also forbids GitLab diff/raw-file HTTP APIs; code remains local-Git-backed. Real enterprise authentication, outage conditions and proxy behavior require company-environment verification. Executed results are appended after the implementation gate passes.

## Executed native evidence

On 2026-10-04, `npm run build` and `node scripts/test-connected-desktop.mjs` passed **9/9 workflow checks** with zero renderer errors. The real Git fixture recorded:

- Same-reference metadata refresh: **0 additional snapshots**; edited title appeared and draft remained.
- New head: **1 prepared snapshot**, old source and draft stayed visible, and stale posting was disabled.
- A third poll for that already staged revision: **0 further snapshots**.
- Explicit revision switch: prepared source became visible without another snapshot.
- Automatic external writes or Claude generation: **0**.
- Total scenario: 60 intercepted metadata/collaboration HTTPS requests, four local snapshot operations and three blob reads; **0 GitLab diff/raw-file requests**. The additional snapshot operations belong to explicit comment and AI-review validation.

Evidence is generated in `research/completion/electron-workflows.json`. A separate browser hook harness reproduced a stale “syncing” indicator after disable/re-enable; after the lifecycle fix, it reports `syncing:false` once the old request has completed. Initial native test setup errors (installing the simulated clock after timers already existed, and passing a fixture payload through Electron's first rather than second evaluation parameter) were corrected before the successful complete run.

Independent browser rerun: `npx playwright test tests/auto-sync-review.spec.js tests/auto-sync-issue.spec.js tests/auto-sync-workspace.spec.js --output=artifacts/auto-sync-independent --reporter=line` passed **17/17**. This includes pagination preservation, unfinished filters, per-service partial failures, issue dirty fields/focus, mutation overlap, initial-outage recovery, reconnect, read deduplication and stale configuration rejection.

Final regression gate: **211 browser tests**, **74 adapter/Git tests**, and **9 native connected workflows** pass. The suite caught a wrapper remount that reset Source mode when only base/start changed; preserving the existing workbench instance for the same head restored its established three-reference validation and old-line draft isolation. A separate final reviewer reran 18 review regressions and verified automatic base-only staging/switch/return and failed-focus storm throttling. No further reproduced P0/P1/P2 remained in this change scope.
