import {
  collectPotentialApplyActors,
  messageHasExplicitTargets
} from "../shared/actor-reference-helpers.js";
import {
  AUTO_APPLY_DIALOG_TIMEOUT_MS
} from "../shared/auto-apply-action-constants.js";
import {
  SPELL_AUTO_APPLY_HOOK_TIMEOUT_MS,
  SPELL_AUTO_PATCH_EXTRA_TIMEOUT_MS
} from "./spell-auto-apply-constants.js";
import { createSpellDirectTestPatchScope } from "./internal/spell-auto-apply-direct-test-patch.js";
import { withScopedInheritedChatVisibility } from "./internal/spell-auto-apply-chat-visibility.js";
import {
  hasNonOwnedUserTargets,
  messageHasNonOwnedApplyTargets,
  requestGmSpellAutoApplyRelay
} from "./internal/spell-auto-apply-relay.js";
import { waitAndInvokeAutoApplyActionsInMessage } from "./internal/spell-auto-apply-actions.js";

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
  const { withPatchedDirectTests } = createSpellDirectTestPatchScope({
    createTowCombatOverlayRollContext
  });

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
        timeoutMs: AUTO_APPLY_DIALOG_TIMEOUT_MS,
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
        await withScopedInheritedChatVisibility(
          visibilitySourceMessage ?? message,
          affectedActors,
          async () => {
            await withPatchedDirectTests(affectedActors, async () => {
              await withPatchedSkillTests(affectedActors, async () => {
                await handler.call(system, syntheticEvent, targetElement ?? { dataset });
              });
            });
          },
          { towCombatOverlayApplyRollVisibility }
        );
      } finally {
        restoreApplyActionAutoResolve();
      }
      return true;
    } catch (_error) {
      return false;
    }
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
          timeoutMs: autoApplyWaitMs + SPELL_AUTO_PATCH_EXTRA_TIMEOUT_MS,
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
                await waitAndInvokeAutoApplyActionsInMessage(messageId, {
                  invokeChatMessageActionByName
                });
              });
              if (typeof onAfterApply === "function") await onAfterApply();
              return;
            }
            if (hasNonOwnedUserTargets() || messageHasNonOwnedApplyTargets(message)) {
              requestGmSpellAutoApplyRelay(messageId, Array.from(game?.user?.targets ?? [])[0] ?? null);
              if (typeof onAfterApply === "function") await onAfterApply();
              return;
            }
            await waitAndInvokeAutoApplyActionsInMessage(messageId, {
              invokeChatMessageActionByName
            });
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
                await waitAndInvokeAutoApplyActionsInMessage(messageId, {
                  invokeChatMessageActionByName
                });
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

    timeoutId = setTimeout(() => cleanup(createHookId), SPELL_AUTO_APPLY_HOOK_TIMEOUT_MS);
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
