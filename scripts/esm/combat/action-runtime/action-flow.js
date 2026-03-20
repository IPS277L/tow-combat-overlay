export function createPanelActionFlowService({
  withPatchedActionSkillTestContext,
  getTowCombatOverlayActorRollModifierFields,
  towCombatOverlayArmAutoSubmitDialog,
  towCombatOverlayDefenceActor,
  getTowCombatOverlaySystemAdapter,
  createTowCombatOverlayRollContext
} = {}) {
  async function runDefaultPanelActorAction(actor, actionKey) {
    const key = String(actionKey ?? "").trim();
    if (!actor || !key) return;

    // Some Old World action flows bypass actor.setupSkillTest and open the test
    // dialog directly, so arm a one-shot dialog patch as a fallback.
    armApplyRollModifiersToNextTestDialog(actor);

    const runWithActionRollContext = async (callback) => withPatchedActionSkillTestContext(actor, callback);
    const normalizedKey = key.toLowerCase();

    if (normalizedKey !== "improvise" && typeof actor?.system?.doAction === "function") {
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

  function armApplyRollModifiersToNextTestDialog(actor, { matches = null, timeoutMs = 20000 } = {}) {
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

  function armAutoSubmitActionSkillDialog(actor, skill) {
    const skillKey = String(skill ?? "").trim();
    if (!skillKey) return;
    towCombatOverlayArmAutoSubmitDialog({
      hookName: "renderTestDialog",
      matches: (app) => app?.actor?.id === actor.id && app?.skill === skillKey,
      submitErrorMessage: "TestDialog.submit() is unavailable."
    });
  }

  function armAutoPickFirstImproviseSkillDialog(actor) {
    towCombatOverlayArmAutoSubmitDialog({
      hookName: "renderItemDialog",
      matches: (app) => {
        const text = String(app?.options?.text ?? "").trim().toLowerCase();
        const title = String(app?.options?.window?.title ?? app?.title ?? "").trim().toLowerCase();
        return text.includes("choose skill") || title.includes("improvise");
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

  function armAutoPickFirstHelpSkillDialog(actor) {
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

  async function runPanelActorAction(actor, actionKey, { autoRoll = true } = {}) {
    const key = String(actionKey ?? "").trim().toLowerCase();
    if (!actor || !key) return;

    if (key === "defence") {
      await towCombatOverlayDefenceActor(actor, { manual: !autoRoll });
      return;
    }

    if (!autoRoll) {
      await runDefaultPanelActorAction(actor, key);
      return;
    }

    if (key === "aim") armAutoSubmitActionSkillDialog(actor, "awareness");
    if (key === "improvise") armAutoPickFirstImproviseSkillDialog(actor);

    await runDefaultPanelActorAction(actor, key);
  }

  function getDialogActionList(config) {
    if (Array.isArray(config?.buttons)) return config.buttons.map((button) => String(button?.action ?? ""));
    return Object.values(config?.buttons ?? {}).map((button) => String(button?.action ?? ""));
  }

  function isRecoverChoiceDialogConfig(config) {
    const title = String(config?.window?.title ?? "").toLowerCase();
    const actions = getDialogActionList(config);
    const hasExpectedChoices = actions.includes("recover") && actions.includes("treat") && actions.includes("condition");
    return hasExpectedChoices && title.includes("recover");
  }

  async function withForcedRecoverDialogChoice(choice, callback) {
    const DialogApi = foundry?.applications?.api?.Dialog;
    if (typeof DialogApi?.wait !== "function" || typeof callback !== "function") return callback?.();

    const originalWait = DialogApi.wait.bind(DialogApi);
    DialogApi.wait = async (config, options) => {
      if (isRecoverChoiceDialogConfig(config)) return String(choice ?? "");
      return originalWait(config, options);
    };

    try {
      return await callback();
    } finally {
      DialogApi.wait = originalWait;
    }
  }

  async function runDefaultRecoverAction(actor) {
    armApplyRollModifiersToNextTestDialog(actor);

    if (typeof actor?.system?.doAction === "function") {
      await withPatchedActionSkillTestContext(actor, () => actor.system.doAction("recover"));
      return;
    }

    const recoverActionData = game?.oldworld?.config?.actions?.recover ?? null;
    if (recoverActionData?.script && typeof recoverActionData.script === "function") {
      await withPatchedActionSkillTestContext(actor, () => recoverActionData.script.call(recoverActionData, actor));
      return;
    }

    const actionUse = game?.oldworld?.config?.rollClasses?.ActionUse;
    if (typeof actionUse?.fromAction === "function") {
      await withPatchedActionSkillTestContext(actor, () => actionUse.fromAction("recover", actor));
    }
  }

  function armAutoSubmitRecallSkillDialog(actor) {
    towCombatOverlayArmAutoSubmitDialog({
      hookName: "renderTestDialog",
      matches: (app) => app?.actor?.id === actor.id && app?.skill === "recall",
      submitErrorMessage: "TestDialog.submit() is unavailable."
    });
  }

  function armAutoPickFirstRecoverItemDialog(pickerType) {
    const type = String(pickerType ?? "").trim();
    if (!type) return;

    const expectedText = (type === "treat")
      ? "select wound to treat"
      : "select condition to test against";
    const expectedTitle = (type === "treat")
      ? "treat wound"
      : "remove condition";

    towCombatOverlayArmAutoSubmitDialog({
      hookName: "renderItemDialog",
      matches: (app) => {
        const text = String(app?.options?.text ?? "").trim().toLowerCase();
        const title = String(app?.options?.window?.title ?? app?.title ?? "").trim().toLowerCase();
        return text.includes(expectedText) || title.includes(expectedTitle);
      },
      submitErrorMessage: "ItemDialog.submit() is unavailable.",
      beforeSubmit: async (app) => {
        if (!app) return;
        const itemCount = Number(app?.items?.length ?? 0);
        if (!Number.isFinite(itemCount) || itemCount <= 0) return;
        app.chosen = [0];
      }
    });
  }

  async function runPanelRecoverAction(actor, subAction, { autoRoll = true } = {}) {
    const actionKey = String(subAction ?? "").trim();
    if (!actor || !actionKey) return;

    if (!autoRoll) {
      if (actionKey === "treat") {
        armApplyRollModifiersToNextTestDialog(actor, {
          matches: (app) => {
            const skill = String(app?.skill ?? "").toLowerCase();
            const title = String(app?.context?.title ?? "").toLowerCase();
            const appendTitle = String(app?.context?.appendTitle ?? "").toLowerCase();
            return skill === "recall" && (title.includes("treat wound") || appendTitle.includes("treat wound"));
          }
        });
      }
      await runDefaultRecoverAction(actor);
      return;
    }

    if (actionKey === "treat") {
      armApplyRollModifiersToNextTestDialog(actor, {
        matches: (app) => {
          const skill = String(app?.skill ?? "").toLowerCase();
          const title = String(app?.context?.title ?? "").toLowerCase();
          const appendTitle = String(app?.context?.appendTitle ?? "").toLowerCase();
          return skill === "recall" && (title.includes("treat wound") || appendTitle.includes("treat wound"));
        }
      });
      armAutoSubmitRecallSkillDialog(actor);
      armAutoPickFirstRecoverItemDialog("treat");
    }
    if (actionKey === "condition") armAutoPickFirstRecoverItemDialog("condition");
    const forcedChoice = (actionKey === "condition" || actionKey === "treat" || actionKey === "recover")
      ? actionKey
      : "recover";
    await withForcedRecoverDialogChoice(forcedChoice, () => runDefaultRecoverAction(actor));
  }

  async function runPanelManoeuvreAction(actor, subAction, { autoRoll = true } = {}) {
    const action = "manoeuvre";
    const actionKey = String(subAction ?? "").trim();
    if (!actor || !actionKey) return;
    const subActionData = game?.oldworld?.config?.actions?.[action]?.subActions?.[actionKey] ?? null;

    if (!autoRoll && typeof actor?.system?.doAction === "function") {
      await withPatchedActionSkillTestContext(actor, () => actor.system.doAction(action, actionKey));
      return;
    }

    const runSkillTestAuto = async (skill) => {
      const skillKey = String(skill ?? "").trim();
      if (!skillKey || typeof actor.setupSkillTest !== "function") return null;
      towCombatOverlayArmAutoSubmitDialog({
        hookName: "renderTestDialog",
        matches: (app) => app?.actor?.id === actor.id && app?.skill === skillKey,
        submitErrorMessage: "TestDialog.submit() is unavailable."
      });
      return getTowCombatOverlaySystemAdapter().setupSkillTest(
        actor,
        skillKey,
        createTowCombatOverlayRollContext(actor, { action, subAction: actionKey, skipTargets: true })
      );
    };

    if (actionKey === "run") {
      const test = await runSkillTestAuto("athletics");
      if (test?.failed && !actor.system?.isStaggered) await actor.addCondition?.("staggered");
      return;
    }

    if (actionKey === "charge") {
      const test = await runSkillTestAuto("athletics");
      if (test?.failed) {
        if (!actor.system?.isStaggered) await actor.addCondition?.("staggered");
        return;
      }
      const effect = foundry?.utils?.deepClone?.(subActionData?.effect);
      if (effect) await actor.applyEffect?.({ effectData: [effect] });
      return;
    }

    if (subActionData?.test?.skill) {
      await runSkillTestAuto(String(subActionData.test.skill));
      return;
    }

    if (subActionData?.script && typeof subActionData.script === "function") {
      armApplyRollModifiersToNextTestDialog(actor);
      await subActionData.script.call(subActionData, actor);
      return;
    }

    const actionUse = game?.oldworld?.config?.rollClasses?.ActionUse;
    if (typeof actionUse?.fromAction === "function") {
      armApplyRollModifiersToNextTestDialog(actor);
      await actionUse.fromAction(action, actor, { subAction: actionKey });
    }
  }

  function resolvePanelCastingLore(actor) {
    const currentLore = String(actor?.system?.magic?.casting?.lore ?? "").trim();
    if (currentLore && currentLore.toLowerCase() !== "none") return currentLore;
    const spells = Array.isArray(actor?.itemTypes?.spell) ? actor.itemTypes.spell : [];
    for (const spell of spells) {
      const lore = String(spell?.system?.lore ?? "").trim();
      if (lore && lore.toLowerCase() !== "none") return lore;
    }
    return "";
  }

  async function runPanelAccumulatePowerAction(actor, { autoRoll = true } = {}) {
    if (!actor || typeof actor.setupCastingTest !== "function") return;
    const lore = resolvePanelCastingLore(actor);
    if (!lore) {
      ui.notifications?.error?.("No spell lore available to accumulate power.");
      return;
    }

    if (autoRoll) {
      armApplyRollModifiersToNextTestDialog(actor, {
        matches: (app) => (
          app?.actor?.id === actor.id
          && (
            String(app?.context?.rollClass ?? "").trim().toLowerCase() === "castingtest"
            || app?.casting === true
          )
        )
      });
      towCombatOverlayArmAutoSubmitDialog({
        hookName: "renderTestDialog",
        matches: (app) => (
          app?.actor?.id === actor.id
          && (
            String(app?.context?.rollClass ?? "").trim().toLowerCase() === "castingtest"
            || app?.casting === true
          )
        ),
        submitErrorMessage: "Casting test submit() is unavailable."
      });
    }

    await actor.setupCastingTest(
      { lore },
      createTowCombatOverlayRollContext(actor, { lore })
    );
  }

  return {
    runDefaultPanelActorAction,
    armApplyRollModifiersToNextTestDialog,
    armAutoSubmitActionSkillDialog,
    armAutoPickFirstImproviseSkillDialog,
    armAutoPickFirstHelpSkillDialog,
    runPanelActorAction,
    runPanelRecoverAction,
    runPanelManoeuvreAction,
    resolvePanelCastingLore,
    runPanelAccumulatePowerAction
  };
}

