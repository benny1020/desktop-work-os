# Contributing

Orbit is an early developer-workspace preview. Small changes that reduce context switching, preserve drafts, improve keyboard access or clarify failure states are especially useful.

1. Open an issue describing the workflow and expected behavior.
2. Use a branch and keep the change focused.
3. Use synthetic fixtures in `tests/fixtures` — never company credentials, source code, internal URLs or production responses.
4. Run the checks relevant to the changed behavior and include the results in the pull request. UI changes should include a screenshot or short recording.

## Local setup

```sh
npm ci
npx playwright install chromium
npm run dev -- --port 5178
```

Use `npm run desktop` for the native application. Browser mode is sufficient for the sample UX; credentials are configured only inside Electron.

## Verification

- `npm test`: user workflows, keyboard access, failed submissions and state persistence.
- `npm run test:adapters`: authentication, endpoint contracts, diff positions and write safeguards.
- `npm run test:desktop`: actual Electron encryption and IPC in an isolated profile.
- `npm run test:connected-desktop`: actual Electron workflows against synthetic protocol fixtures.
- `npm run build`: renderer build.

Keep the distinction between demo, fixture-verified integration and live-tenant verification explicit. Never turn missing data or a failed service call into sample data presented as a successful live result.

Generated artifacts, downloaded upstream code and local execution reports are not tracked. Curated, synthetic README media belongs in `docs/media`.

## License status

The project does not yet have a project-wide license. Contributions and any future license grant need to account for the rights of their respective authors. Do not introduce third-party source without compatible terms and attribution.
