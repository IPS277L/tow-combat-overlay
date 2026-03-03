import {
  towCombatOverlayAttackActor,
  towCombatOverlayRunAttackForControlled
} from "./attack-service.js";
import {
  towCombatOverlayDefenceActor,
  towCombatOverlayRunDefenceForControlled
} from "./defence-service.js";
import {
  towCombatOverlayCastActor,
  towCombatOverlayRunCastingForControlled
} from "./casting-service.js";

let actionServicesSingleton = null;

export function registerTowCombatOverlayActionServices(overrides = {}) {
  actionServicesSingleton = {
    ...(actionServicesSingleton ?? {}),
    attackActor: towCombatOverlayAttackActor,
    defenceActor: towCombatOverlayDefenceActor,
    castActor: towCombatOverlayCastActor,
    runAttackForControlled: towCombatOverlayRunAttackForControlled,
    runDefenceForControlled: towCombatOverlayRunDefenceForControlled,
    runCastingForControlled: towCombatOverlayRunCastingForControlled,
    ...overrides
  };

  return actionServicesSingleton;
}

export function getTowCombatOverlayActionServices() {
  return actionServicesSingleton ?? registerTowCombatOverlayActionServices();
}
