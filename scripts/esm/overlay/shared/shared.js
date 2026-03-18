import {
  MODULE_KEY,
  STATUS_TOOLTIP_BG_ALPHA,
  STATUS_TOOLTIP_BORDER_ALPHA,
  STATUS_TOOLTIP_DOM_CLASS,
  STATUS_TOOLTIP_FONT_SIZE,
  STATUS_TOOLTIP_MAX_WIDTH,
  STATUS_TOOLTIP_OFFSET_X,
  STATUS_TOOLTIP_OFFSET_Y,
  STATUS_TOOLTIP_PAD_X,
  STATUS_TOOLTIP_PAD_Y
} from "../../runtime/overlay-runtime-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/constants.js";

const { tooltips: MODULE_TOOLTIPS } = getTowCombatOverlayConstants();
const TOOLTIP_STATE_KEY = "__towCombatOverlayTooltipState";

function getTooltipState() {
  if (!game) return null;
  if (!game[TOOLTIP_STATE_KEY]) game[TOOLTIP_STATE_KEY] = {};
  return game[TOOLTIP_STATE_KEY];
}

export function towCombatOverlayLocalizeSystemKey(key, fallback = "") {
  const localized = game?.i18n?.localize?.(String(key ?? ""));
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? key ?? "");
}

export function towCombatOverlayResolveConditionLabel(statusId) {
  const id = String(statusId ?? "");
  if (!id) return "";
  const conditionName = game.oldworld?.config?.conditions?.[id]?.name;
  if (typeof conditionName === "string" && conditionName.length > 0) {
    if (conditionName.startsWith("TOW.")) return towCombatOverlayLocalizeSystemKey(conditionName, id);
    return conditionName;
  }
  return towCombatOverlayLocalizeSystemKey(`TOW.ConditionName.${id}`, id);
}

function getActorTypeLabel(actor) {
  const systemType = String(actor?.system?.type ?? "").trim();
  if (systemType) return systemType;
  const actorType = String(actor?.type ?? "").trim();
  if (actorType) return actorType;
  return "actor";
}

function formatTypeTooltipTitle(typeLabel) {
  const raw = String(typeLabel ?? "").trim();
  if (!raw) return "";
  if (raw !== raw.toLowerCase()) return raw;
  return raw
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getMaxWoundLimit(actor) {
  if (!actor || actor.type !== "npc") return null;
  if (actor.system?.type === "minion") return 1;
  if (!actor.system?.hasThresholds) return null;
  const defeatedThreshold = Number(actor.system?.wounds?.defeated?.threshold ?? NaN);
  if (!Number.isFinite(defeatedThreshold) || defeatedThreshold <= 0) return null;
  return defeatedThreshold;
}

export async function runActorOpLock(actor, opKey, operation) {
  const state = game[MODULE_KEY];
  if (!actor || !opKey || typeof operation !== "function") return;
  if (!state) {
    await operation();
    return;
  }
  if (!state.statusRemoveInFlight) state.statusRemoveInFlight = new Set();
  if (!state.statusRemoveQueue) state.statusRemoveQueue = new Map();
  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) {
    await operation();
    return;
  }

  const lockKey = `${actorKey}:${String(opKey)}`;
  const queueKey = actorKey;
  const previous = state.statusRemoveQueue.get(queueKey) ?? Promise.resolve();
  let releaseQueue = null;
  const current = new Promise((resolve) => { releaseQueue = resolve; });
  state.statusRemoveQueue.set(queueKey, current);
  await previous;

  state.statusRemoveInFlight.add(lockKey);
  try {
    await operation();
  } finally {
    state.statusRemoveInFlight.delete(lockKey);
    releaseQueue?.();
    if (state.statusRemoveQueue.get(queueKey) === current) {
      state.statusRemoveQueue.delete(queueKey);
    }
  }
}

export function getTypeTooltipData(actor) {
  const systemType = String(actor?.system?.type ?? "").trim().toLowerCase();
  const fallbackType = String(actor?.type ?? "actor").trim().toLowerCase();
  const typeKey = systemType || fallbackType;
  const npcTypeLabelKey = game.oldworld?.config?.npcType?.[typeKey] ?? null;
  const rawTypeLabel = npcTypeLabelKey
    ? towCombatOverlayLocalizeSystemKey(npcTypeLabelKey, getActorTypeLabel(actor))
    : getActorTypeLabel(actor);
  const typeLabel = formatTypeTooltipTitle(rawTypeLabel);
  const hasThresholds = actor?.type === "npc" && actor.system?.hasThresholds === true;

  if (typeKey === "minion") {
    return { title: typeLabel, description: MODULE_TOOLTIPS.actorType.minionDescription };
  }
  if (typeKey === "champion") {
    return { title: typeLabel, description: MODULE_TOOLTIPS.actorType.championDescription };
  }
  if (hasThresholds) {
    const cap = getMaxWoundLimit(actor);
    const capText = Number.isFinite(cap) ? ` Defeated at ${cap} wounds.` : "";
    return { title: typeLabel, description: `${MODULE_TOOLTIPS.actorType.thresholdDescription}${capText}` };
  }
  if (actor?.type === "npc") {
    return { title: typeLabel, description: MODULE_TOOLTIPS.actorType.standardNpcDescription };
  }
  return { title: typeLabel, description: MODULE_TOOLTIPS.actorType.defaultDescription };
}

function ensureStatusTooltip() {
  const state = getTooltipState();
  if (!state) return null;
  if (state.statusTooltip?.element instanceof HTMLElement && state.statusTooltip.element.isConnected) return state.statusTooltip;

  for (const stale of Array.from(document.querySelectorAll(`.${STATUS_TOOLTIP_DOM_CLASS}`))) {
    stale.remove();
  }

  const element = document.createElement("div");
  element.classList.add(STATUS_TOOLTIP_DOM_CLASS);
  element.style.position = "fixed";
  element.style.left = "0px";
  element.style.top = "0px";
  element.style.display = "none";
  element.style.pointerEvents = "none";
  element.style.zIndex = "12000";
  element.style.maxWidth = `${STATUS_TOOLTIP_MAX_WIDTH}px`;
  element.style.padding = `${STATUS_TOOLTIP_PAD_Y}px ${STATUS_TOOLTIP_PAD_X}px`;
  element.style.borderRadius = "5px";
  element.style.border = `1px solid rgba(193, 139, 44, ${STATUS_TOOLTIP_BORDER_ALPHA})`;
  element.style.background = `rgba(15, 12, 9, ${STATUS_TOOLTIP_BG_ALPHA})`;
  element.style.color = "#f2e7cc";
  element.style.fontFamily = "var(--font-primary, Signika)";
  element.style.fontSize = `${STATUS_TOOLTIP_FONT_SIZE}px`;
  element.style.fontWeight = "400";
  element.style.lineHeight = "1.3";
  element.style.whiteSpace = "normal";

  const title = document.createElement("div");
  title.style.fontSize = `${STATUS_TOOLTIP_FONT_SIZE + 1}px`;
  title.style.fontWeight = "600";
  title.style.color = "#fff4d8";
  title.style.marginBottom = "3px";

  const body = document.createElement("div");
  body.style.fontSize = `${STATUS_TOOLTIP_FONT_SIZE}px`;
  body.style.fontWeight = "400";
  body.style.color = "#f2e7cc";

  element.appendChild(title);
  element.appendChild(body);
  document.body.appendChild(element);
  const view = canvas?.app?.renderer?.events?.domElement ?? canvas?.app?.view ?? null;
  const hideOnLeave = () => hideStatusTooltip();
  const hideOnBlur = () => hideStatusTooltip();
  const hideOnPointerDown = () => hideStatusTooltip();
  const hideOnKeyDown = () => hideStatusTooltip();
  if (view?.addEventListener) view.addEventListener("mouseleave", hideOnLeave);
  window.addEventListener("blur", hideOnBlur);
  window.addEventListener("pointerdown", hideOnPointerDown, true);
  window.addEventListener("keydown", hideOnKeyDown, true);

  state.statusTooltip = { element, title, body, view, hideOnLeave, hideOnBlur, hideOnPointerDown, hideOnKeyDown };
  return state.statusTooltip;
}

function applyTooltipTheme(tooltip, theme = "overlay") {
  if (!tooltip?.element || !tooltip?.title || !tooltip?.body) return;
  const usePanelTheme = String(theme ?? "").toLowerCase() === "panel";
  if (usePanelTheme) {
    tooltip.element.style.border = "1px solid #bdb9ab";
    tooltip.element.style.background = "#f2f1e8";
    tooltip.element.style.color = "#2a2620";
    tooltip.element.style.fontFamily = "\"CaslonPro\", var(--font-primary, Signika), serif";
    tooltip.element.style.fontSize = "16px";
    tooltip.element.style.boxShadow = "0 4px 10px rgba(22, 18, 12, 0.28)";
    tooltip.title.style.color = "#2a2620";
    tooltip.title.style.fontSize = "16px";
    tooltip.title.style.fontWeight = "700";
    tooltip.body.style.color = "#2a2620";
    tooltip.body.style.fontSize = "16px";
    tooltip.body.style.fontWeight = "500";
    return;
  }

  tooltip.element.style.border = `1px solid rgba(193, 139, 44, ${STATUS_TOOLTIP_BORDER_ALPHA})`;
  tooltip.element.style.background = `rgba(15, 12, 9, ${STATUS_TOOLTIP_BG_ALPHA})`;
  tooltip.element.style.color = "#f2e7cc";
  tooltip.element.style.fontFamily = "var(--font-primary, Signika)";
  tooltip.element.style.boxShadow = "none";
  tooltip.title.style.color = "#fff4d8";
  tooltip.body.style.color = "#f2e7cc";
}

export function showOverlayTooltip(title, description, point, existingTooltip = null, options = {}) {
  const tooltip = existingTooltip ?? ensureStatusTooltip();
  if (!tooltip || !point) return;
  const theme = String(options?.theme ?? "overlay");
  const isPanelTheme = theme.toLowerCase() === "panel";
  applyTooltipTheme(tooltip, theme);
  tooltip.title.textContent = String(title ?? "");
  if (options?.descriptionIsHtml === true) {
    tooltip.body.innerHTML = String(description ?? "");
  } else {
    tooltip.body.textContent = String(description ?? "");
  }

  const allowOutsideCanvas = options?.allowOutsideCanvas === true;
  const clientCoordinates = options?.clientCoordinates === true;
  const view = canvas?.app?.renderer?.events?.domElement ?? canvas?.app?.view;
  const rect = view?.getBoundingClientRect?.();

  // Panel tooltips carry long descriptions; prefer wider layout for readability.
  if (isPanelTheme) {
    const widthBasis = Number(rect?.width ?? window.innerWidth);
    const panelMaxWidth = Math.max(220, Math.min(420, Math.round(widthBasis - 24)));
    tooltip.element.style.maxWidth = `${panelMaxWidth}px`;
  } else {
    tooltip.element.style.maxWidth = `${STATUS_TOOLTIP_MAX_WIDTH}px`;
  }

  const baseX = Number(point.x ?? 0) + (clientCoordinates ? 0 : Number(rect?.left ?? 0));
  const baseY = Number(point.y ?? 0) + (clientCoordinates ? 0 : Number(rect?.top ?? 0));
  const clientX = baseX + STATUS_TOOLTIP_OFFSET_X;
  const clientY = baseY + STATUS_TOOLTIP_OFFSET_Y;

  if (!allowOutsideCanvas) {
    const topElement = document.elementFromPoint(clientX, clientY);
    const cursorOnCanvas = !!(view && topElement && (topElement === view || view.contains(topElement)));
    if (!cursorOnCanvas) {
      hideStatusTooltip();
      return;
    }
  }

  tooltip.element.style.left = `${Math.round(clientX)}px`;
  tooltip.element.style.top = `${Math.round(clientY)}px`;
  tooltip.element.style.visibility = "hidden";
  tooltip.element.style.display = "block";

  const tooltipWidth = Math.max(1, Math.round(tooltip.element.offsetWidth || 1));
  const tooltipHeight = Math.max(1, Math.round(tooltip.element.offsetHeight || 1));
  const viewportMargin = 8;
  const bounds = allowOutsideCanvas && !rect
    ? {
      left: viewportMargin,
      top: viewportMargin,
      right: Math.max(viewportMargin, window.innerWidth - viewportMargin),
      bottom: Math.max(viewportMargin, window.innerHeight - viewportMargin)
    }
    : {
      left: Math.round((rect?.left ?? 0) + viewportMargin),
      top: Math.round((rect?.top ?? 0) + viewportMargin),
      right: Math.round((rect?.right ?? window.innerWidth) - viewportMargin),
      bottom: Math.round((rect?.bottom ?? window.innerHeight) - viewportMargin)
    };

  const clamp = (value, min, max) => {
    if (max < min) return min;
    return Math.min(max, Math.max(min, value));
  };

  let finalX = clientX;
  let finalY = clientY;
  if ((finalY + tooltipHeight) > bounds.bottom) {
    finalY = baseY - STATUS_TOOLTIP_OFFSET_Y - tooltipHeight;
  }
  if ((finalX + tooltipWidth) > bounds.right) {
    finalX = baseX - STATUS_TOOLTIP_OFFSET_X - tooltipWidth;
  }

  finalX = clamp(finalX, bounds.left, bounds.right - tooltipWidth);
  finalY = clamp(finalY, bounds.top, bounds.bottom - tooltipHeight);

  tooltip.element.style.left = `${Math.round(finalX)}px`;
  tooltip.element.style.top = `${Math.round(finalY)}px`;
  tooltip.element.style.visibility = "visible";
}

export function hideStatusTooltip() {
  for (const element of Array.from(document.querySelectorAll(`.${STATUS_TOOLTIP_DOM_CLASS}`))) {
    if (element instanceof HTMLElement) element.style.display = "none";
  }
  const state = getTooltipState();
  const element = state?.statusTooltip?.element;
  if (element instanceof HTMLElement) element.style.display = "none";
}

export function clearStatusTooltip() {
  const state = getTooltipState();
  if (!state?.statusTooltip) return;
  const view = state.statusTooltip.view;
  const hideOnLeave = state.statusTooltip.hideOnLeave;
  const hideOnBlur = state.statusTooltip.hideOnBlur;
  const hideOnPointerDown = state.statusTooltip.hideOnPointerDown;
  const hideOnKeyDown = state.statusTooltip.hideOnKeyDown;
  if (view?.removeEventListener && hideOnLeave) view.removeEventListener("mouseleave", hideOnLeave);
  if (hideOnBlur) window.removeEventListener("blur", hideOnBlur);
  if (hideOnPointerDown) window.removeEventListener("pointerdown", hideOnPointerDown, true);
  if (hideOnKeyDown) window.removeEventListener("keydown", hideOnKeyDown, true);
  const element = state.statusTooltip.element;
  if (element instanceof HTMLElement) element.remove();
  for (const stale of Array.from(document.querySelectorAll(`.${STATUS_TOOLTIP_DOM_CLASS}`))) {
    stale.remove();
  }
  delete state.statusTooltip;
  if (game && Object.prototype.hasOwnProperty.call(game, TOOLTIP_STATE_KEY)) {
    const tooltipState = game[TOOLTIP_STATE_KEY];
    if (!tooltipState?.statusTooltip) delete game[TOOLTIP_STATE_KEY];
  }
}
