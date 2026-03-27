import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";
import { buildDisplaySettingsGroups } from "./settings/display-settings-groups.js";

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
  if (selectedRole === "none" || selectedRole === "0") return false;
  const minimumRole = Number(selectedRole);
  if (!Number.isFinite(minimumRole)) return true;
  return isUserInMinimumRole(minimumRole);
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

function registerWorldObjectSetting(moduleId, settingKey, defaultValue, onChange) {
  game.settings.register(moduleId, settingKey, {
    scope: "world",
    config: false,
    type: Object,
    default: defaultValue,
    onChange: () => onChange(settingKey)
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
  const minimumRoleChoices = buildMinimumRoleSettingChoices();
  const groups = buildDisplaySettingsGroups(settingKeys, minimumRoleChoices);

  for (const group of Object.values(groups)) {
    registerDisplaySettingsGroupMenu(moduleId, group);
    for (const settingDefinition of group.settings) {
      registerDisplaySetting(moduleId, settingDefinition, handleDisplaySettingChange);
    }
  }

  registerWorldObjectSetting(
    moduleId,
    settingKeys.tokensPanelTokenOrderByScene,
    {},
    handleDisplaySettingChange
  );
}
