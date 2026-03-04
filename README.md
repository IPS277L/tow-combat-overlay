# The Old World Combat Overlay

FoundryVTT module for combat overlay and automation helpers for Warhammer: The Old World Roleplaying Game.

## Layout

- `the-old-world-combat-overlay/`
  - Release/package root for FoundryVTT.
  - `module.json`
  - `scripts/`
  - `styles/`
  - `templates/`
  - `packs/`
  - `lang/`

- `oldworld-foundryvtt/`
  - Git submodule for the WHTOW system reference used by this module.

- `docs/`
  - Local project notes and migration records.

## Runtime

- Module API:
  - `game.modules.get("the-old-world-combat-overlay")?.api`

Current note:
- the module API is the only live integration entrypoint exposed by the module runtime
- use the module API at your own risk
- public API versioning and compatibility guarantees are not supported at the moment
- the legacy `game.towActions` / `game.towOverlay` globals are no longer exposed
- the current module API keys are `combatOverlayActions` and `combatOverlay`

## Notes

- Legacy macro source, generated macro bundles, and macro build tooling have been removed.
- The runtime is native ESM and is bootstrapped from `the-old-world-combat-overlay/scripts/main.js`.
- The ESM runtime is now grouped by concern:
  - `the-old-world-combat-overlay/scripts/esm/bootstrap/`
  - `the-old-world-combat-overlay/scripts/esm/combat/`
  - `the-old-world-combat-overlay/scripts/esm/runtime/`
  - `the-old-world-combat-overlay/scripts/esm/overlay/`
  - `the-old-world-combat-overlay/scripts/esm/system-adapter/`
- The overlay runtime is also grouped internally by concern:
  - `the-old-world-combat-overlay/scripts/esm/overlay/controls/`
  - `the-old-world-combat-overlay/scripts/esm/overlay/layout/`
  - `the-old-world-combat-overlay/scripts/esm/overlay/lifecycle/`
  - `the-old-world-combat-overlay/scripts/esm/overlay/status/`
  - `the-old-world-combat-overlay/scripts/esm/overlay/shared/`
  - `the-old-world-combat-overlay/scripts/esm/overlay/automation/`
- The overlay/action runtime is registered through the module API only, but that API should currently be treated as provisional and unsupported for compatibility purposes.
- Repo-only files such as `.gitignore`, `.gitmodules`, docs, and the system submodule remain outside the release/package root.
- The package manifest at `the-old-world-combat-overlay/module.json` is the only supported runtime entrypoint.
- The top-level overlay barrels are still the stable overlay import surface:
  - `the-old-world-combat-overlay/scripts/esm/overlay/controls-service.js`
  - `the-old-world-combat-overlay/scripts/esm/overlay/overlay-service.js`
  - `the-old-world-combat-overlay/scripts/esm/overlay/layout-state-service.js`
- Runtime naming is now standardized around `towCombatOverlay` and shared constants:
  - module API keys use `combatOverlayActions` and `combatOverlay`
  - common notifications, dialog labels, and tooltip copy are centralized in `the-old-world-combat-overlay/scripts/esm/runtime/constants.js`
  - internal overlay expando keys are centralized in `the-old-world-combat-overlay/scripts/esm/runtime/overlay-runtime-constants.js`
- Foundry 13 dialog dismiss handling is patched so wrapped system dialogs return a promise from `close()`.
- Overlay tooltip text now reflects actual WHTOW behavior more accurately, including explicit champion wording and threshold-based NPC handling derived from system state.
- The main remaining technical debt is overlay behavior complexity rather than file layout or naming consistency.
