# Worklane flagship design brief

Worklane is a developer's daily work environment. Its defining interaction is following one business task from issue to source, review and evidence while keeping the current work intact. More decoration does not establish that distinction.

## Direction chosen before implementation

The previous design's repeated labels, generic greeting and empty panels used space before actual work. Independent baseline measurements found a complex review map only 151px high at 1440×900, with the first code line at about y393 inside a preview. Home's actual work began around y400 after several explanatory bars.

The new direction is one work cockpit with restrained chrome and a dominant working surface. Home shows a compact work queue beside a personal agenda; My Work keeps the personal timeline primary. The review desk puts a readable business flow alongside the actual code. An unrequested assistant consumes no working column. Evidence, boundaries and file lists expand locally.

Palette uses the existing semantic tokens: white `#FFFFFF`, field `#F7F9F9`, ink `#293338`, secondary `#5E6E77`, work accent `#267469`, divider `#DCE1E5`; dark `#1B2025` / `#20272D` and existing accessible semantic variants. DM Sans carries the interface and IBM Plex Mono carries source/identifiers. Body work titles are 13px, secondary labels at least 11px where space permits, and code 13px with 19px or greater line height.

```text
Quiet workspace rail | History / current place / Search / utilities
                     | Compact work title and available actions
Home                 | Work queue                | Personal agenda
                     | Linked work / next action | Quick add / brief
Review               | Business flow             | Code and human review
                     |                           | AI evidence when requested
```

Search becomes a single global toolbar entry that remains present when navigation is minimized or hidden. The workspace rail becomes compact; fake integration decoration is removed. Hierarchy comes from alignment, source identity, readable type and useful separators.

This direction was compared with a visual-only reskin and a card-heavy dashboard. It was chosen because it exposes Worklane's cross-tool workflow and increases actual reading space. The interface's distinctive element is the linked business-flow workspace; the rest stays quiet.

## Acceptance and retained contracts

- Home's first next action is visible above y300 at 1440×900. Important work remains visible without traversing generic introductory panels.
- Empty plans and unrequested AI do not dominate the screen. Home and My Work have distinct priorities over one shared task dataset.
- Review chrome is compact; readable source starts above y320 where the context layout permits. Code uses at least 13px / 19px. Graph nodes remain readable at the default reading scale; explicit Fit is an overview.
- Issue → wiki → MR → pipeline/back preserves task/filter position, source selection, private drafts and original keyboard targets.
- Every visible action operates; source/evidence limitations and local versus remote effects remain clear. AI changes still require user command/confirmation.
- Validate wide/narrow, light/dark, keyboard/mouse, populated/empty/error states and independent review. Quantify results in the completion report; do not treat aspirational criteria as verified outcomes.
