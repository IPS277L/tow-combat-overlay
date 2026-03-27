import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";

const SETTINGS_GROUP_TEMPLATE_PATH = "modules/tow-combat-overlay/templates/settings/display-settings-group.hbs";

function localizeMaybe(key, fallback = "") {
  const localized = game?.i18n?.localize?.(String(key ?? ""));
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? key ?? "");
}

function getSettingsGroupNameFallback(menuKey) {
  const normalized = String(menuKey ?? "").trim();
  if (normalized === "tokensPanel") return "Tokens Panel";
  if (normalized === "tokenLayout") return "Token Layout";
  if (normalized === "controlPanel") return "Control Panel";
  return normalized || "Settings";
}

function humanizeSettingKey(settingKey) {
  return String(settingKey ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeSelectSettingValue(settingDefinition, value) {
  const choices = (settingDefinition && typeof settingDefinition.choices === "object" && settingDefinition.choices !== null)
    ? settingDefinition.choices
    : {};
  const allowedValues = Object.keys(choices);
  if (!allowedValues.length) return String(settingDefinition?.defaultValue ?? "");
  const normalized = String(value ?? "").trim();
  if (allowedValues.includes(normalized)) return normalized;
  return String(settingDefinition?.defaultValue ?? allowedValues[0] ?? "").trim();
}

function getFoundryUserRoleEntries() {
  const source = CONST?.USER_ROLES;
  if (!source || typeof source !== "object") return [];
  return Object.entries(source)
    .map(([roleName, roleValue]) => ({
      roleName: String(roleName ?? "").trim(),
      roleValue: Number(roleValue)
    }))
    .filter((entry) => entry.roleName && Number.isFinite(entry.roleValue))
    .sort((left, right) => left.roleValue - right.roleValue);
}

function getRoleLabelLocalizationKey(roleName) {
  const normalized = String(roleName ?? "").trim().toUpperCase();
  if (!normalized) return "";
  const sentenceCase = normalized.charAt(0) + normalized.slice(1).toLowerCase();
  return `USER.Role${sentenceCase}`;
}

function buildMinimumRoleSettingChoices() {
  const choices = {
    all: "TOWCOMBATOVERLAY.Setting.VisibilityRole.OptionAllUsers"
  };
  for (const entry of getFoundryUserRoleEntries()) {
    choices[String(entry.roleValue)] = getRoleLabelLocalizationKey(entry.roleName);
  }
  return Object.freeze(choices);
}

function isUserInMinimumRole(minimumRoleValue) {
  const currentRole = Number(game?.user?.role);
  const requiredRole = Number(minimumRoleValue);
  if (!Number.isFinite(currentRole) || !Number.isFinite(requiredRole)) return true;
  return currentRole >= requiredRole;
}

export function canTowCombatOverlayUserViewControl(settingKey, fallbackValue = "all") {
  const selectedRole = String(getTowCombatOverlayDisplaySetting(settingKey, fallbackValue) ?? "").trim().toLowerCase();
  if (!selectedRole || selectedRole === "all") return true;
  const minimumRole = Number(selectedRole);
  if (!Number.isFinite(minimumRole)) return true;
  return isUserInMinimumRole(minimumRole);
}

function buildDisplaySettingsGroups(settingKeys) {
  const minimumRoleChoices = buildMinimumRoleSettingChoices();
  const tokensPanelSettings = Object.freeze([
    {
      key: settingKeys.enableTopPanel,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.EnableTopPanel.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.EnableTopPanel.Hint"
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

function resolveSettingsFormBaseClass() {
  const baseClass = globalThis.FormApplication
    ?? foundry?.applications?.apps?.FormApplication
    ?? foundry?.applications?.api?.FormApplication;
  if (typeof baseClass === "function") return baseClass;
  throw new Error("[tow-combat-overlay] Unable to resolve FormApplication for settings menus.");
}

function createGroupFormClass(group) {
  const SettingsFormBase = resolveSettingsFormBaseClass();
  return class TowCombatOverlaySettingsGroupForm extends SettingsFormBase {
    static get defaultOptions() {
      const inheritedClasses = Array.isArray(super.defaultOptions?.classes)
        ? super.defaultOptions.classes
        : [];
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: `tow-combat-overlay-settings-group-${group.menuKey}`,
        title: localizeMaybe(
          `TOWCOMBATOVERLAY.SettingsGroup.${group.menuKey}.Name`,
          getSettingsGroupNameFallback(group.menuKey)
        ),
        template: SETTINGS_GROUP_TEMPLATE_PATH,
        width: 560,
        classes: [
          ...inheritedClasses,
          "tow-combat-overlay-dialog",
          "tow-combat-overlay-settings-window"
        ],
        closeOnSubmit: true,
        submitOnClose: false,
        submitOnChange: false
      });
    }

    getData() {
      const { moduleId, settings } = getTowCombatOverlayConstants();
      const groupMasterKey = group.menuKey === "tokensPanel"
        ? String(settings.enableTopPanel ?? "").trim()
        : (group.menuKey === "tokenLayout"
            ? String(settings.enableOverlay ?? "").trim()
            : (group.menuKey === "controlPanel"
                ? String(settings.enableControlPanel ?? "").trim()
                : ""));
      const settingDefinitionByKey = new Map(
        group.settings.map((entry) => [String(entry?.key ?? ""), entry])
      );
      const currentValueByKey = new Map(
        group.settings.map((entry) => [entry.key, getTowCombatOverlayDisplaySetting(entry.key, entry.defaultValue)])
      );
      const fields = group.settings.map((entry) => {
        const isSelect = String(entry?.type ?? "boolean").trim() === "select";
        const rawValue = currentValueByKey.get(entry.key);
        const normalizedValue = isSelect
          ? normalizeSelectSettingValue(entry, rawValue)
          : !!rawValue;
        const visibilityRule = entry?.visibleWhen;
        const visibleWhenKey = String(visibilityRule?.key ?? "").trim();
        const visibleWhenValue = String(visibilityRule?.equals ?? "").trim();
        const requiresEnabledKey = groupMasterKey && entry.key !== groupMasterKey
          ? groupMasterKey
          : "";
        const requiresEnabledValue = requiresEnabledKey ? "true" : "";
        let isVisible = true;
        if (requiresEnabledKey) {
          const requiredRawValue = currentValueByKey.get(requiresEnabledKey);
          isVisible = String(!!requiredRawValue) === requiresEnabledValue;
        }
        if (visibleWhenKey) {
          const dependentDefinition = settingDefinitionByKey.get(visibleWhenKey) ?? null;
          const dependentRawValue = currentValueByKey.get(visibleWhenKey);
          const dependentIsSelect = String(dependentDefinition?.type ?? "boolean").trim() === "select";
          const dependentValue = dependentIsSelect
            ? normalizeSelectSettingValue(dependentDefinition, dependentRawValue)
            : String(!!dependentRawValue);
          isVisible = isVisible && (dependentValue === visibleWhenValue);
        }
        const choices = isSelect
          ? Object.entries(entry?.choices ?? {}).map(([value, labelKey]) => ({
            value: String(value ?? ""),
            label: localizeMaybe(labelKey, humanizeSettingKey(value)),
            selected: String(value ?? "") === normalizedValue
          }))
          : [];
        return {
          key: entry.key,
          id: `tow-combat-overlay-setting-${entry.key}`,
          name: localizeMaybe(entry.nameKey, humanizeSettingKey(entry.key)),
          hint: localizeMaybe(entry.hintKey, ""),
          value: normalizedValue,
          isSelect,
          isBoolean: !isSelect,
          choices,
          visibleWhenKey,
          visibleWhenValue,
          requiresEnabledKey,
          requiresEnabledValue,
          isVisible
        };
      });
      const fieldByKey = new Map(fields.map((field) => [field.key, field]));
      const sections = Array.isArray(group.sections)
        ? group.sections.map((section) => ({
          title: localizeMaybe(section.titleKey, ""),
          fields: (Array.isArray(section.settingKeys) ? section.settingKeys : [])
            .map((key) => fieldByKey.get(String(key ?? "")))
            .filter(Boolean)
        })).filter((section) => section.fields.length > 0)
        : [];
      return {
        sections,
        fields,
        saveLabel: localizeMaybe("SETTINGS.Save", "Save"),
        moduleId
      };
    }

    activateListeners(html) {
      super.activateListeners(html);
      const rootElement = html?.[0] instanceof HTMLElement
        ? html[0]
        : (html instanceof HTMLElement ? html : null);
      if (!(rootElement instanceof HTMLElement)) return;
      let resizeFrameId = 0;

      const syncWindowHeight = () => {
        if (resizeFrameId) window.cancelAnimationFrame(resizeFrameId);
        resizeFrameId = window.requestAnimationFrame(() => {
          resizeFrameId = 0;
          if (typeof this.setPosition === "function") this.setPosition({ height: "auto" });
        });
      };

      const syncSelectFieldWidths = () => {
        const selectElements = Array.from(rootElement.querySelectorAll("select"));
        if (!selectElements.length) return;
        const longestLabelLength = selectElements.reduce((maxLength, selectElement) => {
          if (!(selectElement instanceof HTMLSelectElement)) return maxLength;
          const optionLength = Array.from(selectElement.options).reduce((optionMaxLength, optionElement) => {
            const labelLength = String(optionElement?.textContent ?? "").trim().length;
            return Math.max(optionMaxLength, labelLength);
          }, 0);
          return Math.max(maxLength, optionLength);
        }, 0);
        const widthCh = Math.max(12, longestLabelLength + 4);
        for (const selectElement of selectElements) {
          if (!(selectElement instanceof HTMLSelectElement)) continue;
          selectElement.style.width = `${widthCh}ch`;
          selectElement.style.maxWidth = "100%";
        }
      };

      const applyConditionalVisibility = () => {
        const allFields = rootElement.querySelectorAll(".form-group");
        for (const fieldElement of allFields) {
          if (!(fieldElement instanceof HTMLElement)) continue;
          let isVisible = true;
          const requiresEnabledKey = String(fieldElement.dataset.requiresEnabledKey ?? "").trim();
          const requiresEnabledValue = String(fieldElement.dataset.requiresEnabledValue ?? "").trim();
          if (requiresEnabledKey) {
            const requiredInput = rootElement.querySelector(`[name="${requiresEnabledKey}"]`);
            if (requiredInput instanceof HTMLInputElement && requiredInput.type === "checkbox") {
              const requiredCurrentValue = requiredInput.checked ? "true" : "false";
              isVisible = requiredCurrentValue === requiresEnabledValue;
            }
          }
          const dependsOnKey = String(fieldElement.dataset.visibleWhenKey ?? "").trim();
          const equalsValue = String(fieldElement.dataset.visibleWhenValue ?? "").trim();
          if (!dependsOnKey) {
            fieldElement.style.display = isVisible ? "" : "none";
            continue;
          }
          const dependentInput = rootElement.querySelector(`[name="${dependsOnKey}"]`);
          if (!(dependentInput instanceof HTMLElement)) {
            fieldElement.style.display = isVisible ? "" : "none";
            continue;
          }
          let currentValue = "";
          if (dependentInput instanceof HTMLInputElement && dependentInput.type === "checkbox") {
            currentValue = dependentInput.checked ? "true" : "false";
          } else if (dependentInput instanceof HTMLSelectElement) {
            currentValue = String(dependentInput.value ?? "").trim();
          } else {
            currentValue = String(dependentInput.getAttribute("value") ?? "").trim();
          }
          fieldElement.style.display = (isVisible && currentValue === equalsValue) ? "" : "none";
        }
        const sections = rootElement.querySelectorAll(".tow-combat-overlay-settings-group-form__section");
        for (const sectionElement of sections) {
          if (!(sectionElement instanceof HTMLElement)) continue;
          const visibleFields = Array.from(sectionElement.querySelectorAll(".form-group"))
            .filter((field) => field instanceof HTMLElement && field.style.display !== "none");
          sectionElement.style.display = visibleFields.length > 0 ? "" : "none";
        }
        syncSelectFieldWidths();
        syncWindowHeight();
      };

      rootElement.addEventListener("change", applyConditionalVisibility);
      applyConditionalVisibility();
    }

    async _updateObject(_event, formData) {
      const expanded = foundry.utils.expandObject(formData);
      const { moduleId } = getTowCombatOverlayConstants();
      for (const entry of group.settings) {
        const rawValue = expanded?.[entry.key];
        const isSelect = String(entry?.type ?? "boolean").trim() === "select";
        const nextValue = isSelect
          ? normalizeSelectSettingValue(entry, rawValue)
          : (rawValue === true || rawValue === "true" || rawValue === "on");
        await game.settings.set(moduleId, entry.key, nextValue);
      }
    }
  };
}

function registerDisplaySettingsGroupMenu(moduleId, group) {
  const groupNameFallback = getSettingsGroupNameFallback(group.menuKey);
  const localizedName = localizeMaybe(
    `TOWCOMBATOVERLAY.SettingsGroup.${group.menuKey}.Name`,
    groupNameFallback
  );
  const localizedHint = localizeMaybe(
    `TOWCOMBATOVERLAY.SettingsGroup.${group.menuKey}.Hint`,
    `Configure ${groupNameFallback.toLowerCase()}.`
  );
  const localizedLabel = localizeMaybe(
    `TOWCOMBATOVERLAY.SettingsGroup.${group.menuKey}.Label`,
    "Open"
  );
  game.settings.registerMenu(moduleId, `settingsGroup.${group.menuKey}`, {
    name: localizedName,
    hint: localizedHint,
    label: localizedLabel,
    icon: "fas fa-sliders-h",
    type: createGroupFormClass(group),
    restricted: true
  });
}

function registerDisplaySetting(moduleId, settingDefinition, onChange) {
  const isSelect = String(settingDefinition?.type ?? "boolean").trim() === "select";
  if (isSelect) {
    const defaultValue = normalizeSelectSettingValue(settingDefinition, settingDefinition.defaultValue);
    const choices = {};
    for (const [value, labelKey] of Object.entries(settingDefinition?.choices ?? {})) {
      choices[String(value ?? "")] = localizeMaybe(labelKey, humanizeSettingKey(value));
    }
    game.settings.register(moduleId, settingDefinition.key, {
      scope: "world",
      config: false,
      type: String,
      choices,
      default: defaultValue,
      name: settingDefinition.nameKey,
      hint: settingDefinition.hintKey,
      onChange: () => onChange(settingDefinition.key)
    });
    return;
  }

  game.settings.register(moduleId, settingDefinition.key, {
    scope: "world",
    config: false,
    type: Boolean,
    default: !!settingDefinition.defaultValue,
    name: settingDefinition.nameKey,
    hint: settingDefinition.hintKey,
    onChange: () => onChange(settingDefinition.key)
  });
}

export function getTowCombatOverlayDisplaySetting(settingKey, fallbackValue = null) {
  const { moduleId } = getTowCombatOverlayConstants();
  try {
    return game.settings.get(moduleId, settingKey);
  } catch (_error) {
    return fallbackValue;
  }
}

export function isTowCombatOverlayDisplaySettingEnabled(settingKey, fallbackValue = false) {
  return !!getTowCombatOverlayDisplaySetting(settingKey, fallbackValue);
}

export function registerTowCombatOverlayDisplaySettings({ onDisplaySettingsChanged = null } = {}) {
  const { moduleId, settings: settingKeys } = getTowCombatOverlayConstants();
  const handleDisplaySettingChange = (typeof onDisplaySettingsChanged === "function")
    ? onDisplaySettingsChanged
    : () => {};
  const groups = buildDisplaySettingsGroups(settingKeys);

  for (const group of Object.values(groups)) {
    registerDisplaySettingsGroupMenu(moduleId, group);
    for (const settingDefinition of group.settings) {
      registerDisplaySetting(moduleId, settingDefinition, handleDisplaySettingChange);
    }
  }
}
