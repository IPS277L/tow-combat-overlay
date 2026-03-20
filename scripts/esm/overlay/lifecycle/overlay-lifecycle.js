import {
  ACTOR_OVERLAY_RESYNC_DELAYS_MS,
  KEYS,
  MODULE_KEY
} from "../../runtime/overlay-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import {
  registerTowCombatOverlayHooks,
  unregisterTowCombatOverlayHooks
} from "../../bootstrap/register-overlay-hooks.js";
import {
  towCombatOverlayForEachSceneToken,
  towCombatOverlayGetActorFromToken,
  towCombatOverlayGetActorTokenObjects
} from "../shared/core-helpers.js";
import {
  towCombatOverlayEnsureDeadVisual,
  towCombatOverlayEnsureTokenOverlayInteractivity,
  towCombatOverlayPrimeDeadPresence,
  towCombatOverlayQueueWoundSyncFromDeadState,
  towCombatOverlayUpdateCustomLayoutBorderVisibility,
  towCombatOverlayUpdateTokenOverlayHitArea
} from "../layout-state.js";
import {
  towCombatOverlayClearAllNameLabels,
  towCombatOverlayUpdateNameLabel
} from "../controls/control-style.js";
import {
  clearAllStatusOverlays,
  hideDefaultStatusPanelForOverlay,
  setupStatusPalette,
  towCombatOverlayHideCoreTokenHoverVisuals
} from "../status/status-palette.js";

const { notifications: MODULE_NOTIFICATIONS } = getTowCombatOverlayConstants();

function setTowCombatOverlayTokenVisualVisibility(tokenObject, visible) {
  if (!tokenObject || tokenObject.destroyed) return;
  const safeVisible = !!visible;
  const parts = [
    tokenObject[KEYS.nameLabel],
    tokenObject[KEYS.statusPaletteLayer],
    tokenObject[KEYS.layoutBorder]
  ];
  for (const part of parts) {
    if (!part || part.destroyed) continue;
    part.visible = safeVisible;
  }
}

function hasTowCombatOverlayPreviewClone(tokenObject) {
  const previewChildren = tokenObject?.layer?.preview?.children;
  if (!Array.isArray(previewChildren) || previewChildren.length === 0) return false;
  return previewChildren.some((previewToken) => previewToken?._original === tokenObject && !previewToken?.destroyed);
}

function scheduleTowCombatOverlayPreviewRestore(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!(state.previewRestoreTimers instanceof Map)) state.previewRestoreTimers = new Map();
  const key = tokenObject.id ?? tokenObject.document?.id;
  if (!key) return;
  const existing = state.previewRestoreTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    const liveState = game[MODULE_KEY];
    liveState?.previewRestoreTimers?.delete?.(key);
    if (!tokenObject || tokenObject.destroyed || hasTowCombatOverlayPreviewClone(tokenObject)) return;
    setTowCombatOverlayTokenVisualVisibility(tokenObject, tokenObject.visible !== false);
    towCombatOverlayRefreshTokenOverlay(tokenObject);
  }, 140);
  state.previewRestoreTimers.set(key, timer);
}

export function towCombatOverlayRefreshTokenOverlay(tokenObject) {
  hideDefaultStatusPanelForOverlay(tokenObject);
  if (hasTowCombatOverlayPreviewClone(tokenObject)) {
    setTowCombatOverlayTokenVisualVisibility(tokenObject, false);
    scheduleTowCombatOverlayPreviewRestore(tokenObject);
    return;
  }
  setTowCombatOverlayTokenVisualVisibility(tokenObject, tokenObject.visible !== false);
  towCombatOverlayPrimeDeadPresence(towCombatOverlayGetActorFromToken(tokenObject));
  towCombatOverlayEnsureTokenOverlayInteractivity(tokenObject);
  towCombatOverlayHideCoreTokenHoverVisuals(tokenObject);
  setupStatusPalette(tokenObject);
  towCombatOverlayUpdateNameLabel(tokenObject);
  towCombatOverlayUpdateTokenOverlayHitArea(tokenObject);
  towCombatOverlayUpdateCustomLayoutBorderVisibility(tokenObject);
  towCombatOverlayEnsureDeadVisual(tokenObject);
}

export function towCombatOverlayRefreshActorOverlays(actor) {
  towCombatOverlayPrimeDeadPresence(actor);
  towCombatOverlayQueueWoundSyncFromDeadState(actor);
  for (const tokenObject of towCombatOverlayGetActorTokenObjects(actor)) {
    towCombatOverlayRefreshTokenOverlay(tokenObject);
  }
}

export function towCombatOverlayQueueActorOverlayResync(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.actorOverlayResyncTimers) state.actorOverlayResyncTimers = new Map();

  const key = actor.uuid ?? actor.id;
  if (!key) return;

  const existing = state.actorOverlayResyncTimers.get(key);
  if (Array.isArray(existing)) {
    for (const timer of existing) clearTimeout(timer);
  }

  const timers = ACTOR_OVERLAY_RESYNC_DELAYS_MS.map((delayMs, index) => setTimeout(() => {
    towCombatOverlayRefreshActorOverlays(actor);
    const liveState = game[MODULE_KEY];
    const liveTimers = liveState?.actorOverlayResyncTimers?.get?.(key);
    if (!Array.isArray(liveTimers)) return;
    liveTimers[index] = null;
    if (liveTimers.every((timer) => timer == null)) {
      liveState.actorOverlayResyncTimers.delete(key);
    }
  }, delayMs));
  state.actorOverlayResyncTimers.set(key, timers);
}

export function towCombatOverlayRefreshAllOverlays() {
  towCombatOverlayForEachSceneToken((token) => {
    towCombatOverlayRefreshTokenOverlay(token);
  });
}

export function towCombatOverlayIsEnabled() {
  return !!game[MODULE_KEY];
}

export function towCombatOverlayEnable() {
  if (game[MODULE_KEY]) return false;
  const hookIds = registerTowCombatOverlayHooks();
  game[MODULE_KEY] = {
    ...hookIds,
    recentAttacks: new Map(),
    recentTargets: new Map(),
    autoApplyArmed: new Set(),
    actorOverlayResyncTimers: new Map(),
    previewRestoreTimers: new Map(),
    deadSyncTimers: new Map(),
    deadToWoundSyncTimers: new Map(),
    deadPresenceByActor: new Map(),
    deadSyncInFlight: new Set(),
    statusRemoveInFlight: new Set(),
    statusRemoveQueue: new Map(),
    lastCanvasScale: Number(canvas?.stage?.scale?.x ?? 1)
  };
  towCombatOverlayRefreshAllOverlays();
  ui.notifications.info(MODULE_NOTIFICATIONS.overlayEnabled);
  return true;
}

export function towCombatOverlayDisable() {
  const state = game[MODULE_KEY];
  if (!state) return false;
  unregisterTowCombatOverlayHooks(state);
  if (state?.actorOverlayResyncTimers instanceof Map) {
    for (const timers of state.actorOverlayResyncTimers.values()) {
      if (!Array.isArray(timers)) continue;
      for (const timer of timers) clearTimeout(timer);
    }
    state.actorOverlayResyncTimers.clear();
  }
  if (state?.previewRestoreTimers instanceof Map) {
    for (const timer of state.previewRestoreTimers.values()) clearTimeout(timer);
    state.previewRestoreTimers.clear();
  }
  if (state?.deadSyncTimers instanceof Map) {
    for (const entry of state.deadSyncTimers.values()) {
      if (typeof entry?.cancel === "function") entry.cancel();
      else clearTimeout(entry);
    }
    state.deadSyncTimers.clear();
  }
  if (state?.deadToWoundSyncTimers instanceof Map) {
    for (const entry of state.deadToWoundSyncTimers.values()) {
      if (typeof entry?.cancel === "function") entry.cancel();
      else clearTimeout(entry);
    }
    state.deadToWoundSyncTimers.clear();
  }
  if (state?.deadPresenceByActor instanceof Map) state.deadPresenceByActor.clear();
  if (state?.deadSyncInFlight instanceof Set) state.deadSyncInFlight.clear();
  if (state?.statusRemoveInFlight instanceof Set) state.statusRemoveInFlight.clear();
  if (state?.statusRemoveQueue instanceof Map) state.statusRemoveQueue.clear();
  if (state?.staggerWaitPatch && typeof foundry.applications?.api?.Dialog?.wait === "function") {
    foundry.applications.api.Dialog.wait = state.staggerWaitPatch.originalWait;
  }
  delete game[MODULE_KEY];
  towCombatOverlayClearAllNameLabels();
  clearAllStatusOverlays();
  ui.notifications.info(MODULE_NOTIFICATIONS.overlayDisabled);
  return true;
}

export function towCombatOverlayToggle() {
  return towCombatOverlayIsEnabled() ? towCombatOverlayDisable() : towCombatOverlayEnable();
}

