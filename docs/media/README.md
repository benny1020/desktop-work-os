# README media

These files are curated recordings and screenshots of the actual Worklane UI. All task names, documents, code, identities, service addresses and responses are synthetic demo/fixture data. No real credentials or company responses are captured.

- `daily-command-center.png`: built-in demo home and connected work trail.
- `review-architecture-{desktop,picker,collaboration,narrow-dark}.png`: role bands, understandable scopes and AI/human co-review. Reproduce with `npx playwright test tests/review-architecture.spec.js`; copy the corresponding captures from `artifacts/`. Synthetic connected fixtures.
- `todo-backlog.png`, `todo-backlog-dark.png`, `todo-week.png`: parsed quick add, searchable backlog and one shared weekly plan. Captured by `tests/todo-usability-improvements.spec.js` against local planning data and synthetic service fixtures.
- `jira-issues-workflow.png`, `jira-inspector-dark.png`: ordinary issue search, inline status popover and retained inspector. Synthetic Jira fixtures; the dark capture waits for theme transitions to settle.
- `product-guide.png`: actionable sample workflows.
- `review-flow-picker.png`, `review-flow-dark.png`: searchable changed-file scopes and selected-component review at 1440 × 900 / 980 × 650. Reproduce with `npx playwright test tests/review-flows.spec.js`; copy `artifacts/review-flows-picker.png` and `artifacts/review-flows-narrow-dark.png`. Synthetic connected browser fixtures, not live services.
- `local-git-review.png`: actual Electron with a real temporary Git repository/worktree, automatic revision synchronization, local blob source, dependency diagram, and synthetic GitLab/Claude HTTPS fixtures. Reproduce with `npm run test:connected-desktop`; copy `research/completion/electron-local-git-review.png`.
- `visual-review.png`: layered dependency map, actual code, human draft and persistent AI review.
- `ai-collaborative-review.png`, `ai-collaborative-review-dark.png`: selected AI evidence and a human-edited review in light and dark themes.
- `calendar.png`, `wiki-preview.png`, `contextual-assistant.png`, `dark-workspace.png`: connected UI with `tests/fixtures/connected.mjs` responses.
- `visual-review.gif`: dependency → viewed progress → sequence → source → comment → guide → checkpoint → human draft → assistant.
- `connected-context.gif`: issue → wiki → MR → pipeline → home.
- `daily-planning.gif`: quick add → week → calendar → global search.

The AI answer/guide in these recordings is a deterministic fixture. Posting a comment in the animation invokes only the test bridge.

Additional convenience captures (`daily-carryover.png`, `issue-related-work.png`, `wiki-reading-context.png`, `search-progressive.png`) come from `node scripts/capture-convenience.mjs`, using a fixed sample day and synthetic service responses.

## Reproduce

Start the development server in one terminal:

```sh
npm ci
npx playwright install chromium
npm run dev -- --port 5178
```

In another terminal:

```sh
node scripts/capture-readme.mjs
python3 -m venv .venv-media
.venv-media/bin/pip install Pillow
.venv-media/bin/python scripts/encode-readme-gifs.py
```

The recorder captures real UI frames at 1440×900. Pillow encodes them at 1120×700 with a shared palette and captured frame timing. It does not generate replacement UI or reconstruct interactions from still concepts.

Raw frames remain ignored in `artifacts/readme-recording/`. Review recordings for accidental sensitive content before committing any new media.
