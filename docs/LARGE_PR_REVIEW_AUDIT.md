# Large PR review usability audit — 2026-10-07

Three specialist agents audited the 30-file **!428 Introduce durable payment recovery** fixture: diagram/evidence correctness, visual usability, and review workflow. The primary implementer integrated feedback and opened the app to verify sequence → exact code → AI suggestion → private draft, including a 980 × 650 window. Agents then independently rechecked the implemented result.

## Findings resolved

| Problem reproduced | Resulting behavior |
| --- | --- |
| Type declarations and DTO signatures appeared as sequence calls; import order could obscure actual source order. | Conservative call recognition masks comments/literals, uses resolved imports and typed receivers, and orders each caller's interactions by source line. Ambiguous dynamic references remain omitted. |
| Later cleanup calls were silently capped, and AI sequence generation could replace static evidence. | All recognized calls remain reachable; validated AI evidence supplements static steps without duplicating their source coordinates. |
| Large whole-flow diagrams fitted into unreadable text. | More than four participants default to two participants and one interaction. Every step has previous/next/selector navigation and an exact code link. Whole flow and a 100% reset remain available. Compact labels retain their global step number and stay inside the SVG. |
| Selecting a shared file from the initial business flow changed the scope. | Shared code keeps the active business flow and its AI checkpoints. |
| Selecting a lower architectural layer scrolled away progress and zoom controls. | Progress and diagram controls stay sticky. Canvas height is bounded by the actual control height; selection remains visible during zoom and window resize. |
| Comment editor and existing threads left little room for code. | The composer folds with its draft intact. Discussions start collapsed and open after explicit posting. Failure and save notices stay visible even while the composer is folded. |
| Private drafts were scattered across files; approval did not reveal them. | A PR-wide draft menu restores the exact path/line/side and opens a folded composer. Earlier old-side revisions are reference-only. Approval displays viewed and unposted counts without posting drafts. |
| Leaving a demo review lost its reading context; posted comments lost their code location on reopen. | Session state retains each flow's selection, mode and AI guide. Structured posted demo comments retain their code positions across reopen/reload. |
| Escape in the draft menu closed the entire connected MR. | Escape closes only the menu and restores its trigger focus. |

Integration testing also caught a small-PR resize regression: a short diagram had no inner scroll range and its selected node disappeared below the sticky controls. Bounding the canvas and preserving at least 130px for the short-window AI rail resolved it. Existing assertions were retained.

## Final verification

- **301/301 browser tests** passed in one complete run, including 19 added large-PR tests and existing daily/weekly/sprint, connected review and keyboard workflows.
- **119/119 adapter/model tests** passed, including six sequence-evidence regressions and two draft-version model checks.
- **11/11 native connected checks** passed using actual Electron IPC, real temporary Git repositories and synthetic HTTPS metadata. There were zero renderer console errors, zero automatic external writes and zero GitLab diff/raw code API requests.
- Native profile compatibility, OS encrypted credential vault, production build and `git diff --check` passed.
- Six actual app screenshots at 1440 × 900 captured with zero page errors. Layout checks cover 1440 × 900, 980 × 900 and 980 × 650, light/dark.
- All recognized interactions in the three business flows reach exact source evidence; all 30 primary files are reached exactly once when marked viewed through Next unreviewed.

The independent final reviews found no unresolved reproducible Critical/P1/P2 in these scenarios. This is a bounded audit, not proof that every possible repository or large PR is usable. Static inference is neither a full language parser nor runtime tracing. Dynamic dispatch, incomplete code and company GitLab/Claude authentication or model quality remain outside this fixture-based validation. Reading context is session-scoped; drafts and progress are persisted locally.

See [the demo walkthrough and screenshots](COMPLEX_PR_DEMO.md). Reproduce captures with `node scripts/capture-complex-review.mjs` while Vite runs on port 5178.
