import { towCombatOverlayEnsurePromiseClose } from "../combat/attack-service.js";
import { registerTowCombatOverlayApi } from "../combat/overlay-api-service.js";
import { getTowCombatOverlayConstants } from "../runtime/constants.js";
import { registerTowCombatOverlayActionsRuntimeApi } from "./register-actions-api.js";
import {
  registerTowCombatOverlayHooks,
  unregisterTowCombatOverlayHooks
} from "./register-overlay-hooks.js";
import { getTowCombatOverlayOverlayApi } from "./register-public-apis.js";
import {
  isTowCombatOverlaySettingEnabled,
  registerTowCombatOverlaySettings
} from "./register-settings.js";

function ensureTowCombatOverlayStylesheetLoaded() {
  const explicitHrefs = [
    "modules/tow-combat-overlay/styles/dialog-base.css",
    "modules/tow-combat-overlay/styles/dialog-selectors.css",
    "modules/tow-combat-overlay/styles/chat-cards.css"
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

export function syncTowCombatOverlayEnabledSetting() {
  const { settings } = getTowCombatOverlayConstants();
  const overlayApi = getTowCombatOverlayOverlayApi();
  if (!overlayApi) return false;

  const wantsEnabled = isTowCombatOverlaySettingEnabled(settings.enableOverlay, true);
  const isEnabled = typeof overlayApi.isEnabled === "function"
    ? !!overlayApi.isEnabled()
    : false;

  if (wantsEnabled && !isEnabled && typeof overlayApi.enable === "function") {
    overlayApi.enable();
    return true;
  }

  if (!wantsEnabled && isEnabled && typeof overlayApi.disable === "function") {
    overlayApi.disable();
    return true;
  }

  return false;
}

function registerTowCombatOverlayRuntimeApis() {
  registerTowCombatOverlayActionsRuntimeApi();
  registerTowCombatOverlayApi();
}

export function registerTowCombatOverlayModuleHooks() {
  Hooks.once("init", () => {
    ensureTowCombatOverlayStylesheetLoaded();
    registerTowCombatOverlaySettings();
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
    registerTowCombatOverlayRuntimeApis();
    syncTowCombatOverlayEnabledSetting();
  });
}
