import { createActionRelayRuntime } from "./internal/action-relay.js";
import { withTemporaryUserTargets } from "./internal/temporary-targets.js";

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
  const { requestGmActionRelay } = createActionRelayRuntime();

  function armAutoEnduranceDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState } = {}) {
    if (!sourceToken?.actor || !targetToken?.actor) return;
    if (targetToken.actor.isOwner !== true && game?.user?.isGM !== true) return;

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

      if (targetToken.actor.isOwner !== true) {
        requestGmActionRelay("defence", {
          sourceTokenId: String(sourceToken?.id ?? ""),
          targetTokenId: String(targetToken?.id ?? ""),
          opposedMessageId: String(message?.id ?? ""),
          autoRoll: true
        });
        return;
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

  async function runPanelAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll = true } = {}) {
    const sourceActor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
    if (!sourceActor || !targetToken || !attackItem) return;
    const needsGmDefenceRelay = game?.user?.isGM !== true && targetToken?.actor?.isOwner !== true;
    const automation = getOverlayAutomationRef();
    const sourceBeforeState = automation.snapshotActorState(sourceActor);
    const restoreStaggerPrompt = automation.armDefaultStaggerChoiceWound(panelStaggerPatchDurationMs);
    if (autoRoll) {
      automation.armAutoDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState });
    }

    try {
      const testRef = await withTemporaryUserTargets(targetToken, () => setupAbilityTestWithDamage(sourceActor, attackItem, {
        autoRoll
      }));
      if (needsGmDefenceRelay) {
        requestGmActionRelay("defence", {
          sourceTokenId: String(sourceToken?.id ?? ""),
          targetTokenId: String(targetToken?.id ?? ""),
          attackerMessageId: String(testRef?.context?.messageId ?? ""),
          autoRoll: autoRoll !== false
        });
      }
    } finally {
      setTimeout(() => restoreStaggerPrompt(), autoApplyWaitMs);
    }
  }

  async function runPanelUnarmedAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll = true } = {}) {
    const sourceActor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
    if (!sourceActor || !targetToken || !attackItem) return;
    const needsGmDefenceRelay = game?.user?.isGM !== true && targetToken?.actor?.isOwner !== true;
    const automation = getOverlayAutomationRef();
    const sourceBeforeState = automation.snapshotActorState(sourceActor);
    const restoreStaggerPrompt = automation.armDefaultStaggerChoiceWound(panelStaggerPatchDurationMs);
    if (autoRoll) {
      armAutoEnduranceDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState });
    }

    try {
      const testRef = await withTemporaryUserTargets(targetToken, () => setupAbilityTestWithDamage(sourceActor, attackItem, {
        autoRoll
      }));
      if (needsGmDefenceRelay) {
        requestGmActionRelay("defence", {
          sourceTokenId: String(sourceToken?.id ?? ""),
          targetTokenId: String(targetToken?.id ?? ""),
          attackerMessageId: String(testRef?.context?.messageId ?? ""),
          preferredSkill: "endurance",
          autoRoll: autoRoll !== false
        });
      }
      return testRef;
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
    if (targetToken && game?.user?.isGM !== true && targetToken?.actor && targetToken.actor.isOwner !== true) {
      const relayed = requestGmActionRelay("help", {
        sourceTokenId: String(sourceToken?.id ?? ""),
        targetTokenId: String(targetToken?.id ?? ""),
        autoRoll: autoRoll !== false
      });
      if (relayed) return;
    }
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


