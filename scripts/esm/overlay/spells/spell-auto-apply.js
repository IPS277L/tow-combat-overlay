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
  armApplyRollModifiersToNextTestDialog,
  towCombatOverlayArmAutoSubmitDialog,
  createTowCombatOverlayRollContext
} = {}) {
  async function invokeChatMessageActionByName(message, action, targetElement = null) {
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
      await handler.call(system, syntheticEvent, targetElement ?? { dataset: { action: actionName } });
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
      const done = await invokeChatMessageActionByName(message, action, syntheticTarget);
      invoked = invoked || done;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return invoked;
  }

  async function waitAndInvokeAutoApplyActionsInMessage(messageId, {
    attempts = 16,
    intervalMs = 80
  } = {}) {
    const total = Math.max(1, Math.trunc(Number(attempts) || 1));
    const waitMs = Math.max(10, Math.trunc(Number(intervalMs) || 0));
    for (let i = 0; i < total; i += 1) {
      const invoked = await invokeAutoApplyActionsInMessage(messageId);
      if (invoked) return true;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    return false;
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
        const restoreSpellTestAuto = armAutoResolveSpellTriggeredTestDialogs({
          timeoutMs: autoApplyWaitMs + 8000
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
            await waitAndInvokeAutoApplyActionsInMessage(messageId);
            if (typeof onAfterApply === "function") await onAfterApply();
            return;
          }
          startPanelAttackPickMode(panelElement, slotElement, sourceToken, { id: "spell-auto-apply" }, originEvent, {
            onTargetAttack: async (targetToken) => {
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

