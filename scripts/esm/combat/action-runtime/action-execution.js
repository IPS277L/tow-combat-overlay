export function createPanelActionExecutionService({
  getOverlayAutomationRef,
  panelStaggerPatchDurationMs,
  autoApplyWaitMs,
  opposedLinkWaitMs,
  autoDefenceWaitMs,
  setupAbilityTestWithDamage,
  rollSkill,
  armAutoSubmitActionSkillDialog,
  runDefaultPanelActorAction,
  getSystemAdapter,
  createRollContext,
  armApplyRollModifiersToNextTestDialog,
  armAutoPickFirstHelpSkillDialog
} = {}) {
  function armAutoEnduranceDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState } = {}) {
    if (!sourceToken?.actor || !targetToken?.actor?.isOwner) return;

    let timeoutId = null;
    const cleanup = (hookId) => {
      Hooks.off("createChatMessage", hookId);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
    };

    const hookId = Hooks.on("createChatMessage", async (message) => {
      if (message?.type !== "opposed") return;
      if (message.system?.defender?.token !== targetToken.id) return;

      const attackerMessage = game.messages.get(message.system?.attackerMessage);
      const attackerActorUuid = attackerMessage?.system?.test?.actor;
      if (attackerActorUuid && attackerActorUuid !== sourceToken.actor.uuid) return;

      cleanup(hookId);
      const started = Date.now();
      while (Date.now() - started < opposedLinkWaitMs) {
        if (targetToken.actor.system?.opposed?.id === message.id) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await rollSkill(targetToken.actor, "endurance", { autoRoll: true });

      const automation = getOverlayAutomationRef();
      if (typeof automation.armAutoApplyDamageForOpposed === "function") {
        automation.armAutoApplyDamageForOpposed(message, {
          sourceActor: sourceToken.actor,
          sourceBeforeState
        });
      }
    });

    timeoutId = setTimeout(() => cleanup(hookId), autoDefenceWaitMs);
  }

  async function withTemporaryUserTargets(targetToken, callback) {
    const targetId = String(targetToken?.id ?? "").trim();
    if (!targetId || typeof callback !== "function") return callback?.();
    const previousTargetIds = Array.from(game?.user?.targets ?? [])
      .map((token) => String(token?.id ?? "").trim())
      .filter(Boolean);
    const placeables = Array.isArray(canvas?.tokens?.placeables) ? canvas.tokens.placeables : [];
    const setByToggle = (ids) => {
      const idSet = new Set((Array.isArray(ids) ? ids : []).map((id) => String(id ?? "").trim()).filter(Boolean));
      let usedToggle = false;
      for (const tokenObject of placeables) {
        if (typeof tokenObject?.setTarget !== "function") continue;
        usedToggle = true;
        tokenObject.setTarget(idSet.has(String(tokenObject.id ?? "")), {
          releaseOthers: false,
          groupSelection: false,
          user: game.user
        });
      }
      return usedToggle;
    };

    const usedToggle = setByToggle([targetId]);
    if (!usedToggle) {
      const updateTargets = game?.user?.updateTokenTargets;
      if (typeof updateTargets === "function") {
        const updateResult = updateTargets.call(game.user, [targetId]);
        if (updateResult && typeof updateResult.then === "function") await updateResult;
      } else {
        return callback();
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      return await callback();
    } finally {
      if (!setByToggle(previousTargetIds)) {
        const updateTargets = game?.user?.updateTokenTargets;
        if (typeof updateTargets === "function") {
          const restoreResult = updateTargets.call(game.user, previousTargetIds);
          if (restoreResult && typeof restoreResult.then === "function") await restoreResult;
        }
      }
    }
  }

  async function runPanelAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll = true } = {}) {
    const sourceActor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
    if (!sourceActor || !targetToken || !attackItem) return;
    const automation = getOverlayAutomationRef();
    const sourceBeforeState = automation.snapshotActorState(sourceActor);
    const restoreStaggerPrompt = automation.armDefaultStaggerChoiceWound(panelStaggerPatchDurationMs);
    automation.armAutoDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState });

    try {
      await withTemporaryUserTargets(targetToken, () => setupAbilityTestWithDamage(sourceActor, attackItem, {
        autoRoll
      }));
    } finally {
      setTimeout(() => restoreStaggerPrompt(), autoApplyWaitMs);
    }
  }

  async function runPanelUnarmedAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll = true } = {}) {
    const sourceActor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
    if (!sourceActor || !targetToken || !attackItem) return;
    const automation = getOverlayAutomationRef();
    const sourceBeforeState = automation.snapshotActorState(sourceActor);
    const restoreStaggerPrompt = automation.armDefaultStaggerChoiceWound(panelStaggerPatchDurationMs);
    armAutoEnduranceDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState });

    try {
      return await withTemporaryUserTargets(targetToken, () => setupAbilityTestWithDamage(sourceActor, attackItem, {
        autoRoll
      }));
    } finally {
      setTimeout(() => restoreStaggerPrompt(), autoApplyWaitMs);
    }
  }

  async function runPanelAimAction(actor, sourceToken, { autoRoll = true, targetToken = null } = {}) {
    if (!actor) return;
    const execute = async () => {
      if (autoRoll) armAutoSubmitActionSkillDialog(actor, "awareness");
      if (typeof actor?.system?.doAction === "function") {
        await runDefaultPanelActorAction(actor, "aim");
        return;
      }
      await getSystemAdapter().setupSkillTest(
        actor,
        "awareness",
        createRollContext(actor, { action: "aim", skipTargets: true })
      );
    };

    const resolvedTarget = targetToken ?? sourceToken ?? null;
    if (resolvedTarget) {
      await withTemporaryUserTargets(resolvedTarget, execute);
      return;
    }
    await execute();
  }

  async function runPanelHelpAction(actor, sourceToken, { autoRoll = true, targetToken = null } = {}) {
    if (!actor) return;
    const execute = async () => {
      armApplyRollModifiersToNextTestDialog(actor, {
        matches: (app) => String(app?.context?.action ?? "").toLowerCase() === "help"
      });
      if (autoRoll) armAutoPickFirstHelpSkillDialog(actor);
      await runDefaultPanelActorAction(actor, "help");
    };

    const resolvedTarget = targetToken ?? null;
    if (resolvedTarget) {
      await withTemporaryUserTargets(resolvedTarget, execute);
      return;
    }
    await execute();
  }

  return {
    armAutoEnduranceDefenceForOpposed,
    withTemporaryUserTargets,
    runPanelAttackOnTarget,
    runPanelUnarmedAttackOnTarget,
    runPanelAimAction,
    runPanelHelpAction
  };
}


