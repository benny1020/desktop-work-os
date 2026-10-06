# A tour of Worklane

All screens below use synthetic data. The connected-mode images are rendered against test fixtures, not a live company environment.

## Start the day

![Sidebar hidden with a persistent top-left restore control — actual Electron, synthetic service fixtures](media/sidebar-hidden.png)

The top-left control minimizes navigation to icons. Its arrow menu offers Expanded, Icons only and Hide sidebar. Cmd/Ctrl + backslash hides/restores the last visible layout; the preference survives restart, preserving the current work and review draft.

![Daily command center](media/daily-command-center.png)

Home brings the daily plan and attention items into one workspace. A review opens directly into its context.

## Read changes through diagrams

![Visual code review](media/visual-review.gif)

Dependency flow and sequence are separate views. AI review stays beside the diagram and code. Clicking a checkpoint highlights its component and evidence; Draft comment brings the suggestion into your editable local draft. The AI guide shown is a fixture response.

![AI checkpoints, diagram and human review together](media/ai-collaborative-review.png)

![The same review workspace in dark mode](media/ai-collaborative-review-dark.png)

## Review one flow at a time

![Controller–Service–Repository role bands with actual source and editable human review](media/review-architecture-desktop.png)

![Meaningful change scopes, component examples and viewed progress](media/review-architecture-picker.png)

![Layered diagram, selected code, AI checkpoints and a human draft together](media/review-architecture-collaboration.png)

Role bands describe the changed components. Verified import paths help choose where to begin; grouping evidence explains conventional file groups. [Architecture review](REVIEW_ARCHITECTURE.md).

![Searchable review scopes with diagram, code and AI kept together](media/review-flow-picker.png)

Every MR uses the same review model. Cohesive changes open directly; independent areas and large changes expose searchable scopes. Shared files keep one draft and viewed state. These captures use synthetic browser fixtures.

![Selected flow component in a narrow dark workspace](media/review-flow-dark.png)

See [flow grouping and validation](REVIEW_FLOWS.md).

## Review a more complex PR

![Capture, reconciliation and webhook review scopes](media/complex-review-scopes.png)

![Thirty-file PR with layered diagram, source, AI checkpoints and a private review draft](media/complex-review-capture.png)

[Open the complex PR walkthrough](COMPLEX_PR_DEMO.md) for sequence and dark-mode captures. The source, existing discussions and AI guide are synthetic fixtures, available as !428 in Demo workspace.

## Keep the original context

![Connected context stack](media/connected-context.gif)

Open a related document, return to the issue's candidates, inspect an MR, then see its pipeline jobs. Closing the preview restores the original workspace.

## One plan across time views

![Daily planning](media/daily-planning.gif)

![Month calendar](media/calendar.png)

Local tasks and events share Today, Week, Backlog and Calendar. They do not silently change external issue state.

![Searchable backlog with parsed quick-add preview and explicit scheduling](media/todo-backlog.png)

![Weekly plan and unscheduled tasks](media/todo-week.png)

![Backlog in a narrow dark workspace](media/todo-backlog-dark.png)

## Find and update Jira work

![Ordinary issue search, compact filters and inline status changes](media/jira-issues-workflow.png)

![Retained Jira inspector in a narrow dark workspace](media/jira-inspector-dark.png)

Changing project views retains the issue inspector and unsent edits. Counts describe loaded results, and failed filters retain the previous query context.

## Read the wiki inline

![Wiki preview](media/wiki-preview.png)

## Ask beside the current review

![Contextual assistant](media/contextual-assistant.png)

## Work in dark mode

![Dark workspace](media/dark-workspace.png)


## Guided workflows

![Product guide](media/product-guide.png)

## Dependency review

![Review map and source](media/visual-review.png)

## Plan and investigate with fewer detours

![Unfinished work with original dates and local carryover](media/daily-carryover.png)

![Related MR and wiki candidates in the issue](media/issue-related-work.png)

![Document sections and referenced issues](media/wiki-reading-context.png)

![Available search results remain usable when another provider fails](media/search-progressive.png)

See the [workflow convenience review](WORKFLOW_CONVENIENCE.md) for interactions and validation boundaries.

## Personal assistant and durable memory

Synthetic connected-service fixtures; no real company data or live Claude answers.

![Expanded assistant and proposed task](media/assistant-memory.png)

![Inspectable memory and notification preferences](media/assistant-memory-controls.png)

![Dark companion workspace](media/assistant-memory-dark.png)

![Memory workflow walkthrough](media/assistant-memory.gif)
