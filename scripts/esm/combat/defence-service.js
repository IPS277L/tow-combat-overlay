import {
  DEFAULT_DEFENCE_SKILL,
  SELF_ROLL_CONTEXT,
} from "../runtime/action-runtime-constants.js";
import { getTowCombatOverlayConstants } from "../runtime/constants.js";
import {
  createTowCombatOverlayRollContext,
  getTowCombatOverlayActorRollState,
  getTowCombatOverlayActorRollModifierFields
} from "./roll-modifier-service.js";
import { towCombatOverlayArmAutoSubmitDialog } from "./attack-service.js";
import {
  towCombatOverlayApplyDialogClass,
  towCombatOverlayBindClick,
  towCombatOverlayOpenSelectorDialog,
  towCombatOverlayRenderTemplate,
  towCombatOverlayRenderSelectorRowButton
} from "./core-service.js";
import { getTowCombatOverlaySystemAdapter } from "../system-adapter/system-adapter.js";

const {
  notifications: MODULE_NOTIFICATIONS,
  dialogs: MODULE_DIALOGS
} = getTowCombatOverlayConstants();

function towCombatOverlayGetSkillLabel(skill) {
  return game.oldworld?.config?.skills?.[skill] ?? skill;
}

function towCombatOverlayGetCharacteristicLabel(characteristic) {
  return game.oldworld?.config?.characteristics?.[characteristic]
    ?? game.oldworld?.config?.characteristicAbbrev?.[characteristic]
    ?? characteristic;
}

export function towCombatOverlayGetActorSkills(actor) {
  const skills = Object.keys(actor.system?.skills ?? {}).filter((skill) => {
    const skillData = actor.system?.skills?.[skill];
    return skillData && typeof skillData.value !== "undefined";
  });

  return skills.sort((a, b) => a.localeCompare(b));
}

function towCombatOverlayGetActorCharacteristics(actor) {
  return Object.keys(actor.system?.characteristics ?? {}).filter((characteristic) => {
    const value = Number(actor.system?.characteristics?.[characteristic]?.value ?? NaN);
    return Number.isFinite(value);
  });
}

export function towCombatOverlayGetManualDefenceEntries(actor) {
  const skillEntries = towCombatOverlayGetActorSkills(actor).map((skill) => ({
    type: "skill",
    id: skill,
    label: towCombatOverlayGetSkillLabel(skill),
    target: Number(actor.system?.skills?.[skill]?.value ?? 0)
  }));

  const charEntries = towCombatOverlayGetActorCharacteristics(actor).map((characteristic) => ({
    type: "characteristic",
    id: characteristic,
    label: towCombatOverlayGetCharacteristicLabel(characteristic),
    target: Number(actor.system?.characteristics?.[characteristic]?.value ?? 0)
  }));

  return [...skillEntries, ...charEntries];
}

function towCombatOverlayArmAutoSubmitSkillDialog(actor, skill) {
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderTestDialog",
    matches: (app) => app?.actor?.id === actor.id && app?.skill === skill,
    submitErrorMessage: "TestDialog.submit() is unavailable."
  });
}

export async function towCombatOverlayRollSkill(actor, skill, { autoRoll = false } = {}) {
  if (autoRoll) towCombatOverlayArmAutoSubmitSkillDialog(actor, skill);
  return getTowCombatOverlaySystemAdapter().setupSkillTest(actor, skill, createTowCombatOverlayRollContext(actor, SELF_ROLL_CONTEXT));
}

async function towCombatOverlayRollCharacteristic(actor, characteristic) {
  const OldWorldTestClass = getTowCombatOverlaySystemAdapter().getOldWorldTestClass();
  if (!OldWorldTestClass) {
    ui.notifications.error(MODULE_NOTIFICATIONS.oldWorldTestClassUnavailable);
    return null;
  }

  const target = Number(actor.system?.characteristics?.[characteristic]?.value ?? 0);
  if (!Number.isFinite(target) || target <= 0) {
    ui.notifications.warn(
      MODULE_NOTIFICATIONS.defence.noCharacteristicValue
        .replace("{actorName}", actor.name)
        .replace("{characteristic}", characteristic)
    );
    return null;
  }

  const data = {
    actor,
    skill: characteristic,
    characteristic,
    target,
    dice: target,
    ...getTowCombatOverlayActorRollModifierFields(actor),
    state: getTowCombatOverlayActorRollState(actor),
    loseTies: false,
    rollMode: game.settings.get("core", "rollMode"),
    speaker: CONFIG.ChatMessage.documentClass.getSpeaker({ actor }),
    targets: [],
    context: {
      title: game.i18n.format("TOW.Test.SkillTest", { skill: towCombatOverlayGetCharacteristicLabel(characteristic) }),
      appendTitle: "",
      endeavour: false,
      action: undefined,
      subAction: undefined,
      itemUuid: undefined,
      reload: undefined,
      flags: undefined,
      defending: actor.system.opposed?.id
    }
  };

  const test = OldWorldTestClass.fromData(data);
  await test.roll();
  await test.sendToChat();
  return test;
}

export async function towCombatOverlayRenderDefenceSelector(actor, entries) {
  const emphasizedSkills = new Set(["defence", "athletics", "endurance"]);
  const buildRowData = (entry) => {
    const value = Number(entry.target ?? 0);
    const shouldEmphasize = entry.type === "skill" && emphasizedSkills.has(String(entry.id).toLowerCase());
    return {
      rowClass: "skill-btn",
      type: entry.type,
      id: entry.id,
      label: entry.label,
      valueLabel: `T${value}`,
      highlighted: shouldEmphasize,
      compact: true
    };
  };

  const characteristicEntries = entries.filter((entry) => entry.type === "characteristic");
  const skillEntries = entries.filter((entry) => entry.type === "skill");

  const characteristicMarkup = (await Promise.all(
    characteristicEntries.map((entry) => towCombatOverlayRenderSelectorRowButton(buildRowData(entry)))
  )).join("");
  const skillMarkup = (await Promise.all(
    skillEntries.map((entry) => towCombatOverlayRenderSelectorRowButton(buildRowData(entry)))
  )).join("");

  const content = await towCombatOverlayRenderTemplate("modules/the-old-world-combat-overlay/templates/combat/defence-selector.hbs", {
    defenceCharacteristicsHeader: MODULE_DIALOGS.defenceCharacteristicsHeader,
    defenceSkillsHeader: MODULE_DIALOGS.defenceSkillsHeader,
    noCharacteristics: MODULE_DIALOGS.noCharacteristics,
    noSkills: MODULE_DIALOGS.noSkills,
    characteristicMarkup,
    skillMarkup
  });

  const title = MODULE_DIALOGS.defenceSelectorTitle.replace("{actorName}", actor.name);
  towCombatOverlayOpenSelectorDialog({
    title,
    content,
    width: 560,
    height: 560,
    closeLabel: MODULE_DIALOGS.closeLabel,
    onRender: (html, dialogApp) => {
      towCombatOverlayApplyDialogClass(html, "tow-combat-overlay-dialog");
      towCombatOverlayBindClick(html, ".skill-btn", async (event) => {
        const id = event.currentTarget.dataset.id;
        const type = event.currentTarget.dataset.type;
        if (!id || !type) return;
        const fastRoll = event.shiftKey === true;
        dialogApp.close();

        if (type === "characteristic") {
          await towCombatOverlayRollCharacteristic(actor, id);
          return;
        }
        await towCombatOverlayRollSkill(actor, id, { autoRoll: fastRoll });
      });
    }
  });
}

export async function towCombatOverlayDefenceActor(actor, { manual = false } = {}) {
  if (!actor) return;
  const skills = towCombatOverlayGetActorSkills(actor);
  const manualEntries = towCombatOverlayGetManualDefenceEntries(actor);
  if (manualEntries.length === 0) {
    ui.notifications.warn(MODULE_NOTIFICATIONS.defence.noManualEntries.replace("{actorName}", actor.name));
    return;
  }

  if (manual) {
    await towCombatOverlayRenderDefenceSelector(actor, manualEntries);
    return;
  }

  if (skills.length === 0) {
    ui.notifications.warn(MODULE_NOTIFICATIONS.defence.noDefaultSkills.replace("{actorName}", actor.name));
    return;
  }

  const skillToRoll = skills.includes(DEFAULT_DEFENCE_SKILL) ? DEFAULT_DEFENCE_SKILL : skills[0];
  if (skillToRoll !== DEFAULT_DEFENCE_SKILL) {
    ui.notifications.warn(
      MODULE_NOTIFICATIONS.defence.fallbackSkill
        .replace("{actorName}", actor.name)
        .replace("{defaultSkill}", DEFAULT_DEFENCE_SKILL)
        .replace("{rolledSkill}", skillToRoll)
    );
  }
  await towCombatOverlayRollSkill(actor, skillToRoll, { autoRoll: true });
}

export async function towCombatOverlayRunDefenceForControlled({ manual = false } = {}) {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn(MODULE_NOTIFICATIONS.selectAtLeastOneToken);
    return;
  }
  for (const token of tokens) {
    await towCombatOverlayDefenceActor(token.actor, { manual });
  }
}
