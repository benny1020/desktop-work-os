# README media

These files are curated recordings and screenshots of the actual Worklane UI. All task names, documents, code, identities, service addresses and responses are synthetic demo/fixture data. No real credentials or company responses are captured.

- `daily-command-center.png`: built-in demo home and connected work trail.
- `product-guide.png`: actionable sample workflows.
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
