import { registerTowCombatOverlayPublicApis } from "../bootstrap/register-public-apis.js";
import { COMBAT_OVERLAY_ACTIONS_API_VERSION } from "../runtime/action-runtime-constants.js";
import { getTowCombatOverlayConstants } from "../runtime/constants.js";
import {
  towCombatOverlayEscapeHtml,
  towCombatOverlayIsShiftHeld,
  towCombatOverlayScheduleSoon,
  towCombatOverlayToElement
} from "./core.js";
import { getTowCombatOverlaySystemAdapter } from "../system-adapter/system-adapter.js";

const { apiKeys: COMBAT_OVERLAY_API_KEYS } = getTowCombatOverlayConstants();

function getTowCombatOverlayActionsApiBindings() {
  return {
    isShiftHeld: towCombatOverlayIsShiftHeld,
    escapeHtml: towCombatOverlayEscapeHtml,
    toElement: towCombatOverlayToElement,
    scheduleSoon: towCombatOverlayScheduleSoon,
    systemAdapter: getTowCombatOverlaySystemAdapter()
  };
}

export function createTowCombatOverlayActionsApi(overrides = {}) {
  const bindings = getTowCombatOverlayActionsApiBindings();
  return {
    version: COMBAT_OVERLAY_ACTIONS_API_VERSION,
    isShiftHeld: bindings.isShiftHeld,
    escapeHtml: bindings.escapeHtml,
    toElement: bindings.toElement,
    scheduleSoon: bindings.scheduleSoon,
    systemAdapter: bindings.systemAdapter,
    ...overrides
  };
}

export function registerTowCombatOverlayActionsApi(apiOverrides = {}) {
  const nextApi = createTowCombatOverlayActionsApi(apiOverrides);
  const targetApi = registerTowCombatOverlayPublicApis({
    actionsApi: nextApi
  })?.[COMBAT_OVERLAY_API_KEYS.actions] ?? nextApi;

  return targetApi;
}
