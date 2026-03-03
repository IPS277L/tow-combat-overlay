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

export function registerTowCombatOverlayActionServices(overrides = {}) {
  const state = globalThis.towCombatOverlayModule ?? (globalThis.towCombatOverlayModule = {});
  const existingServices = state.actionServices ?? {};

  state.actionServices = {
    ...existingServices,
    attackActor: towCombatOverlayAttackActor,
    defenceActor: towCombatOverlayDefenceActor,
    castActor: towCombatOverlayCastActor,
    runAttackForControlled: towCombatOverlayRunAttackForControlled,
    runDefenceForControlled: towCombatOverlayRunDefenceForControlled,
    runCastingForControlled: towCombatOverlayRunCastingForControlled,
    ...overrides
  };

  return state.actionServices;
}

export function getTowCombatOverlayActionServices() {
  const state = globalThis.towCombatOverlayModule ?? (globalThis.towCombatOverlayModule = {});
  return state.actionServices ?? registerTowCombatOverlayActionServices();
}

globalThis.registerTowCombatOverlayActionServices = registerTowCombatOverlayActionServices;
globalThis.getTowCombatOverlayActionServices = getTowCombatOverlayActionServices;
