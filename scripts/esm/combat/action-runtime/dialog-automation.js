import {
  towCombatOverlayArmAutoSubmitDialog
} from "../../combat/attack.js";
import {
  createTowCombatOverlayRollContext,
  getTowCombatOverlayActorRollModifierFields
} from "../../combat/roll-modifier.js";
import { withPatchedPanelActionSkillTestContext } from "../../overlay/panel/actions/action-test-context.js";

async function withTowCombatOverlaySafeApplyEffect(actor, actionKey, callback) {
  if (!actor || typeof callback !== "function") return callback?.();
  const originalApplyEffect = actor?.applyEffect;
  const originalSystemApplyEffect = actor?.system?.applyEffect;
  if (typeof originalApplyEffect !== "function" && typeof originalSystemApplyEffect !== "function") return callback();

  const actionLabel = String(game?.oldworld?.config?.actions?.[actionKey]?.name ?? actionKey ?? "Action").trim() || "Action";
  const fallbackEffectName = actionLabel;
  const normalizeSingleEffectData = (effectData, indexLabel = "") => {
    if (!effectData || typeof effectData !== "object") return effectData;
    const currentName = String(effectData?.name ?? "").trim();
    if (currentName) return effectData;
    const labelName = String(effectData?.label ?? "").trim();
    const clonedEffectData = foundry?.utils?.deepClone?.(effectData) ?? { ...effectData };
    clonedEffectData.name = labelName || fallbackEffectName;
    return clonedEffectData;
  };

  const normalizeEffectDataContainer = (value, labelPrefix = "effectData") => {
    if (Array.isArray(value)) return value.map((entry, index) => normalizeSingleEffectData(entry, `${labelPrefix}[${index}]`));
    if (value && typeof value === "object") return normalizeSingleEffectData(value, `${labelPrefix}[0]`);
    return value;
  };

  const formatEffectOptions = (options) => {
    if (!options || typeof options !== "object") return options;
    let changed = false;
    const normalizedOptions = { ...options };
    if (Object.prototype.hasOwnProperty.call(options, "effectData")) {
      const normalizedEffectData = normalizeEffectDataContainer(options.effectData, "effectData");
      if (normalizedEffectData !== options.effectData) changed = true;
      normalizedOptions.effectData = normalizedEffectData;
    }
    if (Object.prototype.hasOwnProperty.call(options, "effects")) {
      const normalizedEffects = normalizeEffectDataContainer(options.effects, "effects");
      if (normalizedEffects !== options.effects) changed = true;
      normalizedOptions.effects = normalizedEffects;
    }
    return changed ? normalizedOptions : options;
  };

  const patchedApplyEffect = async (options = {}, ...rest) => {
    const normalizedOptions = formatEffectOptions(options);
    try {
      if (typeof originalApplyEffect !== "function") return undefined;
      return originalApplyEffect.call(actor, normalizedOptions, ...rest);
    } catch (error) { throw error; }
  };

  const patchedSystemApplyEffect = async (options = {}, ...rest) => {
    const normalizedOptions = formatEffectOptions(options);
    try {
      if (typeof originalSystemApplyEffect !== "function") return undefined;
      return originalSystemApplyEffect.call(actor.system, normalizedOptions, ...rest);
    } catch (error) { throw error; }
  };

  if (typeof originalApplyEffect === "function") actor.applyEffect = patchedApplyEffect;
  if (actor?.system && typeof originalSystemApplyEffect === "function") actor.system.applyEffect = patchedSystemApplyEffect;
  try {
    return await callback();
  } finally {
    if (typeof originalApplyEffect === "function" && actor.applyEffect === patchedApplyEffect) {
      actor.applyEffect = originalApplyEffect;
    }
    if (actor?.system && typeof originalSystemApplyEffect === "function" && actor.system.applyEffect === patchedSystemApplyEffect) {
      actor.system.applyEffect = originalSystemApplyEffect;
    }
  }
}

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
  const runWithSafeActionContext = async (callback) => withTowCombatOverlaySafeApplyEffect(
    actor,
    key,
    () => runWithActionRollContext(callback)
  );

  if (typeof actor?.system?.doAction === "function") {
    await runWithSafeActionContext(() => actor.system.doAction(key));
    return;
  }

  const actionData = game?.oldworld?.config?.actions?.[key] ?? null;
  if (actionData?.script && typeof actionData.script === "function") {
    await runWithSafeActionContext(() => actionData.script.call(actionData, actor));
    return;
  }

  const actionUse = game?.oldworld?.config?.rollClasses?.ActionUse;
  if (typeof actionUse?.fromAction === "function") {
    await runWithSafeActionContext(() => actionUse.fromAction(key, actor));
  }
}
