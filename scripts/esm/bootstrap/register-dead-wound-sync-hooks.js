import { WOUND_ITEM_TYPE } from "../runtime/overlay-constants.js";
import {
  towCombatOverlayQueueDeadSyncFromWounds,
  towCombatOverlayQueueWoundSyncFromDeadState
} from "../overlay/layout-state.js";

const DEAD_STATUS_ID = "dead";
const HOOK_STATE_KEY = "__towDeadWoundSyncHookIds";

function effectHasDeadStatus(effect) {
  const statuses = Array.from(effect?.statuses ?? []);
  return statuses.includes(DEAD_STATUS_ID);
}

function changedDataTouchesDeadStatus(changed = {}) {
  const statuses = changed?.statuses;
  if (Array.isArray(statuses)) return statuses.map((entry) => String(entry ?? "")).includes(DEAD_STATUS_ID);
  if (statuses instanceof Set) return Array.from(statuses).map((entry) => String(entry ?? "")).includes(DEAD_STATUS_ID);
  if (statuses && typeof statuses === "object") {
    return Object.keys(statuses).some((key) => key === DEAD_STATUS_ID || key === `-=${DEAD_STATUS_ID}`);
  }
  return false;
}

export function registerTowCombatOverlayDeadWoundSyncHooks() {
  if (!game) return;
  const existing = game[HOOK_STATE_KEY];
  if (existing && typeof existing === "object") return;

  const hookIds = {
    createItem: Hooks.on("createItem", (item) => {
      if (item?.type !== WOUND_ITEM_TYPE) return;
      towCombatOverlayQueueDeadSyncFromWounds(item.parent);
    }),
    updateItem: Hooks.on("updateItem", (item) => {
      if (item?.type !== WOUND_ITEM_TYPE) return;
      towCombatOverlayQueueDeadSyncFromWounds(item.parent);
    }),
    deleteItem: Hooks.on("deleteItem", (item) => {
      if (item?.type !== WOUND_ITEM_TYPE) return;
      towCombatOverlayQueueDeadSyncFromWounds(item.parent);
    }),
    createActiveEffect: Hooks.on("createActiveEffect", (effect) => {
      if (!effectHasDeadStatus(effect)) return;
      towCombatOverlayQueueWoundSyncFromDeadState(effect.parent);
    }),
    deleteActiveEffect: Hooks.on("deleteActiveEffect", (effect) => {
      if (!effectHasDeadStatus(effect)) return;
      towCombatOverlayQueueWoundSyncFromDeadState(effect.parent);
    }),
    updateActiveEffect: Hooks.on("updateActiveEffect", (effect, changed) => {
      if (!effectHasDeadStatus(effect) && !changedDataTouchesDeadStatus(changed)) return;
      towCombatOverlayQueueWoundSyncFromDeadState(effect.parent);
    })
  };

  game[HOOK_STATE_KEY] = hookIds;
}


