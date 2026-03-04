import { registerTowCombatOverlayPublicApis } from "../bootstrap/register-public-apis.js";
import { TOW_ACTIONS_VERSION } from "../runtime/action-runtime-constants.js";
import {
  towCombatOverlayEscapeHtml,
  towCombatOverlayIsShiftHeld,
  towCombatOverlayScheduleSoon,
  towCombatOverlayToElement
} from "./core-service.js";
import { getTowCombatOverlaySystemAdapter } from "../system-adapter/system-adapter.js";

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
  const targetApi = registerTowCombatOverlayPublicApis({
    actionsApi: nextApi
  })?.towActions ?? nextApi;

  return targetApi;
}
