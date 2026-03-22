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

function buildDisplaySettingsGroups(settingKeys) {
  const tokensPanelSettings = Object.freeze([
    {
      key: settingKeys.enableTopPanel,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.EnableTopPanel.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.EnableTopPanel.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableStatuses,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableStatuses.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableStatuses.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableWounds,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableWounds.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelEnableWounds.Hint"
    },
    {
      key: settingKeys.tokensPanelEnableTemporaryEffects,
      defaultValue: true,
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
      key: settingKeys.tokensPanelAlwaysCentered,
      defaultValue: false,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokensPanelAlwaysCentered.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokensPanelAlwaysCentered.Hint"
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
      key: settingKeys.tokenLayoutShowBorder,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutShowBorder.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutShowBorder.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableStatuses,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableStatuses.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableStatuses.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableWounds,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableWounds.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutEnableWounds.Hint"
    },
    {
      key: settingKeys.tokenLayoutEnableTemporaryEffects,
      defaultValue: true,
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
      key: settingKeys.tokenLayoutShowDeadVisuals,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutShowDeadVisuals.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.TokenLayoutShowDeadVisuals.Hint"
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
      key: settingKeys.controlPanelEnableStatuses,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStatuses.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStatuses.Hint"
    },
    {
      key: settingKeys.controlPanelEnableAbilities,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableAbilities.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableAbilities.Hint"
    },
    {
      key: settingKeys.controlPanelEnableWounds,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableWounds.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableWounds.Hint"
    },
    {
      key: settingKeys.controlPanelEnableTemporaryEffects,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableTemporaryEffects.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableTemporaryEffects.Hint"
    },
    {
      key: settingKeys.controlPanelEnableName,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableName.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableName.Hint"
    },
    {
      key: settingKeys.controlPanelEnableImage,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableImage.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableImage.Hint"
    },
    {
      key: settingKeys.controlPanelEnableStats,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStats.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableStats.Hint"
    },
    {
      key: settingKeys.controlPanelEnableActionButtons,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableActionButtons.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableActionButtons.Hint"
    },
    {
      key: settingKeys.controlPanelEnableWeaponsButtons,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableWeaponsButtons.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableWeaponsButtons.Hint"
    },
    {
      key: settingKeys.controlPanelEnableMagicButtons,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableMagicButtons.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableMagicButtons.Hint"
    },
    {
      key: settingKeys.controlPanelShowDeadPortraitStatus,
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelShowDeadPortraitStatus.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelShowDeadPortraitStatus.Hint"
    },
    {
      key: settingKeys.controlPanelAlwaysCentered,
      defaultValue: false,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelAlwaysCentered.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelAlwaysCentered.Hint"
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
            settingKeys.tokensPanelAlwaysCentered
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokensPanel.Chips",
          settingKeys: Object.freeze([
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
            settingKeys.enableOverlay
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokenLayout.Chips",
          settingKeys: Object.freeze([
            settingKeys.tokenLayoutEnableStatuses,
            settingKeys.tokenLayoutEnableWounds,
            settingKeys.tokenLayoutEnableTemporaryEffects
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.TokenLayout.Overlay",
          settingKeys: Object.freeze([
            settingKeys.tokenLayoutShowCustomName,
            settingKeys.tokenLayoutShowBorder,
            settingKeys.tokenLayoutShowDeadVisuals
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
            settingKeys.controlPanelAlwaysCentered
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.ControlPanel.StatusRow",
          settingKeys: Object.freeze([
            settingKeys.controlPanelEnableStatuses,
            settingKeys.controlPanelEnableAbilities,
            settingKeys.controlPanelEnableWounds,
            settingKeys.controlPanelEnableTemporaryEffects
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.ControlPanel.Portrait",
          settingKeys: Object.freeze([
            settingKeys.controlPanelEnableName,
            settingKeys.controlPanelEnableImage,
            settingKeys.controlPanelEnableStats,
            settingKeys.controlPanelShowDeadPortraitStatus
          ])
        },
        {
          titleKey: "TOWCOMBATOVERLAY.SettingsSection.ControlPanel.GridButtons",
          settingKeys: Object.freeze([
            settingKeys.controlPanelEnableActionButtons,
            settingKeys.controlPanelEnableWeaponsButtons,
            settingKeys.controlPanelEnableMagicButtons
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
      const { moduleId } = getTowCombatOverlayConstants();
      const fields = group.settings.map((entry) => ({
        key: entry.key,
        id: `tow-combat-overlay-setting-${entry.key}`,
        name: localizeMaybe(entry.nameKey, humanizeSettingKey(entry.key)),
        hint: localizeMaybe(entry.hintKey, ""),
        value: !!getTowCombatOverlayDisplaySetting(entry.key, entry.defaultValue)
      }));
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

    async _updateObject(_event, formData) {
      const expanded = foundry.utils.expandObject(formData);
      const { moduleId } = getTowCombatOverlayConstants();
      for (const entry of group.settings) {
        const rawValue = expanded?.[entry.key];
        const nextValue = rawValue === true || rawValue === "true" || rawValue === "on";
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

function registerBooleanDisplaySetting(moduleId, settingDefinition, onChange) {
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
      registerBooleanDisplaySetting(moduleId, settingDefinition, handleDisplaySettingChange);
    }
  }
}
