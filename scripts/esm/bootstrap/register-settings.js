import { getTowCombatOverlayConstants } from "../runtime/constants.js";
import { syncTowCombatOverlayEnabledSetting } from "./register-module-hooks.js";

export function getTowCombatOverlaySetting(settingKey, fallbackValue = null) {
  const { moduleId } = getTowCombatOverlayConstants();
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
  const { settings } = getTowCombatOverlayConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableDialogAutoSubmit, true);
}

export function shouldTowCombatOverlayAutoDefence() {
  const { settings } = getTowCombatOverlayConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableAutoDefence, true);
}

export function shouldTowCombatOverlayAutoApplyDamage() {
  const { settings } = getTowCombatOverlayConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableAutoApplyDamage, true);
}

export function shouldTowCombatOverlayAutoChooseStaggerWound() {
  const { settings } = getTowCombatOverlayConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableStaggerChoiceAutomation, true);
}

export function registerTowCombatOverlaySettings() {
  const { moduleId, settings: settingKeys } = getTowCombatOverlayConstants();
  game.settings.register(moduleId, settingKeys.enableOverlay, {
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    name: "TOWCOMBATOVERLAY.Setting.EnableOverlay.Name",
    hint: "TOWCOMBATOVERLAY.Setting.EnableOverlay.Hint",
    onChange: () => syncTowCombatOverlayEnabledSetting()
  });
}
