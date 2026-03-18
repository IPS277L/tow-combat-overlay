import { towCombatOverlayEnsurePromiseClose } from "../combat/attack.js";
import { registerTowCombatOverlayApi } from "../api/combat-overlay-api.js";
import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";
import { registerTowCombatOverlayActionsRuntimeApi } from "./register-actions-api.js";
import { registerTowCombatOverlayDeadWoundSyncHooks } from "./register-dead-wound-sync-hooks.js";
import { getTowCombatOverlayOverlayApi } from "../api/module-api-registry.js";
import {
  isTowCombatOverlayDisplaySettingEnabled,
  registerTowCombatOverlayDisplaySettings
} from "./register-settings.js";
import {
  towCombatOverlayEnsureControlPanel,
  towCombatOverlayRemoveControlPanel
} from "../overlay/panel/control-panel-service.js";

function ensureTowCombatOverlayStylesheetLoaded() {
  const explicitHrefs = [
    "modules/tow-combat-overlay/styles/dialog-base.css",
    "modules/tow-combat-overlay/styles/dialog-selectors.css",
    "modules/tow-combat-overlay/styles/chat-cards.css",
    "modules/tow-combat-overlay/styles/status-tooltip.css",
    "modules/tow-combat-overlay/styles/control-panel.css"
  ];
  const links = Array.from(document.querySelectorAll("link[rel='stylesheet']"));
  const loadedHrefs = new Set(
    links.map((link) => String(link.getAttribute("href") ?? ""))
  );
  let injected = false;
  for (const explicitHref of explicitHrefs) {
    const alreadyLoaded = Array.from(loadedHrefs).some((href) => href.includes(explicitHref));
    if (alreadyLoaded) continue;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = explicitHref;
    document.head.appendChild(link);
    loadedHrefs.add(explicitHref);
    injected = true;
  }
  return injected;
}

export function syncTowCombatOverlayDisplaySettings() {
  const { settings } = getTowCombatOverlayConstants();
  const overlayApi = getTowCombatOverlayOverlayApi();
  let didChange = false;

  const wantsEnabled = isTowCombatOverlayDisplaySettingEnabled(settings.enableOverlay, true);
  const wantsControlPanel = isTowCombatOverlayDisplaySettingEnabled(settings.enableControlPanel, true);

  if (!overlayApi) {
    if (!wantsControlPanel) towCombatOverlayRemoveControlPanel();
    return false;
  }
  const isEnabled = typeof overlayApi.isEnabled === "function"
    ? !!overlayApi.isEnabled()
    : false;

  if (wantsEnabled && !isEnabled && typeof overlayApi.enable === "function") {
    overlayApi.enable();
    didChange = true;
  }

  if (!wantsEnabled && isEnabled && typeof overlayApi.disable === "function") {
    overlayApi.disable();
    didChange = true;
  }

  if (wantsControlPanel) {
    void towCombatOverlayEnsureControlPanel().catch((error) => {
      console.error("[tow-combat-overlay] Failed to initialize control panel.", error);
    });
  } else {
    towCombatOverlayRemoveControlPanel();
  }

  return didChange;
}

function registerTowCombatOverlayRuntimeApis() {
  registerTowCombatOverlayActionsRuntimeApi();
  registerTowCombatOverlayApi();
}

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

  Hooks.once("ready", () => {
    ensureTowCombatOverlayStylesheetLoaded();
    registerTowCombatOverlayDeadWoundSyncHooks();
    syncTowCombatOverlayDisplaySettings();
  });
}

