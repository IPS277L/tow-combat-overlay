export function createPanelSlotBindingService({
  getControlPanelState,
  canReorderButtons = () => true,
  isMainActionPanelSlot,
  getSlotPanelButtonKey,
  movePanelButtonKeyBeforeTarget,
  handlePanelSlotClick,
  updateSelectionDisplay,
  hideStatusTooltip,
  showOverlayTooltip
} = {}) {
  function bindPanelSlotEvent(slotElement) {
    slotElement.addEventListener("click", (event) => {
      event.preventDefault();
      const controlPanelState = getControlPanelState();
      if (controlPanelState?.suppressNextPanelSlotClick === true) {
        controlPanelState.suppressNextPanelSlotClick = false;
        return;
      }
      void handlePanelSlotClick(slotElement, event);
    });
    slotElement.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const itemGroup = String(slotElement.dataset.itemGroup ?? "").trim();
      const topChipType = String(slotElement.dataset.itemTopChipType ?? "").trim();
      if (itemGroup !== "temporaryEffects" && !(itemGroup === "topChips" && topChipType === "temporaryEffects")) return;
      void handlePanelSlotClick(slotElement, event);
    });

    slotElement.draggable = !!canReorderButtons();
    slotElement.addEventListener("dragstart", (event) => {
      if (!canReorderButtons()) {
        event.preventDefault();
        return;
      }
      if (!isMainActionPanelSlot(slotElement)) {
        event.preventDefault();
        return;
      }
      const sourceKey = getSlotPanelButtonKey(slotElement);
      if (!sourceKey) {
        event.preventDefault();
        return;
      }
      const controlPanelState = getControlPanelState();
      if (controlPanelState) controlPanelState.draggedPanelButtonKey = sourceKey;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", sourceKey);
      }
    });

    slotElement.addEventListener("dragover", (event) => {
      if (!canReorderButtons()) return;
      if (!isMainActionPanelSlot(slotElement)) return;
      const targetKey = getSlotPanelButtonKey(slotElement);
      if (!targetKey) return;
      const controlPanelState = getControlPanelState();
      const sourceKey = String(
        controlPanelState?.draggedPanelButtonKey
        ?? event.dataTransfer?.getData("text/plain")
        ?? ""
      ).trim();
      if (!sourceKey || sourceKey === targetKey) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });

    slotElement.addEventListener("drop", (event) => {
      if (!canReorderButtons()) return;
      if (!isMainActionPanelSlot(slotElement)) return;
      const targetKey = getSlotPanelButtonKey(slotElement);
      const controlPanelState = getControlPanelState();
      const sourceKey = String(
        controlPanelState?.draggedPanelButtonKey
        ?? event.dataTransfer?.getData("text/plain")
        ?? ""
      ).trim();
      if (!sourceKey || !targetKey || sourceKey === targetKey) return;
      event.preventDefault();
      const panelElement = slotElement.closest(".tow-combat-overlay-control-panel") ?? controlPanelState?.element ?? null;
      if (!movePanelButtonKeyBeforeTarget(sourceKey, targetKey, panelElement)) return;
      if (controlPanelState) controlPanelState.suppressNextPanelSlotClick = true;
      if (controlPanelState?.element instanceof HTMLElement) {
        updateSelectionDisplay(controlPanelState.element);
      }
    });

    slotElement.addEventListener("dragend", () => {
      const controlPanelState = getControlPanelState();
      if (controlPanelState) controlPanelState.draggedPanelButtonKey = "";
    });

    const onShowTooltip = (event) => {
      const title = String(slotElement.dataset.tooltipTitle ?? "").trim();
      const description = String(slotElement.dataset.tooltipDescription ?? "").trim();
      if (!title) {
        hideStatusTooltip();
        return;
      }
      showOverlayTooltip(title, description || "No description.", { x: event.clientX, y: event.clientY }, null, {
        allowOutsideCanvas: true,
        clientCoordinates: true,
        theme: "panel",
        descriptionIsHtml: true
      });
    };
    const onHideTooltip = () => hideStatusTooltip();
    slotElement.addEventListener("pointerenter", onShowTooltip);
    slotElement.addEventListener("pointermove", onShowTooltip);
    slotElement.addEventListener("pointerleave", onHideTooltip);
    slotElement.addEventListener("pointercancel", onHideTooltip);
  }

  function createPanelSlotElement(slotIndex) {
    const slotElement = document.createElement("button");
    slotElement.type = "button";
    slotElement.classList.add("tow-combat-overlay-control-panel__slot");
    slotElement.dataset.slotIndex = String(slotIndex);
    slotElement.setAttribute("aria-label", `Slot ${slotIndex + 1}`);

    const iconPlaceholder = document.createElement("span");
    iconPlaceholder.classList.add("tow-combat-overlay-control-panel__slot-icon");
    iconPlaceholder.textContent = "+";
    slotElement.appendChild(iconPlaceholder);

    bindPanelSlotEvent(slotElement);
    return slotElement;
  }

  return {
    bindPanelSlotEvent,
    createPanelSlotElement
  };
}
