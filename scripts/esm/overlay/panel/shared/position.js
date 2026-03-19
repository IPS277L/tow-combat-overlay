import { clampPanelCoordinate } from "./state.js";

export function getPanelBounds(panelElement, viewportMarginPx = 8) {
  const rect = panelElement.getBoundingClientRect();
  const panelWidth = Math.max(1, Math.round(rect.width || panelElement.offsetWidth || 1));
  const panelHeight = Math.max(1, Math.round(rect.height || panelElement.offsetHeight || 1));
  const maxLeft = window.innerWidth - panelWidth - viewportMarginPx;
  const maxTop = window.innerHeight - panelHeight - viewportMarginPx;
  return {
    minLeft: viewportMarginPx,
    minTop: viewportMarginPx,
    maxLeft,
    maxTop
  };
}

export function applyPanelPosition(panelElement, left, top, viewportMarginPx = 8) {
  const bounds = getPanelBounds(panelElement, viewportMarginPx);
  const safeLeft = clampPanelCoordinate(left, bounds.minLeft, bounds.maxLeft);
  const safeTop = clampPanelCoordinate(top, bounds.minTop, bounds.maxTop);
  panelElement.style.left = `${Math.round(safeLeft)}px`;
  panelElement.style.top = `${Math.round(safeTop)}px`;
}

export function applyPanelPositionWithSelectionClamp(controlPanelState, panelElement, left, top, viewportMarginPx = 8) {
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

export function applyInitialPanelPosition(panelElement, viewportMarginPx = 8) {
  const rect = panelElement.getBoundingClientRect();
  const panelWidth = Math.max(1, Math.round(rect.width || panelElement.offsetWidth || 1));
  const panelHeight = Math.max(1, Math.round(rect.height || panelElement.offsetHeight || 1));
  const defaultLeft = Math.round((window.innerWidth / 2) - (panelWidth / 2));
  const defaultTop = Math.round(window.innerHeight - panelHeight - viewportMarginPx);
  applyPanelPosition(panelElement, defaultLeft, defaultTop, viewportMarginPx);
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


