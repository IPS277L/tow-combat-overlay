import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";

const {
  moduleId: TOW_MODULE_ID,
  sockets: TOW_SOCKETS,
  flags: TOW_FLAGS
} = getTowCombatOverlayConstants();

export function createPanelSpellAutoApplyService({
  getOverlayAutomationRef,
  panelStaggerPatchDurationMs,
  autoApplyWaitMs,
  armAutoResolveSpellTriggeredTestDialogs,
  spellRequiresTargetPick,
  spellTargetsSelf,
  withTemporaryUserTargets,
  startPanelAttackPickMode,
  resolveActorLatestCastingPotency,
  ensurePanelItemUseRollCompatibility,
  towCombatOverlayApplyRollVisibility,
  armApplyRollModifiersToNextTestDialog,
  towCombatOverlayArmAutoSubmitDialog,
  createTowCombatOverlayRollContext
} = {}) {
  let directTestPatchInstalled = false;
  let directTestPatchOriginalFromData = null;
  let directTestPatchNextContextId = 1;
  const directTestPatchContexts = new Map();

  function hasActiveGmUser() {
    const users = game?.users ? Array.from(game.users) : [];
    return users.some((user) => user?.isGM === true && user?.active === true);
  }

  function requestGmSpellAutoApplyRelay(messageId, targetToken = null) {
    if (game?.user?.isGM === true) return false;
    if (!hasActiveGmUser()) return false;
    const socket = game?.socket;
    if (!socket?.emit) return false;
    const relayPayload = {
      actionType: "spellAutoApply",
      messageId: String(messageId ?? "").trim(),
      targetTokenId: String(targetToken?.id ?? "").trim(),
      rollMode: String(game?.settings?.get?.("core", "rollMode") ?? "").trim(),
      requesterId: String(game?.user?.id ?? "").trim(),
      timestamp: Date.now()
    };
    const relayFlagKey = String(TOW_FLAGS?.actionRelayRequest ?? "actionRelayRequest");
    if (game?.user?.setFlag) {
      void Promise.resolve(game.user.setFlag(TOW_MODULE_ID, relayFlagKey, relayPayload)).catch(() => {});
    }
    socket.emit(`module.${TOW_MODULE_ID}`, {
      type: String(TOW_SOCKETS?.actionRelayRequest ?? "actionRelayRequest"),
      payload: relayPayload
    });
    return true;
  }

  function resolveActorRefsFromTestData(sourceData = {}) {
    return [
      String(sourceData?.actor?.id ?? "").trim(),
      String(sourceData?.actor?.uuid ?? "").trim(),
      String(sourceData?.speaker?.actor ?? "").trim(),
      String(sourceData?.context?.actor ?? "").trim()
    ].filter(Boolean);
  }

  function installDirectTestPatch(OldWorldTestClass) {
    if (!OldWorldTestClass || directTestPatchInstalled) return;
    const originalFromData = OldWorldTestClass?.fromData;
    if (typeof originalFromData !== "function") return;

    directTestPatchOriginalFromData = originalFromData;
    OldWorldTestClass.fromData = function patchedTowCombatOverlaySpellApplyFromData(data, ...args) {
      const sourceData = data && typeof data === "object" ? data : {};
      const refs = resolveActorRefsFromTestData(sourceData);
      let resolvedActor = null;

      for (const context of directTestPatchContexts.values()) {
        for (const ref of refs) {
          const actor = context.actorMap.get(ref);
          if (!actor) continue;
          resolvedActor = actor;
          break;
        }
        if (resolvedActor) break;
      }

      if (!resolvedActor) {
        return directTestPatchOriginalFromData.call(this, data, ...args);
      }

      const rollFields = createTowCombatOverlayRollContext(resolvedActor).fields ?? {};
      const nextData = foundry.utils.deepClone(sourceData);
      const existingBonus = Number(nextData?.bonus ?? NaN);
      const existingPenalty = Number(nextData?.penalty ?? NaN);

      if ((!Number.isFinite(existingBonus) || existingBonus === 0) && Number(rollFields.bonus ?? 0) !== 0) {
        nextData.bonus = Number(rollFields.bonus ?? 0);
      }
      if ((!Number.isFinite(existingPenalty) || existingPenalty === 0) && Number(rollFields.penalty ?? 0) !== 0) {
        nextData.penalty = Number(rollFields.penalty ?? 0);
      }

      return directTestPatchOriginalFromData.call(this, nextData, ...args);
    };
    directTestPatchInstalled = true;
  }

  function maybeRestoreDirectTestPatch(OldWorldTestClass) {
    if (!directTestPatchInstalled || directTestPatchContexts.size > 0) return;
    if (!OldWorldTestClass || typeof directTestPatchOriginalFromData !== "function") return;
    if (OldWorldTestClass.fromData !== directTestPatchOriginalFromData) {
      OldWorldTestClass.fromData = directTestPatchOriginalFromData;
    }
    directTestPatchInstalled = false;
    directTestPatchOriginalFromData = null;
  }

  function resolveActorFromReference(reference) {
    const value = String(reference ?? "").trim();
    if (!value) return null;

    const actorById = game?.actors?.get?.(value) ?? null;
    if (actorById) return actorById;

    const tokenById = canvas?.tokens?.get?.(value)
      ?? canvas?.tokens?.placeables?.find?.((token) => String(token?.id ?? "").trim() === value)
      ?? null;
    const tokenActor = tokenById?.actor ?? tokenById?.document?.actor ?? null;
    if (tokenActor) return tokenActor;

    return null;
  }

  function collectMessageTargetActors(rawTargets) {
    const results = [];
    if (Array.isArray(rawTargets)) {
      for (const entry of rawTargets) {
        const actor = resolveActorFromReference(
          entry?.actor
          ?? entry?.actorId
          ?? entry?.token
          ?? entry?.tokenId
          ?? entry?.id
          ?? entry
        );
        if (actor) results.push(actor);
      }
      return results;
    }

    if (rawTargets instanceof Set) {
      for (const entry of rawTargets) {
        const actor = resolveActorFromReference(entry?.id ?? entry);
        if (actor) results.push(actor);
      }
      return results;
    }

    if (rawTargets && typeof rawTargets === "object") {
      for (const [key, value] of Object.entries(rawTargets)) {
        const actor = resolveActorFromReference(
          value?.actor
          ?? value?.actorId
          ?? value?.token
          ?? value?.tokenId
          ?? value?.id
          ?? key
        );
        if (actor) results.push(actor);
      }
    }

    return results;
  }

  function collectPotentialApplyActors(message, dataset = {}) {
    const actors = [];
    const add = (actor) => {
      if (!actor) return;
      if (actors.some((entry) => entry === actor || String(entry?.uuid ?? "") === String(actor?.uuid ?? ""))) return;
      actors.push(actor);
    };

    add(resolveActorFromReference(
      message?.speaker?.actor
      ?? message?.system?.test?.context?.actor
      ?? message?.system?.context?.actor
    ));

    const candidateTargets = [
      message?.system?.test?.context?.targets,
      message?.system?.context?.targets,
      message?.system?.test?.targets,
      message?.system?.targets
    ];
    for (const rawTargets of candidateTargets) {
      for (const actor of collectMessageTargetActors(rawTargets)) add(actor);
    }

    for (const [key, value] of Object.entries(dataset ?? {})) {
      const lowerKey = String(key ?? "").trim().toLowerCase();
      if (!lowerKey || lowerKey === "action") continue;
      if (!/(actor|token|target)/i.test(lowerKey)) continue;
      add(resolveActorFromReference(value));
    }

    for (const token of Array.from(game?.user?.targets ?? [])) {
      add(token?.actor ?? token?.document?.actor ?? null);
    }

    return actors;
  }

  async function withPatchedSkillTests(actors, callback) {
    const patches = [];
    for (const actor of Array.isArray(actors) ? actors : []) {
      if (!actor || typeof actor.setupSkillTest !== "function") continue;
      const original = actor.setupSkillTest;
      const boundOriginal = original.bind(actor);
      const patched = function patchedTowCombatOverlaySpellApplySkillTest(skill, context = {}) {
        return boundOriginal(skill, createTowCombatOverlayRollContext(actor, context));
      };
      actor.setupSkillTest = patched;
      patches.push({ actor, original, patched });
    }

    try {
      return await callback();
    } finally {
      for (const patch of patches) {
        if (patch.actor?.setupSkillTest === patch.patched) {
          patch.actor.setupSkillTest = patch.original;
        }
      }
    }
  }

  async function withPatchedDirectTests(actors, callback) {
    const actorMap = new Map();
    for (const actor of Array.isArray(actors) ? actors : []) {
      const actorId = String(actor?.id ?? "").trim();
      const actorUuid = String(actor?.uuid ?? "").trim();
      if (actorId) actorMap.set(actorId, actor);
      if (actorUuid) actorMap.set(actorUuid, actor);
    }

    const OldWorldTestClass = game?.oldworld?.config?.rollClasses?.OldWorldTest
      ?? game?.oldworld?.config?.OldWorldTest
      ?? null;
    if (!OldWorldTestClass || typeof OldWorldTestClass?.fromData !== "function") {
      return callback();
    }

    installDirectTestPatch(OldWorldTestClass);
    const contextId = `ctx-${directTestPatchNextContextId++}`;
    directTestPatchContexts.set(contextId, { actorMap });

    try {
      return await callback();
    } finally {
      directTestPatchContexts.delete(contextId);
      maybeRestoreDirectTestPatch(OldWorldTestClass);
    }
  }

  function collectActorVisibilityRefs(actors = []) {
    const refs = new Set();
    for (const actor of Array.isArray(actors) ? actors : []) {
      const actorId = String(actor?.id ?? "").trim();
      const actorUuid = String(actor?.uuid ?? "").trim();
      if (actorId) refs.add(actorId);
      if (actorUuid) refs.add(actorUuid);
    }
    return refs;
  }

  function resolveCreateDataActorRefs(data = {}) {
    const refs = new Set();
    const add = (value) => {
      const next = String(value ?? "").trim();
      if (next) refs.add(next);
    };

    add(data?.speaker?.actor);
    add(data?.system?.test?.context?.actor);
    add(data?.system?.context?.actor);
    add(data?.system?.actor?.id);
    add(data?.system?.actor?.uuid);
    return refs;
  }

  async function withScopedInheritedChatVisibility(sourceMessage, affectedActors, callback) {
    const applyVisibility = towCombatOverlayApplyRollVisibility;
    if (!sourceMessage || typeof applyVisibility !== "function") return callback();

    const sourceUserId = String(
      sourceMessage?.author?.id
      ?? sourceMessage?.user?.id
      ?? sourceMessage?.user
      ?? ""
    ).trim();
    const actorRefs = collectActorVisibilityRefs(affectedActors);
    const hookId = Hooks.on("preCreateChatMessage", (messageDoc, createData, _options, userId) => {
      const creatingUserId = String(userId ?? "").trim();
      if (sourceUserId && creatingUserId && creatingUserId !== sourceUserId) return;

      if (actorRefs.size > 0) {
        const messageActorRefs = resolveCreateDataActorRefs(createData);
        const matchesActor = Array.from(messageActorRefs).some((ref) => actorRefs.has(ref));
        if (!matchesActor) return;
      }

      const updateData = {};
      applyVisibility(updateData, {
        sourceMessage,
        censorForUnauthorized: true
      });
      if (!Object.keys(updateData).length) return;
      messageDoc.updateSource(updateData);
    });

    try {
      return await callback();
    } finally {
      Hooks.off("preCreateChatMessage", hookId);
    }
  }

  async function invokeChatMessageActionByName(
    message,
    action,
    targetElement = null,
    { visibilitySourceMessage = null } = {}
  ) {
    const actionName = String(action ?? "").trim();
    if (!message || !actionName) return false;
    const system = message.system;
    const handlers = system?.constructor?.actions ?? system?.actions ?? {};
    const handler = handlers?.[actionName];
    if (typeof handler !== "function") return false;
    const syntheticEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
      stopImmediatePropagation: () => {},
      currentTarget: targetElement,
      target: targetElement
    };
    try {
      const dataset = targetElement?.dataset ?? { action: actionName };
      const affectedActors = collectPotentialApplyActors(message, dataset);
      const affectedActorRefs = new Set();
      for (const actor of affectedActors) {
        const actorId = String(actor?.id ?? "").trim();
        const actorUuid = String(actor?.uuid ?? "").trim();
        if (actorId) affectedActorRefs.add(actorId);
        if (actorUuid) affectedActorRefs.add(actorUuid);
      }

      // Some spell Apply handlers open test dialogs on target actors (not caster).
      // Keep this fallback narrowly scoped to the current apply action execution window.
      const restoreApplyActionAutoResolve = armAutoResolveSpellTriggeredTestDialogs(null, {
        timeoutMs: 2500,
        matches: (app) => {
          const appActorId = String(app?.actor?.id ?? "").trim();
          const appActorUuid = String(app?.actor?.uuid ?? app?.context?.actor ?? "").trim();
          return (appActorId && affectedActorRefs.has(appActorId))
            || (appActorUuid && affectedActorRefs.has(appActorUuid));
        }
      });

      try {
        for (const actor of affectedActors) {
          armApplyRollModifiersToNextTestDialog(actor);
        }
        await withScopedInheritedChatVisibility(visibilitySourceMessage ?? message, affectedActors, async () => {
          await withPatchedDirectTests(affectedActors, async () => {
            await withPatchedSkillTests(affectedActors, async () => {
              await handler.call(system, syntheticEvent, targetElement ?? { dataset });
            });
          });
        });
      } finally {
        restoreApplyActionAutoResolve();
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  function parseDatasetFromTag(tagHtml) {
    const dataset = {};
    const attrMatches = Array.from(String(tagHtml ?? "").matchAll(/\bdata-([a-z0-9_-]+)\s*=\s*["']([^"']*)["']/gi));
    for (const match of attrMatches) {
      const rawKey = String(match?.[1] ?? "").trim();
      if (!rawKey) continue;
      const camelKey = rawKey.replace(/-([a-z0-9])/gi, (_m, char) => String(char ?? "").toUpperCase());
      dataset[camelKey] = String(match?.[2] ?? "");
    }
    return dataset;
  }

  function getMessageAutoApplyActions(message) {
    const content = String(message?.content ?? "");
    const buttonMatches = Array.from(content.matchAll(/<(button|a)\b[^>]*>/gi));
    const actionsFromContent = buttonMatches
      .map((match) => {
        const tagHtml = String(match?.[0] ?? "");
        const dataset = parseDatasetFromTag(tagHtml);
        const action = String(dataset?.action ?? "").trim();
        if (!action || !action.toLowerCase().startsWith("apply")) return null;
        return { action, dataset };
      })
      .filter(Boolean);

    const handlers = message?.system?.constructor?.actions ?? message?.system?.actions ?? {};
    const availableHandlerNames = new Set(
      Object.keys(handlers).map((name) => String(name ?? "").trim()).filter(Boolean)
    );
    const unique = [];
    const seen = new Set();
    for (const entry of actionsFromContent) {
      const action = String(entry?.action ?? "").trim();
      if (!availableHandlerNames.has(action)) continue;
      const key = JSON.stringify({ action, dataset: entry?.dataset ?? {} });
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ action, dataset: entry?.dataset ?? {} });
    }
    const priority = new Map([
      ["applydamage", 1],
      ["applytargeteffect", 2]
    ]);
    return unique.sort((a, b) => {
      const left = priority.get(String(a?.action ?? "").toLowerCase()) ?? 100;
      const right = priority.get(String(b?.action ?? "").toLowerCase()) ?? 100;
      if (left !== right) return left - right;
      return String(a?.action ?? "").localeCompare(String(b?.action ?? ""));
    });
  }

  async function invokeAutoApplyActionsInMessage(messageId) {
    const id = String(messageId ?? "").trim();
    if (!id) return false;
    const message = game?.messages?.get?.(id) ?? null;
    if (!message) return false;
    const actions = getMessageAutoApplyActions(message);
    if (!actions.length) return false;
    let invoked = false;
    for (const { action, dataset } of actions) {
      const syntheticTarget = { dataset: { ...dataset, action } };
      const done = await invokeChatMessageActionByName(
        message,
        action,
        syntheticTarget,
        { visibilitySourceMessage: message }
      );
      invoked = invoked || done;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return invoked;
  }

  async function waitAndInvokeAutoApplyActionsInMessage(messageId, {
    attempts = 16,
    intervalMs = 80
  } = {}) {
    const getActionKey = (entry) => JSON.stringify({
      action: String(entry?.action ?? "").trim(),
      dataset: entry?.dataset ?? {}
    });
    const total = Math.max(1, Math.trunc(Number(attempts) || 1));
    const waitMs = Math.max(10, Math.trunc(Number(intervalMs) || 0));
    const executedActionKeys = new Set();
    let anyInvoked = false;
    let settledNoActionsChecks = 0;
    for (let i = 0; i < total; i += 1) {
      const currentMessage = game?.messages?.get?.(String(messageId ?? "").trim()) ?? null;
      const actionsBefore = getMessageAutoApplyActions(currentMessage);
      const hadActionsBefore = actionsBefore.length > 0;
      const pendingBefore = actionsBefore.filter((entry) => !executedActionKeys.has(getActionKey(entry)));
      let invoked = false;
      for (const { action, dataset } of pendingBefore) {
        const actionKey = getActionKey({ action, dataset });
        const syntheticTarget = { dataset: { ...dataset, action } };
        const done = await invokeChatMessageActionByName(
          currentMessage,
          action,
          syntheticTarget,
          { visibilitySourceMessage: currentMessage }
        );
        if (done) {
          invoked = true;
          executedActionKeys.add(actionKey);
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      anyInvoked = anyInvoked || invoked;
      const latestMessage = game?.messages?.get?.(String(messageId ?? "").trim()) ?? null;
      const actionsAfter = getMessageAutoApplyActions(latestMessage);
      const hasPendingActionsAfter = actionsAfter.some((entry) => !executedActionKeys.has(getActionKey(entry)));
      if (!hasPendingActionsAfter && (invoked || hadActionsBefore || anyInvoked)) {
        settledNoActionsChecks += 1;
        if (settledNoActionsChecks >= 2) return true;
      } else {
        settledNoActionsChecks = 0;
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    return anyInvoked;
  }

  function messageHasExplicitTargets(message) {
    const candidates = [
      message?.system?.test?.context?.targets,
      message?.system?.context?.targets,
      message?.system?.test?.targets,
      message?.system?.targets
    ];
    return candidates.some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value instanceof Set || value instanceof Map) return value.size > 0;
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return false;
    });
  }

  function hasNonOwnedUserTargets() {
    const targets = Array.from(game?.user?.targets ?? []);
    return targets.some((token) => token?.actor && token.actor.isOwner !== true);
  }

  function messageHasNonOwnedApplyTargets(message) {
    const actors = collectPotentialApplyActors(message, {});
    return actors.some((actor) => actor && actor.isOwner !== true);
  }

  async function resetPanelAccumulatePowerValues(actor) {
    if (!actor || typeof actor.update !== "function") return;
    await actor.update({
      "system.magic.casting.progress": 0
    });
  }

  function armAutoProcessSpellApplyButtons(actor, spell, {
    allowTargetPick = true,
    onAfterApply = null,
    sourceToken = null,
    panelElement = null,
    slotElement = null,
    originEvent = null
  } = {}) {
    if (!actor || !spell) return;
    let timeoutId = null;
    const actorId = String(actor.id ?? "").trim();
    const spellUuid = String(spell.uuid ?? "").trim();
    if (!actorId || !spellUuid) return;

    const cleanup = (createHookId) => {
      Hooks.off("createChatMessage", createHookId);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
    };

    const processMessage = async (message) => {
      const messageId = String(message?.id ?? "").trim();
      if (!messageId) return;
      const performAutoApply = async () => {
        const automation = getOverlayAutomationRef();
        const restoreStaggerPrompt = automation.armDefaultStaggerChoiceWound(panelStaggerPatchDurationMs);
        const restoreSpellTestAuto = armAutoResolveSpellTriggeredTestDialogs(actor, {
          timeoutMs: autoApplyWaitMs + 8000,
          matches: (app) => {
            const appActorId = String(app?.actor?.id ?? "").trim();
            const appActorUuid = String(app?.actor?.uuid ?? app?.context?.actor ?? "").trim();
            const sourceActorId = String(actor?.id ?? "").trim();
            const sourceActorUuid = String(actor?.uuid ?? "").trim();
            if ((sourceActorId && appActorId === sourceActorId) || (sourceActorUuid && appActorUuid === sourceActorUuid)) {
              return true;
            }
            const appSpellId = String(app?.spell?.id ?? app?.data?.spell?.id ?? "").trim();
            const appItemUuid = String(app?.context?.itemUuid ?? app?.context?.spellUuid ?? "").trim();
            if (appSpellId && appSpellId === String(spell?.id ?? "").trim()) return true;
            if (appItemUuid && appItemUuid === String(spell?.uuid ?? "").trim()) return true;
            const contextTargets = app?.context?.targets;
            if (Array.isArray(contextTargets)) {
              return contextTargets.some((target) => {
                const actorRef = String(target?.actor ?? target?.actorId ?? "").trim();
                return (sourceActorId && actorRef === sourceActorId) || (sourceActorUuid && actorRef === sourceActorUuid);
              });
            }
            return false;
          }
        });
        const finishSpellAutoPatches = () => setTimeout(() => {
          restoreStaggerPrompt();
          restoreSpellTestAuto();
        }, autoApplyWaitMs);
        try {
          const hasTargets = messageHasExplicitTargets(message) || (game?.user?.targets?.size ?? 0) > 0;
          const requiresTargetPick = !hasTargets
            && !!sourceToken
            && allowTargetPick
            && (panelElement instanceof HTMLElement)
            && (slotElement instanceof HTMLElement)
            && spellRequiresTargetPick(spell);

          if (!requiresTargetPick) {
            if (spellTargetsSelf(spell) && sourceToken) {
              await withTemporaryUserTargets(sourceToken, async () => {
                await waitAndInvokeAutoApplyActionsInMessage(messageId);
              });
              if (typeof onAfterApply === "function") await onAfterApply();
              return;
            }
            if (hasNonOwnedUserTargets() || messageHasNonOwnedApplyTargets(message)) {
              requestGmSpellAutoApplyRelay(messageId, Array.from(game?.user?.targets ?? [])[0] ?? null);
              if (typeof onAfterApply === "function") await onAfterApply();
              return;
            }
            await waitAndInvokeAutoApplyActionsInMessage(messageId);
            if (typeof onAfterApply === "function") await onAfterApply();
            return;
          }
          startPanelAttackPickMode(panelElement, slotElement, sourceToken, { id: "spell-auto-apply" }, originEvent, {
            onTargetAttack: async (targetToken) => {
              if (targetToken?.actor && targetToken.actor.isOwner !== true && game?.user?.isGM !== true) {
                requestGmSpellAutoApplyRelay(messageId, targetToken);
                if (typeof onAfterApply === "function") await onAfterApply();
                return;
              }
              await withTemporaryUserTargets(targetToken, async () => {
                await waitAndInvokeAutoApplyActionsInMessage(messageId);
              });
              if (typeof onAfterApply === "function") await onAfterApply();
            }
          });
        } finally {
          finishSpellAutoPatches();
        }
      };
      await performAutoApply();
    };

    const createHookId = Hooks.on("createChatMessage", (message) => {
      const messageActorId = String(message?.speaker?.actor ?? "").trim();
      const testActorUuid = String(message?.system?.test?.context?.actor ?? message?.system?.context?.actor ?? "").trim();
      const actorUuid = String(actor?.uuid ?? "").trim();
      const sameActor = (messageActorId === actorId)
        || (!!actorUuid && testActorUuid === actorUuid);
      if (!sameActor) return;
      const rollClass = String(message?.system?.context?.rollClass ?? "").trim().toLowerCase();
      if (rollClass !== "itemuse") return;
      const itemUuid = String(message?.system?.context?.itemUuid ?? message?.system?.test?.context?.itemUuid ?? "").trim();
      const itemId = String(message?.system?.test?.item?.id ?? "").trim();
      const sameSpell = (itemUuid === spellUuid) || (itemId && itemId === String(spell?.id ?? "").trim());
      if (!sameSpell) return;
      cleanup(createHookId);
      void processMessage(message);
    });

    timeoutId = setTimeout(() => cleanup(createHookId), 30000);
  }

  async function runPanelCastSpecificSpellFromAccumulatedPower(actor, spell, {
    autoRollCastingTest = false,
    autoProcessApply = true,
    allowTargetPick = true,
    sourceToken = null,
    panelElement = null,
    slotElement = null,
    originEvent = null
  } = {}) {
    if (!actor || !spell) return;
    if (autoProcessApply) {
      armAutoProcessSpellApplyButtons(actor, spell, {
        allowTargetPick,
        onAfterApply: async () => {
          await resetPanelAccumulatePowerValues(actor);
        },
        sourceToken,
        panelElement,
        slotElement,
        originEvent
      });
    }
    ensurePanelItemUseRollCompatibility();
    if (typeof actor?.system?.castSpell !== "function") return;

    if (!autoRollCastingTest) {
      const potency = resolveActorLatestCastingPotency(actor);
      await actor.system.castSpell(spell, potency, null);
      if (!autoProcessApply) await resetPanelAccumulatePowerValues(actor);
      return;
    }

    if (typeof actor?.setupCastingTest !== "function") return;
    const matchesSpellCastingDialog = (app) => {
      if (app?.actor?.id !== actor.id) return false;
      const spellId = String(app?.spell?.id ?? app?.data?.spell?.id ?? "").trim();
      if (spellId && spellId === String(spell?.id ?? "").trim()) return true;
      const rollClass = String(app?.context?.rollClass ?? "").trim().toLowerCase();
      return rollClass === "castingtest" || app?.casting === true;
    };
    armApplyRollModifiersToNextTestDialog(actor, { matches: matchesSpellCastingDialog });
    towCombatOverlayArmAutoSubmitDialog({
      hookName: "renderTestDialog",
      matches: matchesSpellCastingDialog,
      submitErrorMessage: "Casting test submit() is unavailable."
    });
    const lore = String(spell?.system?.lore ?? "").trim();
    const test = await actor.setupCastingTest(
      { spell },
      createTowCombatOverlayRollContext(actor, { spell: String(spell?.id ?? ""), lore })
    );
    const potencyRaw = Number(test?.result?.potency ?? test?.result?.successes ?? NaN);
    const potency = Number.isFinite(potencyRaw) ? Math.max(0, Math.trunc(potencyRaw)) : 0;
    await actor.system.castSpell(spell, potency, null);
    if (!autoProcessApply) await resetPanelAccumulatePowerValues(actor);
  }

  return {
    invokeChatMessageActionByName,
    armAutoProcessSpellApplyButtons,
    runPanelCastSpecificSpellFromAccumulatedPower,
    resetPanelAccumulatePowerValues
  };
}
