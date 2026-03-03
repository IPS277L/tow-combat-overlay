import { getTowCombatOverlayModuleConstants } from "./constants.js";

function ensureTowCombatOverlayApiObject(hostObject, key) {
  if (!hostObject || !key) return null;
  const current = hostObject[key];
  if (current && typeof current === "object") return current;
  const next = {};
  hostObject[key] = next;
  return next;
}

function resolveTowCombatOverlaySharedApiObject({
  moduleApi = null,
  moduleKey = ""
} = {}) {
  const moduleObject = (moduleApi && moduleKey) ? moduleApi[moduleKey] : null;
  if (moduleObject && typeof moduleObject === "object") return moduleObject;
  return {};
}

export function registerTowCombatOverlayPublicApis({
  actionsApi = null,
  overlayApi = null
} = {}) {
  const { moduleId } = getTowCombatOverlayModuleConstants();
  const moduleState = game?.modules?.get?.(moduleId) ?? null;
  const moduleApi = moduleState
    ? ensureTowCombatOverlayApiObject(moduleState, "api")
    : null;

  if (actionsApi) {
    const sharedActionsApi = resolveTowCombatOverlaySharedApiObject({
      moduleApi,
      moduleKey: "towActions"
    });
    Object.assign(sharedActionsApi, actionsApi);
    if (moduleApi) moduleApi.towActions = sharedActionsApi;
  }

  if (overlayApi) {
    const sharedOverlayApi = resolveTowCombatOverlaySharedApiObject({
      moduleApi,
      moduleKey: "towOverlay"
    });
    Object.assign(sharedOverlayApi, overlayApi);
    if (moduleApi) moduleApi.towOverlay = sharedOverlayApi;
  }
}

export function getTowCombatOverlayModuleApi() {
  const { moduleId } = getTowCombatOverlayModuleConstants();
  return game?.modules?.get?.(moduleId)?.api ?? null;
}

export function getTowCombatOverlayPublicApi(apiKey) {
  const key = String(apiKey ?? "").trim();
  if (!key) return null;

  const moduleApi = getTowCombatOverlayModuleApi()?.[key] ?? null;
  if (moduleApi && typeof moduleApi === "object") return moduleApi;

  return null;
}

export function getTowCombatOverlayActionsApi() {
  return getTowCombatOverlayPublicApi("towActions");
}

export function getTowCombatOverlayOverlayApi() {
  return getTowCombatOverlayPublicApi("towOverlay");
}

export function syncTowCombatOverlayPublicApisFromGlobals() {
  registerTowCombatOverlayPublicApis({
    actionsApi: getTowCombatOverlayActionsApi(),
    overlayApi: getTowCombatOverlayOverlayApi()
  });
}
