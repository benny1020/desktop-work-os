# Jira workflow usability

The connected workspace now starts with ordinary issue search and compact project/work filters. JQL remains available under **Advanced JQL**. Issue inspection, comments, and linked work stay open when switching project views or filters.

![Connected Jira issue search and inline status controls](media/jira-issues-workflow.png)

This screenshot uses isolated fixture data rendered by the actual app. It is not a company-account connection.

## Problems corrected

| Before | Now |
| --- | --- |
| Finding personal/project work required writing JQL. | Search by issue key or words; project and Recent/Open/Assigned to me/Due soon/Active sprint filters produce server queries. |
| Sprint showed the same recent-update query as every other view. | Sprint starts with `sprint in openSprints()` without a 30-day update cutoff. |
| Board/view/filter changes discarded the issue inspector. | The inspector and unsaved due/assignee/comment edits remain mounted across project views and filters. |
| Changing a status required opening an issue. | A row popover fetches allowed Jira transitions and writes only when **Apply** is clicked. Escape/outside-click cancels the popover. |
| A failed first-page query could leave the old next-page token paired with the new query. | Only a successful request replaces the applied query. Previous rows/pagination remain tied to their original query after failure. |
| Unchanged assignee/due/priority fields could be repeatedly saved. | Save buttons activate only for changes. Writes remain explicit. |
| Sprint/priority required expanding and then manually loading options. | Expanding loads options; **Refresh project options** retries them. A failed board request does not discard successfully loaded priority choices. |
| Add-to-Today could silently move already scheduled linked work. | Canonical linked work shows its current date/time, **In Today**, or explicit **Move to Today**. Local undo restores only the unchanged moved task. |
| Comments lacked keyboard posting and feedback appeared below the full inspector. | Cmd/Ctrl+Enter posts explicitly; sticky success/error feedback stays visible. Subtasks open through the retained context stack. |
| Narrow split views could crush issue titles into very small columns. | Compact rows and a minimum table width preserve readable titles through horizontal scrolling; table text follows theme colors. Settled light/dark rendering was inspected. |

## Practical scope

- Filters execute Jira queries; visible counts describe **loaded** results and advertise additional pages. Board counts never claim full-project totals before all pages are loaded.
- The Roadmap screen describes its implemented behavior as **Issue deadlines**. It orders due dates and does not claim to infer epic dependencies or a full Jira roadmap.
- Project, board, and sprint option APIs currently return up to 50 results. The UI identifies the project-list limit when reached; unlisted projects can still be queried with JQL.
- Planning changes are local. They do not change Jira status/due dates or post GitLab review comments.
- Related GitLab/wiki results retain their existing “mentions, not verified relationships” disclosure.
- Extra required fields on Jira creation retain the adapter's explicit create-in-Jira recovery path. URL/token configuration and real company-account permissions remain unverified here.

## Verification

`tests/jira-usability-improvements.spec.js` adds 17 browser cases: server filter construction, true active sprint scope, retained drafts, inline writes/cancellation/retry, failed-query pagination and persistent mismatch disclosure, unsent search/JQL, subtasks, partial planning/status metadata failure, superseded status retry recovery, accepted-write refresh recovery, keyboard comments, narrow dark view, and canonical issue/MR scheduling with guarded undo.

`tests/integration/jira-workspace.test.mjs` checks sprint scope, key/project literal handling, ordinary-search operator handling, and personal/due filters.

Existing connected workflow, automatic synchronization, comment draft, and retained-context suites were rerun. The tests use deterministic browser fixtures; real Atlassian accounts and live permission configurations are outside these checks.
