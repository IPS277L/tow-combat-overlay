function clearWrapVars(panelElement) {
  panelElement.classList.remove("is-temporary-effects-wrapped");
  panelElement.style.removeProperty("--tow-temp-effects-cols");
  panelElement.style.removeProperty("--tow-temp-effects-container-shift");
  panelElement.style.removeProperty("--tow-temp-effects-first-row-offset");
  panelElement.style.removeProperty("--tow-temp-effects-bridge-gap");
  panelElement.style.removeProperty("--tow-statuses-max-width");
}

function getStatusIconsSpanWidth(statusesBottomElement) {
  const statusIcons = Array.from(
    statusesBottomElement?.querySelectorAll?.(".tow-combat-overlay-control-panel__status-icon") ?? []
  );
  let availableWidth = Math.ceil(Number(statusesBottomElement?.getBoundingClientRect?.().width ?? 0));
  if (statusIcons.length >= 2) {
    const firstRect = statusIcons[0]?.getBoundingClientRect?.();
    const lastRect = statusIcons[statusIcons.length - 1]?.getBoundingClientRect?.();
    if (firstRect && lastRect) {
      const iconSpan = Math.ceil(Math.max(0, lastRect.right - firstRect.left));
      if (iconSpan > 0) availableWidth = iconSpan;
    }
  } else if (statusIcons.length === 1) {
    const onlyRect = statusIcons[0]?.getBoundingClientRect?.();
    if (onlyRect) {
      const iconSpan = Math.ceil(Math.max(0, onlyRect.width));
      if (iconSpan > 0) availableWidth = iconSpan;
    }
  }
  return availableWidth + 1;
}

function resolveWrapElements(panelElement) {
  const statusesTopElement = panelElement.querySelector(".tow-combat-overlay-control-panel__statuses-top");
  const statusesBottomElement = panelElement.querySelector(".tow-combat-overlay-control-panel__statuses-bottom");
  const abilitiesGroup = panelElement.querySelector(
    ".tow-combat-overlay-control-panel__statuses-top .tow-combat-overlay-control-panel__item-group[data-item-group='abilities']"
  );
  const woundIndicator = panelElement.querySelector(
    ".tow-combat-overlay-control-panel__statuses-top [data-wound-action-indicator]"
  );
  const temporaryEffectsGroup = panelElement.querySelector(
    ".tow-combat-overlay-control-panel__statuses-top .tow-combat-overlay-control-panel__item-group[data-item-group='temporaryEffects']"
  );
  return {
    statusesTopElement,
    statusesBottomElement,
    abilitiesGroup,
    woundIndicator,
    temporaryEffectsGroup
  };
}

function isVisible(element) {
  return (
    element instanceof HTMLElement
    && element.style.display !== "none"
    && element.getBoundingClientRect().width > 0
  );
}

function computeWrapLayout(panelElement, { maxCols, bridgeGapPx }) {
  if (!(panelElement instanceof HTMLElement)) return null;
  const elements = resolveWrapElements(panelElement);
  const {
    statusesTopElement,
    statusesBottomElement,
    abilitiesGroup,
    woundIndicator,
    temporaryEffectsGroup
  } = elements;
  if (!(statusesTopElement instanceof HTMLElement) || !(temporaryEffectsGroup instanceof HTMLElement)) return null;

  const temporaryGrid = temporaryEffectsGroup.querySelector(".tow-combat-overlay-control-panel__group-grid");
  if (!(temporaryGrid instanceof HTMLElement)) return null;
  const temporarySlots = Array.from(temporaryGrid.querySelectorAll(".tow-combat-overlay-control-panel__slot"));
  if (!temporarySlots.length || temporaryEffectsGroup.style.display === "none") return null;

  const availableWidth = getStatusIconsSpanWidth(statusesBottomElement);
  if (availableWidth <= 0) return null;

  const leadRects = [];
  if (isVisible(abilitiesGroup)) leadRects.push(abilitiesGroup.getBoundingClientRect());
  if (isVisible(woundIndicator)) leadRects.push(woundIndicator.getBoundingClientRect());
  const tempRect = temporaryEffectsGroup.getBoundingClientRect();
  const anchorLeft = leadRects.length
    ? Math.min(...leadRects.map((rect) => rect.left))
    : Number(statusesTopElement.getBoundingClientRect().left ?? tempRect.left);
  const leadRight = leadRects.length
    ? Math.max(...leadRects.map((rect) => rect.right))
    : tempRect.left;

  const containerShift = Math.max(0, tempRect.left - anchorLeft);
  const firstRowOffset = Math.max(0, leadRight - anchorLeft);
  const normalizedMaxCols = Math.max(1, Math.min(Number(maxCols) || 1, temporarySlots.length));
  if (normalizedMaxCols >= temporarySlots.length) return null;

  return {
    cols: normalizedMaxCols,
    containerShiftPx: Math.round(containerShift),
    firstRowOffsetPx: Math.round(firstRowOffset),
    bridgeGapPx: Math.max(0, Math.round(Number(bridgeGapPx) || 0)),
    maxWidthPx: Math.max(1, Math.round(availableWidth))
  };
}

function applyWrapLayout(panelElement, layout) {
  panelElement.classList.add("is-temporary-effects-wrapped");
  panelElement.style.setProperty("--tow-temp-effects-cols", String(layout.cols));
  panelElement.style.setProperty("--tow-temp-effects-container-shift", `${layout.containerShiftPx}px`);
  panelElement.style.setProperty("--tow-temp-effects-first-row-offset", `${layout.firstRowOffsetPx}px`);
  panelElement.style.setProperty("--tow-temp-effects-bridge-gap", `${layout.bridgeGapPx}px`);
  panelElement.style.setProperty("--tow-statuses-max-width", `${layout.maxWidthPx}px`);
}

export function syncTemporaryEffectsWrapLayout(panelElement, { maxCols, bridgeGapPx }) {
  if (!(panelElement instanceof HTMLElement)) return false;
  clearWrapVars(panelElement);
  const layout = computeWrapLayout(panelElement, { maxCols, bridgeGapPx });
  if (!layout) return false;
  applyWrapLayout(panelElement, layout);
  return true;
}
