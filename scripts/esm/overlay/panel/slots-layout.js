export function createPanelSlotsLayoutService({
  updatePanelWoundActionIndicator,
  iconSrcWound,
  escapePanelHtml,
  buildPanelItemGroupsForActor,
  getPanelActionEntries,
  getPanelManoeuvreSubActionEntries,
  getPanelRecoverActionEntries,
  isPanelGeneratedUnarmedItem,
  resolveTemporaryEffectDescription,
  panelFallbackItemIcon,
  panelUnarmedActionId,
  panelActionIconByKey,
  resolvePanelButtonOrderScope,
  getControlPanelState,
  readSavedPanelReorderUnlocked,
  syncPanelReorderToggleButton,
  toPanelButtonKey,
  getDefaultPanelButtonKeyOrder,
  parsePanelButtonKey,
  isSyntheticEmptySlotKey,
  readSavedPanelButtonKeyOrder,
  updateGroupSlots
} = {}) {
  function updatePanelSlots(panelElement, token = null) {
    const actor = token?.actor ?? token?.document?.actor ?? null;
    updatePanelWoundActionIndicator(panelElement, actor, {
      woundIconSrc: iconSrcWound,
      escapeHtml: escapePanelHtml
    });
    const groups = actor
      ? buildPanelItemGroupsForActor(actor, {
        getPanelActionEntries,
        getPanelManoeuvreSubActionEntries,
        getPanelRecoverActionEntries,
        isPanelGeneratedUnarmedItem,
        resolveTemporaryEffectDescription,
        fallbackItemIcon: panelFallbackItemIcon,
        unarmedActionId: panelUnarmedActionId,
        actionIconByKey: panelActionIconByKey
      })
      : { actions: [], attacks: [], abilities: [], temporaryEffects: [], manoeuvre: [], recover: [], magic: [] };
    const buttonOrderScope = resolvePanelButtonOrderScope(token);
    const controlPanelState = getControlPanelState();
    if (controlPanelState) controlPanelState.buttonOrderScope = buttonOrderScope;
    const reorderUnlocked = readSavedPanelReorderUnlocked(buttonOrderScope);
    if (controlPanelState) controlPanelState.buttonReorderUnlocked = reorderUnlocked;
    syncPanelReorderToggleButton(panelElement);

    const groupKeys = ["manoeuvre", "recover", "actions", "attacks", "magic"];
    const groupedItems = Object.fromEntries(groupKeys.map((key) => {
      const items = Array.isArray(groups[key]) ? groups[key] : [];
      const normalizedItems = items
        .filter(Boolean)
        .map((item, index) => {
          const stableId = String(item?.id ?? item?.key ?? item?.name ?? `${key}-${index}`).trim();
          const panelButtonKey = toPanelButtonKey(key, stableId);
          return {
            ...item,
            panelGroup: key,
            panelButtonKey
          };
        });
      return [key, normalizedItems];
    }));

    const keyToItem = new Map();
    for (const groupKey of groupKeys) {
      const items = groupedItems[groupKey] ?? [];
      for (const item of items) {
        const buttonKey = String(item?.panelButtonKey ?? "").trim();
        if (!buttonKey) continue;
        keyToItem.set(buttonKey, item);
      }
    }

    const defaultLayoutKeys = getDefaultPanelButtonKeyOrder()
      .map((key) => String(key ?? "").trim())
      .filter((key) => !!parsePanelButtonKey(key))
      .filter((key) => !isSyntheticEmptySlotKey(key));
    const defaultLayoutKeySet = new Set(defaultLayoutKeys);

    const savedLayoutKeysRaw = (readSavedPanelButtonKeyOrder(buttonOrderScope) ?? [])
      .map((key) => String(key ?? "").trim())
      .filter((key) => !!parsePanelButtonKey(key));
    const savedLayoutKeys = [];
    for (const key of savedLayoutKeysRaw) {
      if (isSyntheticEmptySlotKey(key)) {
        savedLayoutKeys.push(key);
        continue;
      }
      if (defaultLayoutKeySet.has(key) || keyToItem.has(key)) savedLayoutKeys.push(key);
    }

    const layoutKeys = Array.from(new Set([
      ...savedLayoutKeys,
      ...defaultLayoutKeys
    ]));

    const flattenedItems = [];
    const consumedKeys = new Set();
    for (const buttonKey of layoutKeys) {
      const key = String(buttonKey ?? "").trim();
      if (!key || consumedKeys.has(key)) continue;
      const item = keyToItem.get(key) ?? null;
      if (item) {
        flattenedItems.push(item);
      } else if (isSyntheticEmptySlotKey(key)) {
        const parsed = parsePanelButtonKey(key);
        flattenedItems.push({
          __empty: true,
          panelButtonKey: key,
          panelGroup: String(parsed?.groupKey ?? "all")
        });
      }
      consumedKeys.add(key);
    }

    const appendUnconsumedItems = (groupKey, { include } = {}) => {
      const items = Array.isArray(groupedItems[groupKey]) ? groupedItems[groupKey] : [];
      for (const item of items) {
        if (typeof include === "function" && !include(item)) continue;
        const itemKey = String(item?.panelButtonKey ?? "").trim();
        if (itemKey && consumedKeys.has(itemKey)) continue;
        flattenedItems.push(item);
        if (itemKey) consumedKeys.add(itemKey);
      }
    };

    appendUnconsumedItems("manoeuvre");
    appendUnconsumedItems("recover");
    appendUnconsumedItems("actions", {
      include: (item) => String(item?.id ?? "").trim().toLowerCase() !== "accumulatepower"
    });
    appendUnconsumedItems("attacks");
    const hasAccumulate = (Array.isArray(groupedItems.actions) ? groupedItems.actions : [])
      .some((item) => String(item?.id ?? "").trim().toLowerCase() === "accumulatepower");
    if (hasAccumulate && (flattenedItems.length % 2) === 1) {
      const alignEmptyKey = toPanelButtonKey("attacks", "empty-slot-attacks-align-accumulate");
      if (!consumedKeys.has(alignEmptyKey)) {
        flattenedItems.push({
          __empty: true,
          panelButtonKey: alignEmptyKey,
          panelGroup: "attacks"
        });
        consumedKeys.add(alignEmptyKey);
      }
    }
    appendUnconsumedItems("actions", {
      include: (item) => String(item?.id ?? "").trim().toLowerCase() === "accumulatepower"
    });
    appendUnconsumedItems("magic");

    updateGroupSlots(panelElement, "all", flattenedItems, actor);
    updateGroupSlots(panelElement, "abilities", groups.abilities, actor);
    updateGroupSlots(panelElement, "temporaryEffects", groups.temporaryEffects, actor);
  }

  return {
    updatePanelSlots
  };
}
