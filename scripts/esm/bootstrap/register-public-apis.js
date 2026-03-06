import { getTowCombatOverlayConstants } from "../runtime/constants.js";

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
  const { apiKeys, moduleId } = getTowCombatOverlayConstants();
  const moduleState = game?.modules?.get?.(moduleId) ?? null;
  const moduleApi = moduleState
    ? ensureTowCombatOverlayApiObject(moduleState, "api")
    : null;

  if (actionsApi) {
    const sharedActionsApi = resolveTowCombatOverlaySharedApiObject({
      moduleApi,
      moduleKey: apiKeys.actions
    });
    Object.assign(sharedActionsApi, actionsApi);
    if (moduleApi) moduleApi[apiKeys.actions] = sharedActionsApi;
  }

  if (overlayApi) {
    const sharedOverlayApi = resolveTowCombatOverlaySharedApiObject({
      moduleApi,
      moduleKey: apiKeys.overlay
    });
    Object.assign(sharedOverlayApi, overlayApi);
    if (moduleApi) moduleApi[apiKeys.overlay] = sharedOverlayApi;
  }

  return moduleApi;
}

export function getTowCombatOverlayModuleApi() {
  const { moduleId } = getTowCombatOverlayConstants();
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
  return getTowCombatOverlayPublicApi(getTowCombatOverlayConstants().apiKeys.actions);
}

export function getTowCombatOverlayOverlayApi() {
  return getTowCombatOverlayPublicApi(getTowCombatOverlayConstants().apiKeys.overlay);
}
