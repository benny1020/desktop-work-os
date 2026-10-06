# Sidebar layout

The top-left control minimizes the expanded sidebar to icons, or expands it again. The adjacent arrow offers **Expanded**, **Icons only** and **Hide sidebar**. When hidden, the restore button stays visible and returns to the last visible layout. **Cmd/Ctrl + backslash** toggles hiding without changing the current route, selected code or unsent review.

The preference uses the existing local `orbit-` storage namespace. Restart remembers both visibility and the last expanded/icon layout. Hidden navigation is unmounted, so keyboard tab navigation cannot enter invisible menu items. The layout menu supports Tab, Escape, outside dismissal and focus recovery. Shortcuts inside a review preview preserve the comment input's focus. Native Electron reserves room for macOS window controls and keeps the topbar draggable.

Validation uses `tests/sidebar-layout.spec.js` for persistence, icon navigation, actual content width, hidden/dark keyboard search, menu focus, and selected-code/draft preservation without external writes. Shell, diagram and minimum-window regressions are included in the validation run. `scripts/test-connected-desktop.mjs` additionally verifies native hide/restore, reload persistence and restore-button geometry beside real window controls. Remote services use synthetic fixtures.

![Actual Electron with hidden navigation](media/sidebar-hidden.png)

Final validation: **256/256 browser tests**, **20/20 focused shell/review checks** (included in the full suite), and **10/10 native connected workflow checks** passed. Production build and `git diff --check` passed. Native validation had zero renderer console errors. Adapter/model and native memory counts in the README retain the preceding unchanged-module validation; this layout change introduces no backend or model API changes.
