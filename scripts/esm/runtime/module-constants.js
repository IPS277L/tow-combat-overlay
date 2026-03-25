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
    enableControlPanel: "enableControlPanel",
    enableTopPanel: "enableTopPanel",
    tokensPanelEnableStatuses: "tokensPanelEnableStatuses",
    tokensPanelEnableWounds: "tokensPanelEnableWounds",
    tokensPanelEnableTemporaryEffects: "tokensPanelEnableTemporaryEffects",
    tokensPanelShowDeadVisual: "tokensPanelShowDeadVisual",
    tokensPanelPositionMode: "tokensPanelPositionMode",
    tokensPanelDragButtonPosition: "tokensPanelDragButtonPosition",
    tokenLayoutShowBorder: "tokenLayoutShowBorder",
    tokenLayoutEnableStatuses: "tokenLayoutEnableStatuses",
    tokenLayoutEnableWounds: "tokenLayoutEnableWounds",
    tokenLayoutEnableTemporaryEffects: "tokenLayoutEnableTemporaryEffects",
    tokenLayoutShowCustomName: "tokenLayoutShowCustomName",
    tokenLayoutShowDeadVisuals: "tokenLayoutShowDeadVisuals",
    controlPanelEnableStatuses: "controlPanelEnableStatuses",
    controlPanelEnableAbilities: "controlPanelEnableAbilities",
    controlPanelEnableWounds: "controlPanelEnableWounds",
    controlPanelEnableTemporaryEffects: "controlPanelEnableTemporaryEffects",
    controlPanelEnableName: "controlPanelEnableName",
    controlPanelEnableStats: "controlPanelEnableStats",
    controlPanelEnableImage: "controlPanelEnableImage",
    controlPanelEnableActionButtons: "controlPanelEnableActionButtons",
    controlPanelEnableWeaponsButtons: "controlPanelEnableWeaponsButtons",
    controlPanelEnableMagicButtons: "controlPanelEnableMagicButtons",
    controlPanelShowDeadPortraitStatus: "controlPanelShowDeadPortraitStatus",
    controlPanelPositionMode: "controlPanelPositionMode",
    controlPanelEnableButtonsDragDrop: "controlPanelEnableButtonsDragDrop"
  })
});

export function getTowCombatOverlayConstants() {
  return Object.freeze({
    ...MODULE_CONSTANTS_BASE,
    notifications: Object.freeze({
      selectAtLeastOneToken: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.SelectAtLeastOneToken", "Select at least one token."),
      noPermissionToEditActor: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.NoPermissionToEditActor", "You do not have permission to edit {actorName}."),
      overlayEnabled: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.OverlayEnabled", "Combat overlay visuals enabled."),
      overlayDisabled: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.OverlayDisabled", "Combat overlay visuals disabled. Other module features remain available."),
      moduleApiUnavailable: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ModuleApiUnavailable", "The Old World Combat Overlay API is unavailable."),
      oldWorldTestClassUnavailable: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.OldWorldTestClassUnavailable", "Cannot roll a characteristic test: OldWorldTest is unavailable."),
      noSpellLoreForAccumulatePower: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.NoSpellLoreForAccumulatePower", "Cannot accumulate power: no spell lore is available for this actor."),
      apiUnavailable: Object.freeze({
        abilityTest: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.AbilityTest", "Cannot run an ability test: the system API is unavailable for this actor."),
        weaponTest: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.WeaponTest", "Cannot run a weapon test: the system API is unavailable for this actor."),
        skillTest: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.SkillTest", "Cannot run a skill test: the system API is unavailable for this actor."),
        addCondition: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.AddCondition", "Cannot add a condition: the system API is unavailable for this actor."),
        removeCondition: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.RemoveCondition", "Cannot remove a condition: the system API is unavailable for this actor."),
        applyDamage: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.ApplyDamage", "Cannot apply damage: the system API is unavailable for this actor."),
        wound: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.Wound", "Cannot add a wound: the system API is unavailable for this actor."),
        staggerChoice: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.ApiUnavailable.StaggerChoice", "Cannot prompt a staggered choice: the system API is unavailable for this actor.")
      }),
      defence: Object.freeze({
        noCharacteristicValue: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.Defence.NoCharacteristicValue", "{actorName}: characteristic '{characteristic}' does not have a valid value."),
        noManualEntries: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.Defence.NoManualEntries", "{actorName}: no rollable skills or characteristics were found."),
        noDefaultSkills: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.Defence.NoDefaultSkills", "{actorName}: no rollable skills were found for the default defence roll."),
        fallbackSkill: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Notification.Defence.FallbackSkill", "{actorName}: '{defaultSkill}' was not found, so '{rolledSkill}' was rolled instead.")
      })
    }),
    dialogs: Object.freeze({
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
      rollModifier: Object.freeze({
        title: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.RollModifier.Title", "Roll Modifier"),
        description: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.RollModifier.Description", "Left-click adds 1 bonus die. Right-click adds 1 penalty die. Shift + left-click cycles Common, Glorious, and Grim.")
      }),
      speed: Object.freeze({
        title: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.Speed.Title", "Speed"),
        description: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.Speed.Description", "Movement pace category used for battlefield mobility and maneuvering.")
      }),
      miscastDice: Object.freeze({
        title: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.MiscastDice.Title", "Miscast Dice"),
        description: localizeTowCombatOverlayText("TOWCOMBATOVERLAY.Tooltip.MiscastDice.Description", "Current count of accumulated miscast dice on the selected actor.")
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
