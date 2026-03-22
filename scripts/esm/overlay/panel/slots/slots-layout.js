import { getOverlayWoundIndicatorData } from "../../shared/wound-chip-data.js";
import { getTowCombatOverlayConstants } from "../../../runtime/module-constants.js";
import { isTowCombatOverlayDisplaySettingEnabled } from "../../../bootstrap/register-settings.js";

const { settings: MODULE_SETTINGS } = getTowCombatOverlayConstants();

export function createPanelSlotsLayoutService({
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
  function localizeMaybe(key, fallback = "") {
    const localized = game?.i18n?.localize?.(String(key ?? ""));
    if (typeof localized === "string" && localized !== key) return localized;
    return String(fallback ?? key ?? "");
  }

  function supportsWoundActionChip(actor) {
    return !!actor && actor.type === "npc" && actor.system?.hasThresholds === true;
  }

  function buildTopChips(groups, actor) {
    const enableAbilities = isTowCombatOverlayDisplaySettingEnabled(MODULE_SETTINGS.controlPanelEnableAbilities, true);
    const enableWounds = isTowCombatOverlayDisplaySettingEnabled(MODULE_SETTINGS.controlPanelEnableWounds, true);
    const enableTemporaryEffects = isTowCombatOverlayDisplaySettingEnabled(MODULE_SETTINGS.controlPanelEnableTemporaryEffects, true);
    const abilities = enableAbilities
      ? (Array.isArray(groups?.abilities) ? groups.abilities : [])
      : [];
    const temporaryEffects = enableTemporaryEffects
      ? (Array.isArray(groups?.temporaryEffects) ? groups.temporaryEffects : [])
      : [];
    const woundIndicator = enableWounds
      ? getOverlayWoundIndicatorData(actor, {
        woundIconSrc: iconSrcWound,
        escapeHtml: escapePanelHtml
      })
      : null;
    const woundChipData = enableWounds ? (woundIndicator ?? (supportsWoundActionChip(actor)
      ? {
        title: localizeMaybe("TOWCOMBATOVERLAY.Tooltip.Panel.WoundActions.Title", "Wound Actions"),
        description: localizeMaybe("TOWCOMBATOVERLAY.Tooltip.Panel.WoundActions.Fallback", "Use wounds controls below."),
        image: iconSrcWound,
        isActive: false
      }
      : null)) : null;
    const woundChip = woundChipData
      ? [{
        id: "__wound_actions__",
        key: "ability:wound-actions",
        name: String(woundChipData.title ?? "Wounds").trim(),
        img: String(woundChipData.image ?? "").trim() || iconSrcWound,
        system: {
          description: String(woundChipData.description ?? "").trim()
        },
        panelTopChipType: "woundActions",
        panelTopChipActive: woundChipData.isActive === true
      }]
      : [];

    return [
      ...abilities.map((item) => ({ ...item, panelTopChipType: "abilities" })),
      ...woundChip,
      ...temporaryEffects.map((item) => ({ ...item, panelTopChipType: "temporaryEffects" }))
    ];
  }

  function updatePanelSlots(panelElement, token = null) {
    const enableActionButtons = isTowCombatOverlayDisplaySettingEnabled(MODULE_SETTINGS.controlPanelEnableActionButtons, true);
    const enableWeaponsButtons = isTowCombatOverlayDisplaySettingEnabled(MODULE_SETTINGS.controlPanelEnableWeaponsButtons, true);
    const enableMagicButtons = isTowCombatOverlayDisplaySettingEnabled(MODULE_SETTINGS.controlPanelEnableMagicButtons, true);
    const actor = token?.actor ?? token?.document?.actor ?? null;
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
    const topChips = buildTopChips(groups, actor);
    const buttonOrderScope = resolvePanelButtonOrderScope(token);
    const controlPanelState = getControlPanelState();
    if (controlPanelState) controlPanelState.buttonOrderScope = buttonOrderScope;
    const reorderUnlocked = readSavedPanelReorderUnlocked(buttonOrderScope);
    if (controlPanelState) controlPanelState.buttonReorderUnlocked = reorderUnlocked;
    syncPanelReorderToggleButton(panelElement);

    const groupKeys = ["manoeuvre", "recover", "actions", "attacks", "magic"];
    const groupedItems = Object.fromEntries(groupKeys.map((key) => {
      const items = Array.isArray(groups[key]) ? groups[key] : [];
      const groupEnabled = (
        ((key === "actions" || key === "manoeuvre" || key === "recover"))
        || (key === "attacks")
        || (key === "magic" && enableMagicButtons)
      );
      const normalizedItems = items
        .filter(Boolean)
        .filter(() => groupEnabled)
        .filter((item) => {
          if (key === "manoeuvre" || key === "recover") return enableActionButtons;
          if (key === "attacks") {
            const itemId = String(item?.id ?? "").trim().toLowerCase();
            const unarmedId = String(panelUnarmedActionId ?? "").trim().toLowerCase();
            if (itemId && unarmedId && itemId === unarmedId) return enableActionButtons;
            return enableWeaponsButtons;
          }
          if (key !== "actions") return true;
          const itemId = String(item?.id ?? "").trim().toLowerCase();
          if (itemId === "accumulatepower") return enableMagicButtons;
          return enableActionButtons;
        })
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
    updateGroupSlots(panelElement, "topChips", topChips, actor);
  }

  return {
    updatePanelSlots
  };
}

