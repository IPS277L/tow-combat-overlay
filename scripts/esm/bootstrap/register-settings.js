import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";

const SETTINGS_GROUP_TEMPLATE_PATH = "modules/tow-combat-overlay/templates/settings/display-settings-group.hbs";

function localizeMaybe(key, fallback = "") {
  const localized = game?.i18n?.localize?.(String(key ?? ""));
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? key ?? "");
}

function buildDisplaySettingsGroups(settingKeys) {
  return Object.freeze({
    tokensPanel: Object.freeze({
      menuKey: "tokensPanel",
      settings: Object.freeze([
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
      ])
    }),
    tokenLayout: Object.freeze({
      menuKey: "tokenLayout",
      settings: Object.freeze([
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
      ])
    }),
    controlPanel: Object.freeze({
      menuKey: "controlPanel",
      settings: Object.freeze([
        {
          key: settingKeys.enableControlPanel,
          defaultValue: true,
          nameKey: "TOWCOMBATOVERLAY.Setting.EnableControlPanel.Name",
          hintKey: "TOWCOMBATOVERLAY.Setting.EnableControlPanel.Hint"
        },
        {
          key: settingKeys.controlPanelShowStatuses,
          defaultValue: true,
          nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelShowStatuses.Name",
          hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelShowStatuses.Hint"
        },
        {
          key: settingKeys.controlPanelEnableButtonReorder,
          defaultValue: true,
          nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableButtonReorder.Name",
          hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableButtonReorder.Hint"
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
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: `tow-combat-overlay-settings-group-${group.menuKey}`,
        title: localizeMaybe(
          `TOWCOMBATOVERLAY.SettingsGroup.${group.menuKey}.Name`,
          group.menuKey
        ),
        template: SETTINGS_GROUP_TEMPLATE_PATH,
        width: 560,
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
        name: localizeMaybe(entry.nameKey, entry.key),
        hint: localizeMaybe(entry.hintKey, ""),
        value: !!getTowCombatOverlayDisplaySetting(entry.key, entry.defaultValue)
      }));
      return {
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
  game.settings.registerMenu(moduleId, `settingsGroup.${group.menuKey}`, {
    name: `TOWCOMBATOVERLAY.SettingsGroup.${group.menuKey}.Name`,
    hint: `TOWCOMBATOVERLAY.SettingsGroup.${group.menuKey}.Hint`,
    label: `TOWCOMBATOVERLAY.SettingsGroup.${group.menuKey}.Label`,
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
