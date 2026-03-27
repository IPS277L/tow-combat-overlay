export function createControlPanelTooltipVisibilityService({
  moduleSettings,
  isSettingEnabled
} = {}) {
  const isControlPanelTooltipsEnabled = () => isSettingEnabled(moduleSettings.controlPanelEnableTooltips, true);
  const isControlPanelNameTooltipEnabled = () => (
    isControlPanelTooltipsEnabled()
    && isSettingEnabled(moduleSettings.controlPanelEnableNameTooltip, true)
  );
  const showControlPanelTooltipClickBehaviorText = () => (
    isControlPanelTooltipsEnabled()
    && isSettingEnabled(moduleSettings.controlPanelShowTooltipClickBehaviorText, true)
  );
  const isControlPanelStatsTooltipEnabled = () => (
    isControlPanelTooltipsEnabled()
    && isSettingEnabled(moduleSettings.controlPanelEnableStatsTooltip, true)
  );
  const isControlPanelStatusesTooltipEnabled = () => (
    isControlPanelTooltipsEnabled()
    && isSettingEnabled(moduleSettings.controlPanelEnableStatusesTooltip, true)
  );
  const isControlPanelAbilitiesTooltipEnabled = () => (
    isControlPanelTooltipsEnabled()
    && isSettingEnabled(moduleSettings.controlPanelEnableAbilitiesTooltip, true)
  );
  const isControlPanelWoundsTooltipEnabled = () => (
    isControlPanelTooltipsEnabled()
    && isSettingEnabled(moduleSettings.controlPanelEnableWoundsTooltip, true)
  );
  const isControlPanelTemporaryEffectsTooltipEnabled = () => (
    isControlPanelTooltipsEnabled()
    && isSettingEnabled(moduleSettings.controlPanelEnableTemporaryEffectsTooltip, true)
  );
  const isControlPanelButtonsTooltipEnabled = () => (
    isControlPanelTooltipsEnabled()
    && isSettingEnabled(moduleSettings.controlPanelEnableButtonsTooltip, true)
  );

  const canShowControlPanelSlotTooltip = (slotElement) => {
    if (!(slotElement instanceof HTMLElement)) return false;
    if (!isControlPanelTooltipsEnabled()) return false;
    const groupKey = String(slotElement.dataset.itemGroup ?? "").trim();
    const topChipType = String(slotElement.dataset.itemTopChipType ?? "").trim();
    if (groupKey === "topChips") {
      if (topChipType === "abilities") return isControlPanelAbilitiesTooltipEnabled();
      if (topChipType === "woundActions") return isControlPanelWoundsTooltipEnabled();
      if (topChipType === "temporaryEffects") return isControlPanelTemporaryEffectsTooltipEnabled();
      return false;
    }
    if (groupKey === "abilities") return isControlPanelAbilitiesTooltipEnabled();
    if (groupKey === "temporaryEffects") return isControlPanelTemporaryEffectsTooltipEnabled();
    return isControlPanelButtonsTooltipEnabled();
  };

  return {
    isControlPanelTooltipsEnabled,
    isControlPanelNameTooltipEnabled,
    showControlPanelTooltipClickBehaviorText,
    isControlPanelStatsTooltipEnabled,
    isControlPanelStatusesTooltipEnabled,
    isControlPanelAbilitiesTooltipEnabled,
    isControlPanelWoundsTooltipEnabled,
    isControlPanelTemporaryEffectsTooltipEnabled,
    isControlPanelButtonsTooltipEnabled,
    canShowControlPanelSlotTooltip
  };
}
