import { getTowCombatOverlayActionsApi, getTowCombatOverlayPublicApi } from "../register-public-apis.js";

export async function towCombatOverlayEnsureTowActionsRuntime() {
  const api = getTowCombatOverlayPublicApi("towActions");
  return typeof api?.attackActor === "function" &&
    typeof api?.defenceActor === "function" &&
    typeof api?.isShiftHeld === "function" &&
    typeof api?.systemAdapter === "object";
}

export async function towCombatOverlayEnsureTowActions() {
  const ready = await towCombatOverlayEnsureTowActionsRuntime();
  if (!ready) ui.notifications.error("The Old World Combat Overlay module API is unavailable.");
  return ready;
}

export function towCombatOverlayGetTowActionsSystemAdapter() {
  const api = getTowCombatOverlayActionsApi();
  return api?.systemAdapter ?? null;
}

export async function towCombatOverlayAddActorCondition(actor, condition, options = {}) {
  const adapter = towCombatOverlayGetTowActionsSystemAdapter();
  if (typeof adapter?.addCondition === "function") {
    return adapter.addCondition(actor, condition, options);
  }
  return actor?.addCondition?.(condition, options) ?? null;
}

export async function towCombatOverlayRemoveActorCondition(actor, condition) {
  const adapter = towCombatOverlayGetTowActionsSystemAdapter();
  if (typeof adapter?.removeCondition === "function") {
    return adapter.removeCondition(actor, condition);
  }
  return actor?.removeCondition?.(condition) ?? null;
}

export async function towCombatOverlayAddActorWound(actor, options = {}) {
  const adapter = towCombatOverlayGetTowActionsSystemAdapter();
  if (typeof adapter?.addWound === "function") {
    return adapter.addWound(actor, options);
  }
  return actor?.system?.addWound?.(options) ?? null;
}

export async function towCombatOverlayApplyActorDamage(actor, damage, context = {}) {
  const adapter = towCombatOverlayGetTowActionsSystemAdapter();
  if (typeof adapter?.applyDamage === "function") {
    return adapter.applyDamage(actor, damage, context);
  }
  return actor?.system?.applyDamage?.(damage, context) ?? null;
}
