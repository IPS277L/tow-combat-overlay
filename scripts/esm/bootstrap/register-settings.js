import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";

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
  game.settings.register(moduleId, settingKeys.enableOverlay, {
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    name: "TOWCOMBATOVERLAY.Setting.EnableOverlay.Name",
    hint: "TOWCOMBATOVERLAY.Setting.EnableOverlay.Hint",
    onChange: () => handleDisplaySettingChange()
  });
  game.settings.register(moduleId, settingKeys.enableControlPanel, {
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    name: "TOWCOMBATOVERLAY.Setting.EnableControlPanel.Name",
    hint: "TOWCOMBATOVERLAY.Setting.EnableControlPanel.Hint",
    onChange: () => handleDisplaySettingChange()
  });
  game.settings.register(moduleId, settingKeys.enableTopPanel, {
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    name: "TOWCOMBATOVERLAY.Setting.EnableTopPanel.Name",
    hint: "TOWCOMBATOVERLAY.Setting.EnableTopPanel.Hint",
    onChange: () => handleDisplaySettingChange()
  });
}
