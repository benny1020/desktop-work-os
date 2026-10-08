# Todo and planning design references

2026-10-08. A follow-up to the [team usability review](UPSTREAM_UX_REVIEW.md), concentrating on personal task management, daily planning and readable weekly layouts. Four repositories were cloned locally and inspected at the commits below. Relevant files and primary product pages were read; this is not a review of every line in those repositories. No upstream source, artwork or new dependency was copied into Worklane.

## Which products fit Worklane

| Reference | What is useful | Worklane decision |
| --- | --- | --- |
| [Super Productivity](https://github.com/super-productivity/super-productivity) | Developer issue integrations, one task dataset across daily/planner/schedule views, day load and clear task/event separation | Strongest workflow reference. Add a small truthful weekly count; retain local Jira/MR planning and context previews. Duration-based load/timeboxing needs real estimates and event duration before claiming capacity. |
| [WeekToDo](https://github.com/manuelernestog/weektodo) | Date columns beside persistent unscheduled lists, configurable visible column count, compact text tasks, fast inline capture | Strongest weekly layout reference. Implement 5-day workweek versus full 7-day selection, with visible weekend-item recovery. Preserve full dates and one canonical task list. |
| [Planify](https://github.com/alainm23/planify) | Quiet checklist typography, compact hierarchy, overdue rescheduling, separately disclosed completed tasks | Retain Worklane's earlier-day carryover and guarded Undo. Consider a separate completed fold for Today after addressing focus retention and timeline ordering; it is not implemented in this pass. |
| [Vikunja](https://github.com/go-vikunja/vikunja) | One task model across list/board/table, inline metadata and explicit quick-entry syntax guidance | Keep Worklane's visible parsed title/date/time preview. Labels, priorities, subtasks and richer date parsing are candidates, not newly implemented capabilities. Avoid hiding unsupported input behind a natural-language claim. |

Super Productivity's [official product page](https://super-productivity.com/) and WeekToDo's [official explanation](https://weektodo.me/) describe developer planning and combined calendar/task lists. [Vikunja quick-entry documentation](https://vikunja.io/help/quick-add-magic/) explains recognized metadata syntax. Planify's published task-list screenshot and Today implementation were inspected locally. Public browser inspection used isolated empty profiles; it did not connect accounts or access personal tabs. Super Productivity's actual Planner was reached through its visible navigation; it displayed dated groups and planned/available duration. WeekToDo's public planner was inspected after local first-run setup: day columns above persistent custom lists, with compact completion and editing affordances. A direct Super Productivity URL/source-component locator attempt initially failed because the hosted app used hash routing; that failed attempt is not treated as feature evidence.

SevenFlow appeared in search results but its repository returned **404** on direct open and Git clone at audit time. It is excluded from verified source references; cached descriptions are not treated as current implementation evidence.

## Inspected source, pinned commits

- **Super Productivity** — `71eb7780bcf5d6b1dfdcd39a8a8265547d040760`, MIT.
  - [planner view, lines 1–18](https://github.com/super-productivity/super-productivity/blob/71eb7780bcf5d6b1dfdcd39a8a8265547d040760/src/app/features/planner/planner-plan-view/planner-plan-view.component.html#L1-L18): overdue items before dated day groups.
  - [day header/items, lines 1–95](https://github.com/super-productivity/super-productivity/blob/71eb7780bcf5d6b1dfdcd39a8a8265547d040760/src/app/features/planner/planner-day/planner-day.component.html#L1-L95): planned/available duration, counts, task drag/drop and separate all-day events. Worklane adopts a simple count rather than fabricating duration capacity.
  - [schedule controls, lines 1–69](https://github.com/super-productivity/super-productivity/blob/71eb7780bcf5d6b1dfdcd39a8a8265547d040760/src/app/features/schedule/schedule/schedule.component.html#L1-L69): accessible day/week/month controls and calendar visibility disclosure.
- **WeekToDo** — `d384fc72d04e9c8a8431d456a3218c08d0c77e29`, GPL-3.0.
  - [column settings, lines 177–191](https://github.com/manuelernestog/weektodo/blob/d384fc72d04e9c8a8431d456a3218c08d0c77e29/src/views/configModal.vue#L177-L191): configurable calendar/custom-list column counts.
  - [dated list and capture, lines 1–28](https://github.com/manuelernestog/weektodo/blob/d384fc72d04e9c8a8431d456a3218c08d0c77e29/src/components/toDoList.vue#L1-L28): width follows visible columns; date lists keep inline task capture and empty drag targets.
  - [compact task row, lines 1–28](https://github.com/manuelernestog/weektodo/blob/d384fc72d04e9c8a8431d456a3218c08d0c77e29/src/components/toDoItem.vue#L1-L28): restrained completion/title/time hierarchy.
- **Planify** — `31e1b7d38fe00749ea50ae89d03a643bd55fb387`, GPL-3.0.
  - [Today overdue header, lines 159–174](https://github.com/alainm23/planify/blob/31e1b7d38fe00749ea50ae89d03a643bd55fb387/src/Views/Today.vala#L159-L174): overdue section with reschedule action.
  - [completed section, lines 259–303](https://github.com/alainm23/planify/blob/31e1b7d38fe00749ea50ae89d03a643bd55fb387/src/Views/Today.vala#L259-L303): separate completed list/revealer.
  - [published list screenshot](https://github.com/alainm23/planify/blob/31e1b7d38fe00749ea50ae89d03a643bd55fb387/data/resources/screenshot/screenshot-01.png): checklist density and nested sections; inspected, not redistributed.
- **Vikunja** — `e7d7f173e40627eb35c913752507ba61c2b895d8`, AGPL-3.0-or-later.
  - [quick-entry help, lines 1–91](https://github.com/go-vikunja/vikunja/blob/e7d7f173e40627eb35c913752507ba61c2b895d8/frontend/src/components/tasks/partials/QuickAddMagic.vue#L1-L91): on-demand syntax help for metadata and date/time.
  - [quick-entry build, lines 90–119](https://github.com/go-vikunja/vikunja/blob/e7d7f173e40627eb35c913752507ba61c2b895d8/frontend/src/composables/useQuickAddTask.ts#L90-L119): parsing tied to the canonical task and active context. No parser was imported.

## Implemented now

- **This Week → Week layout:** choose **Workweek · 5 days** or **Full week · 7 days**. The existing full-week default remains. Wider weekday columns make task titles easier to read and let a 980px window with expanded navigation display five days without horizontal scrolling.
- A five-day view discloses the number of weekend items. Clicking the count restores the full week and focuses the first weekend date with work, including for keyboard users. It never unschedules, deletes or duplicates a task.
- **Whole week** shows planned and completed item counts across Monday–Sunday, including hidden weekends. These are actual local plan counts, not AI-generated estimates or performance metrics.
- The display choice survives navigation within the renderer session. Calendar Week stays seven days; Calendar Month and Day stay unchanged.
- Scheduling time inputs now expose the full native AM/PM field. Edit/More popovers retain stable task geometry.

![Five-day workweek, actual app with synthetic tasks](media/todo-workweek.png)

![Stable scheduling menu with readable time input](media/upstream-planning-week.png)

## Validation

Full browser **345/345**, adapter/model/Git **168/168**, affected planning **15/15** and final narrow-layout **2/2** checks passed. Production build, native profile/vault/parser-worker checks and **11/11** native connected workflows passed with zero renderer errors. Details are recorded in [development history](LOCAL_DEVELOPMENT.md). New checks in `tests/planning-workweek.spec.js` verify canonical task data remains byte-identical when changing layouts, weekend recovery/focus, increased column width, navigation return, a narrow five-day view with expanded sidebar, and unchanged seven-day Calendar semantics. Existing editor-draft/concurrent-save/Undo/keyboard tests remain required.

Captures are reproducible with `node scripts/capture-planning-ux.mjs`, using an owned ephemeral Vite server and isolated Chromium, synthetic service data and a frozen example week. No real company records or credentials are used. Actual upstream public UI/source inspection does not certify their integrations or Worklane's live organization compatibility.
