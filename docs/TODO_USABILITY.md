# Personal planning usability review

The [three-round practical planning review](PLANNING_PRACTICAL_REVIEW.md) records the latest corrections and validation: Today navigation intent, per-view range memory, canonical duplicate guards across removal/reopen, all loaded MR planning, linked-key quick entry, deadline conflict visibility and guarded date/order undo. The current integrated browser suite passes 280 tests.

The Today, This Week, Backlog and Calendar views share one local task dataset. Scheduling and completion in this space do not change Jira status or due dates. Linked items open the connected issue or merge request for further work.

## Corrections

| Problem reproduced | Resulting behavior |
| --- | --- |
| Quick add displayed its fallback date even when the text said “tomorrow 2pm”. | Before saving, a live preview shows the parsed title, actual date, time and item type. Invalid dates retain the draft and show actionable validation. |
| Backlog exposed the end-of-day rollover button, scheduling the entire unscheduled queue to tomorrow. | Backlog has a title/issue search and an explicit action that names the number of shown unfinished items and the target date. An undo restores the prior schedule. |
| Already scheduled Jira/MR work could be silently moved by another “Add to Today” click. | The feed shows its existing planning date. Same-day additions are disabled; other dates use “Move to Today” or “Move to Backlog”, with schedule undo and no duplicate task. |
| Dragging a task to a day had no recovery action and no obvious way back to backlog. | Weekly and calendar day drops record reversible schedule moves. An always-visible unscheduled region accepts planned tasks to return them to backlog. |
| Schedule undo promised to retain newer edits but guarded only the date and completed flag. | A full before/after task snapshot prevents undo from overwriting a newer title, time, type, linked object or other metadata change. |
| Completed backlog work crowded the queue. | Completed work is hidden until “Show completed” is enabled. Keyboard completion focuses the next visible task, or the search when the queue is empty. |
| Demo quick add always targeted Friday, even while viewing tomorrow or backlog; minute/24-hour inputs were incomplete. | Demo My Work uses the same parser with its fixture date, honors the current day/backlog, previews the result, accepts mouse submission and sorts real times including minutes. |
| A quick-created document whose title referenced an existing issue was interpreted as scheduling that issue. | Only task quick entry treats an existing issue key as a scheduling action; documents and incidents are created with their chosen type. |

## Verification

The focused planning run passed **36/36 browser tests**, comprising ten new regressions plus the existing daily workflow, daily quality, planning independence and keyboard usability suites. Independent review subsequently found the schedule-undo metadata guard mismatch; after its correction, an additional focused run passed **16/16**, including the new time-edit-before-undo regression and the existing daily workflow suite. The final repository-wide result is recorded by the parent task after integrating all changes.

New regressions cover parsed-date preview and failure retention; filtered bulk schedule and undo; completed disclosure and focus; linked-object reschedule and deduplication; bidirectional drag and undo; desktop/light and narrow/dark layout; and demo scheduling, search, validation and mouse submission. Fixture call logs confirm these planning interactions make no Jira mutation or Claude chat calls.

Screens were opened and visually inspected at 1440×900 light and 980×720 dark. The narrow weekly grid scrolls horizontally to preserve readable columns rather than overflowing the document. Existing calendar day/week/month and navigation-context tests remain covered. Production build and whitespace checks passed.

This is fixture-backed browser validation. Real company Jira/GitLab accounts, Dooray calendar integration and multi-device plan sync were not exercised. The demo keeps its existing October 2025 sample dataset; the connected workspace uses the current local date.

## Screenshots

![Backlog triage, parsed quick add and explicit schedule action](media/todo-backlog.png)

![Narrow dark backlog](media/todo-backlog-dark.png)

![Weekly planning with an unscheduled drop region](media/todo-week.png)
