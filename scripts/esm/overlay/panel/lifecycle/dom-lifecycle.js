export function createPanelDomLifecycleService({
  panelId,
  panelSelectionId,
  panelStateKey,
  panelViewportMarginPx,
  panelSelectionGapPx,
  getControlPanelState,
  readSavedPanelReorderUnlocked,
  removeStaleControlPanels,
  createControlPanelElement,
  applyInitialPanelPosition,
  syncSelectionPanelPosition,
  bindPanelActionControls,
  bindPanelReorderToggle,
  bindPanelReorderReset,
  bindSelectionPanelStatEvents,
  bindSelectionNameTooltipEvent,
  bindPanelStatusesTooltipEvents,
  bindControlPanelDrag,
  isPanelDragEnabled,
  applyPanelPositionWithSelectionClamp,
  writeSavedPanelPosition,
  bindPanelSelectionSync,
  clearPanelAttackPickMode,
  panelSelectionSyncService
} = {}) {
  async function ensureControlPanel() {
    const controlPanelState = getControlPanelState();
    if (!controlPanelState) return;
    if (typeof controlPanelState.buttonReorderUnlocked !== "boolean") {
      controlPanelState.buttonReorderUnlocked = readSavedPanelReorderUnlocked();
    }

    const hasMainPanel = controlPanelState.element instanceof HTMLElement && controlPanelState.element.isConnected;
    const hasSelectionPanel = controlPanelState.selectionElement instanceof HTMLElement && controlPanelState.selectionElement.isConnected;
    if (hasMainPanel && hasSelectionPanel) return;
    removeStaleControlPanels({ panelId, selectionPanelId: panelSelectionId });

    const { panelElement, selectionPanelElement } = await createControlPanelElement();
    panelElement.style.visibility = "hidden";
    selectionPanelElement.style.visibility = "hidden";
    document.body.appendChild(panelElement);
    document.body.appendChild(selectionPanelElement);
    applyInitialPanelPosition(panelElement, panelViewportMarginPx);
    syncSelectionPanelPosition({ element: panelElement, selectionElement: selectionPanelElement }, panelSelectionGapPx);
    panelElement.style.visibility = "";
    selectionPanelElement.style.visibility = "";

    bindPanelActionControls(panelElement);
    bindPanelReorderToggle(panelElement);
    bindPanelReorderReset(panelElement);
    bindPanelActionControls(selectionPanelElement);
    bindSelectionPanelStatEvents(selectionPanelElement);
    bindSelectionNameTooltipEvent(selectionPanelElement);
    bindPanelStatusesTooltipEvents(panelElement);
    controlPanelState.element = panelElement;
    controlPanelState.selectionElement = selectionPanelElement;
    bindControlPanelDrag(controlPanelState, panelElement, {
      applyPosition: (state, element, left, top) => applyPanelPositionWithSelectionClamp(
        state,
        element,
        left,
        top,
        panelViewportMarginPx
      ),
      persistPosition: writeSavedPanelPosition,
      dragSources: [selectionPanelElement],
      canDrag: () => (typeof isPanelDragEnabled === "function" ? !!isPanelDragEnabled() : true),
      onMoved: () => syncSelectionPanelPosition(controlPanelState, panelSelectionGapPx)
    });
    bindPanelSelectionSync(controlPanelState, panelElement);
  }

  function removeControlPanel() {
    const controlPanelState = game?.[panelStateKey];
    clearPanelAttackPickMode();
    const panelElement = controlPanelState?.element;
    const selectionPanelElement = controlPanelState?.selectionElement;
    const onPointerDown = controlPanelState?.onPointerDown;
    const onPointerMove = controlPanelState?.onPointerMove;
    const onPointerUp = controlPanelState?.onPointerUp;
    const onResize = controlPanelState?.onResize;

    if (typeof onPointerDown === "function") {
      const dragSourceElements = Array.isArray(controlPanelState?.dragSourceElements)
        ? controlPanelState.dragSourceElements
        : (panelElement instanceof HTMLElement ? [panelElement] : []);
      for (const sourceElement of dragSourceElements) {
        if (!(sourceElement instanceof HTMLElement)) continue;
        sourceElement.removeEventListener("pointerdown", onPointerDown);
      }
    }
    if (typeof onPointerMove === "function") window.removeEventListener("pointermove", onPointerMove);
    if (typeof onPointerUp === "function") {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    }
    if (typeof onResize === "function") window.removeEventListener("resize", onResize);
    panelSelectionSyncService.unbindSelectionSync(controlPanelState);
    if (panelElement instanceof HTMLElement) panelElement.remove();
    if (selectionPanelElement instanceof HTMLElement) selectionPanelElement.remove();

    removeStaleControlPanels({ panelId, selectionPanelId: panelSelectionId });
    if (game && Object.prototype.hasOwnProperty.call(game, panelStateKey)) delete game[panelStateKey];
  }

  return {
    ensureControlPanel,
    removeControlPanel
  };
}

