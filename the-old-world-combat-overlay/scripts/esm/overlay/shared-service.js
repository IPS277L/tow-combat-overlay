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
} from "../overlay-runtime-constants.js";

function getActorTypeLabel(actor) {
  const systemType = String(actor?.system?.type ?? "").trim();
  if (systemType) return systemType;
  const actorType = String(actor?.type ?? "").trim();
  if (actorType) return actorType;
  return "actor";
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
  if (!state || !actor || !opKey || typeof operation !== "function") return;
  if (!state.statusRemoveInFlight) state.statusRemoveInFlight = new Set();
  if (!state.statusRemoveQueue) state.statusRemoveQueue = new Map();
  const actorKey = actor.uuid ?? actor.id;
  if (!actorKey) return;

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
  const typeLabel = npcTypeLabelKey ? game.i18n.localize(npcTypeLabelKey) : getActorTypeLabel(actor);

  if (typeKey === "minion") {
    return { title: typeLabel, description: "Minions are defeated at 1 wound." };
  }
  if (["brute", "champion", "monstrosity"].includes(typeKey)) {
    const cap = getMaxWoundLimit(actor);
    const capText = Number.isFinite(cap) ? ` Defeated at ${cap} wounds.` : "";
    return { title: typeLabel, description: `Threshold-based NPC type.${capText}` };
  }
  return { title: typeLabel, description: "Actor type." };
}

function ensureStatusTooltip() {
  const state = game[MODULE_KEY];
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
  element.style.zIndex = "10000";
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

export function showOverlayTooltip(title, description, point, existingTooltip = null) {
  const tooltip = existingTooltip ?? ensureStatusTooltip();
  if (!tooltip || !point) return;
  tooltip.title.textContent = String(title ?? "");
  tooltip.body.textContent = String(description ?? "");

  const view = canvas?.app?.renderer?.events?.domElement ?? canvas?.app?.view;
  const rect = view?.getBoundingClientRect?.();
  const clientX = Number(point.x ?? 0) + Number(rect?.left ?? 0) + STATUS_TOOLTIP_OFFSET_X;
  const clientY = Number(point.y ?? 0) + Number(rect?.top ?? 0) + STATUS_TOOLTIP_OFFSET_Y;

  const topElement = document.elementFromPoint(clientX, clientY);
  const cursorOnCanvas = !!(view && topElement && (topElement === view || view.contains(topElement)));
  if (!cursorOnCanvas) {
    hideStatusTooltip();
    return;
  }

  tooltip.element.style.left = `${Math.round(clientX)}px`;
  tooltip.element.style.top = `${Math.round(clientY)}px`;
  tooltip.element.style.display = "block";
}

export function hideStatusTooltip() {
  for (const element of Array.from(document.querySelectorAll(`.${STATUS_TOOLTIP_DOM_CLASS}`))) {
    if (element instanceof HTMLElement) element.style.display = "none";
  }
  const state = game[MODULE_KEY];
  const element = state?.statusTooltip?.element;
  if (element instanceof HTMLElement) element.style.display = "none";
}

export function clearStatusTooltip() {
  const state = game[MODULE_KEY];
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
}
