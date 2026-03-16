import { WOUND_ITEM_TYPE } from "../runtime/overlay-runtime-constants.js";
import {
  towCombatOverlayQueueDeadSyncFromWounds,
  towCombatOverlayQueueWoundSyncFromDeadState
} from "../overlay/layout-state-service.js";

const DEAD_STATUS_ID = "dead";
const HOOK_STATE_KEY = "__towDeadWoundSyncHookIds";

function effectHasDeadStatus(effect) {
  const statuses = Array.from(effect?.statuses ?? []);
  return statuses.includes(DEAD_STATUS_ID);
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
    updateActiveEffect: Hooks.on("updateActiveEffect", (effect) => {
      if (!effectHasDeadStatus(effect)) return;
      towCombatOverlayQueueWoundSyncFromDeadState(effect.parent);
    })
  };

  game[HOOK_STATE_KEY] = hookIds;
}

