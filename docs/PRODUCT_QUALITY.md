# Worklane product quality pass

2026-10-03. This pass strengthens the product's distinctive workflow: understand a change, act in context, and return to the day. It does not claim market validation or production readiness.

## Design decisions

- Keep the dense desktop layout, DM Sans for UI and IBM Plex Mono for code. Bundle the fonts so the desktop UI works consistently without Google font requests.
- Use white and cool gray surfaces, deep teal actions, restrained status colors and stronger secondary-text contrast. The dependency map is the primary visual feature; decorative dashboards were not added.
- Give Worklane a compact W/lane mark, consistent favicon, a discoverable workflow guide and an issue-to-code work trail on Home.
- Make daily planning answer what is next, and code review answer what changed and how its pieces relate. Keep secondary explanations behind disclosure controls.

## What changed

| Surface | Result |
| --- | --- |
| First use | Explore workflows opens one of three actual sample workflows: connected issue context, visual code review or incident investigation. The guide never opens automatically. |
| Home | Demo work trail directly opens issue, MR, pipeline and wiki previews. Connected Home uses real loaded requests and local plan counts, with a clear next review and honest setup/empty states. |
| MR review | Strongly connected components are grouped before dependency layering. A reading path, changed-line counts and discussion counts derive from the loaded snapshot. Diagram sizing follows the panel; manual zoom remains under the user's control. |
| Keyboard review | Graph components and edges support activation, directional navigation and Home/End. Existing command shortcuts and mouse controls remain available. |
| Planning | Local deletion has a single-level Undo restoring the exact saved item and its position, including linked identity. No external delete is performed. |
| Assistant | Current object/file context is visible. Suggested questions only fill and focus the composer; API submission remains explicit. |
| Copy | Primary integration, issue, document, command, assistant and review interfaces use consistent English. User content, service responses and Korean natural-language scheduling support are preserved. |
| App shell | Route navigation resets scroll; inspector previews retain the underlying view. Navigation scrolls independently of fixed utility controls. Short windows hide favorites to prioritize primary navigation. |
| Small windows | Assistant remains inside the object preview layout and cannot cover its close button. Review panels respond to container width. |
| Connected identity | Workspace settings describe the personal workspace, rather than presenting the demo company and scenario as real account details. |

## Verification

Three specialist agents worked on daily productivity, visual review and independent UI audit; the primary agent integrated and reviewed the changes. The audit reproduced three failures before their fixes: retained page scroll, inaccessible sidebar controls and an Assistant covering the preview close button. All three now pass at 980×650.

- **83/83 browser tests**, zero skipped, unexpected or flaky results in the final combined local run. This includes **19 new quality regressions**.
- **24/24 Node adapter tests**.
- Native Electron profile-upgrade and encrypted-vault checks pass.
- **7/7 native connected workflows**, 37 actual main-process adapter requests, no console errors; isolated HTTPS fixtures only.
- Production renderer build passes. Fonts are packaged locally and production CSP no longer allows external font hosts.
- Actual light/dark screenshots inspected at 1440×900 and minimum-window interactions checked at 980×650.
- Seven README screenshots and three animated UI recordings use synthetic fixture data. The recordings demonstrate actual interactions, not rendered concepts.
- A pinned-action GitHub workflow now runs install, production build, adapter contracts and browser workflows on pushes and pull requests, and retains failure evidence.

Reproduce: `npm test`, `npm run test:adapters`, `npm run test:desktop`, `npm run test:connected-desktop`. Media: `node scripts/capture-readme.mjs`, then `python scripts/encode-readme-gifs.py` with Pillow installed.

## Still unverified or out of scope

No human study has measured task-completion speed or market interest. Company API compatibility requires real configured endpoints and permissions; these runs used no company credentials or records. Windows/Linux desktop operation, signed installers, auto-update, production sync and complete repository semantic analysis are not established. Dependency and sequence inference remain limited to the loaded change snapshot. Dooray is a placeholder and Observe is a mock.

The bundled fonts retain their [DM Sans](../public/licenses/DM-Sans-OFL.txt) and [IBM Plex Mono](../public/licenses/IBM-Plex-Mono-OFL.txt) SIL Open Font Licenses. No project-wide source license is granted by this quality pass.
