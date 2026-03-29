import {
  towCombatOverlayApplyRollVisibility
} from "../../combat/core.js";
import {
  towCombatOverlayDefenceActor,
  towCombatOverlayRollSkill
} from "../../combat/defence.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import { towCombatOverlayAutomation } from "../../overlay/automation/automation.js";
import { ACTION_RELAY_OPPOSED_DISCOVERY_WAIT_MS } from "../../runtime/action-constants.js";
import {
  collectTowCombatOverlayActorRefsFromCreateData,
  collectTowCombatOverlayActorRefsFromTokens,
  collectTowCombatOverlayRefsFromMessage,
  collectTowCombatOverlayTokenRefsFromCreateData,
  collectTowCombatOverlayTokenRefsFromTokens,
  normalizeTowCombatOverlayRollMode,
  resolveTowCombatOverlayMessageRefId
} from "./relay-reference-utils.js";
import {
  armAutoPickFirstHelpSkillDialog,
  runDefaultPanelActorAction
} from "../../combat/action-runtime/dialog-automation.js";
import { waitAndInvokeTowAutoApplyActionsInMessage } from "../../chat/auto-apply-action-runner.js";

const ACTION_RELAY_POST_DEFENCE_SETTLE_MS = ACTION_RELAY_OPPOSED_DISCOVERY_WAIT_MS;

function resolveCanvasTokenById(tokenId) {
  const id = String(tokenId ?? "").trim();
  if (!id) return null;
  const tokenByScene = canvas?.scene?.tokens?.get?.(id)?.object ?? null;
  if (tokenByScene) return tokenByScene;
  const placeables = Array.isArray(canvas?.tokens?.placeables) ? canvas.tokens.placeables : [];
  return placeables.find((token) => String(token?.id ?? "") === id) ?? null;
}

async function withTemporaryCurrentUserTargets(targetToken, callback) {
  if (typeof callback !== "function") return callback?.();
  const targetId = String(targetToken?.id ?? "").trim();
  if (!targetId) return callback();
  const currentUser = game?.user;
  if (!currentUser) return callback();

  const previousTargetIds = Array.from(currentUser.targets ?? [])
    .map((token) => String(token?.id ?? "").trim())
    .filter(Boolean);
  const placeables = Array.isArray(canvas?.tokens?.placeables) ? canvas.tokens.placeables : [];

  const setByToggle = (ids) => {
    const idSet = new Set((Array.isArray(ids) ? ids : []).map((id) => String(id ?? "").trim()).filter(Boolean));
    let toggled = false;
    for (const token of placeables) {
      if (typeof token?.setTarget !== "function") continue;
      toggled = true;
      token.setTarget(idSet.has(String(token.id ?? "")), {
        releaseOthers: false,
        groupSelection: false,
        user: currentUser
      });
    }
    return toggled;
  };

  const usedToggle = setByToggle([targetId]);
  if (!usedToggle) {
    const updateTargets = currentUser.updateTokenTargets;
    if (typeof updateTargets === "function") {
      await Promise.resolve(updateTargets.call(currentUser, [targetId]));
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    return await callback();
  } finally {
    if (!setByToggle(previousTargetIds)) {
      const updateTargets = currentUser.updateTokenTargets;
      if (typeof updateTargets === "function") {
        await Promise.resolve(updateTargets.call(currentUser, previousTargetIds));
      }
    }
  }
}

export async function withScopedTowCombatOverlayRelayVisibility(rollMode, callback, {
  actorRefs = null,
  tokenRefs = null,
  messageRefs = null,
  settleMs = 0
} = {}) {
  if (typeof callback !== "function") return callback?.();
  const requestedMode = normalizeTowCombatOverlayRollMode(rollMode);
  if (!requestedMode) return callback();
  const actorRefSet = actorRefs instanceof Set
    ? actorRefs
    : new Set(Array.isArray(actorRefs) ? actorRefs : []);
  const tokenRefSet = tokenRefs instanceof Set
    ? tokenRefs
    : new Set(Array.isArray(tokenRefs) ? tokenRefs : []);
  const messageRefSet = messageRefs instanceof Set
    ? messageRefs
    : new Set(Array.isArray(messageRefs) ? messageRefs : []);
  if (actorRefSet.size === 0 && tokenRefSet.size === 0 && messageRefSet.size === 0) {
    return callback();
  }

  const hookId = Hooks.on("preCreateChatMessage", (messageDoc, createData, _options, userId) => {
    const creatingUserId = String(userId ?? "").trim();
    const currentUserId = String(game?.user?.id ?? "").trim();
    if (creatingUserId && currentUserId && creatingUserId !== currentUserId) return;
    const sourceData = (createData && typeof createData === "object")
      ? createData
      : (messageDoc?.toObject?.() ?? {});
    const messageActorRefs = collectTowCombatOverlayActorRefsFromCreateData(sourceData);
    const messageTokenRefs = collectTowCombatOverlayTokenRefsFromCreateData(sourceData);
    const attackerMessageRef = resolveTowCombatOverlayMessageRefId(sourceData?.system?.attackerMessage);
    const createdMessageRef = resolveTowCombatOverlayMessageRefId(sourceData?.id ?? sourceData?._id ?? messageDoc?.id);
    const matchesActor = actorRefSet.size > 0
      ? Array.from(messageActorRefs).some((ref) => actorRefSet.has(ref))
      : false;
    const matchesToken = tokenRefSet.size > 0
      ? Array.from(messageTokenRefs).some((ref) => tokenRefSet.has(ref))
      : false;
    const matchesMessage = messageRefSet.size > 0
      ? [attackerMessageRef, createdMessageRef].filter(Boolean).some((ref) => messageRefSet.has(ref))
      : false;
    if (!matchesActor && !matchesToken && !matchesMessage) return;
    const updateData = {};
    towCombatOverlayApplyRollVisibility(updateData, { rollMode: requestedMode });
    if (!Object.keys(updateData).length) return;
    messageDoc.updateSource(updateData);
  });

  try {
    const result = await callback();
    const settleDuration = Math.max(0, Math.trunc(Number(settleMs) || 0));
    if (settleDuration > 0) {
      await new Promise((resolve) => setTimeout(resolve, settleDuration));
    }
    return result;
  } finally {
    Hooks.off("preCreateChatMessage", hookId);
  }
}

export async function withTowCombatOverlayAutoStaggerChoice(callback, { restoreDelayMs = 6000 } = {}) {
  if (typeof callback !== "function") return callback?.();
  const restore = (typeof towCombatOverlayAutomation?.armDefaultStaggerChoiceWound === "function")
    ? towCombatOverlayAutomation.armDefaultStaggerChoiceWound()
    : null;
  try {
    return await callback();
  } finally {
    if (typeof restore === "function") {
      const delay = Math.max(0, Math.trunc(Number(restoreDelayMs) || 0));
      setTimeout(() => {
        try {
          restore();
        } catch (_error) {}
      }, delay);
    }
  }
}

export function resolveOpposedMessageForRelay({ targetToken = null, opposedMessageId = "", attackerMessageId = "" } = {}) {
  const explicitOpposedId = String(opposedMessageId ?? "").trim();
  if (explicitOpposedId) {
    const explicit = game?.messages?.get?.(explicitOpposedId) ?? null;
    if (explicit?.type === "opposed") return explicit;
  }

  const targetOpposedId = String(targetToken?.actor?.system?.opposed?.id ?? "").trim();
  if (targetOpposedId) {
    const byTargetOpposed = game?.messages?.get?.(targetOpposedId) ?? null;
    if (byTargetOpposed?.type === "opposed") return byTargetOpposed;
  }

  const attackerRef = String(attackerMessageId ?? "").trim();
  let latestByTarget = null;
  const messages = Array.from(game?.messages ?? []);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.type !== "opposed") continue;
    const defenderTokenId = String(message?.system?.defender?.token ?? "").trim();
    if (targetToken && defenderTokenId !== String(targetToken.id ?? "")) continue;
    if (!latestByTarget) latestByTarget = message;
    if (!attackerRef) continue;
    const attackerMessage = resolveTowCombatOverlayMessageRefId(message?.system?.attackerMessage);
    if (attackerMessage && attackerMessage === attackerRef) return message;
  }
  return latestByTarget;
}

async function handleTowCombatOverlayActionRelayPayload(payload) {
  const actionType = String(payload?.actionType ?? "").trim().toLowerCase();
  if (!actionType) return false;
  const sourceToken = resolveCanvasTokenById(payload?.sourceTokenId);
  const targetToken = resolveCanvasTokenById(payload?.targetTokenId);
  const requestedRollMode = normalizeTowCombatOverlayRollMode(payload?.rollMode);
  const relayActorRefs = collectTowCombatOverlayActorRefsFromTokens(sourceToken, targetToken);
  const relayTokenRefs = collectTowCombatOverlayTokenRefsFromTokens(sourceToken, targetToken);

  if (actionType === "spellautoapply") {
    const messageId = String(payload?.messageId ?? "").trim();
    const sourceMessage = messageId ? (game?.messages?.get?.(messageId) ?? null) : null;
    const messageRefs = new Set(messageId ? [messageId] : []);
    const messageRefsFromSource = collectTowCombatOverlayRefsFromMessage(sourceMessage);
    for (const ref of messageRefsFromSource.actorRefs) relayActorRefs.add(ref);
    for (const ref of messageRefsFromSource.tokenRefs) relayTokenRefs.add(ref);
    if (targetToken) {
      await withScopedTowCombatOverlayRelayVisibility(requestedRollMode, async () => {
        await withTowCombatOverlayAutoStaggerChoice(async () => {
          await withTemporaryCurrentUserTargets(targetToken, async () => {
            await waitAndInvokeTowAutoApplyActionsInMessage(messageId, { attempts: 20, intervalMs: 100 });
          });
        });
      }, {
        actorRefs: relayActorRefs,
        tokenRefs: relayTokenRefs,
        messageRefs,
        settleMs: 2500
      });
      return true;
    }
    await withScopedTowCombatOverlayRelayVisibility(requestedRollMode, async () => {
      await withTowCombatOverlayAutoStaggerChoice(async () => {
        await waitAndInvokeTowAutoApplyActionsInMessage(messageId, { attempts: 20, intervalMs: 100 });
      });
    }, {
      actorRefs: relayActorRefs,
      tokenRefs: relayTokenRefs,
      messageRefs,
      settleMs: 2500
    });
    return true;
  }

  if (!sourceToken?.actor || !targetToken) return false;

  if (actionType === "help") {
    await withScopedTowCombatOverlayRelayVisibility(requestedRollMode, async () => {
      if (payload?.autoRoll !== false) armAutoPickFirstHelpSkillDialog(sourceToken.actor);
      await withTemporaryCurrentUserTargets(targetToken, async () => {
        await runDefaultPanelActorAction(sourceToken.actor, "help");
      });
    }, {
      actorRefs: relayActorRefs,
      tokenRefs: relayTokenRefs,
      settleMs: 1200
    });
    return true;
  }

  if (actionType === "defence") {
    const opposedMessageId = String(payload?.opposedMessageId ?? "").trim();
    const attackerMessageId = String(payload?.attackerMessageId ?? "").trim();
    const preferredSkill = String(payload?.preferredSkill ?? "").trim().toLowerCase();
    const sourceBeforeState = towCombatOverlayAutomation.snapshotActorState(sourceToken.actor);
    const started = Date.now();
    let opposedMessage = null;
    while ((Date.now() - started) < ACTION_RELAY_OPPOSED_DISCOVERY_WAIT_MS) {
      opposedMessage = resolveOpposedMessageForRelay({
        targetToken,
        opposedMessageId,
        attackerMessageId
      });
      if (opposedMessage) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await withScopedTowCombatOverlayRelayVisibility(requestedRollMode, async () => {
      await withTowCombatOverlayAutoStaggerChoice(async () => {
        if (preferredSkill) await towCombatOverlayRollSkill(targetToken.actor, preferredSkill, { autoRoll: true });
        else await towCombatOverlayDefenceActor(targetToken.actor, { manual: false });
      });
    }, {
      actorRefs: relayActorRefs,
      tokenRefs: relayTokenRefs,
      messageRefs: new Set([attackerMessageId, opposedMessageId].filter(Boolean)),
      settleMs: ACTION_RELAY_POST_DEFENCE_SETTLE_MS
    });
    if (!opposedMessage) {
      const afterDefenceStarted = Date.now();
      while ((Date.now() - afterDefenceStarted) < ACTION_RELAY_POST_DEFENCE_SETTLE_MS) {
        opposedMessage = resolveOpposedMessageForRelay({
          targetToken,
          opposedMessageId,
          attackerMessageId
        });
        if (opposedMessage) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    if (opposedMessage) {
      towCombatOverlayAutomation.armAutoApplyDamageForOpposed(opposedMessage, {
        sourceActor: sourceToken.actor,
        sourceBeforeState
      });
    }
    return true;
  }

  return false;
}

export function ensureTowCombatOverlayActionRelayFlagHook() {
  const { moduleId, flags } = getTowCombatOverlayConstants();
  const relayFlagKey = String(flags?.actionRelayRequest ?? "actionRelayRequest");
  const stateKey = "__towCombatOverlayActionRelayFlagHookState";
  if (!game) return null;
  const existingState = game[stateKey];
  if (existingState && typeof existingState === "object") return existingState;

  const processedByRequester = new Map();

  const buildFingerprint = (payload, fallbackRequesterId = "") => JSON.stringify({
    requesterId: String(payload?.requesterId ?? fallbackRequesterId).trim(),
    actionType: String(payload?.actionType ?? "").trim(),
    sourceTokenId: String(payload?.sourceTokenId ?? "").trim(),
    targetTokenId: String(payload?.targetTokenId ?? "").trim(),
    messageId: String(payload?.messageId ?? "").trim(),
    attackerMessageId: String(payload?.attackerMessageId ?? "").trim(),
    opposedMessageId: String(payload?.opposedMessageId ?? "").trim(),
    preferredSkill: String(payload?.preferredSkill ?? "").trim(),
    autoRoll: payload?.autoRoll === false ? false : true,
    rollMode: normalizeTowCombatOverlayRollMode(payload?.rollMode),
    timestamp: Number(payload?.timestamp ?? 0)
  });

  const didUpdateTouchRelayFlag = (changed) => {
    const moduleFlags = changed?.flags?.[moduleId];
    if (moduleFlags && Object.prototype.hasOwnProperty.call(moduleFlags, relayFlagKey)) return true;
    if (!foundry?.utils?.flattenObject || !changed || typeof changed !== "object") return false;
    const flattened = foundry.utils.flattenObject(changed);
    const rootPath = `flags.${moduleId}.${relayFlagKey}`;
    return Object.keys(flattened).some((key) => key === rootPath || key.startsWith(`${rootPath}.`) || key.startsWith(`${rootPath}.-=`));
  };

  const handleRelayPayload = async (payload, requestUser = null) => {
    if (!payload || typeof payload !== "object") return false;
    const sourceUserId = String(requestUser?.id ?? payload?.requesterId ?? "").trim();
    if (!sourceUserId) return false;
    const fingerprint = buildFingerprint(payload, sourceUserId);
    if (processedByRequester.get(sourceUserId) === fingerprint) return false;
    processedByRequester.set(sourceUserId, fingerprint);
    const didApply = await handleTowCombatOverlayActionRelayPayload(payload);
    if (requestUser?.unsetFlag) {
      void Promise.resolve(requestUser.unsetFlag(moduleId, relayFlagKey)).catch(() => {});
    }
    return didApply;
  };

  const hookId = Hooks.on("updateUser", (user, changed) => {
    if (game?.user?.isGM !== true) return;
    if (!didUpdateTouchRelayFlag(changed)) return;
    const payload = user?.getFlag?.(moduleId, relayFlagKey);
    if (!payload || typeof payload !== "object") return;
    void Promise.resolve(handleRelayPayload(payload, user)).catch(() => {});
  });

  const relayState = {
    hookId,
    handleRelayPayload,
    buildFingerprint
  };
  game[stateKey] = relayState;
  return relayState;
}