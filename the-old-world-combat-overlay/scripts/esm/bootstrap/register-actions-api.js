import { registerTowCombatOverlayActionsApi } from "../combat/actions-api-service.js";
import { getTowCombatOverlayActionServices } from "./register-action-services.js";

export function registerTowCombatOverlayActionsRuntimeApi() {
  const services = getTowCombatOverlayActionServices();
  return registerTowCombatOverlayActionsApi({
    attackActor: services.attackActor,
    castActor: services.castActor,
    defenceActor: services.defenceActor,
    runAttackForControlled: services.runAttackForControlled,
    runCastingForControlled: services.runCastingForControlled,
    runDefenceForControlled: services.runDefenceForControlled
  });
}

export const registerTowCombatOverlayActionsFromGlobals = registerTowCombatOverlayActionsRuntimeApi;
