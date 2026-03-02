const isShiftHeld = globalThis.towCombatOverlayIsShiftHeld;
const escapeHtml = globalThis.towCombatOverlayEscapeHtml;
const toElement = globalThis.towCombatOverlayToElement;
const scheduleSoon = globalThis.towCombatOverlayScheduleSoon;

function createTowActionsApi(overrides = {}) {
  return {
    version: TOW_ACTIONS_VERSION,
    isShiftHeld,
    escapeHtml,
    toElement,
    scheduleSoon,
    systemAdapter: globalThis.getTowCombatOverlaySystemAdapter?.() ?? null,
    ...overrides
  };
}

function registerTowActionsApi(apiOverrides = {}) {
  const nextApi = createTowActionsApi(apiOverrides);
  const targetApi = (game[TOW_ACTIONS_KEY] && typeof game[TOW_ACTIONS_KEY] === "object")
    ? game[TOW_ACTIONS_KEY]
    : {};
  Object.assign(targetApi, nextApi);
  game[TOW_ACTIONS_KEY] = targetApi;

  if (typeof globalThis.registerTowCombatOverlayPublicApis === "function") {
    globalThis.registerTowCombatOverlayPublicApis({
      actionsApi: targetApi
    });
  }

  return targetApi;
}

globalThis.registerTowActionsApi = registerTowActionsApi;

const towCombatOverlayActionServices = getTowCombatOverlayActionServices();

registerTowActionsApi({
  attackActor: towCombatOverlayActionServices.attackActor,
  castActor: towCombatOverlayActionServices.castActor,
  defenceActor: towCombatOverlayActionServices.defenceActor,
  runAttackForControlled: towCombatOverlayActionServices.runAttackForControlled,
  runCastingForControlled: towCombatOverlayActionServices.runCastingForControlled,
  runDefenceForControlled: towCombatOverlayActionServices.runDefenceForControlled
});
