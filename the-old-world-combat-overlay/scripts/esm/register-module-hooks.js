import { getTowCombatOverlayModuleConstants } from "./constants.js";
import { registerTowCombatOverlayActionsApi } from "./actions-bootstrap.js";
import { registerTowOverlayApi } from "./overlay-public-api-service.js";
import {
  registerTowCombatOverlayHooks,
  unregisterTowCombatOverlayHooks
} from "./register-overlay-hooks.js";
import { getTowCombatOverlayOverlayApi } from "./register-public-apis.js";
import {
  isTowCombatOverlaySettingEnabled,
  registerTowCombatOverlaySettings
} from "./register-settings.js";

export function syncTowCombatOverlayEnabledSetting() {
  const { settings } = getTowCombatOverlayModuleConstants();
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
  registerTowCombatOverlayActionsApi();
  registerTowOverlayApi();
}

export function registerTowCombatOverlayModuleHooks() {
  Hooks.once("init", () => {
    registerTowCombatOverlaySettings();
    registerTowCombatOverlayRuntimeApis();
  });

  Hooks.once("ready", () => {
    registerTowCombatOverlayRuntimeApis();
    syncTowCombatOverlayEnabledSetting();
  });
}
