import {
  DEAD_SYNC_DEBOUNCE_MS,
  DEAD_TO_WOUND_SYNC_DEBOUNCE_MS,
  MODULE_KEY,
  WOUND_ITEM_TYPE
} from "../../runtime/overlay-runtime-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/constants.js";
import {
  towCombatOverlayCanEditActor,
  towCombatOverlayWarnNoPermission
} from "../shared/core-helpers-service.js";
import {
  towCombatOverlayAddActorCondition,
  towCombatOverlayAddActorWound,
  towCombatOverlayRemoveActorCondition
} from "../shared/actions-bridge-service.js";
import { runActorOpLock } from "../shared/shared-service.js";

const { logPrefix: MODULE_LOG_PREFIX } = getTowCombatOverlayConstants();

export function towCombatOverlayGetWoundCount(tokenDocument) {
  const actor = tokenDocument?.actor;
  if (!actor) return null;
  const liveItems = actor.items?.contents ?? [];
  const itemWounds = Array.isArray(liveItems)
    ? liveItems.filter((item) => item.type === WOUND_ITEM_TYPE).length
    : (Array.isArray(actor.itemTypes?.wound) ? actor.itemTypes.wound.length : 0);
  const isMinion = actor.type === "npc" && actor.system?.type === "minion";
  if (isMinion && actor.hasCondition?.("dead")) return Math.max(1, itemWounds);
  return itemWounds;
}

export function towCombatOverlayGetActorWoundItemCount(actor) {
  if (!actor) return 0;
  const items = actor.items?.contents ?? [];
  if (Array.isArray(items)) return items.filter((item) => item.type === WOUND_ITEM_TYPE).length;
  if (Array.isArray(actor.itemTypes?.wound)) return actor.itemTypes.wound.length;
  return 0;
}

export function towCombatOverlayGetMaxWoundLimit(actor) {
  if (!actor || actor.type !== "npc") return null;
  if (actor.system?.type === "minion") return 1;
  if (!actor.system?.hasThresholds) return null;
  const defeatedThreshold = Number(actor.system?.wounds?.defeated?.threshold ?? NaN);
  if (!Number.isFinite(defeatedThreshold) || defeatedThreshold <= 0) return null;
  return defeatedThreshold;
}

export function towCombatOverlayIsAtWoundCap(actor) {
  const cap = towCombatOverlayGetMaxWoundLimit(actor);
  if (!Number.isFinite(cap)) return false;
  if (actor.system?.type === "minion" && actor.hasCondition?.("dead")) return true;
  return towCombatOverlayGetActorWoundItemCount(actor) >= cap;
}

export async function towCombatOverlaySyncNpcDeadFromWounds(actor) {
  if (!actor || actor.type !== "npc" || !towCombatOverlayCanEditActor(actor)) return;
  if (actor.system?.type === "minion") return;
  if (!actor.system?.hasThresholds || typeof actor.system?.thresholdAtWounds !== "function") return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadSyncInFlight) state.deadSyncInFlight = new Set();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey || state.deadSyncInFlight.has(actorKey)) return;
  state.deadSyncInFlight.add(actorKey);

  try {
    const woundCount = towCombatOverlayGetActorWoundItemCount(actor);
    const threshold = actor.system.thresholdAtWounds(woundCount);
    const shouldBeDead = threshold === "defeated";
    const hasDead = !!actor.hasCondition?.("dead");
    if (shouldBeDead === hasDead) return;

    if (shouldBeDead) {
      await runActorOpLock(actor, "condition:dead", async () => {
        if (actor.hasCondition?.("dead")) return;
        await towCombatOverlayAddActorCondition(actor, "dead");
      });
    } else {
      await runActorOpLock(actor, "condition:dead", async () => {
        if (!actor.hasCondition?.("dead")) return;
        await towCombatOverlayRemoveActorCondition(actor, "dead");
      });
    }
  } finally {
    state.deadSyncInFlight.delete(actorKey);
  }
}

export function towCombatOverlayQueueDeadSyncFromWounds(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadSyncTimers) state.deadSyncTimers = new Map();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

  let debounced = state.deadSyncTimers.get(actorKey);
  if (typeof debounced !== "function") {
    debounced = foundry.utils.debounce((latestActor) => {
      void towCombatOverlaySyncNpcDeadFromWounds(latestActor).catch((error) => {
        console.error(`${MODULE_LOG_PREFIX} Failed to sync dead condition from wounds.`, error);
      });
    }, DEAD_SYNC_DEBOUNCE_MS);
    state.deadSyncTimers.set(actorKey, debounced);
  }
  debounced(actor);
}

export async function towCombatOverlaySyncWoundsFromDeadState(actor) {
  if (!actor || !towCombatOverlayCanEditActor(actor)) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadPresenceByActor) state.deadPresenceByActor = new Map();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

  const hasDead = !!actor.hasCondition?.("dead");
  const wasDead = state.deadPresenceByActor.get(actorKey) === true;
  state.deadPresenceByActor.set(actorKey, hasDead);

  const cap = towCombatOverlayGetMaxWoundLimit(actor);
  if (!Number.isFinite(cap) || cap <= 0) return;

  if (hasDead) {
    await runActorOpLock(actor, "dead-wound-sync", async () => {
      const current = towCombatOverlayGetActorWoundItemCount(actor);
      const missing = Math.max(0, cap - current);
      if (missing <= 0) return;
      for (let i = 0; i < missing; i++) {
        await actor.createEmbeddedDocuments("Item", [{ type: WOUND_ITEM_TYPE, name: "Wound" }]);
      }
    }).catch((error) => {
      console.error(`${MODULE_LOG_PREFIX} Failed to sync wounds from dead condition.`, error);
    });
    return;
  }

  if (!wasDead) return;
  if (towCombatOverlayGetActorWoundItemCount(actor) < cap) return;
  await runActorOpLock(actor, "dead-wound-sync", async () => {
    const maxPasses = Math.max(1, towCombatOverlayGetActorWoundItemCount(actor) + 2);
    for (let i = 0; i < maxPasses; i++) {
      const wounds = (actor.items?.contents ?? []).filter((item) => item.type === WOUND_ITEM_TYPE);
      if (!wounds.length) break;
      const toDelete = wounds.find((wound) => wound.system?.treated !== true) ?? wounds[wounds.length - 1];
      if (!toDelete?.id || !actor.items.get(toDelete.id)) break;
      await actor.deleteEmbeddedDocuments("Item", [toDelete.id]);
    }
  }).catch((error) => {
    console.error(`${MODULE_LOG_PREFIX} Failed to clear wounds after removing dead condition.`, error);
  });
}

export function towCombatOverlayQueueWoundSyncFromDeadState(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadToWoundSyncTimers) state.deadToWoundSyncTimers = new Map();

  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

  let debounced = state.deadToWoundSyncTimers.get(actorKey);
  if (typeof debounced !== "function") {
    debounced = foundry.utils.debounce((latestActor) => {
      void towCombatOverlaySyncWoundsFromDeadState(latestActor);
    }, DEAD_TO_WOUND_SYNC_DEBOUNCE_MS);
    state.deadToWoundSyncTimers.set(actorKey, debounced);
  }
  debounced(actor);
}

export function towCombatOverlayPrimeDeadPresence(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.deadPresenceByActor) state.deadPresenceByActor = new Map();
  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey || state.deadPresenceByActor.has(actorKey)) return;
  state.deadPresenceByActor.set(actorKey, !!actor.hasCondition?.("dead"));
}

export function towCombatOverlayGetResilienceValue(tokenDocument) {
  return tokenDocument?.actor?.system?.resilience?.value ?? null;
}

export async function towCombatOverlayAddWound(actor) {
  if (!towCombatOverlayCanEditActor(actor)) {
    towCombatOverlayWarnNoPermission(actor);
    return;
  }
  if (towCombatOverlayIsAtWoundCap(actor)) return;
  if (typeof actor.system?.addWound === "function") {
    await towCombatOverlayAddActorWound(actor, { roll: false });
  } else {
    await actor.createEmbeddedDocuments("Item", [{ type: WOUND_ITEM_TYPE, name: "Wound" }]);
  }
}

export async function towCombatOverlayRemoveWound(actor) {
  if (!towCombatOverlayCanEditActor(actor)) {
    towCombatOverlayWarnNoPermission(actor);
    return;
  }

  await runActorOpLock(actor, "remove-wound", async () => {
    const wounds = (actor.items?.contents ?? []).filter((item) => item.type === WOUND_ITEM_TYPE);
    const isMinion = actor.type === "npc" && actor.system?.type === "minion";
    if (!wounds.length) {
      if (isMinion && actor.hasCondition?.("dead")) {
        await towCombatOverlayRemoveActorCondition(actor, "dead");
      }
      return;
    }

    const toDelete = wounds.find((wound) => wound.system?.treated !== true) ?? wounds[wounds.length - 1];
    if (!toDelete?.id || !actor.items.get(toDelete.id)) return;
    await actor.deleteEmbeddedDocuments("Item", [toDelete.id]);

    if (isMinion && actor.hasCondition?.("dead")) {
      const remaining = towCombatOverlayGetActorWoundItemCount(actor);
      if (remaining <= 0) await towCombatOverlayRemoveActorCondition(actor, "dead");
    }
  });
}
