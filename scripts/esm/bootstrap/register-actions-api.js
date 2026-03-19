import { registerTowCombatOverlayActionsApi } from "../api/combat-overlay-actions-api.js";
import { getTowCombatOverlayActionServices } from "../combat/action-runtime/action-services.js";

export function registerTowCombatOverlayActionsRuntimeApi() {
  const services = getTowCombatOverlayActionServices();
  return registerTowCombatOverlayActionsApi({
    attackActor: services.attackActor,
    defenceActor: services.defenceActor,
    runAttackForControlled: services.runAttackForControlled,
    runDefenceForControlled: services.runDefenceForControlled
  });
}

export const registerTowCombatOverlayActionsFromGlobals = registerTowCombatOverlayActionsRuntimeApi;

