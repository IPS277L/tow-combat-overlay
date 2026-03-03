import { getTowCombatOverlayOverlayRuntimeConstants } from "../overlay-runtime-constants.js";

const {
  tokenControlPad: TOKEN_CONTROL_PAD,
  overlayTokenBasePx: OVERLAY_TOKEN_BASE_PX,
  overlayScaleMin: OVERLAY_SCALE_MIN,
  overlayScaleMax: OVERLAY_SCALE_MAX,
  overlayScaleExpSmall: OVERLAY_SCALE_EXP_SMALL,
  overlayScaleExpLarge: OVERLAY_SCALE_EXP_LARGE,
  overlayEdgePadMinFactor: OVERLAY_EDGE_PAD_MIN_FACTOR,
  overlayEdgePadExp: OVERLAY_EDGE_PAD_EXP
} = getTowCombatOverlayOverlayRuntimeConstants();

export const towCombatOverlayCanEditActor = globalThis.towCombatOverlayCanEditActor ?? function towCombatOverlayCanEditActorFallback(actor) {
  return actor?.isOwner === true;
};

export const towCombatOverlayWarnNoPermission = globalThis.towCombatOverlayWarnNoPermission ?? function towCombatOverlayWarnNoPermissionFallback(actor) {
  ui.notifications.warn(`No permission to edit ${actor?.name ?? "actor"}.`);
};

export const towCombatOverlayGetActorFromToken = globalThis.towCombatOverlayGetActorFromToken ?? function towCombatOverlayGetActorFromTokenFallback(tokenObject) {
  return tokenObject?.document?.actor ?? null;
};

export const towCombatOverlayAsTokenObject = globalThis.towCombatOverlayAsTokenObject ?? function towCombatOverlayAsTokenObjectFallback(tokenLike) {
  return tokenLike?.object ?? tokenLike ?? null;
};

export const towCombatOverlayForEachSceneToken = globalThis.towCombatOverlayForEachSceneToken ?? function towCombatOverlayForEachSceneTokenFallback(callback) {
  for (const token of canvas.tokens.placeables) callback(token);
};

export const towCombatOverlayForEachActorToken = globalThis.towCombatOverlayForEachActorToken ?? function towCombatOverlayForEachActorTokenFallback(actor, callback) {
  if (!actor) return;
  for (const token of actor.getActiveTokens(true)) {
    const tokenObject = towCombatOverlayAsTokenObject(token);
    if (tokenObject) callback(tokenObject);
  }
};

export const towCombatOverlayGetActorTokenObjects = globalThis.towCombatOverlayGetActorTokenObjects ?? function towCombatOverlayGetActorTokenObjectsFallback(actor) {
  const seen = new Set();
  const tokens = [];
  towCombatOverlayForEachActorToken(actor, (tokenObject) => {
    if (!tokenObject?.id || seen.has(tokenObject.id)) return;
    seen.add(tokenObject.id);
    tokens.push(tokenObject);
  });

  const syntheticToken = towCombatOverlayAsTokenObject(actor?.token);
  if (syntheticToken?.id && !seen.has(syntheticToken.id)) {
    seen.add(syntheticToken.id);
    tokens.push(syntheticToken);
  }

  return tokens;
};

export const towCombatOverlayGetTokenOverlayScale = globalThis.towCombatOverlayGetTokenOverlayScale ?? function towCombatOverlayGetTokenOverlayScaleFallback(tokenObject) {
  const width = Number(tokenObject?.w ?? NaN);
  const height = Number(tokenObject?.h ?? NaN);
  const tokenSize = Math.min(width, height);
  if (!Number.isFinite(tokenSize) || tokenSize <= 0) return 1;
  const ratio = tokenSize / OVERLAY_TOKEN_BASE_PX;
  const curvedScale = ratio < 1
    ? Math.pow(ratio, OVERLAY_SCALE_EXP_SMALL)
    : Math.pow(ratio, OVERLAY_SCALE_EXP_LARGE);
  return Math.max(OVERLAY_SCALE_MIN, Math.min(OVERLAY_SCALE_MAX, curvedScale));
};

export const towCombatOverlayGetOverlayEdgePad = globalThis.towCombatOverlayGetOverlayEdgePad ?? function towCombatOverlayGetOverlayEdgePadFallback(tokenObject) {
  const overlayScale = towCombatOverlayGetTokenOverlayScale(tokenObject);
  const scaledFactor = Math.pow(Math.max(overlayScale, 0.001), OVERLAY_EDGE_PAD_EXP);
  const factor = Math.max(OVERLAY_EDGE_PAD_MIN_FACTOR, Math.min(1, scaledFactor));
  return TOKEN_CONTROL_PAD * factor;
};

export const towCombatOverlayGetOverlayEdgePadPx = globalThis.towCombatOverlayGetOverlayEdgePadPx ?? function towCombatOverlayGetOverlayEdgePadPxFallback(tokenObject) {
  return Math.round(towCombatOverlayGetOverlayEdgePad(tokenObject));
};

export const towCombatOverlayClampNumber = globalThis.towCombatOverlayClampNumber ?? function towCombatOverlayClampNumberFallback(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
};

export const towCombatOverlayRoundTo = globalThis.towCombatOverlayRoundTo ?? function towCombatOverlayRoundToFallback(value, digits = 2) {
  const factor = 10 ** Math.max(0, Number(digits) || 0);
  return Math.round(Number(value) * factor) / factor;
};

export const towCombatOverlayPreventPointerDefault = globalThis.towCombatOverlayPreventPointerDefault ?? function towCombatOverlayPreventPointerDefaultFallback(event) {
  event.stopPropagation();
  event.nativeEvent?.preventDefault?.();
};

export const towCombatOverlayGetMouseButton = globalThis.towCombatOverlayGetMouseButton ?? function towCombatOverlayGetMouseButtonFallback(event) {
  return event.button ?? event.data?.button ?? event.nativeEvent?.button ?? 0;
};

export const towCombatOverlayIsShiftModifier = globalThis.towCombatOverlayIsShiftModifier ?? function towCombatOverlayIsShiftModifierFallback() {
  const shiftKey = foundry.helpers?.interaction?.KeyboardManager?.MODIFIER_KEYS?.SHIFT
    ?? KeyboardManager?.MODIFIER_KEYS?.SHIFT;
  if (!shiftKey) return false;
  return game.keyboard?.isModifierActive?.(shiftKey) === true;
};

export const towCombatOverlayCopyPoint = globalThis.towCombatOverlayCopyPoint ?? function towCombatOverlayCopyPointFallback(point) {
  if (!point) return null;
  return { x: Number(point.x ?? 0), y: Number(point.y ?? 0) };
};

export const towCombatOverlayGetWorldPoint = globalThis.towCombatOverlayGetWorldPoint ?? function towCombatOverlayGetWorldPointFallback(event) {
  if (typeof event?.getLocalPosition === "function" && canvas?.stage) {
    return towCombatOverlayCopyPoint(event.getLocalPosition(canvas.stage));
  }
  if (typeof event?.data?.getLocalPosition === "function" && canvas?.stage) {
    return towCombatOverlayCopyPoint(event.data.getLocalPosition(canvas.stage));
  }
  const global = event?.global ?? event?.data?.global;
  if (global && canvas?.stage?.worldTransform) return towCombatOverlayCopyPoint(canvas.stage.worldTransform.applyInverse(global));
  return towCombatOverlayCopyPoint(canvas.mousePosition);
};

export const towCombatOverlayGetScreenPoint = globalThis.towCombatOverlayGetScreenPoint ?? function towCombatOverlayGetScreenPointFallback(event) {
  return towCombatOverlayCopyPoint(event?.global ?? event?.data?.global ?? null);
};

export const towCombatOverlayGetTooltipPointFromEvent = globalThis.towCombatOverlayGetTooltipPointFromEvent ?? function towCombatOverlayGetTooltipPointFromEventFallback(event) {
  return towCombatOverlayGetScreenPoint(event) ?? towCombatOverlayGetWorldPoint(event);
};

export const towCombatOverlayBindTooltipHandlers = globalThis.towCombatOverlayBindTooltipHandlers ?? function towCombatOverlayBindTooltipHandlersFallback(displayObject, getTooltipData, keyStore = null) {
  if (!displayObject || typeof getTooltipData !== "function") return null;

  const onShow = (event) => {
    const point = towCombatOverlayGetTooltipPointFromEvent(event);
    if (!point) return;
    const data = getTooltipData(event) ?? {};
    const title = data.title ?? data.name ?? "";
    const description = data.description ?? "No description.";
    if (!title) return;
    globalThis.showOverlayTooltip?.(title, description, point);
  };
  const onHide = () => globalThis.hideStatusTooltip?.();

  displayObject.on("pointerover", onShow);
  displayObject.on("pointermove", onShow);
  displayObject.on("pointerout", onHide);
  displayObject.on("pointerupoutside", onHide);
  displayObject.on("pointercancel", onHide);

  if (keyStore?.over) displayObject[keyStore.over] = onShow;
  if (keyStore?.move) displayObject[keyStore.move] = onShow;
  if (keyStore?.out) displayObject[keyStore.out] = onHide;
  return { onShow, onHide };
};

export const towCombatOverlayTokenAtPoint = globalThis.towCombatOverlayTokenAtPoint ?? function towCombatOverlayTokenAtPointFallback(point, { excludeTokenId } = {}) {
  if (!point) return null;
  const globalPoint = canvas?.stage?.worldTransform?.apply?.(point) ?? null;
  const placeables = [...canvas.tokens.placeables];
  for (let i = placeables.length - 1; i >= 0; i--) {
    const token = placeables[i];
    if (!token || token.destroyed || !token.visible) continue;
    if (token.id === excludeTokenId) continue;
    if (typeof token.containsPoint === "function") {
      if (token.containsPoint(point)) return token;
      if (globalPoint && token.containsPoint(globalPoint)) return token;
    }
    if (token.mesh?.containsPoint?.(point)) return token;
    if (globalPoint && token.mesh?.containsPoint?.(globalPoint)) return token;
    if (token.bounds?.contains?.(point.x, point.y)) return token;
    if (point.x >= token.x && point.x <= token.x + token.w && point.y >= token.y && point.y <= token.y + token.h) return token;
  }
  return null;
};

export const towCombatOverlayExecuteFirstMacroByNameCandidates = globalThis.towCombatOverlayExecuteFirstMacroByNameCandidates ?? async function towCombatOverlayExecuteFirstMacroByNameCandidatesFallback(candidates) {
  const macro = candidates
    .map((name) => game.macros.getName(name))
    .find(Boolean);
  if (!macro) return false;
  await macro.execute();
  return true;
};

globalThis.towCombatOverlayCanEditActor = globalThis.towCombatOverlayCanEditActor ?? towCombatOverlayCanEditActor;
globalThis.towCombatOverlayWarnNoPermission = globalThis.towCombatOverlayWarnNoPermission ?? towCombatOverlayWarnNoPermission;
globalThis.towCombatOverlayGetActorFromToken = globalThis.towCombatOverlayGetActorFromToken ?? towCombatOverlayGetActorFromToken;
globalThis.towCombatOverlayAsTokenObject = globalThis.towCombatOverlayAsTokenObject ?? towCombatOverlayAsTokenObject;
globalThis.towCombatOverlayForEachSceneToken = globalThis.towCombatOverlayForEachSceneToken ?? towCombatOverlayForEachSceneToken;
globalThis.towCombatOverlayForEachActorToken = globalThis.towCombatOverlayForEachActorToken ?? towCombatOverlayForEachActorToken;
globalThis.towCombatOverlayGetActorTokenObjects = globalThis.towCombatOverlayGetActorTokenObjects ?? towCombatOverlayGetActorTokenObjects;
globalThis.towCombatOverlayGetTokenOverlayScale = globalThis.towCombatOverlayGetTokenOverlayScale ?? towCombatOverlayGetTokenOverlayScale;
globalThis.towCombatOverlayGetOverlayEdgePad = globalThis.towCombatOverlayGetOverlayEdgePad ?? towCombatOverlayGetOverlayEdgePad;
globalThis.towCombatOverlayGetOverlayEdgePadPx = globalThis.towCombatOverlayGetOverlayEdgePadPx ?? towCombatOverlayGetOverlayEdgePadPx;
globalThis.towCombatOverlayClampNumber = globalThis.towCombatOverlayClampNumber ?? towCombatOverlayClampNumber;
globalThis.towCombatOverlayRoundTo = globalThis.towCombatOverlayRoundTo ?? towCombatOverlayRoundTo;
globalThis.towCombatOverlayPreventPointerDefault = globalThis.towCombatOverlayPreventPointerDefault ?? towCombatOverlayPreventPointerDefault;
globalThis.towCombatOverlayGetMouseButton = globalThis.towCombatOverlayGetMouseButton ?? towCombatOverlayGetMouseButton;
globalThis.towCombatOverlayIsShiftModifier = globalThis.towCombatOverlayIsShiftModifier ?? towCombatOverlayIsShiftModifier;
globalThis.towCombatOverlayCopyPoint = globalThis.towCombatOverlayCopyPoint ?? towCombatOverlayCopyPoint;
globalThis.towCombatOverlayGetWorldPoint = globalThis.towCombatOverlayGetWorldPoint ?? towCombatOverlayGetWorldPoint;
globalThis.towCombatOverlayGetScreenPoint = globalThis.towCombatOverlayGetScreenPoint ?? towCombatOverlayGetScreenPoint;
globalThis.towCombatOverlayGetTooltipPointFromEvent = globalThis.towCombatOverlayGetTooltipPointFromEvent ?? towCombatOverlayGetTooltipPointFromEvent;
globalThis.towCombatOverlayBindTooltipHandlers = globalThis.towCombatOverlayBindTooltipHandlers ?? towCombatOverlayBindTooltipHandlers;
globalThis.towCombatOverlayTokenAtPoint = globalThis.towCombatOverlayTokenAtPoint ?? towCombatOverlayTokenAtPoint;
globalThis.towCombatOverlayExecuteFirstMacroByNameCandidates = globalThis.towCombatOverlayExecuteFirstMacroByNameCandidates ?? towCombatOverlayExecuteFirstMacroByNameCandidates;
