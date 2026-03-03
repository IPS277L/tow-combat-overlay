import { getTowCombatOverlayModuleConstants } from "./constants.js";
import { syncTowCombatOverlayEnabledSetting } from "./register-module-hooks.js";

export function getTowCombatOverlaySetting(settingKey, fallbackValue = null) {
  const { moduleId } = getTowCombatOverlayModuleConstants();
  try {
    return game.settings.get(moduleId, settingKey);
  } catch (_error) {
    return fallbackValue;
  }
}

export function isTowCombatOverlaySettingEnabled(settingKey, fallbackValue = false) {
  return !!getTowCombatOverlaySetting(settingKey, fallbackValue);
}

export function shouldTowCombatOverlayAutoSubmitDialogs() {
  const { settings } = getTowCombatOverlayModuleConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableDialogAutoSubmit, true);
}

export function shouldTowCombatOverlayAutoDefence() {
  const { settings } = getTowCombatOverlayModuleConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableAutoDefence, true);
}

export function shouldTowCombatOverlayAutoApplyDamage() {
  const { settings } = getTowCombatOverlayModuleConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableAutoApplyDamage, true);
}

export function shouldTowCombatOverlayAutoChooseStaggerWound() {
  const { settings } = getTowCombatOverlayModuleConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableStaggerChoiceAutomation, true);
}

export function registerTowCombatOverlaySettings() {
  const { moduleId, settings: settingKeys } = getTowCombatOverlayModuleConstants();
  const settings = [
    {
      key: settingKeys.enableOverlay,
      name: "Enable Overlay",
      hint: "Enables The Old World Combat Overlay token UI.",
      default: true,
      onChange: () => syncTowCombatOverlayEnabledSetting()
    },
    {
      key: settingKeys.enableAutoDefence,
      name: "Enable Auto-Defence",
      hint: "Automatically trigger defender rolls during opposed attack flow.",
      default: true
    },
    {
      key: settingKeys.enableAutoApplyDamage,
      name: "Enable Auto-Apply Damage",
      hint: "Automatically apply computed opposed damage when possible.",
      default: true
    },
    {
      key: settingKeys.enableStaggerChoiceAutomation,
      name: "Enable Stagger Automation",
      hint: "Automatically choose the wound option for stagger prompts during automation.",
      default: true
    },
    {
      key: settingKeys.enableDialogAutoSubmit,
      name: "Enable Dialog Auto-Submit",
      hint: "Automatically submit attack, defence, and casting dialogs during fast roll flows.",
      default: true
    }
  ];

  for (const setting of settings) {
    game.settings.register(moduleId, setting.key, {
      scope: "world",
      config: true,
      type: Boolean,
      default: setting.default,
      name: setting.name,
      hint: setting.hint,
      onChange: setting.onChange
    });
  }
}
