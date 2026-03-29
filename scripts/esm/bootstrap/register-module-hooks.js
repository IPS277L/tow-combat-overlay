import { towCombatOverlayEnsurePromiseClose } from "../combat/attack.js";
import { towCombatOverlayApplyChatMessageCensorship } from "../combat/core.js";
import { registerTowCombatOverlayApi } from "../api/combat-overlay-api.js";
import { registerTowCombatOverlayActionsRuntimeApi } from "./register-actions-api.js";
import { registerTowCombatOverlayDeadWoundSyncHooks } from "./register-dead-wound-sync-hooks.js";
import { registerTowCombatOverlayDisplaySettings } from "./register-settings.js";
import { towCombatOverlayApplyTableVisibilityRelay } from "../chat/table-visibility-relay.js";
import {
  ensureTowCombatOverlayStylesheetLoaded,
  ensureTowCombatOverlaySidebarObserver,
  requestTowCombatOverlayViewportSync
} from "./ui-bootstrap.js";
import { syncTowCombatOverlayDisplaySettings } from "./display-settings-sync.js";
import { ensureTowCombatOverlayActionRelayFlagHook } from "./relay/action-relay-runtime.js";
import {
  ensureTowCombatOverlayTopPanelOrderBackoffSweeps,
  ensureTowCombatOverlayTopPanelOrderRelayHook,
  ensureTowCombatOverlayTopPanelOrderSocketRelay
} from "./relay/top-panel-order-relay.js";

function registerTowCombatOverlayRuntimeApis() {
  registerTowCombatOverlayActionsRuntimeApi();
  registerTowCombatOverlayApi();
}

export { syncTowCombatOverlayDisplaySettings };

export function registerTowCombatOverlayModuleHooks() {
  Hooks.once("init", () => {
    ensureTowCombatOverlayStylesheetLoaded();
    registerTowCombatOverlayDisplaySettings({
      onDisplaySettingsChanged: syncTowCombatOverlayDisplaySettings
    });
    registerTowCombatOverlayRuntimeApis();
  });

  Hooks.on("renderAbilityAttackDialog", (app) => {
    towCombatOverlayEnsurePromiseClose(app);
  });

  Hooks.on("renderTestDialog", (app) => {
    towCombatOverlayEnsurePromiseClose(app);
  });

  Hooks.on("renderWeaponDialog", (app) => {
    towCombatOverlayEnsurePromiseClose(app);
  });

  Hooks.on("preCreateChatMessage", (messageDoc, createData, _options, userId) => {
    towCombatOverlayApplyTableVisibilityRelay(messageDoc, createData, userId);
  });

  Hooks.on("renderChatMessage", (message, html) => {
    towCombatOverlayApplyChatMessageCensorship(message, html);
  });

  Hooks.on("collapseSidebar", () => {
    requestTowCombatOverlayViewportSync();
  });

  Hooks.on("renderSidebar", () => {
    ensureTowCombatOverlaySidebarObserver();
  });

  Hooks.once("ready", () => {
    ensureTowCombatOverlayStylesheetLoaded();
    registerTowCombatOverlayDeadWoundSyncHooks();
    ensureTowCombatOverlaySidebarObserver();
    ensureTowCombatOverlayTopPanelOrderSocketRelay();
    ensureTowCombatOverlayTopPanelOrderRelayHook();
    ensureTowCombatOverlayActionRelayFlagHook();
    ensureTowCombatOverlayTopPanelOrderBackoffSweeps();
    syncTowCombatOverlayDisplaySettings();
  });
}