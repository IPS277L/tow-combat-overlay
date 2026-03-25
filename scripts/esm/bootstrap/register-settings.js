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
      defaultValue: true,
      nameKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableButtonsDragDrop.Name",
      hintKey: "TOWCOMBATOVERLAY.Setting.ControlPanelEnableButtonsDragDrop.Hint"
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
            settingKeys.tokensPanelPositionMode,
            settingKeys.tokensPanelDragButtonPosition
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
            settingKeys.controlPanelPositionMode,
            settingKeys.controlPanelEnableButtonsDragDrop
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
        let isVisible = true;
        if (visibleWhenKey) {
          const dependentDefinition = settingDefinitionByKey.get(visibleWhenKey) ?? null;
          const dependentRawValue = currentValueByKey.get(visibleWhenKey);
          const dependentIsSelect = String(dependentDefinition?.type ?? "boolean").trim() === "select";
          const dependentValue = dependentIsSelect
            ? normalizeSelectSettingValue(dependentDefinition, dependentRawValue)
            : String(!!dependentRawValue);
          isVisible = dependentValue === visibleWhenValue;
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

      const applyConditionalVisibility = () => {
        const conditionalFields = rootElement.querySelectorAll("[data-visible-when-key]");
        for (const fieldElement of conditionalFields) {
          if (!(fieldElement instanceof HTMLElement)) continue;
          const dependsOnKey = String(fieldElement.dataset.visibleWhenKey ?? "").trim();
          const equalsValue = String(fieldElement.dataset.visibleWhenValue ?? "").trim();
          if (!dependsOnKey) {
            fieldElement.style.display = "";
            continue;
          }
          const dependentInput = rootElement.querySelector(`[name="${dependsOnKey}"]`);
          if (!(dependentInput instanceof HTMLElement)) {
            fieldElement.style.display = "";
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
          fieldElement.style.display = currentValue === equalsValue ? "" : "none";
        }
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
