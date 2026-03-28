import { clampPanelCoordinate, readSavedPanelPosition } from "./state.js";
import { getTowCombatOverlayConstants } from "../../../runtime/module-constants.js";
import { getTowCombatOverlayDisplaySetting } from "../../../bootstrap/register-settings.js";
import { getCanvasClientBounds } from "../../top-panel/top-panel-layout.js";
import { PANEL_SELECTION_GAP_PX, PANEL_SELECTION_ID } from "./panel-constants.js";

const { settings: MODULE_SETTINGS } = getTowCombatOverlayConstants();

export function isControlPanelAlwaysCenteredEnabled() {
  return String(getTowCombatOverlayDisplaySetting(MODULE_SETTINGS.controlPanelPositionMode, "free")).trim() === "alwaysCentered";
}

export function isControlPanelLockedEnabled() {
  return String(getTowCombatOverlayDisplaySetting(MODULE_SETTINGS.controlPanelPositionMode, "free")).trim() === "locked";
}

function resolveSelectionElement(controlPanelState = null) {
  const stateSelectionElement = controlPanelState?.selectionElement;
  if (stateSelectionElement instanceof HTMLElement) return stateSelectionElement;
  const selectionById = document.getElementById(PANEL_SELECTION_ID);
  return selectionById instanceof HTMLElement ? selectionById : null;
}

function getCenteredCompositeMetrics(panelElement, controlPanelState = null, selectionGapPx = PANEL_SELECTION_GAP_PX) {
  const rect = panelElement.getBoundingClientRect();
  const panelWidth = Math.max(1, Math.round(rect.width || panelElement.offsetWidth || 1));
  const panelHeight = Math.max(1, Math.round(rect.height || panelElement.offsetHeight || 1));
  const selectionElement = resolveSelectionElement(controlPanelState);
  if (!(selectionElement instanceof HTMLElement) || !selectionElement.isConnected) {
    return {
      compositeWidth: panelWidth,
      compositeHeight: panelHeight,
      panelOffsetX: 0,
      panelOffsetY: 0
    };
  }

  const selectionRect = selectionElement.getBoundingClientRect();
  const selectionVisible = selectionRect.width > 0 && selectionRect.height > 0 && selectionElement.style.display !== "none";
  if (!selectionVisible) {
    return {
      compositeWidth: panelWidth,
      compositeHeight: panelHeight,
      panelOffsetX: 0,
      panelOffsetY: 0
    };
  }

  const selectionWidth = Math.max(1, Math.round(selectionRect.width || selectionElement.offsetWidth || 1));
  const selectionImageBlock = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection");
  const imageBottomOffset = (selectionImageBlock instanceof HTMLElement)
    ? (selectionImageBlock.offsetTop + selectionImageBlock.offsetHeight)
    : selectionElement.offsetHeight;
  const compositeHeight = Math.max(panelHeight, Math.round(imageBottomOffset || panelHeight));

  return {
    compositeWidth: panelWidth + selectionWidth + selectionGapPx,
    compositeHeight,
    panelOffsetX: selectionWidth + selectionGapPx,
    panelOffsetY: Math.max(0, compositeHeight - panelHeight)
  };
}

function applyCenteredPanelPosition(
  panelElement,
  viewportMarginPx = 8,
  controlPanelState = null,
  selectionGapPx = PANEL_SELECTION_GAP_PX
) {
  const canvasBounds = getCanvasClientBounds(viewportMarginPx, { includeSidebarOffset: true });
  const bounds = getPanelBounds(panelElement, viewportMarginPx, { includeSidebarOffset: true });
  const {
    compositeWidth,
    compositeHeight,
    panelOffsetX,
    panelOffsetY
  } = getCenteredCompositeMetrics(panelElement, controlPanelState, selectionGapPx);
  const centeredLeft = Math.round(canvasBounds.left + ((canvasBounds.width - compositeWidth) / 2) + panelOffsetX);
  const centeredTop = Math.round(canvasBounds.bottom - compositeHeight + panelOffsetY);
  const left = clampPanelCoordinate(centeredLeft, bounds.minLeft, bounds.maxLeft);
  const top = clampPanelCoordinate(centeredTop, bounds.minTop, bounds.maxTop);
  panelElement.style.left = `${Math.round(left)}px`;
  panelElement.style.top = `${Math.round(top)}px`;
}

export function getPanelBounds(
  panelElement,
  viewportMarginPx = 8,
  { includeSidebarOffset = false } = {}
) {
  const rect = panelElement.getBoundingClientRect();
  const panelWidth = Math.max(1, Math.round(rect.width || panelElement.offsetWidth || 1));
  const panelHeight = Math.max(1, Math.round(rect.height || panelElement.offsetHeight || 1));
  const canvasBounds = getCanvasClientBounds(viewportMarginPx, { includeSidebarOffset });
  const maxLeft = canvasBounds.right - panelWidth;
  const maxTop = canvasBounds.bottom - panelHeight;
  return {
    minLeft: canvasBounds.left,
    minTop: canvasBounds.top,
    maxLeft,
    maxTop
  };
}

export function applyPanelPosition(
  panelElement,
  left,
  top,
  viewportMarginPx = 8,
  controlPanelState = null,
  selectionGapPx = PANEL_SELECTION_GAP_PX
) {
  if (isControlPanelAlwaysCenteredEnabled()) {
    applyCenteredPanelPosition(panelElement, viewportMarginPx, controlPanelState, selectionGapPx);
    return;
  }
  const bounds = getPanelBounds(panelElement, viewportMarginPx);
  const safeLeft = clampPanelCoordinate(left, bounds.minLeft, bounds.maxLeft);
  const safeTop = clampPanelCoordinate(top, bounds.minTop, bounds.maxTop);
  panelElement.style.left = `${Math.round(safeLeft)}px`;
  panelElement.style.top = `${Math.round(safeTop)}px`;
}

export function applyPanelPositionWithSelectionClamp(
  controlPanelState,
  panelElement,
  left,
  top,
  viewportMarginPx = 8,
  selectionGapPx = PANEL_SELECTION_GAP_PX
) {
  if (isControlPanelAlwaysCenteredEnabled()) {
    applyCenteredPanelPosition(panelElement, viewportMarginPx, controlPanelState, selectionGapPx);
    return;
  }
  const bounds = getPanelBounds(panelElement, viewportMarginPx);
  let minLeft = bounds.minLeft;
  let maxLeft = bounds.maxLeft;
  let minTop = bounds.minTop;
  let maxTop = bounds.maxTop;

  const selectionPanelElement = controlPanelState?.selectionElement;
  if (selectionPanelElement instanceof HTMLElement && selectionPanelElement.isConnected) {
    const panelRect = panelElement.getBoundingClientRect();
    const selectionRect = selectionPanelElement.getBoundingClientRect();
    const selectionVisible = selectionRect.width > 0 && selectionRect.height > 0 && selectionPanelElement.style.display !== "none";

    if (selectionVisible) {
      const leftOverflow = Math.max(0, panelRect.left - selectionRect.left);
      const topOverflow = Math.max(0, panelRect.top - selectionRect.top);
      const bottomOverflow = Math.max(0, selectionRect.bottom - panelRect.bottom);

      minLeft += leftOverflow;
      minTop += topOverflow;
      maxTop -= bottomOverflow;
    }
  }

  const safeLeft = clampPanelCoordinate(left, minLeft, maxLeft);
  const safeTop = clampPanelCoordinate(top, minTop, maxTop);
  panelElement.style.left = `${Math.round(safeLeft)}px`;
  panelElement.style.top = `${Math.round(safeTop)}px`;
}

export function applyInitialPanelPosition(
  panelElement,
  viewportMarginPx = 8,
  controlPanelState = null,
  selectionGapPx = PANEL_SELECTION_GAP_PX
) {
  if (isControlPanelAlwaysCenteredEnabled()) {
    applyCenteredPanelPosition(panelElement, viewportMarginPx, controlPanelState, selectionGapPx);
    return;
  }

  const savedPosition = readSavedPanelPosition();
  if (savedPosition && Number.isFinite(savedPosition.left) && Number.isFinite(savedPosition.top)) {
    applyPanelPosition(
      panelElement,
      savedPosition.left,
      savedPosition.top,
      viewportMarginPx,
      controlPanelState,
      selectionGapPx
    );
    return;
  }

  const rect = panelElement.getBoundingClientRect();
  const canvasBounds = getCanvasClientBounds(viewportMarginPx);
  const panelWidth = Math.max(1, Math.round(rect.width || panelElement.offsetWidth || 1));
  const panelHeight = Math.max(1, Math.round(rect.height || panelElement.offsetHeight || 1));
  const defaultLeft = Math.round(canvasBounds.left + ((canvasBounds.width - panelWidth) / 2));
  const defaultTop = Math.round(canvasBounds.bottom - panelHeight);
  applyPanelPosition(panelElement, defaultLeft, defaultTop, viewportMarginPx, controlPanelState, selectionGapPx);
}

export function syncSelectionPanelPosition(controlPanelState, selectionGapPx = 0) {
  const panelElement = controlPanelState?.element;
  const selectionPanelElement = controlPanelState?.selectionElement;
  if (!(panelElement instanceof HTMLElement)) return;
  if (!(selectionPanelElement instanceof HTMLElement)) return;

  const panelRect = panelElement.getBoundingClientRect();
  const selectionSizePx = Math.max(1, Math.round(panelRect.height));
  selectionPanelElement.style.setProperty("--tow-control-panel-selection-size", `${selectionSizePx}px`);

  const selectionRect = selectionPanelElement.getBoundingClientRect();
  const selectionImageBlock = selectionPanelElement.querySelector(".tow-combat-overlay-control-panel__selection");
  const imageBottomOffset = (selectionImageBlock instanceof HTMLElement)
    ? (selectionImageBlock.offsetTop + selectionImageBlock.offsetHeight)
    : selectionPanelElement.offsetHeight;
  const left = panelRect.left - selectionRect.width - selectionGapPx;
  const top = panelRect.bottom - imageBottomOffset;
  selectionPanelElement.style.left = `${Math.round(left)}px`;
  selectionPanelElement.style.top = `${Math.round(top)}px`;
}
