const MODULE_CONSTANTS = Object.freeze({
  moduleId: "the-old-world-combat-overlay",
  moduleName: "The Old World Combat Overlay",
  logPrefix: "[the-old-world-combat-overlay]",
  apiKeys: Object.freeze({
    actions: "combatOverlayActions",
    overlay: "combatOverlay"
  }),
  flags: Object.freeze({
    actorRollModifier: "actorRollModifier"
  }),
  notifications: Object.freeze({
    selectAtLeastOneToken: "Select at least one token.",
    noPermissionToEditActor: "No permission to edit {actorName}.",
    overlayEnabled: "Overlay enabled: wounds, resilience, and status highlights.",
    overlayDisabled: "Overlay disabled.",
    moduleApiUnavailable: "The Old World Combat Overlay module API is unavailable.",
    oldWorldTestClassUnavailable: "OldWorldTest roll class is unavailable.",
    apiUnavailable: Object.freeze({
      abilityTest: "Ability test API is unavailable for this actor.",
      skillTest: "Skill test API is unavailable for this actor.",
      castingTest: "Casting test API is unavailable for this actor.",
      addCondition: "Condition add API is unavailable for this actor.",
      removeCondition: "Condition remove API is unavailable for this actor.",
      applyDamage: "Damage application API is unavailable for this actor.",
      wound: "Wound API is unavailable for this actor.",
      staggerChoice: "Stagger choice API is unavailable for this actor."
    }),
    defence: Object.freeze({
      noCharacteristicValue: "{actorName}: characteristic '{characteristic}' has no valid value.",
      noManualEntries: "{actorName}: no rollable skills or characteristics found.",
      noDefaultSkills: "{actorName}: no rollable skills found for default defence roll.",
      fallbackSkill: "{actorName}: '{defaultSkill}' not found, rolled '{rolledSkill}' instead."
    }),
    casting: Object.freeze({
      noLore: "{actorName}: '{spellName}' has no lore, cannot open Casting Test.",
      noSpells: "{actorName}: no castable spells found in Magic tab."
    })
  }),
  dialogs: Object.freeze({
    closeLabel: "Close",
    attackListHeader: "Attacks",
    noAttacks: "No attacks",
    attackSelectorTitle: "{actorName} - Weapon Attacks",
    spellSelectorTitle: "{actorName} - Spells",
    defenceSelectorTitle: "{actorName} - Defence Roll",
    defenceCharacteristicsHeader: "Characteristics",
    defenceSkillsHeader: "Skills",
    noCharacteristics: "No characteristics",
    noSkills: "No skills"
  }),
  labels: Object.freeze({
    rollState: Object.freeze({
      normal: "Common",
      grim: "Grim",
      glorious: "Glorious"
    })
  }),
  tooltips: Object.freeze({
    wounds: Object.freeze({
      title: "Wounds",
      description: "Left-click adds 1 wound. Right-click removes 1 wound."
    }),
    attack: Object.freeze({
      title: "Attack",
      description: "Attack roll. Left-click attacks. Drag to a target for quick targeting. Hold Shift for manual mode."
    }),
    defence: Object.freeze({
      title: "Defence",
      description: "Defence roll. Left-click defends. Hold Shift for manual mode."
    }),
    rollModifier: Object.freeze({
      title: "Roll Modifier",
      description: "Left-click adds 1 bonus die. Right-click adds 1 penalty die. Shift + left-click cycles Common, Glorious, and Grim."
    }),
    resilience: Object.freeze({
      title: "Resilience",
      description: "Resilience value used for durability and damage resolution thresholds."
    }),
    actorType: Object.freeze({
      defaultDescription: "Actor type.",
      standardNpcDescription: "Standard NPC type without wound thresholds.",
      championDescription: "Champions do not use wound thresholds and track wounds normally.",
      minionDescription: "Minions are defeated at 1 wound.",
      thresholdDescription: "Threshold-based NPC type."
    })
  }),
  settings: Object.freeze({
    enableOverlay: "enableOverlay",
    enableAutoDefence: "enableAutoDefence",
    enableAutoApplyDamage: "enableAutoApplyDamage",
    enableStaggerChoiceAutomation: "enableStaggerChoiceAutomation",
    enableDialogAutoSubmit: "enableDialogAutoSubmit"
  })
});

export function getTowCombatOverlayConstants() {
  return MODULE_CONSTANTS;
}
