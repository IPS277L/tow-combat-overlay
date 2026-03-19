import { getTowCombatOverlayActionsApi, getTowCombatOverlayPublicApi } from "../../api/module-api-registry.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";

const {
  apiKeys: COMBAT_OVERLAY_API_KEYS,
  notifications: MODULE_NOTIFICATIONS
} = getTowCombatOverlayConstants();

export async function towCombatOverlayEnsureActionsApiRuntime() {
  const api = getTowCombatOverlayPublicApi(COMBAT_OVERLAY_API_KEYS.actions);
  return typeof api?.attackActor === "function" &&
    typeof api?.defenceActor === "function" &&
    typeof api?.isShiftHeld === "function" &&
    typeof api?.systemAdapter === "object";
}

export async function towCombatOverlayEnsureActionsApi() {
  const ready = await towCombatOverlayEnsureActionsApiRuntime();
  if (!ready) ui.notifications.error(MODULE_NOTIFICATIONS.moduleApiUnavailable);
  return ready;
}

export function towCombatOverlayGetActionsSystemAdapter() {
  const api = getTowCombatOverlayActionsApi();
  return api?.systemAdapter ?? null;
}

export async function towCombatOverlayAddActorCondition(actor, condition, options = {}) {
  const adapter = towCombatOverlayGetActionsSystemAdapter();
  if (typeof adapter?.addCondition === "function") {
    return adapter.addCondition(actor, condition, options);
  }
  return actor?.addCondition?.(condition, options) ?? null;
}

export async function towCombatOverlayRemoveActorCondition(actor, condition) {
  const adapter = towCombatOverlayGetActionsSystemAdapter();
  if (typeof adapter?.removeCondition === "function") {
    return adapter.removeCondition(actor, condition);
  }
  return actor?.removeCondition?.(condition) ?? null;
}

export async function towCombatOverlayAddActorWound(actor, options = {}) {
  const adapter = towCombatOverlayGetActionsSystemAdapter();
  if (typeof adapter?.addWound === "function") {
    return adapter.addWound(actor, options);
  }
  return actor?.system?.addWound?.(options) ?? null;
}

export async function towCombatOverlayApplyActorDamage(actor, damage, context = {}) {
  const adapter = towCombatOverlayGetActionsSystemAdapter();
  if (typeof adapter?.applyDamage === "function") {
    return adapter.applyDamage(actor, damage, context);
  }
  return actor?.system?.applyDamage?.(damage, context) ?? null;
}

