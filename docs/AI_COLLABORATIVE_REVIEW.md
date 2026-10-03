# AI, diagrams and your review in one workspace

Validated 2026-10-03. This pass follows the [four-cycle UI/UX review](UX_REVIEW_CYCLES.md).

## Review flow

At desktop width, the dependency/sequence map, actual code and persistent AI review occupy three panes. AI is a second perspective beside the evidence. Generating a guide no longer replaces the diagram with another tab.

1. Open an MR and explicitly generate a review guide.
2. Select an AI checkpoint. Its component and exact diff line are selected together.
3. Inspect the code, switch between dependency and sequence views, and make your own assessment.
4. Choose **Draft comment** to append the suggestion to the target line's local draft. Existing human text is preserved; repeated insertion does not duplicate the same suggestion.
5. Edit the draft and explicitly **Post to GitLab**. Approval remains a separate action with confirmation.

**Checked**, **Not relevant**, and **To check** are reversible local checkpoint decisions. They neither mark files viewed nor approve the MR. Decisions use the MR's base/start/head refs and finding identity, so reordered findings keep their decisions and new diff versions do not inherit them.

![Diagram, code and AI review together](media/ai-collaborative-review.png)

![Dark review workspace](media/ai-collaborative-review-dark.png)

## Interaction details

- AI generation has its own pending/error state. Code navigation and drafting remain usable while it runs; a regeneration failure preserves the previous guide.
- Selecting a checkpoint switches to Diff, including recovery from a failed Source request. Unavailable references have disabled navigation/draft actions.
- All checks / This file filters and a collapsed reading order keep the rail compact.
- At narrower widths, the diagram and AI stack on the left while code stays on the right. Pane scrolling is independent; selected nodes and checkpoints remain reachable after resizing.
- GitLab snapshot reads compare base/start/head before and after downloading the diff. AI generation also verifies those refs against the displayed version before sending its request. A late response cannot replace a newer diff's guide.
- Opening an MR or selecting evidence does not trigger an AI request, comment, or approval.

## Review and validation

Root implementation and an independent reviewer iterated on the evidence-to-draft flow, pending/error behavior, source recovery, stale diff refs, and responsive selection. Hands-on captures exposed hidden selection after resizing and excess header scrolling; both were corrected. A full-suite regression also caught an overly broad compact-header selector hiding the full-page Back control and connection badge; its scope was narrowed to inspectors.

Final application revision:

- **131/131 browser tests passed**, including six co-review scenarios and all prior browser workflows.
- **30/30 adapter tests passed**, including base/start changes before AI generation and during snapshot loading.
- **7/7 native connected workflows passed**, with 37 requests through the actual Electron main-process adapters and zero renderer console errors.
- Production renderer build and whitespace checks passed.
- Light/dark captures at 1440×900 and resize behavior at 980×650 inspected. The independent final reviewer reported no remaining reproduced issue in the reviewed scope.

Local evidence: `artifacts/ai-review-release.log`, `artifacts/ai-review-native-final.log`, `artifacts/ai-rail-resize-final/`, and `artifacts/ai-review-narrow-dark-final.png`. Generated logs are intentionally not published; reproduce with the commands in the README.

All external-service responses and AI findings in this validation are synthetic fixtures. These results establish the implemented UI/transport behavior, not live organization connectivity or the correctness of model judgments. Diagram sequence relationships remain inferred rather than runtime traces.
