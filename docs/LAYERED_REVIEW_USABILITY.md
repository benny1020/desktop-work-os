# Layered review, planning and Jira usability — 2026-10-06

The review workspace now describes recognizable changes and component roles. The default map places Controller / Entry points, Service / Business logic and Repository / Persistence in distinct bands, alongside other roles actually present in the changed files. Code-derived annotations take precedence over file conventions; ambiguous or unavailable roles stay explicit. Import-depth layout and separate inferred sequence views remain available.

Review scopes show titles such as **Payment request handling**, component examples, the entry point, a verified import reading path, grouping evidence and viewed progress. Large groups have numbered parts. Selecting a component opens its diff/source beside the AI guide and private human draft; changing scopes preserves file, line, source mode and canonical drafts. AI-derived edges never redefine initial scope membership.

Planning now previews parsed quick entry, searches and folds completed backlog work, schedules only the shown tasks, and supports day/backlog drag with undo. Linked work shows its existing date before an explicit move. Scheduling undo compares the complete moved task snapshot so later edits cannot be overwritten. Jira now has ordinary search and compact server filters, inline status changes, true active-sprint queries, retained inspectors and clear loaded-result boundaries.

## Independent review and repairs

Three agents worked on architecture, planning and Jira, followed by independent cross-review. The primary implementer also opened the running app to inspect component navigation, selected-line drafts, Source and the AI guide. Actual light/dark screenshots were inspected at 1440×900 and narrow desktop sizes.

| Reproduced issue | Final correction |
| --- | --- |
| Duplicate backend scope names and vague directory labels | Human titles, unique accessible option names, entry point and grouping evidence |
| Role diagram pushed important cards below the default viewport | Compact scope/header and role bands; all three Controller–Service–Repository cards fit at 1440×900 |
| Reverse-role import cycle had an unusable mouse path | Outer routing corridor, verified with a real stroke click and keyboard activation |
| Selected component disappeared after desktop-to-narrow resize | Resize-aware reveal across both map panel and inner diagram canvas |
| Failed Jira query mixed old pagination with a new query | Applied query/cursor replaced only after a successful request |
| Refresh cleared failed-filter warning while showing old-query rows | Durable requested/applied query mismatch with explicit selected-query retry |
| Status-option failure hid a successfully fetched issue | Local status error and independent retry; description and comments stay usable |
| Status write succeeded but following read failure invited another write | Accepted-write notice, consumed transition selection, read-only retry |
| A background read superseded a pending status-option retry and left it disabled after failure | Request-owned loading cleanup across failed and invalidated reads |
| Undo overwrote a schedule after later task edits | Whole-record before/after comparison and regression for edited time |

After repairs, independent reviewers reported no remaining critical issue in the reviewed workflows. This assessment covers the implemented paths and fixtures; it is not a claim about all tenant-specific service behavior.

## Final validation

| Check | Result |
| --- | --- |
| Full browser suite | **253/253 passed**, zero skipped, 1.4 minutes |
| Adapter/model suite | **107/107 passed**, zero skipped |
| Production build | Passed; existing large-bundle advisory remains |
| Native connected workflows | **9/9 passed**, zero renderer console errors |
| Native memory lifecycle | **5/5 passed** across restarts |
| Native profile upgrade and encrypted vault | Passed |
| Whitespace validation | `git diff --check` passed |

The first integrated browser run found the resize defect above (247/248); it was repaired and a complete 252-test run passed. The final independent review then reproduced the status-option retry race, which was also repaired and added to the final full-suite run. Focused tests additionally cover six architecture scenarios, seventeen Jira scenarios and eleven new planning/demo scenarios.

Native validation uses actual Electron renderer/preload/main, OS safeStorage, a real temporary Git repository/worktree and intercepted HTTPS fixture responses. It recorded 60 fixture requests, zero automatic external writes, four local snapshots and three blob reads. GitLab raw/diff code API requests remain zero. Native memory checks use the same isolated profile across restarts and never send real desktop notifications.

```sh
npm run test:adapters
npm test -- --workers=2 --output artifacts/final-layered-253
npm run build
node scripts/test-profile-compatibility.mjs
node scripts/test-desktop.mjs
node scripts/test-connected-desktop.mjs
node scripts/test-assistant-memory-desktop.mjs
```

Company Jira/GitLab/Confluence authentication, actual Claude answer quality and tenant permissions remain untested. Role classification is bounded static inspection of changed code and conventions, not full-repository AST or runtime tracing. Dooray and Observe remain within their previously agreed placeholder scope.

See the [screen tour](SCREENSHOTS.md), [architecture/source-reference details](REVIEW_ARCHITECTURE.md), [planning review](TODO_USABILITY.md) and [Jira review](JIRA_USABILITY.md).
