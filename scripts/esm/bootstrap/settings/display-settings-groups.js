export function buildDisplaySettingsGroups(settingKeys, minimumRoleChoices) {
  const tokensPanelSettings = Object.freeze([
    {
      key: settingKeys.enableTopPanel,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.EnableTopPanel.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.EnableTopPanel.Hint"
    },
    {
      key: settingKeys.tokensPanelCardsDragDropMinimumRole,
      type: "select",
      defaultValue: "all",
      choices: minimumRoleChoices,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelCardsDragDropMinimumRole.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelCardsDragDropMinimumRole.Hint"
    },
    {
      key: settingKeys.tokensPanelMinimumRole,
      type: "select",
      defaultValue: "all",
      choices: minimumRoleChoices,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelMinimumRole.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelMinimumRole.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableStatusRow,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableStatusRow.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableStatusRow.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableStatuses,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokensPanelEnableStatusRow,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableStatuses.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableStatuses.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableWounds,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokensPanelEnableStatusRow,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableWounds.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableWounds.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableTemporaryEffects,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokensPanelEnableStatusRow,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableTemporaryEffects.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableTemporaryEffects.Hint"
    },
    {
      key: settingKeys.tokensPanelShowDeadVisual,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelShowDeadVisual.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelShowDeadVisual.Hint"
    },
    {
      key: settingKeys.tokensPanelPositionMode,
      type: "select",
      defaultValue: "free",
      choices: Object.freeze({
        free: "TOWCOMBATOVERLAY.Setting.TokensPanelPositionMode.OptionFree",
        locked: "TOWCOMBATOVERLAY.Setting.TokensPanelPositionMode.OptionLocked",
        alwaysCentered: "TOWCOMBATOVERLAY.Setting.TokensPanelPositionMode.OptionAlwaysCentered"
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelPositionMode.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelPositionMode.Hint"
    },
    {
      key: settingKeys.tokensPanelDragButtonPosition,
      type: "select",
      defaultValue: "right",
      visibleWhen: Object.freeze({
        key: settingKeys.tokensPanelPositionMode,
        equals: "free"
      }),
      choices: Object.freeze({
        left: "TOWCOMBATOVERLAY.Setting.TokensPanelDragButtonPosition.OptionLeft",
        right: "TOWCOMBATOVERLAY.Setting.TokensPanelDragButtonPosition.OptionRight"
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelDragButtonPosition.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelDragButtonPosition.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableTooltips,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableTooltips.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableTooltips.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableCardsTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokensPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableCardsTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableCardsTooltip.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableStatusesTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokensPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableStatusesTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableStatusesTooltip.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableWoundsTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokensPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableWoundsTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableWoundsTooltip.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableTemporaryEffectsTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokensPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableTemporaryEffectsTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableTemporaryEffectsTooltip.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableOverflowTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokensPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableOverflowTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableOverflowTooltip.Hint"
    }
  ]);

  const tokenLayoutSettings = Object.freeze([
    {
      key: settingKeys.enableOverlay,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.EnableOverlay.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.EnableOverlay.Hint"
    },
    {
      key: settingKeys.tokenLayoutMinimumRole,
      type: "select",
      defaultValue: "all",
      choices: minimumRoleChoices,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutMinimumRole.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutMinimumRole.Hint"
    },
    {
      key: settingKeys.tokenLayoutShowBorder,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutShowBorder.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutShowBorder.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableStatusRow,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableStatusRow.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableStatusRow.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableStatuses,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokenLayoutEnableStatusRow,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableStatuses.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableStatuses.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableWounds,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokenLayoutEnableStatusRow,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableWounds.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableWounds.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableTemporaryEffects,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokenLayoutEnableStatusRow,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableTemporaryEffects.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableTemporaryEffects.Hint"
    },
    {
      key: settingKeys.tokenLayoutShowCustomName,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutShowCustomName.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutShowCustomName.Hint"
    },
    {
      key: settingKeys.tokenLayoutNamePosition,
      type: "select",
      defaultValue: "bottom",
      visibleWhen: Object.freeze({
        key: settingKeys.tokenLayoutShowCustomName,
        equals: true
      }),
      choices: Object.freeze({
        top: "TOWCOMBATOVERLAY.Setting.TokenLayoutNamePosition.OptionTop",
        bottom: "TOWCOMBATOVERLAY.Setting.TokenLayoutNamePosition.OptionBottom"
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutNamePosition.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutNamePosition.Hint"
    },
    {
      key: settingKeys.tokenLayoutShowDeadVisuals,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutShowDeadVisuals.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutShowDeadVisuals.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableTooltips,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableTooltips.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableTooltips.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableNameTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokenLayoutEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableNameTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableNameTooltip.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableStatusesTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokenLayoutEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableStatusesTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableStatusesTooltip.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableWoundsTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokenLayoutEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableWoundsTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableWoundsTooltip.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableTemporaryEffectsTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokenLayoutEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableTemporaryEffectsTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableTemporaryEffectsTooltip.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableOverflowTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.tokenLayoutEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableOverflowTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableOverflowTooltip.Hint"
    }
  ]);

  const controlPanelSettings = Object.freeze([
    {
      key: settingKeys.enableControlPanel,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.EnableControlPanel.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.EnableControlPanel.Hint"
    },
    {
      key: settingKeys.controlPanelMinimumRole,
      type: "select",
      defaultValue: "all",
      choices: minimumRoleChoices,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelMinimumRole.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelMinimumRole.Hint"
    },
    {
      key: settingKeys.controlPanelEnableStatusRow,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStatusRow.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStatusRow.Hint"
    },
    {
      key: settingKeys.controlPanelEnableStatuses,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableStatusRow,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStatuses.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStatuses.Hint"
    },
    {
      key: settingKeys.controlPanelEnableAbilities,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableStatusRow,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableAbilities.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableAbilities.Hint"
    },
    {
      key: settingKeys.controlPanelEnableWounds,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableStatusRow,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableWounds.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableWounds.Hint"
    },
    {
      key: settingKeys.controlPanelEnableTemporaryEffects,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableStatusRow,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableTemporaryEffects.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableTemporaryEffects.Hint"
    },
    {
      key: settingKeys.controlPanelEnablePortrait,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnablePortrait.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnablePortrait.Hint"
    },
    {
      key: settingKeys.controlPanelEnableName,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnablePortrait,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableName.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableName.Hint"
    },
    {
      key: settingKeys.controlPanelEnableImage,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnablePortrait,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableImage.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableImage.Hint"
    },
    {
      key: settingKeys.controlPanelEnableStats,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnablePortrait,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStats.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStats.Hint"
    },
    {
      key: settingKeys.controlPanelEnableGridButtons,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableGridButtons.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableGridButtons.Hint"
    },
    {
      key: settingKeys.controlPanelEnableActionButtons,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableGridButtons,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableActionButtons.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableActionButtons.Hint"
    },
    {
      key: settingKeys.controlPanelEnableWeaponsButtons,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableGridButtons,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableWeaponsButtons.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableWeaponsButtons.Hint"
    },
    {
      key: settingKeys.controlPanelEnableMagicButtons,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableGridButtons,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableMagicButtons.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableMagicButtons.Hint"
    },
    {
      key: settingKeys.controlPanelEnableItemsRarity,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableGridButtons,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableItemsRarity.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableItemsRarity.Hint"
    },
    {
      key: settingKeys.controlPanelShowDeadPortraitStatus,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnablePortrait,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelShowDeadPortraitStatus.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelShowDeadPortraitStatus.Hint"
    },
    {
      key: settingKeys.controlPanelPositionMode,
      type: "select",
      defaultValue: "free",
      choices: Object.freeze({
        free: "TOWCOMBATOVERLAY.Setting.ControlPanelPositionMode.OptionFree",
        locked: "TOWCOMBATOVERLAY.Setting.ControlPanelPositionMode.OptionLocked",
        alwaysCentered: "TOWCOMBATOVERLAY.Setting.ControlPanelPositionMode.OptionAlwaysCentered"
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelPositionMode.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelPositionMode.Hint"
    },
    {
      key: settingKeys.controlPanelEnableButtonsDragDrop,
      defaultValue: false,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableButtonsDragDrop.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableButtonsDragDrop.Hint"
    },
    {
      key: settingKeys.controlPanelEnableTooltips,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableTooltips.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableTooltips.Hint"
    },
    {
      key: settingKeys.controlPanelShowTooltipClickBehaviorText,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelShowTooltipClickBehaviorText.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelShowTooltipClickBehaviorText.Hint"
    },
    {
      key: settingKeys.controlPanelEnableNameTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableNameTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableNameTooltip.Hint"
    },
    {
      key: settingKeys.controlPanelEnableStatsTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStatsTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStatsTooltip.Hint"
    },
    {
      key: settingKeys.controlPanelEnableStatusesTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStatusesTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStatusesTooltip.Hint"
    },
    {
      key: settingKeys.controlPanelEnableAbilitiesTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableAbilitiesTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableAbilitiesTooltip.Hint"
    },
    {
      key: settingKeys.controlPanelEnableWoundsTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableWoundsTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableWoundsTooltip.Hint"
    },
    {
      key: settingKeys.controlPanelEnableTemporaryEffectsTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableTemporaryEffectsTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableTemporaryEffectsTooltip.Hint"
    },
    {
      key: settingKeys.controlPanelEnableButtonsTooltip,
      defaultValue: true,
      visibleWhen: Object.freeze({
        key: settingKeys.controlPanelEnableTooltips,
        equals: true
      }),
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableButtonsTooltip.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableButtonsTooltip.Hint"
    }
  ]);

  return Object.freeze({
    tokensPanel: Object.freeze({
      menuKey: "tokensPanel",
      settings: tokensPanelSettings,
      sections: Object.freeze([
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokensPanel.General",
          settingKeys: Object.freeze([
            settingKeys.enableTopPanel,
            settingKeys.tokensPanelMinimumRole,
            settingKeys.tokensPanelCardsDragDropMinimumRole,
            settingKeys.tokensPanelPositionMode,
            settingKeys.tokensPanelDragButtonPosition
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokensPanel.Chips",
          settingKeys: Object.freeze([
            settingKeys.tokensPanelEnableStatusRow,
            settingKeys.tokensPanelEnableStatuses,
            settingKeys.tokensPanelEnableWounds,
            settingKeys.tokensPanelEnableTemporaryEffects
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokensPanel.Behavior",
          settingKeys: Object.freeze([
            settingKeys.tokensPanelShowDeadVisual
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokensPanel.Tooltips",
          settingKeys: Object.freeze([
            settingKeys.tokensPanelEnableTooltips,
            settingKeys.tokensPanelEnableCardsTooltip,
            settingKeys.tokensPanelEnableStatusesTooltip,
            settingKeys.tokensPanelEnableWoundsTooltip,
            settingKeys.tokensPanelEnableTemporaryEffectsTooltip,
            settingKeys.tokensPanelEnableOverflowTooltip
          ])
        }
      ])
    }),
    tokenLayout: Object.freeze({
      menuKey: "tokenLayout",
      settings: tokenLayoutSettings,
      sections: Object.freeze([
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokenLayout.General",
          settingKeys: Object.freeze([
            settingKeys.enableOverlay,
            settingKeys.tokenLayoutMinimumRole
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokenLayout.Chips",
          settingKeys: Object.freeze([
            settingKeys.tokenLayoutEnableStatusRow,
            settingKeys.tokenLayoutEnableStatuses,
            settingKeys.tokenLayoutEnableWounds,
            settingKeys.tokenLayoutEnableTemporaryEffects
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokenLayout.Overlay",
          settingKeys: Object.freeze([
            settingKeys.tokenLayoutShowCustomName,
            settingKeys.tokenLayoutNamePosition,
            settingKeys.tokenLayoutShowBorder,
            settingKeys.tokenLayoutShowDeadVisuals
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokenLayout.Tooltips",
          settingKeys: Object.freeze([
            settingKeys.tokenLayoutEnableTooltips,
            settingKeys.tokenLayoutEnableNameTooltip,
            settingKeys.tokenLayoutEnableStatusesTooltip,
            settingKeys.tokenLayoutEnableWoundsTooltip,
            settingKeys.tokenLayoutEnableTemporaryEffectsTooltip,
            settingKeys.tokenLayoutEnableOverflowTooltip
          ])
        }
      ])
    }),
    controlPanel: Object.freeze({
      menuKey: "controlPanel",
      settings: controlPanelSettings,
      sections: Object.freeze([
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.ControlPanel.General",
          settingKeys: Object.freeze([
            settingKeys.enableControlPanel,
            settingKeys.controlPanelMinimumRole,
            settingKeys.controlPanelPositionMode,
            settingKeys.controlPanelEnableButtonsDragDrop
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.ControlPanel.StatusRow",
          settingKeys: Object.freeze([
            settingKeys.controlPanelEnableStatusRow,
            settingKeys.controlPanelEnableStatuses,
            settingKeys.controlPanelEnableAbilities,
            settingKeys.controlPanelEnableWounds,
            settingKeys.controlPanelEnableTemporaryEffects
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.ControlPanel.Portrait",
          settingKeys: Object.freeze([
            settingKeys.controlPanelEnablePortrait,
            settingKeys.controlPanelEnableName,
            settingKeys.controlPanelEnableImage,
            settingKeys.controlPanelEnableStats,
            settingKeys.controlPanelShowDeadPortraitStatus
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.ControlPanel.GridButtons",
          settingKeys: Object.freeze([
            settingKeys.controlPanelEnableGridButtons,
            settingKeys.controlPanelEnableActionButtons,
            settingKeys.controlPanelEnableWeaponsButtons,
            settingKeys.controlPanelEnableMagicButtons,
            settingKeys.controlPanelEnableItemsRarity
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.ControlPanel.Tooltips",
          settingKeys: Object.freeze([
            settingKeys.controlPanelEnableTooltips,
            settingKeys.controlPanelShowTooltipClickBehaviorText,
            settingKeys.controlPanelEnableNameTooltip,
            settingKeys.controlPanelEnableStatsTooltip,
            settingKeys.controlPanelEnableStatusesTooltip,
            settingKeys.controlPanelEnableAbilitiesTooltip,
            settingKeys.controlPanelEnableWoundsTooltip,
            settingKeys.controlPanelEnableTemporaryEffectsTooltip,
            settingKeys.controlPanelEnableButtonsTooltip
          ])
        }
      ])
    })
  });
}


