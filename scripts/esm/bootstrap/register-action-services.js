import {
  towCombatOverlayAttackActor,
  towCombatOverlayRunAttackForControlled
} from "../combat/attack.js";
import {
  towCombatOverlayDefenceActor,
  towCombatOverlayRunDefenceForControlled
} from "../combat/defence.js";

let actionServicesSingleton = null;

export function registerTowCombatOverlayActionServices(overrides = {}) {
  actionServicesSingleton = {
    ...(actionServicesSingleton ?? {}),
    attackActor: towCombatOverlayAttackActor,
    defenceActor: towCombatOverlayDefenceActor,
    runAttackForControlled: towCombatOverlayRunAttackForControlled,
    runDefenceForControlled: towCombatOverlayRunDefenceForControlled,
    ...overrides
  };

  return actionServicesSingleton;
}

export function getTowCombatOverlayActionServices() {
  return actionServicesSingleton ?? registerTowCombatOverlayActionServices();
}
