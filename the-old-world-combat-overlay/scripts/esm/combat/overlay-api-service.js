import { registerTowCombatOverlayPublicApis } from "../bootstrap/register-public-apis.js";
import {
  towCombatOverlayDisable,
  towCombatOverlayEnable,
  towCombatOverlayIsEnabled,
  towCombatOverlayRefreshActorOverlays,
  towCombatOverlayRefreshAllOverlays,
  towCombatOverlayRefreshTokenOverlay,
  towCombatOverlayToggle
} from "../overlay/overlay-service.js";

const TOW_OVERLAY_VERSION = "1.0.0";

function getTowOverlayApiBindings() {
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

export function createTowOverlayApi(overrides = {}) {
  const bindings = getTowOverlayApiBindings();
  return {
    version: TOW_OVERLAY_VERSION,
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

export function registerTowOverlayApi(apiOverrides = {}) {
  const nextApi = createTowOverlayApi(apiOverrides);
  const targetApi = registerTowCombatOverlayPublicApis({
    overlayApi: nextApi
  })?.towOverlay ?? nextApi;

  return targetApi;
}
