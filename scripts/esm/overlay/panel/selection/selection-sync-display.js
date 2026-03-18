export function createPanelSelectionSyncDisplayService({
  getControlPanelState,
  clearPanelAttackPickMode,
  getPrimaryTokenIconSrc,
  getPrimaryTokenName,
  towCombatOverlayGetResilienceValue,
  towCombatOverlayGetWoundCount,
  getSpeedLabel,
  actorHasMagicCasting,
  formatStatNumber,
  formatWoundsWithMax,
  formatMiscastDiceValue,
  updatePanelSlots,
  updateStatusDisplay,
  updateActionControlsDisplay,
  applyInitialPanelPosition,
  applyPanelPosition,
  syncSelectionPanelPosition,
  panelViewportMarginPx = 8,
  panelSelectionGapPx = 0
} = {}) {
  function syncItemGroupsMinWidth(panelElement) {
    if (!(panelElement instanceof HTMLElement)) return;
    const statusesElement = panelElement.querySelector(".tow-combat-overlay-control-panel__statuses");
    const statusesTopElement = panelElement.querySelector(".tow-combat-overlay-control-panel__statuses-top");
    const statusesBottomElement = panelElement.querySelector(".tow-combat-overlay-control-panel__statuses-bottom");
    const itemGroupsElement = panelElement.querySelector(".tow-combat-overlay-control-panel__item-groups");
    if (!(itemGroupsElement instanceof HTMLElement)) return;

    const widths = [
      statusesElement instanceof HTMLElement ? statusesElement.scrollWidth : 0,
      statusesTopElement instanceof HTMLElement ? statusesTopElement.scrollWidth : 0,
      statusesBottomElement instanceof HTMLElement ? statusesBottomElement.scrollWidth : 0
    ].map((value) => Number(value) || 0);
    const targetWidth = Math.max(0, Math.max(...widths) - 12);
    if (targetWidth > 0) itemGroupsElement.style.minWidth = `${Math.ceil(targetWidth)}px`;
    else itemGroupsElement.style.removeProperty("min-width");
  }

  function fitSelectionNameFont(selectionNameMainElement, { minFontSizePx = 12 } = {}) {
    if (!(selectionNameMainElement instanceof HTMLElement)) return;
    selectionNameMainElement.style.fontSize = "";
    selectionNameMainElement.style.lineHeight = "";

    const availableWidth = Number(selectionNameMainElement.clientWidth || 0);
    const contentWidth = Number(selectionNameMainElement.scrollWidth || 0);
    if (availableWidth <= 0 || contentWidth <= 0 || contentWidth <= availableWidth) return;

    const computed = window.getComputedStyle(selectionNameMainElement);
    const baseFontSize = Number.parseFloat(computed.fontSize);
    if (!Number.isFinite(baseFontSize) || baseFontSize <= 0) return;

    const scale = availableWidth / contentWidth;
    const nextSize = Math.max(Number(minFontSizePx) || 12, Math.floor(baseFontSize * scale));
    if (nextSize >= baseFontSize) return;
    selectionNameMainElement.style.fontSize = `${nextSize}px`;
    selectionNameMainElement.style.lineHeight = "1";
  }

  function updateSelectionDisplay(panelElement) {
    const controlPanelState = getControlPanelState();
    const selectionPanelElement = controlPanelState?.selectionElement;
    const selectionElement = selectionPanelElement?.querySelector?.(".tow-combat-overlay-control-panel__selection");
    if (!(selectionElement instanceof HTMLElement)) return;
    const imageElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-image");
    const selectionNameMainElement = selectionPanelElement?.querySelector?.(".tow-combat-overlay-control-panel__selection-name-main");
    const selectionSpeedElement = selectionPanelElement?.querySelector?.("[data-selection-stat='speed']");
    const selectionResilienceElement = selectionPanelElement?.querySelector?.("[data-selection-stat='resilience']");
    const selectionWoundsElement = selectionPanelElement?.querySelector?.("[data-selection-stat='wounds']");
    const selectionMiscastElement = selectionPanelElement?.querySelector?.("[data-selection-stat='miscastDice']");
    const selectionMiscastRow = selectionPanelElement?.querySelector?.("[data-selection-stat-row='miscastDice']");
    const placeholderElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-placeholder");
    const multiCountElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-multi-count");
    if (!(imageElement instanceof HTMLImageElement)) return;
    if (!(selectionNameMainElement instanceof HTMLElement)) return;
    if (!(placeholderElement instanceof HTMLElement)) return;
    if (!(multiCountElement instanceof HTMLElement)) return;
    if (!(selectionSpeedElement instanceof HTMLElement)) return;
    if (!(selectionResilienceElement instanceof HTMLElement)) return;
    if (!(selectionWoundsElement instanceof HTMLElement)) return;
    if (!(selectionMiscastElement instanceof HTMLElement)) return;
    if (!(selectionMiscastRow instanceof HTMLElement)) return;

    const controlledTokens = Array.isArray(canvas?.tokens?.controlled)
      ? canvas.tokens.controlled.filter((token) => token && !token.destroyed)
      : [];
    const selectedCount = controlledTokens.length;

    if (selectedCount !== 1) {
      panelElement.style.display = "none";
      if (selectionPanelElement instanceof HTMLElement) selectionPanelElement.style.display = "none";
      clearPanelAttackPickMode();
      return;
    }

    panelElement.style.display = "";
    if (selectionPanelElement instanceof HTMLElement) selectionPanelElement.style.display = "";

    const token = controlledTokens[0];
    const iconSrc = getPrimaryTokenIconSrc(token);
    const tokenName = getPrimaryTokenName(token);
    const resilience = towCombatOverlayGetResilienceValue(token?.document);
    const wounds = towCombatOverlayGetWoundCount(token?.document);
    const speed = getSpeedLabel(token);
    const actor = token?.actor ?? token?.document?.actor ?? null;
    const hasMagic = actorHasMagicCasting(actor);
    const isDead = !!actor?.hasCondition?.("dead");
    selectionElement.dataset.selection = "single";
    selectionElement.classList.toggle("is-dead", isDead);
    selectionElement.classList.toggle("is-magic", hasMagic);
    imageElement.src = iconSrc;
    imageElement.alt = tokenName;
    selectionNameMainElement.textContent = tokenName || "-";
    fitSelectionNameFont(selectionNameMainElement);
    selectionSpeedElement.textContent = speed;
    selectionResilienceElement.textContent = formatStatNumber(resilience);
    selectionWoundsElement.textContent = formatWoundsWithMax(token, wounds);
    selectionMiscastElement.textContent = hasMagic ? formatMiscastDiceValue(token) : "-";
    selectionMiscastRow.style.display = hasMagic ? "" : "none";
    placeholderElement.textContent = iconSrc ? "-" : "?";
    multiCountElement.textContent = "x1";
    updatePanelSlots(panelElement, token);
    updateStatusDisplay(panelElement, token);
    syncItemGroupsMinWidth(panelElement);
    updateActionControlsDisplay(panelElement, token);
    updateActionControlsDisplay(selectionPanelElement, token);
    if (!controlPanelState.hasInitialAutoCenter) {
      applyInitialPanelPosition(panelElement, panelViewportMarginPx);
      controlPanelState.hasInitialAutoCenter = true;
    }
    const rect = panelElement.getBoundingClientRect();
    applyPanelPosition(panelElement, rect.left, rect.top, panelViewportMarginPx);
    syncSelectionPanelPosition(controlPanelState, panelSelectionGapPx);
  }

  return {
    syncItemGroupsMinWidth,
    fitSelectionNameFont,
    updateSelectionDisplay
  };
}

