const MODULE_CONSTANTS = Object.freeze({
  moduleId: "the-old-world-combat-overlay",
  moduleName: "The Old World Combat Overlay",
  settings: Object.freeze({
    enableOverlay: "enableOverlay",
    enableAutoDefence: "enableAutoDefence",
    enableAutoApplyDamage: "enableAutoApplyDamage",
    enableStaggerChoiceAutomation: "enableStaggerChoiceAutomation",
    enableDialogAutoSubmit: "enableDialogAutoSubmit"
  })
});

export function getTowCombatOverlayModuleConstants() {
  return MODULE_CONSTANTS;
}
