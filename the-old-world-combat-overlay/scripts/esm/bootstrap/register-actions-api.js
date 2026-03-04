import { registerTowActionsApi } from "../combat/actions-api-service.js";
import { getTowCombatOverlayActionServices } from "./register-action-services.js";

export function registerTowCombatOverlayActionsApi() {
  const services = getTowCombatOverlayActionServices();
  return registerTowActionsApi({
    attackActor: services.attackActor,
    castActor: services.castActor,
    defenceActor: services.defenceActor,
    runAttackForControlled: services.runAttackForControlled,
    runCastingForControlled: services.runCastingForControlled,
    runDefenceForControlled: services.runDefenceForControlled
  });
}

export const registerTowCombatOverlayActionsFromGlobals = registerTowCombatOverlayActionsApi;
