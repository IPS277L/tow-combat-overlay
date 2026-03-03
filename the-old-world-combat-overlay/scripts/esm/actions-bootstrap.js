import { getTowCombatOverlayActionServices } from "./register-action-services.js";
import { registerTowActionsApi } from "./public-api-service.js";

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
