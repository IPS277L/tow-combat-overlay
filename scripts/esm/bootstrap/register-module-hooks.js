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
    registerTowCombatOverlaySettings();
    registerTowCombatOverlayRuntimeApis();
  });

  Hooks.on("renderAbilityAttackDialog", (app) => {
    towCombatOverlayEnsurePromiseClose(app);
  });

  Hooks.on("renderCastingDialog", (app) => {
    towCombatOverlayEnsurePromiseClose(app);
  });

  Hooks.on("renderTestDialog", (app) => {
    towCombatOverlayEnsurePromiseClose(app);
  });

  Hooks.on("renderWeaponDialog", (app) => {
    towCombatOverlayEnsurePromiseClose(app);
  });

  Hooks.once("ready", () => {
    registerTowCombatOverlayRuntimeApis();
    syncTowCombatOverlayEnabledSetting();
  });
}
