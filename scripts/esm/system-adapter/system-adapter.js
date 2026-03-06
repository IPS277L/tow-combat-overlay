import { getTowCombatOverlayConstants } from "../runtime/constants.js";

const { notifications: MODULE_NOTIFICATIONS } = getTowCombatOverlayConstants();

function createTowCombatOverlaySystemAdapter() {
  return {
    setupAbilityTest(actor, ability, context = {}, options = {}) {
      if (!actor || typeof actor.setupAbilityTest !== "function") {
        ui.notifications.error(MODULE_NOTIFICATIONS.apiUnavailable.abilityTest);
        return null;
      }
      return actor.setupAbilityTest(ability, context, options);
    },

    setupSkillTest(actor, skill, context = {}) {
      if (!actor || typeof actor.setupSkillTest !== "function") {
        ui.notifications.error(MODULE_NOTIFICATIONS.apiUnavailable.skillTest);
        return null;
      }
      return actor.setupSkillTest(skill, context);
    },

    setupCastingTest(actor, data, context = {}) {
      if (!actor || typeof actor.setupCastingTest !== "function") {
        ui.notifications.error(MODULE_NOTIFICATIONS.apiUnavailable.castingTest);
        return null;
      }
      return actor.setupCastingTest(data, context);
    },

    getOldWorldTestClass() {
      return game.oldworld?.config?.rollClasses?.OldWorldTest ?? null;
    },

    addCondition(actor, condition, options = {}) {
      if (!actor || typeof actor.addCondition !== "function") {
        ui.notifications.error(MODULE_NOTIFICATIONS.apiUnavailable.addCondition);
        return null;
      }
      return actor.addCondition(condition, options);
    },

    removeCondition(actor, condition) {
      if (!actor || typeof actor.removeCondition !== "function") {
        ui.notifications.error(MODULE_NOTIFICATIONS.apiUnavailable.removeCondition);
        return null;
      }
      return actor.removeCondition(condition);
    },

    applyDamage(actor, damage, context = {}) {
      if (!actor?.system || typeof actor.system.applyDamage !== "function") {
        ui.notifications.error(MODULE_NOTIFICATIONS.apiUnavailable.applyDamage);
        return null;
      }
      return actor.system.applyDamage(damage, context);
    },

    addWound(actor, options = {}) {
      if (!actor?.system || typeof actor.system.addWound !== "function") {
        ui.notifications.error(MODULE_NOTIFICATIONS.apiUnavailable.wound);
        return null;
      }
      return actor.system.addWound(options);
    },

    promptStaggeredChoice(actor, options = {}) {
      if (!actor?.system || typeof actor.system.promptStaggeredChoice !== "function") {
        ui.notifications.error(MODULE_NOTIFICATIONS.apiUnavailable.staggerChoice);
        return null;
      }
      return actor.system.promptStaggeredChoice(options);
    }
  };
}

let systemAdapterSingleton = null;

export function getTowCombatOverlaySystemAdapter() {
  if (!systemAdapterSingleton) {
    systemAdapterSingleton = createTowCombatOverlaySystemAdapter();
  }
  return systemAdapterSingleton;
}
