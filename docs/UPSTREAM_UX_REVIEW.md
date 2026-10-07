# Upstream-informed usability review

2026-10-07–08. Three agents audited review, personal planning/Jira, and navigation/assistant UX against primary product documentation and pinned upstream source. Each used isolated Chromium and owned Vite instances; no personal browser tabs or real organization accounts were used. The primary implementer integrated the changes, and separate agents challenged the final behavior.

## Changes made

| Reproduced problem | Resulting interaction |
| --- | --- |
| P1: expanding five contracts in !464 at 980×650 put the entire graph below the clipped panel | Entry and trigger remain visible; bounded **Flow details** discloses contracts, return points and call boundaries without growing the header. Graph retains at least 140px of visible height. |
| P2: secondary context consumed the main reading area | At 1440×900 with collapsed navigation, the same graph viewport grew from 234.3 to 314.5px; opening contracts does not shrink it. **End L…** remains a direct source action. |
| P2: class relationships hid repeated method operations | **Calls** beside the selected component lists every retained source call, direction, file/line and evidence kind. `storage.find()` and `storage.save()` remain distinct and open their exact call sites without leaving Dependency flow. |
| P2, independent follow-up: shrinking the window left the selected source line off-screen | Code viewport resize reveals the selected line with its own scroll position. Ordinary manual reading can still scroll away; the whole page does not jump. |
| P2: weekly hover changed card height by 87px, moving subsequent tasks | Stable compact cards reserve Edit/More space. Scheduling controls open in a bounded popover; both hover and keyboard focus preserve every card's position. |
| P2: a calendar icon silently completed an event | A recognizable completion box is separate from the event marker. Completion/reopening offers Undo, guarded against overwriting later edits. |
| P2: incidental task-editor dismissal discarded unsaved changes | Escape/outside dismissal retains the per-item editor draft for the renderer session. Explicit Cancel discards it; Save/delete clears the matching draft. |
| P2, independent follow-up: More → immediate Escape did not close the menu | Escape is handled from the common task row, including the opener, and returns focus to More. |
| P2, independent follow-up: an editor draft could accept a concurrently changed record as its base | The immutable opening snapshot guards restoration and Save; a newer saved item must not be silently overwritten. |
| P2: closing search/create stranded keyboard focus on the document body | Restore the launch control unless a newly opened preview or destination owns focus. Disconnected launchers fall back to Global search. |
| P2: typing a destination such as Docs removed its navigation command | Matching navigation commands remain searchable at every query length, alongside progressive service results. Observe and Settings are included. |
| P2: a local-only search miss showed a blank result area | Explicit settled empty feedback suggests task titles/destinations and offers Clear search. Loading/error states are not misreported as empty results. |

These are targeted interaction changes. Today, Week, Backlog and Calendar still share the canonical personal plan; local completion does not transition Jira. Existing Jira filters, deadline distinctions, sprint scope, draft retention, immutable MR revision handling and assistant confirmation controls were retained.

## Actual upstream code examined

No upstream implementation, template or new package was copied in this pass. Existing cmdk/Radix dependencies remain in use. Plane's AGPL and Huly's EPL source were inspected as references only.

- **PR Lens**, `7a9115c8202da4db030be5954ada8862e6135dce`: [scope selection](https://github.com/coldteadotai/pr-lens/blob/7a9115c8202da4db030be5954ada8862e6135dce/packages/renderer/src/scope.ts#L24-L62), [design lanes](https://github.com/coldteadotai/pr-lens/blob/7a9115c8202da4db030be5954ada8862e6135dce/packages/renderer/src/design.ts#L14-L26), [architecture edge labels](https://github.com/coldteadotai/pr-lens/blob/7a9115c8202da4db030be5954ada8862e6135dce/packages/renderer/src/svg/architecture.ts#L188-L226), [label clearance](https://github.com/coldteadotai/pr-lens/blob/7a9115c8202da4db030be5954ada8862e6135dce/packages/renderer/src/layout/labels.ts#L50-L69). Meaningful relationships motivated selected-component call disclosure; Worklane retains uncluttered class rails rather than putting every method label on the canvas.
- **diagram-design**, `d1376371965f513d99cc9ec388835d255c5c88d5`: [connector rules](https://github.com/cathrynlavery/diagram-design/blob/d1376371965f513d99cc9ec388835d255c5c88d5/skills/diagram-design/references/primitives-core.md#L56-L76) and [architecture rules](https://github.com/cathrynlavery/diagram-design/blob/d1376371965f513d99cc9ec388835d255c5c88d5/skills/diagram-design/references/type-architecture.md#L60-L76). Existing separate rails, ports and role bands were rechecked; disclosure improves space without changing the source graph or routing.
- **Plane**, `7466675e471efe1c96b122615f7a0d30c9b2eb05`: [calendar issue block](https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/web/components/issues/issue-layouts/calendar/issue-block.tsx#L68-L81), including fixed card geometry at lines 120–169; [start/due preview](https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/web/components/issues/preview-card/date.tsx#L18-L51); [calendar date ordering](https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/web/components/issues/issue-layouts/calendar/day-tile.tsx#L87-L104). Adopted stable action disclosure; preserved the distinction between personal scheduling and Jira deadline.
- **Huly**, `5bb9b2fea616e8ce3c6d9c92adbfb1a83f918c14`: [event interaction](https://github.com/hcengineering/platform/blob/5bb9b2fea616e8ce3c6d9c92adbfb1a83f918c14/plugins/calendar-resources/src/components/EventElement.svelte#L33-L38) and [time editor](https://github.com/hcengineering/platform/blob/5bb9b2fea616e8ce3c6d9c92adbfb1a83f918c14/plugins/calendar-resources/src/components/EventTimeEditor.svelte#L21-L50). Clear event affordances informed the completion fix. Event duration/time-grid expansion remains a separate capability gap.
- **Radix**, `c71610373b6aa17de24f5c7484ced5108160f12b`: [dialog trigger restoration](https://github.com/radix-ui/primitives/blob/c71610373b6aa17de24f5c7484ced5108160f12b/packages/react/dialog/src/dialog.tsx#L320-L323). Worklane's controlled palette has no Dialog.Trigger; explicit launch-point restoration fixes that integration gap.
- **cmdk**, `dd2250ed608443e8f32bafc5fa2d1d07a3746aa3`: [manual filtering](https://github.com/dip/cmdk/blob/dd2250ed608443e8f32bafc5fa2d1d07a3746aa3/cmdk/src/index.tsx#L435-L445), [empty result behavior](https://github.com/dip/cmdk/blob/dd2250ed608443e8f32bafc5fa2d1d07a3746aa3/cmdk/src/index.tsx#L894-L912). Host-side matching and asynchronous empty feedback must be implemented explicitly when filtering is delegated.

Primary product references: [Linear Peek](https://linear.app/docs/peek), [Search](https://linear.app/docs/search), [My Issues](https://linear.app/docs/my-issues), [Inbox](https://linear.app/docs/inbox); [GitLab Changes](https://docs.gitlab.com/user/project/merge_requests/changes/) and [review workflow](https://docs.gitlab.com/tutorials/reviews/); [Raycast search](https://manual.raycast.com/search-bar) and [keyboard behavior](https://manual.raycast.com/keyboard-shortcuts); [Plane display options](https://docs.plane.so/core-concepts/issues/display-options). These are interaction references, not claims of feature parity or whole-repository code review.

## Screenshots and verification

![Source calls beside diagram, actual code and sample AI checkpoints](media/upstream-review-calls.png)

![Stable weekly planning actions](media/upstream-planning-week.png)

![Searchable navigation in the compact palette](media/upstream-search-navigation.png)

See [the screenshot tour](SCREENSHOTS.md) for the dark/narrow and empty-result views. Captures use actual app pixels with synthetic sample/fixture data; no live Claude quality is demonstrated.

Final browser regression: **343/343**; adapters/model/Git: **168/168**. Cold-start checks: **2/2**, with zero unexpected reloads and preserved private drafts. Focused regressions are in `tests/upstream-review-ux.spec.js` (4), `tests/upstream-planning-ux.spec.js` (7) and `tests/upstream-shell-ux.spec.js` (4). Fifteen new checks include invalidated acknowledgement after a second concurrent update, source visibility after resize, and protecting destination-preview focus.

Independent review repeated the original narrow clipping, method-call/source, Escape/focus and concurrent-draft failures. Review canvas measured 314.5px at 1440; selected source L19 remained fully visible after resizing to 980. The planning reviewer found two regressions during cross-review; both were fixed and independently rechecked, including the subsequent concurrent-save challenge. No remaining reproducible Critical/P1/P2 was identified within these audited paths. This is bounded evidence, not a claim of defect-free software.

Production build, native profile compatibility, OS-encrypted credential vault and production parser-worker checks passed. Native connected validation passed **23/23** scenarios (11 existing connected workflows, 6 API, 6 mixed business flows), using actual immutable local Git objects and synthetic HTTPS/Claude responses, with zero renderer errors. Existing connected checks recorded 71 service requests. Mixed/API review made zero remote code API calls or automatic external writes. Native and browser runs used isolated profiles; no company records were modified.

Fourteen actual screenshots (7 current business-flow captures, 5 review/search, 2 planning) recorded zero page errors; the README GIF was regenerated from four unaltered 1440×900 app frames. Results and commands are also recorded in [development history](LOCAL_DEVELOPMENT.md).

At 980×650, graph/code retain 140px minimum viewports; lower review actions remain accessible through local panel scrolling. This is a deliberate narrow-window compromise, not the full 1440×900 reading density. Closed-app background operation, live organization permissions, live model accuracy, other operating systems and arbitrarily complex source/runtime analysis are not certified by this audit.
