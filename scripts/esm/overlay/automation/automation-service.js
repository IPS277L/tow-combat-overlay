import {
  AUTO_APPLY_WAIT_MS,
  AUTO_DEFENCE_WAIT_MS,
  AUTO_STAGGER_PATCH_MS,
  MODULE_KEY,
  OPPOSED_LINK_WAIT_MS
} from "../../runtime/overlay-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import { getTowCombatOverlayActionsApi } from "../../api/module-api-registry.js";
import {
  towCombatOverlayApplyActorDamage,
  towCombatOverlayEnsureActionsApi
} from "../shared/actions-bridge.js";
import {
  towCombatOverlayApplyRollVisibility,
  towCombatOverlayLocalize,
  towCombatOverlayRenderTemplate
} from "../../combat/core.js";
import { towCombatOverlayResolveConditionLabel } from "../shared/shared.js";
import {
  deriveAppliedStatusLabels,
  getFlowNamesModel,
  isLikelyStaggerChoiceDialog
} from "./automation-helpers.js";
import {
  captureSettledActorState,
  deriveSourceStatusHints,
  snapshotActorState
} from "./internal/automation-actor-state.js";
import { resolveFlowVisibilitySourceMessage } from "./internal/automation-chat-visibility.js";
import { postFlowSeparatorCard } from "./internal/automation-flow-separator.js";

const TOW_AUTOMATION_LOCAL_STATE = {};
const {
  moduleId: TOW_MODULE_ID,
  flags: { chatVisibility: TOW_CHAT_VISIBILITY_FLAG }
} = getTowCombatOverlayConstants();

function getTowAutomationStateBucket() {
  const runtimeState = game?.[MODULE_KEY];
  if (runtimeState && typeof runtimeState === "object") return runtimeState;
  return TOW_AUTOMATION_LOCAL_STATE;
}


export function armDefaultStaggerChoiceWound(durationMs = AUTO_STAGGER_PATCH_MS) {

  // Use runtime overlay state when available; otherwise use local automation state.
  // Do not initialize game[MODULE_KEY] here because it breaks overlay lifecycle bootstrap.
  const state = getTowAutomationStateBucket();
  const DialogApi = foundry.applications?.api?.Dialog;
  if (typeof DialogApi?.wait !== "function") return () => {};

  if (!state.staggerWaitPatch) {
    const originalWait = DialogApi.wait.bind(DialogApi);
    state.staggerWaitPatch = { originalWait, refs: 0, activeUntil: 0 };

    DialogApi.wait = async (config, options) => {
      const patchState = state.staggerWaitPatch;
      if (!patchState || patchState.refs <= 0 || Date.now() > Number(patchState.activeUntil ?? 0)) {
        return originalWait(config, options);
      }
      if (isLikelyStaggerChoiceDialog(config)) return "wound";
      return state.staggerWaitPatch.originalWait(config, options);
    };
  }

  state.staggerWaitPatch.refs += 1;
  state.staggerWaitPatch.activeUntil = Math.max(
    Number(state.staggerWaitPatch.activeUntil ?? 0),
    Date.now() + Math.max(0, Number(durationMs) || 0)
  );
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (!state.staggerWaitPatch) return;
    state.staggerWaitPatch.refs = Math.max(0, state.staggerWaitPatch.refs - 1);
    if (state.staggerWaitPatch.refs === 0) {
      DialogApi.wait = state.staggerWaitPatch.originalWait;
      delete state.staggerWaitPatch;
    }
  };

  const timer = setTimeout(restore, durationMs);
  return () => {
    clearTimeout(timer);
    restore();
  };
}

export function armAutoDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState } = {}) {

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

    const state = game[MODULE_KEY];
    if (state) {
      if (!state.autoDefenceHandled) state.autoDefenceHandled = new Set();
      if (state.autoDefenceHandled.has(message.id)) return;
      state.autoDefenceHandled.add(message.id);
    }

    cleanup(hookId);
    if (!(await towCombatOverlayEnsureActionsApi())) return;

    const started = Date.now();
    while (Date.now() - started < OPPOSED_LINK_WAIT_MS) {
      if (targetToken.actor.system?.opposed?.id === message.id) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const actionsApi = getTowCombatOverlayActionsApi();
    await actionsApi.defenceActor(targetToken.actor, { manual: false });
    armAutoApplyDamageForOpposed(message, {
      sourceActor: sourceToken.actor,
      sourceBeforeState
    });
  });

  timeoutId = setTimeout(() => cleanup(hookId), AUTO_DEFENCE_WAIT_MS);
}

async function applyDamageWithWoundsFallback(defenderActor, damageValue, context) {
  const system = defenderActor?.system;
  if (!system || typeof system.applyDamage !== "function") return;

  const getActorWoundCount = (actor) => {
    const liveItems = actor?.items?.contents ?? [];
    if (Array.isArray(liveItems)) return liveItems.filter((item) => item?.type === "wound").length;
    if (Array.isArray(actor?.itemTypes?.wound)) return actor.itemTypes.wound.length;
    return 0;
  };
  const getActorWoundCap = (actor) => {
    if (!actor) return null;
    if (actor.type !== "npc") return null;
    if (actor.system?.type === "minion") return 1;
    if (!actor.system?.hasThresholds) return null;
    const defeatedThreshold = Number(actor.system?.wounds?.defeated?.threshold ?? NaN);
    if (!Number.isFinite(defeatedThreshold) || defeatedThreshold <= 0) return null;
    return Math.trunc(defeatedThreshold);
  };
  const isActorAtWoundCap = (actor) => {
    const cap = getActorWoundCap(actor);
    if (!Number.isFinite(cap)) return false;
    return getActorWoundCount(actor) >= cap;
  };

  const originalAddWound = (typeof system.addWound === "function") ? system.addWound.bind(system) : null;
  if (!originalAddWound) {
    await towCombatOverlayApplyActorDamage(defenderActor, damageValue, context);
    return;
  }

  system.addWound = async function wrappedAddWound(options = {}) {
    if (isActorAtWoundCap(defenderActor)) return null;
    const tableId = game.settings.get("whtow", "tableSettings")?.wounds;
    const hasTable = !!(tableId && game.tables.get(tableId));

    if (!hasTable) return originalAddWound({ ...options, roll: false });
    try {
      return await originalAddWound(options);
    } catch (error) {
      const message = String(error?.message ?? error ?? "");
      if (message.includes("No table found for wounds")) {
        return originalAddWound({ ...options, roll: false });
      }
      throw error;
    }
  };

  try {
    await towCombatOverlayApplyActorDamage(defenderActor, damageValue, context);
  } finally {
    system.addWound = originalAddWound;
  }
}

function armAutoApplyDamageForOpposed(opposedMessage, { sourceActor = null, sourceBeforeState = null } = {}) {

  if (!opposedMessage?.id) return;
  const state = game[MODULE_KEY];
  if (state) {
    if (!state.autoApplyArmed) state.autoApplyArmed = new Set();
    if (state.autoApplyArmed.has(opposedMessage.id)) return;
    state.autoApplyArmed.add(opposedMessage.id);
  }

  const cleanup = () => {
    state?.autoApplyArmed?.delete(opposedMessage.id);
    state?.autoDefenceHandled?.delete(opposedMessage.id);
  };

  void (async () => {
    let applying = false;
    let separatorPosted = false;
      const postSeparatorOnce = async (opposed, sourceMessage = null) => {
      if (separatorPosted) return;
      separatorPosted = true;
      const sourceStatusHints = await deriveSourceStatusHints(sourceActor, sourceBeforeState, {
        deriveAppliedStatusLabels,
        towCombatOverlayLocalize,
        towCombatOverlayResolveConditionLabel
      });
      const visibilitySourceMessage = resolveFlowVisibilitySourceMessage(sourceMessage, opposedMessage, {
        TOW_MODULE_ID,
        TOW_CHAT_VISIBILITY_FLAG
      });
      await postFlowSeparatorCard(opposed, {
        sourceStatusHints,
        targetStatusHints: [],
        sourceMessage: visibilitySourceMessage,
        towCombatOverlayLocalize,
        towCombatOverlayResolveConditionLabel,
        getFlowNamesModel,
        towCombatOverlayRenderTemplate,
        towCombatOverlayApplyRollVisibility,
        resolveFlowVisibilitySourceMessage: (opposedRef, fallbackRef) => resolveFlowVisibilitySourceMessage(
          opposedRef,
          fallbackRef,
          { TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG }
        )
      });
    };

    const started = Date.now();
    while (Date.now() - started < AUTO_APPLY_WAIT_MS) {
      const message = game.messages.get(opposedMessage.id);
      const opposed = message?.system;
      if (!opposed) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      const computed = opposed.result?.computed === true;
      const hasDamage = typeof opposed.result?.damage !== "undefined" && opposed.result?.damage !== null;
      const alreadyApplied = opposed.result?.damage?.applied === true;
      if (!computed) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      if (!hasDamage || alreadyApplied) {
        await postSeparatorOnce(opposed, message);
        break;
      }

      const defenderActor = ChatMessage.getSpeakerActor(opposed.defender);
      if (!defenderActor?.isOwner || applying) {
        await postSeparatorOnce(opposed, message);
        break;
      }

      applying = true;
      const beforeState = snapshotActorState(defenderActor);
      const damageValue = Number(opposed.result?.damage?.value ?? 0);
      await applyDamageWithWoundsFallback(defenderActor, damageValue, {
        opposed,
        item: opposed.attackerTest?.item,
        test: opposed.attackerMessage?.system?.test
      });
      const afterState = await captureSettledActorState(defenderActor, beforeState, 700);
      const targetStatusHints = deriveAppliedStatusLabels(beforeState, afterState, {
        localize: towCombatOverlayLocalize,
        resolveConditionLabel: towCombatOverlayResolveConditionLabel
      });
      const sourceStatusHints = await deriveSourceStatusHints(sourceActor, sourceBeforeState, {
        deriveAppliedStatusLabels,
        towCombatOverlayLocalize,
        towCombatOverlayResolveConditionLabel
      });
      if (!separatorPosted) {
        separatorPosted = true;
        const visibilitySourceMessage = resolveFlowVisibilitySourceMessage(message, opposedMessage, {
          TOW_MODULE_ID,
          TOW_CHAT_VISIBILITY_FLAG
        });
        await postFlowSeparatorCard(opposed, {
          sourceStatusHints,
          targetStatusHints,
          sourceMessage: visibilitySourceMessage,
          towCombatOverlayLocalize,
          towCombatOverlayResolveConditionLabel,
          getFlowNamesModel,
          towCombatOverlayRenderTemplate,
          towCombatOverlayApplyRollVisibility,
          resolveFlowVisibilitySourceMessage: (opposedRef, fallbackRef) => resolveFlowVisibilitySourceMessage(
            opposedRef,
            fallbackRef,
            { TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG }
          )
        });
      }
      break;
    }
    cleanup();
  })();
}

export function createTowCombatOverlayAutomationCoordinator() {
  return {
    armDefaultStaggerChoiceWound,
    armAutoDefenceForOpposed,
    armAutoApplyDamageForOpposed,
    snapshotActorState
  };
}

export const towCombatOverlayAutomation = createTowCombatOverlayAutomationCoordinator();


