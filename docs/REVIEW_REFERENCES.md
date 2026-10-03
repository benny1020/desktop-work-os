# Visual review: source references and implementation

Reviewed on 2026-10-03. This note covers the additional review-progress work, not an audit of every upstream repository. See [the earlier source review](../research/SOURCE_REVIEW.md) for the broader comparison.

## Pinned upstream source

GitLab, commit `7aba7128dcd14b202ca79a87d24d171679be0ad2`:

| Source inspected | Behavior confirmed | Applied behavior |
| --- | --- | --- |
| [rapid_diffs/adapters/viewed.js, lines 17–51](https://github.com/gitlabhq/gitlabhq/blob/7aba7128dcd14b202ca79a87d24d171679be0ad2/app/assets/javascripts/rapid_diffs/adapters/viewed.js#L17-L51) | A checkbox updates a file's viewed state; mount restores it. GitLab also collapses the viewed diff, except a directly linked file. | An explicit Viewed checkbox beside the code header, a check in the file list, and a visible count. Opening a diagram node does not mark it reviewed. |
| [diffs/stores/code_review.js, lines 14–21, 37–62](https://github.com/gitlabhq/gitlabhq/blob/7aba7128dcd14b202ca79a87d24d171679be0ad2/app/assets/javascripts/diffs/stores/code_review.js#L14-L62) | Reviewed file IDs are restored and saved locally under the MR path. | File paths are saved locally under the full MR URL (or demo project), IID, mode, and all three diff refs. Next unreviewed skips completed files and wraps to the first remaining file. |

Both complete files were read: **53 + 64 = 117 source lines**, including imports, comments, and blank lines. This is not a claim to have read GitLab's entire review implementation. The pinned [LICENSE](https://github.com/gitlabhq/gitlabhq/blob/7aba7128dcd14b202ca79a87d24d171679be0ad2/LICENSE) identifies client-side JavaScript as MIT Expat. These React changes are independently written; no GitLab code or dependency was copied into the app.

## Second repository: GitHub Pull Requests for VS Code

Source: [`microsoft/vscode-pull-request-github`](https://github.com/microsoft/vscode-pull-request-github), pinned commit `c9cc14a6acd4dc7a4d127b2fe6b42601e602b82b`. Its [LICENSE](https://github.com/microsoft/vscode-pull-request-github/blob/c9cc14a6acd4dc7a4d127b2fe6b42601e602b82b/LICENSE) is MIT, copyright Microsoft Corporation. These TypeScript source ranges and the license were directly read; this comparison was not based only on its README or screenshots.

| Exact source | Confirmed behavior | Applied versus deferred in Worklane |
| --- | --- | --- |
| [src/view/treeNodes/fileChangeNode.ts:168–195](https://github.com/microsoft/vscode-pull-request-github/blob/c9cc14a6acd4dc7a4d127b2fe6b42601e602b82b/src/view/treeNodes/fileChangeNode.ts#L168-L195) | Viewed state updates the tree checkbox, file context, and accessible file-specific label. Mark and unmark are separate operations. Commit-node children deliberately omit the checkbox. | Confirms the already-added explicit checkbox and per-file identity pattern. Worklane's checkbox includes the full path and remains independently reversible. Its count is local personal progress; the extension invokes its pull-request model. No implementation was copied. |
| [src/commands.ts:1834–1889](https://github.com/microsoft/vscode-pull-request-github/blob/c9cc14a6acd4dc7a4d127b2fe6b42601e602b82b/src/commands.ts#L1834-L1889) | The same mark/unmark commands accept a tree item or the active editor, enabling keybindings. Marking from the editor may close the tab, and failures are surfaced. | Worklane keeps the component code and composer open, and exposes keyboard-operable native controls. A dedicated global mark-viewed shortcut and automatic tab closing are **not implemented**. Closing the only visible component would interrupt diagram-to-code review. |
| [src/commands.ts:2238–2333](https://github.com/microsoft/vscode-pull-request-github/blob/c9cc14a6acd4dc7a4d127b2fe6b42601e602b82b/src/commands.ts#L2238-L2333) | Next/previous first locates a diff hunk relative to the cursor, then moves between files in a checked-out review; at the end, it offers wrapping. Non-checkout PR diffs stop at the file boundary with an explanation. | Worklane's Next unreviewed already wraps among remaining files in the current snapshot. It does **not** implement this hunk navigation, checkout behavior, or next/previous editor commands. Hunk navigation is deferred until long-file review evidence justifies the additional controls. |

The VS Code comparison validates or challenges the interaction choices above; it is not a claim that these improvements are a port of the extension. No VS Code extension source, packages, or GitHub write APIs were added. Downloaded research copies stay in the ignored `research/` directory.

## Deliberate differences

- The code panel stays open when marked viewed. There is only one selected file in this split view, and collapsing it would conceal the source and comment composer. A separate Next unreviewed action lets the reviewer choose when to move.
- A new head, base, or start SHA starts a separate progress record. Even unchanged files need review again; this conservative rule does not pretend to match GitLab's per-file code-review ID calculation.
- Viewed is personal progress on this device, not GitLab approval or a server-side review update. It never sends a comment or approves the MR.
- All viewed files remain reachable through the diagram and file list. Unchecking a file reopens it in the remaining queue.
- Progress counts only files delivered in the snapshot. Existing omitted-diff notices remain visible; 100% is not proof that every repository file was reviewed.
- Progress uses local storage alongside existing local drafts. There is no multi-device synchronization or account-level isolation within the same Electron profile.

## Independent usability review correction

A comment could be edited while its request was pending, but the success handler cleared the entire draft slot. The handler now clears only the exact draft that was submitted. Text typed during the request remains in the composer and survives closing/reopening the MR.

## Reproduction

```sh
npx playwright test tests/review-progress.spec.js --output=artifacts/review-progress-test-results
```

Tests exercise real UI actions with isolated GitLab fixtures: persistence across reload, next-file skipping and wrapping, explicit unmarking, no automatic approval, changed-SHA/server isolation, and typing during a delayed successful comment post. No company service or credentials are used.
