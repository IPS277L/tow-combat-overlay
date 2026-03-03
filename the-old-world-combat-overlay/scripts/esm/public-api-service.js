import { registerTowCombatOverlayPublicApis } from "./register-public-apis.js";
import { TOW_ACTIONS_KEY, TOW_ACTIONS_VERSION } from "./action-runtime-constants.js";
import {
  towCombatOverlayEscapeHtml,
  towCombatOverlayIsShiftHeld,
  towCombatOverlayScheduleSoon,
  towCombatOverlayToElement
} from "./core-service.js";
import { getTowCombatOverlaySystemAdapter } from "./system-adapter/tow-combat-overlay-system-adapter.js";

function getTowActionsApiBindings() {
  return {
    isShiftHeld: towCombatOverlayIsShiftHeld,
    escapeHtml: towCombatOverlayEscapeHtml,
    toElement: towCombatOverlayToElement,
    scheduleSoon: towCombatOverlayScheduleSoon,
    systemAdapter: getTowCombatOverlaySystemAdapter()
  };
}

export function createTowActionsApi(overrides = {}) {
  const bindings = getTowActionsApiBindings();
  return {
    version: TOW_ACTIONS_VERSION,
    isShiftHeld: bindings.isShiftHeld,
    escapeHtml: bindings.escapeHtml,
    toElement: bindings.toElement,
    scheduleSoon: bindings.scheduleSoon,
    systemAdapter: bindings.systemAdapter,
    ...overrides
  };
}

export function registerTowActionsApi(apiOverrides = {}) {
  const nextApi = createTowActionsApi(apiOverrides);
  const targetApi = (game[TOW_ACTIONS_KEY] && typeof game[TOW_ACTIONS_KEY] === "object")
    ? game[TOW_ACTIONS_KEY]
    : {};
  Object.assign(targetApi, nextApi);
  game[TOW_ACTIONS_KEY] = targetApi;

  registerTowCombatOverlayPublicApis({
    actionsApi: targetApi
  });

  return targetApi;
}

globalThis.registerTowActionsApi = registerTowActionsApi;
