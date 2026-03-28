import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";

const {
  moduleId: TOW_MODULE_ID,
  sockets: TOW_SOCKETS,
  flags: TOW_FLAGS
} = getTowCombatOverlayConstants();

const RELAY_WAIT_NOTICE_DELAY_MS = 2500;
const RELAY_WAIT_NOTICE_COOLDOWN_MS = 10000;

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
  let lastRelayWaitNoticeAt = 0;

  function resolveCanvasTokenById(tokenId) {
    const id = String(tokenId ?? "").trim();
    if (!id) return null;
    const tokenByScene = canvas?.scene?.tokens?.get?.(id)?.object ?? null;
    if (tokenByScene) return tokenByScene;
    const placeables = Array.isArray(canvas?.tokens?.placeables) ? canvas.tokens.placeables : [];
    return placeables.find((token) => String(token?.id ?? "") === id) ?? null;
  }

  function shouldShowRelayWaitNotice(payload = {}) {
    const actionType = String(payload?.actionType ?? "").trim().toLowerCase();
    if (!actionType) return false;
    if (actionType === "defence") {
      const targetToken = resolveCanvasTokenById(payload?.targetTokenId);
      const opposedId = String(targetToken?.actor?.system?.opposed?.id ?? "").trim();
      if (!opposedId) return true;
      const opposedMessage = game?.messages?.get?.(opposedId) ?? null;
      if (!opposedMessage) return true;
      const computed = opposedMessage?.system?.result?.computed === true;
      const applied = opposedMessage?.system?.result?.damage?.applied === true;
      return !(computed || applied);
    }
    return true;
  }

  function scheduleRelayWaitNotice(payload = {}) {
    setTimeout(() => {
      const now = Date.now();
      if (now - lastRelayWaitNoticeAt < RELAY_WAIT_NOTICE_COOLDOWN_MS) return;
      if (!shouldShowRelayWaitNotice(payload)) return;
      lastRelayWaitNoticeAt = now;
      ui?.notifications?.info?.("Waiting for an active GM client to continue this action.");
    }, RELAY_WAIT_NOTICE_DELAY_MS);
  }

  function hasActiveGmUser() {
    const users = game?.users ? Array.from(game.users) : [];
    return users.some((user) => user?.isGM === true && user?.active === true);
  }

  function requestGmActionRelay(type, payload = {}) {
    const actionType = String(type ?? "").trim();
    if (!actionType || game?.user?.isGM === true) return false;
    if (!hasActiveGmUser()) return false;
    const socket = game?.socket;
    if (!socket?.emit) return false;

    const relayPayload = {
      ...payload,
      actionType,
      requesterId: String(game?.user?.id ?? "").trim(),
      timestamp: Date.now()
    };

    const currentUser = game?.user;
    const relayFlagKey = String(TOW_FLAGS?.actionRelayRequest ?? "actionRelayRequest");
    if (currentUser?.setFlag) {
      void Promise.resolve(currentUser.setFlag(TOW_MODULE_ID, relayFlagKey, relayPayload)).catch(() => {});
    }

    const requestType = String(TOW_SOCKETS?.actionRelayRequest ?? "actionRelayRequest");
    socket.emit(`module.${TOW_MODULE_ID}`, {
      type: requestType,
      payload: relayPayload
    });
    scheduleRelayWaitNotice(relayPayload);
    return true;
  }

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
    const needsGmDefenceRelay = game?.user?.isGM !== true && targetToken?.actor?.isOwner !== true;
    const automation = getOverlayAutomationRef();
    const sourceBeforeState = automation.snapshotActorState(sourceActor);
    const restoreStaggerPrompt = automation.armDefaultStaggerChoiceWound(panelStaggerPatchDurationMs);
    automation.armAutoDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState });

    try {
      const testRef = await withTemporaryUserTargets(targetToken, () => setupAbilityTestWithDamage(sourceActor, attackItem, {
        autoRoll
      }));
      if (needsGmDefenceRelay) {
        requestGmActionRelay("defence", {
          sourceTokenId: String(sourceToken?.id ?? ""),
          targetTokenId: String(targetToken?.id ?? ""),
          attackerMessageId: String(testRef?.context?.messageId ?? ""),
          autoRoll: true
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
    armAutoEnduranceDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState });

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
          autoRoll: true
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


