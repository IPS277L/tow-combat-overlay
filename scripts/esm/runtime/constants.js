function localizeTowCombatOverlayText(key, fallback) {
  const value = game?.i18n?.localize?.(key);
  return (typeof value === "string" && value !== key) ? value : fallback;
}

const MODULE_CONSTANTS_BASE = Object.freeze({
  moduleId: "tow-combat-overlay",
  moduleName: "The Old World Combat Overlay",
  logPrefix: "[tow-combat-overlay]",
  apiKeys: Object.freeze({
    actions: "combatOverlayActions",
    overlay: "combatOverlay"
  }),
  flags: Object.freeze({
    actorRollModifier: "actorRollModifier"
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
  return Object.freeze({
    ...MODULE_CONSTANTS_BASE,
    notifications: Object.freeze({
      selectAtLeastOneToken: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.SelectAtLeastOneToken", "Select at least one token."),
      noPermissionToEditActor: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.NoPermissionToEditActor", "No permission to edit {actorName}."),
      overlayEnabled: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.OverlayEnabled", "Overlay enabled: wounds, resilience, and status highlights."),
      overlayDisabled: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.OverlayDisabled", "Overlay disabled."),
      moduleApiUnavailable: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ModuleApiUnavailable", "The Old World Combat Overlay module API is unavailable."),
      oldWorldTestClassUnavailable: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.OldWorldTestClassUnavailable", "OldWorldTest roll class is unavailable."),
      apiUnavailable: Object.freeze({
        abilityTest: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.AbilityTest", "Ability test API is unavailable for this actor."),
        skillTest: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.SkillTest", "Skill test API is unavailable for this actor."),
        addCondition: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.AddCondition", "Condition add API is unavailable for this actor."),
        removeCondition: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.RemoveCondition", "Condition remove API is unavailable for this actor."),
        applyDamage: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.ApplyDamage", "Damage application API is unavailable for this actor."),
        wound: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.Wound", "Wound API is unavailable for this actor."),
        staggerChoice: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.StaggerChoice", "Stagger choice API is unavailable for this actor.")
      }),
      defence: Object.freeze({
        noCharacteristicValue: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.Defence.NoCharacteristicValue", "{actorName}: characteristic '{characteristic}' has no valid value."),
        noManualEntries: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.Defence.NoManualEntries", "{actorName}: no rollable skills or characteristics found."),
        noDefaultSkills: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.Defence.NoDefaultSkills", "{actorName}: no rollable skills found for default defence roll."),
        fallbackSkill: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.Defence.FallbackSkill", "{actorName}: '{defaultSkill}' not found, rolled '{rolledSkill}' instead.")
      })
    }),
    dialogs: Object.freeze({
      closeLabel: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Dialog.CloseLabel", "Close"),
      attackListHeader: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Dialog.AttackListHeader", "Attacks"),
      noAttacks: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Dialog.NoAttacks", "No attacks"),
      attackSelectorTitle: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Dialog.AttackSelectorTitle", "{actorName} - Weapon Attacks"),
      defenceSelectorTitle: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Dialog.DefenceSelectorTitle", "{actorName} - Defence Roll"),
      defenceCharacteristicsHeader: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Dialog.DefenceCharacteristicsHeader", "Characteristics"),
      defenceSkillsHeader: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Dialog.DefenceSkillsHeader", "Skills"),
      noCharacteristics: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Dialog.NoCharacteristics", "No characteristics"),
      noSkills: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Dialog.NoSkills", "No skills")
    }),
    labels: Object.freeze({
      rollState: Object.freeze({
        normal: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Label.RollState.Normal", "Common"),
        grim: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Label.RollState.Grim", "Grim"),
        glorious: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Label.RollState.Glorious", "Glorious")
      })
    }),
    tooltips: Object.freeze({
      wounds: Object.freeze({
        title: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.Wounds.Title", "Wounds"),
        description: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.Wounds.Description", "Left-click adds 1 wound. Right-click removes 1 wound.")
      }),
      attack: Object.freeze({
        title: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.Attack.Title", "Attack"),
        description: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.Attack.Description", "Attack roll. Left-click attacks. Drag to a target for quick targeting. Hold Shift for manual mode.")
      }),
      defence: Object.freeze({
        title: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.Defence.Title", "Defence"),
        description: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.Defence.Description", "Defence roll. Left-click defends. Hold Shift for manual mode.")
      }),
      rollModifier: Object.freeze({
        title: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.RollModifier.Title", "Roll Modifier"),
        description: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.RollModifier.Description", "Left-click adds 1 bonus die. Right-click adds 1 penalty die. Shift + left-click cycles Common, Glorious, and Grim.")
      }),
      resilience: Object.freeze({
        title: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.Resilience.Title", "Resilience"),
        description: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.Resilience.Description", "Resilience value used for durability and damage resolution thresholds.")
      }),
      actorType: Object.freeze({
        defaultDescription: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.ActorType.DefaultDescription", "Actor type."),
        standardNpcDescription: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.ActorType.StandardNpcDescription", "Standard NPC type without wound thresholds."),
        championDescription: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.ActorType.ChampionDescription", "Champions do not use wound thresholds and track wounds normally."),
        minionDescription: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.ActorType.MinionDescription", "Minions are defeated at 1 wound."),
        thresholdDescription: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.ActorType.ThresholdDescription", "Threshold-based NPC type.")
      })
    })
  });
}
