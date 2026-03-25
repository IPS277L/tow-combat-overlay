export function createPanelReorderService({
  getControlPanelState,
  readSavedPanelButtonKeyOrder,
  writeSavedPanelButtonKeyOrder,
  parsePanelButtonKey,
  toPanelButtonKey,
  reorderableGroupKeys,
  panelUnarmedActionId
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
    movePanelButtonKeyBeforeTarget,
    getSlotPanelButtonKey,
    isMainActionPanelSlot
  };
}
