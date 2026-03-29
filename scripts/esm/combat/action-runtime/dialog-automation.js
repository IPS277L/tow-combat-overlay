import {
  towCombatOverlayArmAutoSubmitDialog
} from "../../combat/attack.js";
import {
  createTowCombatOverlayRollContext,
  getTowCombatOverlayActorRollModifierFields
} from "../../combat/roll-modifier.js";
import { withPatchedPanelActionSkillTestContext } from "../../overlay/panel/actions/action-test-context.js";

export function armAutoSubmitActionSkillDialog(actor, skill) {
  const skillKey = String(skill ?? "").trim();
  if (!actor || !skillKey) return;
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderTestDialog",
    matches: (app) => app?.actor?.id === actor.id && app?.skill === skillKey,
    submitErrorMessage: "TestDialog.submit() is unavailable."
  });
}

export function armAutoPickFirstHelpSkillDialog(actor) {
  if (!actor) return;
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderItemDialog",
    matches: (app) => {
      const text = String(app?.options?.text ?? "").trim().toLowerCase();
      const title = String(app?.options?.window?.title ?? app?.title ?? "").trim().toLowerCase();
      return text.includes("choose skill") || title.includes("help");
    },
    submitErrorMessage: "ItemDialog.submit() is unavailable.",
    beforeSubmit: async (app) => {
      if (!app) return;
      const firstChoice = app?.items?.[0] ?? null;
      const firstSkill = String(firstChoice?.id ?? "").trim();
      app.chosen = [0];
      if (firstSkill) armAutoSubmitActionSkillDialog(actor, firstSkill);
    }
  });
}

export function armApplyRollModifiersToNextTestDialog(actor, { matches = null, timeoutMs = 20000 } = {}) {
  if (!actor) return;
  const rollFields = getTowCombatOverlayActorRollModifierFields(actor);
  const hookName = "renderTestDialog";
  let hookId = null;
  let timeoutId = null;

  const cleanup = () => {
    if (hookId !== null) Hooks.off(hookName, hookId);
    hookId = null;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = null;
  };

  hookId = Hooks.on(hookName, (app) => {
    if (app?.actor?.id !== actor.id) return;
    if (typeof matches === "function" && !matches(app)) return;
    cleanup();
    if (!app || app._towCombatOverlayRollModsInjected) return;
    app._towCombatOverlayRollModsInjected = true;
    app.userEntry ??= {};
    app.fields ??= {};
    for (const [key, value] of Object.entries(rollFields)) {
      const numericValue = Number(value ?? 0);
      app.userEntry[key] = numericValue;
      app.fields[key] = numericValue;
    }
    if (typeof app.render === "function") app.render(true);
  });

  timeoutId = setTimeout(cleanup, Math.max(250, Number(timeoutMs) || 0));
}

export async function runDefaultPanelActorAction(actor, actionKey) {
  const key = String(actionKey ?? "").trim();
  if (!actor || !key) return;
  armApplyRollModifiersToNextTestDialog(actor);
  const runWithActionRollContext = async (callback) => withPatchedPanelActionSkillTestContext(
    actor,
    callback,
    { createRollContext: createTowCombatOverlayRollContext }
  );

  if (typeof actor?.system?.doAction === "function") {
    await runWithActionRollContext(() => actor.system.doAction(key));
    return;
  }

  const actionData = game?.oldworld?.config?.actions?.[key] ?? null;
  if (actionData?.script && typeof actionData.script === "function") {
    await runWithActionRollContext(() => actionData.script.call(actionData, actor));
    return;
  }

  const actionUse = game?.oldworld?.config?.rollClasses?.ActionUse;
  if (typeof actionUse?.fromAction === "function") {
    await runWithActionRollContext(() => actionUse.fromAction(key, actor));
  }
}
