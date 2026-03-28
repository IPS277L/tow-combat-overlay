import {
  clampTopPanelCoordinate,
  readSavedTopPanelPosition,
  readSavedTopPanelTokenOrder
} from "./top-panel-state.js";
import { TOP_PANEL_VIEWPORT_MARGIN_PX } from "./top-panel-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import { getTowCombatOverlayDisplaySetting } from "../../bootstrap/register-settings.js";

function getRectHorizontalOverlapPx(leftA, rightA, leftB, rightB) {
  const left = Math.max(leftA, leftB);
  const right = Math.min(rightA, rightB);
  return Math.max(0, right - left);
}

function getOpenedSidebarWidthPx() {
  const sidebarElement = document.getElementById("sidebar");
  if (!(sidebarElement instanceof HTMLElement)) return 0;
  const computedStyle = window.getComputedStyle(sidebarElement);
  if (
    sidebarElement.hidden === true
    || computedStyle.display === "none"
    || computedStyle.visibility === "hidden"
  ) {
    return 0;
  }

  const sidebarRect = sidebarElement.getBoundingClientRect();
  const viewportLeft = 0;
  const viewportRight = window.innerWidth;
  let occupiedWidth = getRectHorizontalOverlapPx(
    sidebarRect.left,
    sidebarRect.right,
    viewportLeft,
    viewportRight
  );

  const rightUiElement = document.getElementById("ui-right");
  if (rightUiElement instanceof HTMLElement) {
    const rightUiStyle = window.getComputedStyle(rightUiElement);
    if (
      rightUiElement.hidden !== true
      && rightUiStyle.display !== "none"
      && rightUiStyle.visibility !== "hidden"
    ) {
      const rightUiRect = rightUiElement.getBoundingClientRect();
      const overlapInsideUiRight = getRectHorizontalOverlapPx(
        sidebarRect.left,
        sidebarRect.right,
        rightUiRect.left,
        rightUiRect.right
      );
      occupiedWidth = Math.min(occupiedWidth, overlapInsideUiRight);
    }
  }

  return Math.max(0, Math.round(occupiedWidth));
}

export function getCanvasClientBounds(
  viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX,
  { includeSidebarOffset = false } = {}
) {
  const canvasView = canvas?.app?.view;
  const rect = (canvasView instanceof HTMLElement)
    ? canvasView.getBoundingClientRect()
    : null;
  const rightUiOccupiedWidthPx = includeSidebarOffset ? getOpenedSidebarWidthPx() : 0;
  const viewportRight = Math.max(
    viewportMarginPx + 1,
    window.innerWidth - viewportMarginPx - rightUiOccupiedWidthPx
  );

  if (!rect) {
    return {
      left: viewportMarginPx,
      top: viewportMarginPx,
      right: viewportRight,
      bottom: window.innerHeight - viewportMarginPx,
      width: Math.max(1, viewportRight - viewportMarginPx),
      height: Math.max(1, window.innerHeight - (viewportMarginPx * 2))
    };
  }

  const left = Math.max(viewportMarginPx, Math.round(rect.left + viewportMarginPx));
  const top = Math.max(viewportMarginPx, Math.round(rect.top + viewportMarginPx));
  const right = Math.min(viewportRight, Math.round(rect.right - viewportMarginPx));
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

export function syncTopPanelWidth(
  panelElement,
  viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX,
  { includeSidebarOffset = false } = {}
) {
  if (!(panelElement instanceof HTMLElement)) return;
  const bounds = getCanvasClientBounds(viewportMarginPx, { includeSidebarOffset });
  panelElement.style.maxWidth = `${Math.max(1, Math.round(bounds.width))}px`;
}

export function syncTopPanelListBottomPadding(panelElement) {
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

export function getTopPanelBounds(
  panelElement,
  viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX,
  { includeSidebarOffset = false } = {}
) {
  const rect = panelElement.getBoundingClientRect();
  const canvasBounds = getCanvasClientBounds(viewportMarginPx, { includeSidebarOffset });
  const panelWidth = Math.max(1, Math.round(rect.width || panelElement.offsetWidth || 1));
  const panelHeight = Math.max(1, Math.round(rect.height || panelElement.offsetHeight || 1));
  return {
    minLeft: canvasBounds.left,
    minTop: canvasBounds.top,
    maxLeft: canvasBounds.right - panelWidth,
    maxTop: canvasBounds.bottom - panelHeight
  };
}

export function applyTopPanelPosition(
  panelElement,
  left,
  top,
  viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX,
  { includeSidebarOffset = false } = {}
) {
  const bounds = getTopPanelBounds(panelElement, viewportMarginPx, { includeSidebarOffset });
  const safeLeft = clampTopPanelCoordinate(left, bounds.minLeft, bounds.maxLeft);
  const safeTop = clampTopPanelCoordinate(top, bounds.minTop, bounds.maxTop);
  panelElement.style.left = `${Math.round(safeLeft)}px`;
  panelElement.style.top = `${Math.round(safeTop)}px`;
}

export function applyDefaultTopPanelPosition(
  panelElement,
  viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX,
  { includeSidebarOffset = false } = {}
) {
  const rect = panelElement.getBoundingClientRect();
  const canvasBounds = getCanvasClientBounds(viewportMarginPx, { includeSidebarOffset });
  const panelWidth = Math.max(1, Math.round(rect.width || panelElement.offsetWidth || 1));
  const defaultLeft = Math.round(canvasBounds.left + ((canvasBounds.width - panelWidth) / 2));
  applyTopPanelPosition(panelElement, defaultLeft, canvasBounds.top, viewportMarginPx, { includeSidebarOffset });
}

export function applyInitialTopPanelPosition(panelElement, viewportMarginPx = TOP_PANEL_VIEWPORT_MARGIN_PX) {
  if (isTopPanelAlwaysCenteredEnabled()) {
    syncTopPanelWidth(panelElement, viewportMarginPx, { includeSidebarOffset: true });
    applyDefaultTopPanelPosition(panelElement, viewportMarginPx, { includeSidebarOffset: true });
    return;
  }
  syncTopPanelWidth(panelElement, viewportMarginPx);
  const saved = readSavedTopPanelPosition();
  if (saved) {
    applyTopPanelPosition(panelElement, saved.left, saved.top, viewportMarginPx);
    return;
  }

  applyDefaultTopPanelPosition(panelElement, viewportMarginPx);
}

export function getSceneTokens() {
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

export function isTopPanelAlwaysCenteredEnabled() {
  const { settings } = getTowCombatOverlayConstants();
  return String(getTowCombatOverlayDisplaySetting(settings.tokensPanelPositionMode, "free")).trim() === "alwaysCentered";
}

export function isTopPanelLockedEnabled() {
  const { settings } = getTowCombatOverlayConstants();
  return String(getTowCombatOverlayDisplaySetting(settings.tokensPanelPositionMode, "free")).trim() === "locked";
}

export function getCurrentSceneId() {
  return String(canvas?.scene?.id ?? "").trim();
}

export function getOrderedSceneTokens() {
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

export function moveTokenRelativeToTarget(tokenIds, sourceId, targetId, { placeAfter = true } = {}) {
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
  if (nextTargetIndex < 0) return ids;
  const insertIndex = placeAfter ? (nextTargetIndex + 1) : nextTargetIndex;
  ids.splice(Math.max(0, insertIndex), 0, dragged);
  return ids;
}

export function shouldDropAfterTarget(event, targetPortrait) {
  if (!(targetPortrait instanceof HTMLElement)) return true;
  const rect = targetPortrait.getBoundingClientRect();
  const midpointX = rect.left + (rect.width / 2);
  return Number(event?.clientX ?? midpointX) >= midpointX;
}
