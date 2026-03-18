import { registerTowCombatOverlayPublicApis } from "../bootstrap/register-public-apis.js";
import { getTowCombatOverlayConstants } from "../runtime/constants.js";
import { COMBAT_OVERLAY_API_VERSION } from "../runtime/overlay-runtime-constants.js";
import {
  towCombatOverlayDisable,
  towCombatOverlayEnable,
  towCombatOverlayIsEnabled,
  towCombatOverlayRefreshActorOverlays,
  towCombatOverlayRefreshAllOverlays,
  towCombatOverlayRefreshTokenOverlay,
  towCombatOverlayToggle
} from "../overlay/overlay.js";

const { apiKeys: COMBAT_OVERLAY_API_KEYS } = getTowCombatOverlayConstants();

function getTowCombatOverlayApiBindings() {
  return {
    isEnabled: towCombatOverlayIsEnabled,
    enable: towCombatOverlayEnable,
    disable: towCombatOverlayDisable,
    toggle: towCombatOverlayToggle,
    refreshAll: towCombatOverlayRefreshAllOverlays,
    refreshActor: towCombatOverlayRefreshActorOverlays,
    refreshToken: towCombatOverlayRefreshTokenOverlay
  };
}

export function createTowCombatOverlayApi(overrides = {}) {
  const bindings = getTowCombatOverlayApiBindings();
  return {
    version: COMBAT_OVERLAY_API_VERSION,
    isEnabled: bindings.isEnabled,
    enable: bindings.enable,
    disable: bindings.disable,
    toggle: bindings.toggle,
    refreshAll: bindings.refreshAll,
    refreshActor: bindings.refreshActor,
    refreshToken: bindings.refreshToken,
    ...overrides
  };
}

export function registerTowCombatOverlayApi(apiOverrides = {}) {
  const nextApi = createTowCombatOverlayApi(apiOverrides);
  const targetApi = registerTowCombatOverlayPublicApis({
    overlayApi: nextApi
  })?.[COMBAT_OVERLAY_API_KEYS.overlay] ?? nextApi;

  return targetApi;
}
