export function createPanelReorderService({
  bindPanelTooltipEvent,
  getControlPanelState,
  writeSavedPanelReorderUnlocked,
  clearSavedPanelButtonKeyOrder,
  readSavedPanelButtonKeyOrder,
  writeSavedPanelButtonKeyOrder,
  parsePanelButtonKey,
  toPanelButtonKey,
  reorderableGroupKeys,
  panelUnarmedActionId,
  updateSelectionDisplay
} = {}) {
  function getCurrentPanelButtonOrderScope() {
    const controlPanelState = getControlPanelState();
    return String(controlPanelState?.buttonOrderScope ?? "global").trim() || "global";
  }

  function getDefaultPanelButtonKeyOrder() {
    const preferredSequence = [
      ["manoeuvre", "charge"],
      ["manoeuvre", "run"],
      ["manoeuvre", "moveQuietly"],
      ["manoeuvre", "moveCarefully"],
      ["recover", "recover"],
      ["recover", "treat"],
      ["actions", "help"],
      ["recover", "condition"],
      ["actions", "defence"],
      ["actions", "aim"],
      ["attacks", panelUnarmedActionId],
      ["actions", "improvise"]
    ];
    return preferredSequence
      .map(([groupKey, itemId]) => toPanelButtonKey(groupKey, itemId))
      .filter(Boolean);
  }

  function isPanelButtonReorderUnlocked() {
    const controlPanelState = getControlPanelState();
    return !!controlPanelState?.buttonReorderUnlocked;
  }

  function getPanelReorderToggleTooltipData(unlocked) {
    if (unlocked) {
      return {
        title: "Button Order: Unlocked",
        description: "<em>Click to lock button order.</em><br><br>Drag and drop is enabled."
      };
    }
    return {
      title: "Button Order: Locked",
      description: "<em>Click to unlock and rearrange buttons.</em><br><br>Drag and drop is disabled."
    };
  }

  function syncPanelReorderToggleButton(panelElement) {
    if (!(panelElement instanceof HTMLElement)) return;
    const button = panelElement.querySelector("[data-action='toggle-button-reorder']");
    if (!(button instanceof HTMLButtonElement)) return;
    const unlocked = isPanelButtonReorderUnlocked();
    const tooltipData = getPanelReorderToggleTooltipData(unlocked);
    button.dataset.state = unlocked ? "unlocked" : "locked";
    button.setAttribute("aria-pressed", unlocked ? "true" : "false");
    button.setAttribute("aria-label", unlocked ? "Lock button order" : "Unlock button order");
    button.dataset.tooltipTitle = tooltipData.title;
    button.dataset.tooltipDescription = tooltipData.description;
    button.removeAttribute("title");
    panelElement.classList.toggle("is-reorder-unlocked", unlocked);
    const icon = button.querySelector(".tow-combat-overlay-control-panel__reorder-toggle-icon");
    if (icon instanceof HTMLElement) icon.textContent = unlocked ? "U" : "L";
  }

  function bindPanelReorderToggle(panelElement) {
    if (!(panelElement instanceof HTMLElement)) return;
    const button = panelElement.querySelector("[data-action='toggle-button-reorder']");
    if (!(button instanceof HTMLButtonElement)) return;
    bindPanelTooltipEvent(button, () => getPanelReorderToggleTooltipData(isPanelButtonReorderUnlocked()));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const controlPanelState = getControlPanelState();
      if (!controlPanelState) return;
      const scope = getCurrentPanelButtonOrderScope();
      const unlocked = !isPanelButtonReorderUnlocked();
      controlPanelState.buttonReorderUnlocked = unlocked;
      writeSavedPanelReorderUnlocked(unlocked, scope);
      syncPanelReorderToggleButton(panelElement);
    });
    syncPanelReorderToggleButton(panelElement);
  }

  function bindPanelReorderReset(panelElement) {
    if (!(panelElement instanceof HTMLElement)) return;
    const button = panelElement.querySelector("[data-action='reset-button-order']");
    if (!(button instanceof HTMLButtonElement)) return;
    const tooltipTitle = "Reset Button Order";
    const tooltipDescription = "<em>Click to reset the selected token action buttons to default order.</em>";
    button.dataset.tooltipTitle = tooltipTitle;
    button.dataset.tooltipDescription = tooltipDescription;
    button.removeAttribute("title");
    bindPanelTooltipEvent(button, () => ({ title: tooltipTitle, description: tooltipDescription }));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const scope = getCurrentPanelButtonOrderScope();
      clearSavedPanelButtonKeyOrder(scope);
      const controlPanelState = getControlPanelState();
      if (controlPanelState?.element instanceof HTMLElement) {
        updateSelectionDisplay(controlPanelState.element);
      }
    });
  }

  function getSlotPanelButtonKey(slotElement) {
    if (!(slotElement instanceof HTMLElement)) return "";
    const itemType = String(slotElement.dataset.itemType ?? "").trim();
    const itemGroup = String(slotElement.dataset.itemGroup ?? "").trim();

    if (itemType === "empty") {
      const explicitKey = String(slotElement.dataset.itemOrderKey ?? "").trim();
      if (explicitKey && parsePanelButtonKey(explicitKey)) return explicitKey;
      const fallbackId = String(slotElement.dataset.itemId ?? "").trim() || "empty";
      return toPanelButtonKey(itemGroup || "all", fallbackId);
    }

    if (itemType !== "item") return "";
    if (!reorderableGroupKeys.has(itemGroup)) return "";

    const explicitKey = String(slotElement.dataset.itemOrderKey ?? "").trim();
    if (explicitKey && parsePanelButtonKey(explicitKey)) return explicitKey;

    const itemId = String(slotElement.dataset.itemId ?? "").trim();
    return toPanelButtonKey(itemGroup, itemId);
  }

  function isMainActionPanelSlot(slotElement) {
    if (!(slotElement instanceof HTMLElement)) return false;
    if (!slotElement.closest(".tow-combat-overlay-control-panel__group-grid[data-item-group='all']")) return false;
    return !!getSlotPanelButtonKey(slotElement);
  }

  function getVisibleMainPanelButtonKeys(panelElement) {
    if (!(panelElement instanceof HTMLElement)) return [];
    const slots = Array.from(
      panelElement.querySelectorAll(".tow-combat-overlay-control-panel__group-grid[data-item-group='all'] .tow-combat-overlay-control-panel__slot")
    );
    if (!slots.length) return [];
    const keys = [];
    for (const slot of slots) {
      const key = getSlotPanelButtonKey(slot);
      if (!key || !parsePanelButtonKey(key)) continue;
      keys.push(key);
    }
    return keys;
  }

  function movePanelButtonKeyBeforeTarget(sourceKey, targetKey, panelElement = null) {
    const source = String(sourceKey ?? "").trim();
    const target = String(targetKey ?? "").trim();
    if (!source || !target || source === target) return false;

    const scope = getCurrentPanelButtonOrderScope();
    const defaultOrder = getDefaultPanelButtonKeyOrder();
    const savedOrder = readSavedPanelButtonKeyOrder(scope) ?? [];
    const visibleOrder = getVisibleMainPanelButtonKeys(panelElement);
    const merged = Array.from(new Set([...visibleOrder, ...savedOrder, ...defaultOrder]));

    if (!merged.includes(source)) merged.push(source);
    if (!merged.includes(target)) merged.push(target);

    const sourceIndex = merged.indexOf(source);
    const targetIndex = merged.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0) return false;

    const temp = merged[sourceIndex];
    merged[sourceIndex] = merged[targetIndex];
    merged[targetIndex] = temp;

    const normalized = merged.filter((key) => !!parsePanelButtonKey(key));
    writeSavedPanelButtonKeyOrder(normalized, scope);
    return true;
  }

  return {
    getDefaultPanelButtonKeyOrder,
    isPanelButtonReorderUnlocked,
    syncPanelReorderToggleButton,
    bindPanelReorderToggle,
    bindPanelReorderReset,
    movePanelButtonKeyBeforeTarget,
    getSlotPanelButtonKey,
    isMainActionPanelSlot
  };
}
