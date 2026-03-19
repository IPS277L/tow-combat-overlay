import { towCombatOverlayRenderTemplate } from "../../combat/core.js";
import {
  hideStatusTooltip,
  showOverlayTooltip,
  towCombatOverlayLocalizeSystemKey
} from "../shared/shared.js";
import {
  getActorStatusSet,
  getAllConditionEntries
} from "../panel/shared/status.js";
import {
  resolveTemporaryEffectDescription
} from "../panel/shared/description.js";
import {
  clampTopPanelCoordinate,
  readSavedTopPanelDragUnlocked,
  readSavedTopPanelPosition,
  readSavedTopPanelTokenOrder,
  writeSavedTopPanelDragUnlocked,
  writeSavedTopPanelPosition,
  writeSavedTopPanelTokenOrder
} from "./top-panel-state.js";

const TOP_PANEL_ID = "tow-combat-overlay-top-panel";
const TOP_PANEL_STATE_KEY = "__towCombatOverlayTopPanelState";
const TOP_PANEL_TEMPLATE_PATH = "modules/tow-combat-overlay/templates/overlay/top-panel.hbs";
const TOP_PANEL_VIEWPORT_MARGIN_PX = 8;

const TOP_PANEL_HOOKS = Object.freeze([
  "canvasReady",
  "controlToken",
  "createToken",
  "updateToken",
  "deleteToken",
  "refreshToken",
  "updateActor",
  "createActor",
  "deleteActor"
]);
const TOP_PANEL_CHIP_TOOLTIP_FALLBACK = "No description.";
const TOP_PANEL_CHIP_MAX_PER_ROW = 14;
const TOP_PANEL_CHIP_MAX_ROWS_IN_PORTRAIT = 2;
const TOP_PANEL_CHIP_MIN_SIZE_PX = 10;
const TOP_PANEL_CHIP_FALLBACK_SIZE_PX = 27;
const TOP_PANEL_CHIP_FALLBACK_GAP_PX = 1;

function getTopPanelState() {
  if (!game) return null;
  if (!game[TOP_PANEL_STATE_KEY]) game[TOP_PANEL_STATE_KEY] = {};
  return game[TOP_PANEL_STATE_KEY];
}

function localizeMaybe(key, fallback = "") {
  const localized = game?.i18n?.localize?.(String(key ?? ""));
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? key ?? "");
}

function removeStaleTopPanels() {
  for (const panel of Array.from(document.querySelectorAll(`#${TOP_PANEL_ID}`))) {
    if (panel instanceof HTMLElement) panel.remove();
  }
}

function getCanvasClientBounds(viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX) {
  const canvasView = canvas?.app?.view;
  const rect = (canvasView instanceof HTMLElement)
    ? canvasView.getBoundingClientRect()
    : null;

  if (!rect) {
    return {
      left: viewportMarginPx,
      top: viewportMarginPx,
      right: window.innerWidth - viewportMarginPx,
      bottom: window.innerHeight - viewportMarginPx,
      width: Math.max(1, window.innerWidth - (viewportMarginPx * 2)),
      height: Math.max(1, window.innerHeight - (viewportMarginPx * 2))
    };
  }

  const left = Math.max(viewportMarginPx, Math.round(rect.left + viewportMarginPx));
  const top = Math.max(viewportMarginPx, Math.round(rect.top + viewportMarginPx));
  const right = Math.min(window.innerWidth - viewportMarginPx, Math.round(rect.right - viewportMarginPx));
  const bottom = Math.min(window.innerHeight - viewportMarginPx, Math.round(rect.bottom - viewportMarginPx));
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function syncTopPanelWidth(panelElement, viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX) {
  if (!(panelElement instanceof HTMLElement)) return;
  const bounds = getCanvasClientBounds(viewportMarginPx);
  panelElement.style.maxWidth = `${Math.max(1, Math.round(bounds.width))}px`;
}

function syncTopPanelListBottomPadding(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return;
  const listElement = panelElement.querySelector(".tow-combat-overlay-top-panel__list");
  if (!(listElement instanceof HTMLElement)) return;

  let maxExtraBottom = 0;
  const portraits = Array.from(listElement.querySelectorAll(".tow-combat-overlay-top-panel__portrait"));
  for (const portrait of portraits) {
    if (!(portrait instanceof HTMLElement)) continue;
    const chips = portrait.querySelector(".tow-combat-overlay-top-panel__chips");
    if (!(chips instanceof HTMLElement)) continue;
    const portraitRect = portrait.getBoundingClientRect();
    const chipsRect = chips.getBoundingClientRect();
    const extraBottom = Math.max(0, chipsRect.bottom - portraitRect.bottom);
    if (extraBottom > maxExtraBottom) maxExtraBottom = extraBottom;
  }

  listElement.style.paddingBottom = `${Math.ceil(maxExtraBottom)}px`;
}

function readCssPixelValue(element, variableName, fallbackValue) {
  if (!(element instanceof HTMLElement)) return fallbackValue;
  const raw = String(getComputedStyle(element).getPropertyValue(variableName) ?? "").trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function syncTopPanelPortraitChipSizing(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return;
  const listElement = panelElement.querySelector(".tow-combat-overlay-top-panel__list");
  if (!(listElement instanceof HTMLElement)) return;

  const defaultChipSize = readCssPixelValue(panelElement, "--tow-top-panel-chip-size", TOP_PANEL_CHIP_FALLBACK_SIZE_PX);
  const chipGap = readCssPixelValue(panelElement, "--tow-top-panel-chip-gap", TOP_PANEL_CHIP_FALLBACK_GAP_PX);
  const maxRows = Math.max(1, TOP_PANEL_CHIP_MAX_ROWS_IN_PORTRAIT);

  const portraits = Array.from(listElement.querySelectorAll(".tow-combat-overlay-top-panel__portrait"));
  for (const portrait of portraits) {
    if (!(portrait instanceof HTMLElement)) continue;
    const chipsLayer = portrait.querySelector(".tow-combat-overlay-top-panel__chips");
    if (!(chipsLayer instanceof HTMLElement)) continue;
    const chips = Array.from(chipsLayer.querySelectorAll(".tow-combat-overlay-top-panel__chip"));
    const chipCount = chips.length;
    if (!chipCount) {
      chipsLayer.style.removeProperty("--tow-top-panel-chip-size-local");
      continue;
    }

    const availableWidth = Math.max(1, portrait.clientWidth);
    const neededColumns = Math.max(1, Math.ceil(chipCount / maxRows));
    const sizeToFitRows = Math.floor((availableWidth - ((neededColumns - 1) * chipGap)) / neededColumns);
    const resolvedSize = Math.max(
      TOP_PANEL_CHIP_MIN_SIZE_PX,
      Math.min(defaultChipSize, sizeToFitRows)
    );

    chipsLayer.style.setProperty("--tow-top-panel-chip-size-local", `${resolvedSize}px`);
  }
}

function getTopPanelBounds(panelElement, viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX) {
  const rect = panelElement.getBoundingClientRect();
  const canvasBounds = getCanvasClientBounds(viewportMarginPx);
  const panelWidth = Math.max(1, Math.round(rect.width || panelElement.offsetWidth || 1));
  const panelHeight = Math.max(1, Math.round(rect.height || panelElement.offsetHeight || 1));
  return {
    minLeft: canvasBounds.left,
    minTop: canvasBounds.top,
    maxLeft: canvasBounds.right - panelWidth,
    maxTop: canvasBounds.bottom - panelHeight
  };
}

function applyTopPanelPosition(panelElement, left, top, viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX) {
  const bounds = getTopPanelBounds(panelElement, viewportMarginPx);
  const safeLeft = clampTopPanelCoordinate(left, bounds.minLeft, bounds.maxLeft);
  const safeTop = clampTopPanelCoordinate(top, bounds.minTop, bounds.maxTop);
  panelElement.style.left = `${Math.round(safeLeft)}px`;
  panelElement.style.top = `${Math.round(safeTop)}px`;
}

function applyInitialTopPanelPosition(panelElement, viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX) {
  syncTopPanelWidth(panelElement, viewportMarginPx);
  const saved = readSavedTopPanelPosition();
  if (saved) {
    applyTopPanelPosition(panelElement, saved.left, saved.top, viewportMarginPx);
    return;
  }

  applyDefaultTopPanelPosition(panelElement, viewportMarginPx);
}

function applyDefaultTopPanelPosition(panelElement, viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX) {
  const rect = panelElement.getBoundingClientRect();
  const canvasBounds = getCanvasClientBounds(viewportMarginPx);
  const panelWidth = Math.max(1, Math.round(rect.width || panelElement.offsetWidth || 1));
  const defaultLeft = Math.round(canvasBounds.left + ((canvasBounds.width - panelWidth) / 2));
  applyTopPanelPosition(panelElement, defaultLeft, canvasBounds.top, viewportMarginPx);
}

function getSceneTokens() {
  const placeables = Array.isArray(canvas?.tokens?.placeables)
    ? canvas.tokens.placeables
    : [];

  return placeables
    .filter((token) => token && !token.destroyed)
    .filter((token) => {
      const tokenId = String(token.id ?? "").trim();
      if (!tokenId) return false;
      const actor = token.actor ?? token.document?.actor;
      if (!actor) return false;
      return token.visible !== false;
    });
}

function getCurrentSceneId() {
  return String(canvas?.scene?.id ?? "").trim();
}

function getOrderedSceneTokens() {
  const tokens = getSceneTokens();
  const sceneId = getCurrentSceneId();
  if (!sceneId || !tokens.length) return tokens;

  const byId = new Map(tokens.map((token) => [String(token.id), token]));
  const savedOrder = readSavedTopPanelTokenOrder(sceneId) ?? [];
  const ordered = [];

  for (const tokenId of savedOrder) {
    const token = byId.get(String(tokenId));
    if (!token) continue;
    ordered.push(token);
    byId.delete(String(tokenId));
  }

  const remaining = Array.from(byId.values())
    .sort((left, right) => Number(left?.document?.sort ?? 0) - Number(right?.document?.sort ?? 0));

  return [...ordered, ...remaining];
}

function moveTokenBeforeTarget(tokenIds, sourceId, targetId) {
  const source = String(sourceId ?? "").trim();
  const target = String(targetId ?? "").trim();
  if (!source || !target || source === target) return tokenIds;

  const ids = Array.isArray(tokenIds)
    ? tokenIds.map((entry) => String(entry ?? "").trim()).filter(Boolean)
    : [];
  const sourceIndex = ids.indexOf(source);
  const targetIndex = ids.indexOf(target);
  if (sourceIndex < 0 || targetIndex < 0) return ids;

  const [dragged] = ids.splice(sourceIndex, 1);
  const nextTargetIndex = ids.indexOf(target);
  ids.splice(Math.max(0, nextTargetIndex), 0, dragged);
  return ids;
}

function getTokenPortraitSrc(token) {
  const textureSrc = String(token?.document?.texture?.src ?? "").trim();
  if (textureSrc) return textureSrc;
  return String(token?.actor?.img ?? token?.document?.actor?.img ?? "icons/svg/mystery-man.svg").trim();
}

function resolveTokenDispositionClass(token) {
  const disposition = Number(token?.document?.disposition ?? 0);
  if (disposition > 0) return "is-friendly";
  if (disposition < 0) return "is-hostile";
  return "is-neutral";
}

function normalizeCanvasColorToCss(value) {
  const toDimmedRgba = (red, green, blue, alpha = 0.9, factor = 0.72) => {
    const r = Math.max(0, Math.min(255, Math.round(Number(red) * factor)));
    const g = Math.max(0, Math.min(255, Math.round(Number(green) * factor)));
    const b = Math.max(0, Math.min(255, Math.round(Number(blue) * factor)));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  if (typeof value === "number" && Number.isFinite(value)) {
    const clamped = Math.max(0, Math.min(0xFFFFFF, Math.trunc(value)));
    const red = (clamped >> 16) & 0xFF;
    const green = (clamped >> 8) & 0xFF;
    const blue = clamped & 0xFF;
    return toDimmedRgba(red, green, blue);
  }

  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("#")) {
    const hex = raw.slice(1);
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      const parsed = Number.parseInt(hex, 16);
      const red = (parsed >> 16) & 0xFF;
      const green = (parsed >> 8) & 0xFF;
      const blue = parsed & 0xFF;
      return toDimmedRgba(red, green, blue);
    }
    return raw;
  }
  if (raw.startsWith("rgb") || raw.startsWith("hsl") || raw.startsWith("var(")) return raw;
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    const parsed = Number.parseInt(raw, 16);
    const red = (parsed >> 16) & 0xFF;
    const green = (parsed >> 8) & 0xFF;
    const blue = parsed & 0xFF;
    return toDimmedRgba(red, green, blue);
  }
  return "";
}

function resolveNaturalTokenBorderColor(token) {
  const dispositionColors = CONFIG?.Canvas?.dispositionColors ?? {};
  const disposition = Number(token?.document?.disposition ?? 0);
  const isControlled = token?.controlled === true;
  const rawColor = isControlled
    ? dispositionColors.CONTROLLED
    : (disposition > 0 ? dispositionColors.FRIENDLY : (disposition < 0 ? dispositionColors.HOSTILE : dispositionColors.NEUTRAL));
  return normalizeCanvasColorToCss(rawColor);
}

function getConditionEntryLookup() {
  const entries = getAllConditionEntries();
  const map = new Map();
  for (const entry of entries) {
    const key = String(entry?.id ?? "").trim();
    if (!key) continue;
    map.set(key, entry);
  }
  return { entries, map };
}

function getActiveConditionChips(actor) {
  if (!actor) return [];
  const { entries } = getConditionEntryLookup();
  const activeStatusSet = getActorStatusSet(actor);
  if (!activeStatusSet.size) return [];

  const chips = [];
  for (const entry of entries) {
    const id = String(entry.id ?? "").trim();
    if (!id || !activeStatusSet.has(id)) continue;
    const conditionData = game?.oldworld?.config?.conditions?.[id] ?? {};
    const rawDescription = String(conditionData?.description ?? "").trim();
    const description = rawDescription.startsWith("TOW.")
      ? towCombatOverlayLocalizeSystemKey(rawDescription, "")
      : rawDescription;
    chips.push({
      type: "condition",
      key: `condition:${id}`,
      title: String(entry.label ?? id),
      description: description || TOP_PANEL_CHIP_TOOLTIP_FALLBACK,
      img: String(entry.img ?? "").trim()
    });
  }

  return chips;
}

function getTemporaryEffectChips(actor) {
  if (!actor) return [];
  const conditionKeys = new Set(
    Object.keys(game?.oldworld?.config?.conditions ?? {}).map((key) => String(key ?? "").toLowerCase())
  );

  return Array.from(actor?.effects?.contents ?? [])
    .filter((effect) => {
      if (!effect) return false;
      if (effect.disabled || effect.isSuppressed) return false;
      if (effect.transfer) return false;
      const statuses = Array.from(effect.statuses ?? []).map((status) => String(status ?? "").toLowerCase());
      if (statuses.some((status) => conditionKeys.has(status))) return false;
      return true;
    })
    .sort((left, right) => Number(left?.sort ?? 0) - Number(right?.sort ?? 0))
    .map((effect) => ({
      type: "effect",
      key: `effect:${String(effect?.id ?? "")}`,
      title: String(effect?.name ?? localizeMaybe("TOWCOMBATOVERLAY.Label.Condition", "Condition")).trim(),
      description: resolveTemporaryEffectDescription(effect) || TOP_PANEL_CHIP_TOOLTIP_FALLBACK,
      img: String(effect?.img ?? effect?.icon ?? "icons/svg/aura.svg").trim()
    }));
}

function limitChipList(items, maxCount = TOP_PANEL_CHIP_MAX_PER_ROW, overflowType = "overflow") {
  const list = Array.isArray(items) ? items : [];
  if (list.length <= maxCount) return list;
  const visible = list.slice(0, maxCount);
  const overflowCount = list.length - maxCount;
  visible.push({
    type: overflowType,
    key: `overflow:${overflowType}:${overflowCount}`,
    title: `+${overflowCount}`,
    description: `+${overflowCount} more`,
    img: ""
  });
  return visible;
}

function createTopPanelChipElement(chip) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("tow-combat-overlay-top-panel__chip", `is-${String(chip?.type ?? "ability")}`);
  button.dataset.chipType = String(chip?.type ?? "ability");
  button.dataset.tooltipTitle = String(chip?.title ?? "").trim();
  button.dataset.tooltipDescription = String(chip?.description ?? TOP_PANEL_CHIP_TOOLTIP_FALLBACK).trim();
  button.setAttribute("aria-label", button.dataset.tooltipTitle || "Info");
  button.setAttribute("title", button.dataset.tooltipTitle || "Info");

  const chipImage = String(chip?.img ?? "").trim();
  if (chipImage) {
    const image = document.createElement("img");
    image.classList.add("tow-combat-overlay-top-panel__chip-image");
    image.src = chipImage;
    image.alt = "";
    button.appendChild(image);
  } else {
    const text = document.createElement("span");
    text.classList.add("tow-combat-overlay-top-panel__chip-text");
    text.textContent = String(chip?.title ?? "").trim() || "?";
    button.appendChild(text);
  }

  return button;
}

function createTopPanelChipGroup(groupKey, chips = []) {
  const groupElement = document.createElement("div");
  groupElement.classList.add("tow-combat-overlay-top-panel__chip-group", `is-${groupKey}`);
  for (const chip of chips) {
    groupElement.appendChild(createTopPanelChipElement(chip));
  }
  return groupElement;
}

function selectTokenFromTopPanel(tokenId, event) {
  const token = canvas?.tokens?.get?.(String(tokenId ?? "").trim()) ?? null;
  if (!token || token.destroyed) return;

  const shouldKeepOthers =
    event?.shiftKey === true
    || event?.ctrlKey === true
    || event?.metaKey === true;

  if (!shouldKeepOthers && typeof canvas?.tokens?.releaseAll === "function") {
    canvas.tokens.releaseAll();
  }

  token.control({
    releaseOthers: !shouldKeepOthers
  });
}

function buildPortraitElement(token) {
  const portrait = document.createElement("button");
  portrait.type = "button";
  portrait.classList.add("tow-combat-overlay-top-panel__portrait", resolveTokenDispositionClass(token));
  if (token.controlled === true) portrait.classList.add("is-controlled");
  if (token.actor?.hasCondition?.("dead")) portrait.classList.add("is-dead");

  portrait.dataset.tokenId = String(token.id ?? "").trim();
  portrait.draggable = true;
  portrait.setAttribute("aria-label", String(token.name ?? token.actor?.name ?? "Token"));
  portrait.setAttribute("title", String(token.name ?? token.actor?.name ?? "Token"));
  const naturalBorderColor = resolveNaturalTokenBorderColor(token);
  if (naturalBorderColor) {
    portrait.style.setProperty("--tow-top-panel-token-border-color", naturalBorderColor);
  }

  const image = document.createElement("img");
  image.classList.add("tow-combat-overlay-top-panel__portrait-image");
  image.src = getTokenPortraitSrc(token);
  image.alt = String(token.name ?? token.actor?.name ?? "Token");
  portrait.appendChild(image);

  const actor = token.actor ?? token.document?.actor ?? null;
  if (actor) {
    const conditionChips = getActiveConditionChips(actor);
    const effectChips = getTemporaryEffectChips(actor);
    const allChips = limitChipList(
      [...conditionChips, ...effectChips],
      TOP_PANEL_CHIP_MAX_PER_ROW,
      "row-overflow"
    );
    const hasAnyChips = allChips.length;
    if (hasAnyChips) {
      const chipsLayer = document.createElement("div");
      chipsLayer.classList.add("tow-combat-overlay-top-panel__chips");
      chipsLayer.appendChild(createTopPanelChipGroup("status-effects", allChips));
      portrait.appendChild(chipsLayer);
    }
  }

  return portrait;
}

function bindTopPanelElementEvents(topPanelElement) {
  const state = getTopPanelState();
  if (!state) return;
  if (typeof state.panelDragUnlocked !== "boolean") {
    state.panelDragUnlocked = readSavedTopPanelDragUnlocked();
  }

  const lockButton = topPanelElement.querySelector("[data-action='toggle-panel-drag-lock']");
  const resetButton = topPanelElement.querySelector("[data-action='reset-panel-position']");

  const syncDragControls = () => {
    const unlocked = state.panelDragUnlocked !== false;
    topPanelElement.classList.toggle("is-drag-locked", !unlocked);
    if (lockButton instanceof HTMLButtonElement) {
      lockButton.dataset.state = unlocked ? "unlocked" : "locked";
      lockButton.setAttribute("aria-pressed", unlocked ? "true" : "false");
      lockButton.setAttribute("aria-label", unlocked ? "Lock panel movement" : "Unlock panel movement");
      const icon = lockButton.querySelector(".tow-combat-overlay-top-panel__control-toggle-icon");
      if (icon instanceof HTMLElement) icon.textContent = unlocked ? "U" : "L";
    }
  };

  let panelDragData = null;

  const onPanelPointerMove = (event) => {
    if (!panelDragData) return;
    const deltaX = Number(event.clientX) - panelDragData.startClientX;
    const deltaY = Number(event.clientY) - panelDragData.startClientY;
    applyTopPanelPosition(topPanelElement, panelDragData.startLeft + deltaX, panelDragData.startTop + deltaY);
  };

  const onPanelPointerUp = () => {
    if (!panelDragData) return;
    panelDragData = null;
    topPanelElement.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onPanelPointerMove);
    window.removeEventListener("pointerup", onPanelPointerUp);
    window.removeEventListener("pointercancel", onPanelPointerUp);
    writeSavedTopPanelPosition(topPanelElement);
  };

  const onPanelPointerDown = (event) => {
    if (event.button !== 0) return;
    if (state.panelDragUnlocked === false) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".tow-combat-overlay-top-panel__control-button")) return;
    const portraitTarget = target.closest(".tow-combat-overlay-top-panel__portrait");
    if (portraitTarget && event.shiftKey !== true) return;

    event.preventDefault();
    const rect = topPanelElement.getBoundingClientRect();
    panelDragData = {
      startClientX: Number(event.clientX),
      startClientY: Number(event.clientY),
      startLeft: Number(rect.left),
      startTop: Number(rect.top)
    };
    topPanelElement.classList.add("is-dragging");
    window.addEventListener("pointermove", onPanelPointerMove);
    window.addEventListener("pointerup", onPanelPointerUp);
    window.addEventListener("pointercancel", onPanelPointerUp);
  };

  const onResize = () => {
    syncTopPanelWidth(topPanelElement);
    syncTopPanelPortraitChipSizing(topPanelElement);
    syncTopPanelListBottomPadding(topPanelElement);
    const rect = topPanelElement.getBoundingClientRect();
    applyTopPanelPosition(topPanelElement, rect.left, rect.top);
  };

  state.onPanelPointerDown = onPanelPointerDown;
  state.onPanelPointerMove = onPanelPointerMove;
  state.onPanelPointerUp = onPanelPointerUp;
  state.onResize = onResize;

  topPanelElement.addEventListener("pointerdown", onPanelPointerDown);
  window.addEventListener("resize", onResize);
  syncDragControls();

  if (lockButton instanceof HTMLButtonElement) {
    lockButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.panelDragUnlocked = !state.panelDragUnlocked;
      writeSavedTopPanelDragUnlocked(state.panelDragUnlocked);
      syncDragControls();
    });
  }

  if (resetButton instanceof HTMLButtonElement) {
    resetButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyDefaultTopPanelPosition(topPanelElement);
      writeSavedTopPanelPosition(topPanelElement);
    });
  }

  topPanelElement.addEventListener("click", (event) => {
    const liveState = getTopPanelState();
    if (!liveState) return;
    if (liveState.suppressNextClick === true) {
      liveState.suppressNextClick = false;
      return;
    }
    const portrait = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__portrait")
      : null;
    if (!(portrait instanceof HTMLElement)) return;
    event.preventDefault();
    selectTokenFromTopPanel(portrait.dataset.tokenId, event);
  });

  const onChipTooltipShow = (event) => {
    const chipElement = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__chip")
      : null;
    if (!(chipElement instanceof HTMLElement)) return;
    const title = String(chipElement.dataset.tooltipTitle ?? "").trim();
    if (!title) return;
    const description = String(chipElement.dataset.tooltipDescription ?? "").trim() || TOP_PANEL_CHIP_TOOLTIP_FALLBACK;
    showOverlayTooltip(title, description, { x: event.clientX, y: event.clientY }, null, {
      allowOutsideCanvas: true,
      clientCoordinates: true,
      theme: "panel",
      descriptionIsHtml: true
    });
  };

  const onChipTooltipHide = (event) => {
    const chipElement = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__chip")
      : null;
    if (!(chipElement instanceof HTMLElement)) return;
    const next = event.relatedTarget;
    if (next instanceof Element && next.closest(".tow-combat-overlay-top-panel__chip") === chipElement) return;
    hideStatusTooltip();
  };

  topPanelElement.addEventListener("pointerover", onChipTooltipShow);
  topPanelElement.addEventListener("pointermove", onChipTooltipShow);
  topPanelElement.addEventListener("pointerout", onChipTooltipHide);
  topPanelElement.addEventListener("pointercancel", () => hideStatusTooltip());

  topPanelElement.addEventListener("dragstart", (event) => {
    const portrait = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__portrait")
      : null;
    if (!(portrait instanceof HTMLElement)) {
      event.preventDefault();
      return;
    }

    const sourceId = String(portrait.dataset.tokenId ?? "").trim();
    if (!sourceId) {
      event.preventDefault();
      return;
    }

    const liveState = getTopPanelState();
    if (!liveState) {
      event.preventDefault();
      return;
    }

    liveState.draggedTokenId = sourceId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", sourceId);
    }
  });

  topPanelElement.addEventListener("dragover", (event) => {
    const targetPortrait = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__portrait")
      : null;
    if (!(targetPortrait instanceof HTMLElement)) return;

    const liveState = getTopPanelState();
    if (!liveState) return;

    const sourceId = String(
      liveState.draggedTokenId
      ?? event.dataTransfer?.getData("text/plain")
      ?? ""
    ).trim();
    const targetId = String(targetPortrait.dataset.tokenId ?? "").trim();
    if (!sourceId || !targetId || sourceId === targetId) return;

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });

  topPanelElement.addEventListener("drop", (event) => {
    const targetPortrait = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__portrait")
      : null;
    if (!(targetPortrait instanceof HTMLElement)) return;

    const liveState = getTopPanelState();
    if (!liveState) return;

    const sourceId = String(
      liveState.draggedTokenId
      ?? event.dataTransfer?.getData("text/plain")
      ?? ""
    ).trim();
    const targetId = String(targetPortrait.dataset.tokenId ?? "").trim();
    if (!sourceId || !targetId || sourceId === targetId) return;

    event.preventDefault();

    const sceneId = getCurrentSceneId();
    if (!sceneId) return;
    const currentTokenIds = getOrderedSceneTokens().map((token) => String(token.id ?? "").trim()).filter(Boolean);
    const nextOrder = moveTokenBeforeTarget(currentTokenIds, sourceId, targetId);
    writeSavedTopPanelTokenOrder(sceneId, nextOrder);

    liveState.suppressNextClick = true;
    void renderTopPanelContent();
  });

  topPanelElement.addEventListener("dragend", () => {
    const liveState = getTopPanelState();
    if (!liveState) return;
    liveState.draggedTokenId = "";
  });
}

async function createTopPanelElement() {
  const html = await towCombatOverlayRenderTemplate(TOP_PANEL_TEMPLATE_PATH, {});
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(html ?? "").trim();
  const topPanel = wrapper.firstElementChild;
  if (!(topPanel instanceof HTMLElement) || topPanel.id !== TOP_PANEL_ID) {
    throw new Error("[tow-combat-overlay] Failed to render top panel template.");
  }
  bindTopPanelElementEvents(topPanel);
  return topPanel;
}

async function renderTopPanelContent() {
  const state = getTopPanelState();
  const panelElement = state?.element;
  if (!(panelElement instanceof HTMLElement) || !panelElement.isConnected) return;
  syncTopPanelWidth(panelElement);

  const listElement = panelElement.querySelector(".tow-combat-overlay-top-panel__list");
  if (!(listElement instanceof HTMLElement)) return;

  const tokens = getOrderedSceneTokens();
  listElement.innerHTML = "";

  if (!tokens.length) {
    panelElement.dataset.hasTokens = "false";
    listElement.style.paddingBottom = "0px";
    return;
  }

  panelElement.dataset.hasTokens = "true";
  const fragment = document.createDocumentFragment();
  for (const token of tokens) {
    fragment.appendChild(buildPortraitElement(token));
  }
  listElement.appendChild(fragment);
  syncTopPanelPortraitChipSizing(panelElement);
  syncTopPanelListBottomPadding(panelElement);
}

function queueTopPanelRender() {
  const state = getTopPanelState();
  if (!state) return;
  if (state.renderQueued) return;

  state.renderQueued = true;
  requestAnimationFrame(() => {
    const liveState = getTopPanelState();
    if (!liveState) return;
    liveState.renderQueued = false;
    void renderTopPanelContent();
  });
}

function bindTopPanelHooks() {
  const state = getTopPanelState();
  if (!state) return;
  if (!(state.hookIds instanceof Map)) state.hookIds = new Map();

  for (const hookName of TOP_PANEL_HOOKS) {
    if (state.hookIds.has(hookName)) continue;
    const hookId = Hooks.on(hookName, () => queueTopPanelRender());
    state.hookIds.set(hookName, hookId);
  }
}

function unbindTopPanelHooks() {
  const state = getTopPanelState();
  const hookIds = state?.hookIds;
  if (!(hookIds instanceof Map)) return;

  for (const [hookName, hookId] of hookIds.entries()) {
    Hooks.off(hookName, hookId);
  }
  hookIds.clear();
}

export async function towCombatOverlayEnsureTopPanel() {
  const state = getTopPanelState();
  if (!state) return;

  if (state.element instanceof HTMLElement && state.element.isConnected) {
    await renderTopPanelContent();
    return;
  }

  removeStaleTopPanels();
  const panelElement = await createTopPanelElement();
  panelElement.style.left = "0px";
  panelElement.style.top = "0px";
  document.body.appendChild(panelElement);
  applyInitialTopPanelPosition(panelElement);

  state.element = panelElement;
  bindTopPanelHooks();
  await renderTopPanelContent();
}

export function towCombatOverlayRemoveTopPanel() {
  const state = game?.[TOP_PANEL_STATE_KEY];
  unbindTopPanelHooks();

  if (typeof state?.onPanelPointerDown === "function" && state?.element instanceof HTMLElement) {
    state.element.removeEventListener("pointerdown", state.onPanelPointerDown);
  }
  if (typeof state?.onPanelPointerMove === "function") window.removeEventListener("pointermove", state.onPanelPointerMove);
  if (typeof state?.onPanelPointerUp === "function") {
    window.removeEventListener("pointerup", state.onPanelPointerUp);
    window.removeEventListener("pointercancel", state.onPanelPointerUp);
  }
  if (typeof state?.onResize === "function") window.removeEventListener("resize", state.onResize);

  if (state?.element instanceof HTMLElement) state.element.remove();
  removeStaleTopPanels();

  if (game && Object.prototype.hasOwnProperty.call(game, TOP_PANEL_STATE_KEY)) {
    delete game[TOP_PANEL_STATE_KEY];
  }
}
