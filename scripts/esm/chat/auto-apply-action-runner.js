import { getMessageActionsByPrefix } from "../overlay/shared/chat-message-action-helpers.js";
import {
  AUTO_APPLY_ACTION_DEFAULT_ATTEMPTS,
  AUTO_APPLY_ACTION_DEFAULT_INTERVAL_MS,
  AUTO_APPLY_ACTION_MIN_INTERVAL_MS,
  AUTO_APPLY_ACTION_PRIORITY_ENTRIES,
  AUTO_APPLY_ACTION_STEP_DELAY_MS,
  AUTO_APPLY_ACTION_SETTLE_CHECKS_REQUIRED,
  AUTO_APPLY_DIALOG_TIMEOUT_MS
} from "../overlay/shared/auto-apply-action-constants.js";
import {
  collectActorReferenceSet,
  collectPotentialApplyActors
} from "../overlay/shared/actor-reference-helpers.js";
import { towCombatOverlayArmAutoSubmitDialog } from "../combat/attack.js";

export function getTowMessageAutoApplyActions(message) {
  return getMessageActionsByPrefix(message, {
    actionPrefix: "apply",
    priorityEntries: AUTO_APPLY_ACTION_PRIORITY_ENTRIES
  });
}

export async function invokeTowMessageActionByName(message, action, dataset = {}) {
  const actionName = String(action ?? "").trim();
  if (!message || !actionName) return false;
  const system = message.system;
  const handlers = system?.constructor?.actions ?? system?.actions ?? {};
  const handler = handlers?.[actionName];
  if (typeof handler !== "function") return false;
  const syntheticTarget = { dataset: { ...dataset, action: actionName } };
  const syntheticEvent = {
    preventDefault: () => {},
    stopPropagation: () => {},
    stopImmediatePropagation: () => {},
    currentTarget: syntheticTarget,
    target: syntheticTarget
  };

  const affectedActors = collectPotentialApplyActors(message, dataset);
  const affectedActorRefs = collectActorReferenceSet(affectedActors);

  const restoreAutoSubmitTestDialog = towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderTestDialog",
    matches: (app) => {
      const appActorId = String(app?.actor?.id ?? "").trim();
      const appActorUuid = String(app?.actor?.uuid ?? app?.context?.actor ?? "").trim();
      if (!affectedActorRefs.size) return true;
      return (appActorId && affectedActorRefs.has(appActorId))
        || (appActorUuid && affectedActorRefs.has(appActorUuid));
    },
    submitErrorMessage: "TestDialog.submit() is unavailable.",
    timeoutMs: AUTO_APPLY_DIALOG_TIMEOUT_MS
  });
  const restoreAutoSubmitItemDialog = towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderItemDialog",
    matches: (app) => {
      const text = String(app?.options?.text ?? "").trim().toLowerCase();
      const title = String(app?.options?.window?.title ?? app?.title ?? "").trim().toLowerCase();
      return text.includes("select") || text.includes("choose") || title.includes("select") || title.includes("choose");
    },
    submitErrorMessage: "ItemDialog.submit() is unavailable.",
    beforeSubmit: async (app) => {
      if (!app) return;
      const itemCount = Number(app?.items?.length ?? 0);
      if (!Number.isFinite(itemCount) || itemCount <= 0) return;
      app.chosen = [0];
    },
    timeoutMs: AUTO_APPLY_DIALOG_TIMEOUT_MS
  });
  try {
    await handler.call(system, syntheticEvent, syntheticTarget);
    return true;
  } catch (_error) {
    return false;
  } finally {
    if (typeof restoreAutoSubmitTestDialog === "function") restoreAutoSubmitTestDialog();
    if (typeof restoreAutoSubmitItemDialog === "function") restoreAutoSubmitItemDialog();
  }
}

export async function waitAndInvokeTowAutoApplyActionsInMessage(messageId, {
  attempts = AUTO_APPLY_ACTION_DEFAULT_ATTEMPTS,
  intervalMs = AUTO_APPLY_ACTION_DEFAULT_INTERVAL_MS
} = {}) {
  const id = String(messageId ?? "").trim();
  if (!id) return false;
  const getActionKey = (entry) => JSON.stringify({
    action: String(entry?.action ?? "").trim(),
    dataset: entry?.dataset ?? {}
  });
  const total = Math.max(1, Math.trunc(Number(attempts) || 1));
  const waitMs = Math.max(AUTO_APPLY_ACTION_MIN_INTERVAL_MS, Math.trunc(Number(intervalMs) || 0));
  const executedActionKeys = new Set();
  let anyInvoked = false;
  let settledNoActionsChecks = 0;
  for (let i = 0; i < total; i += 1) {
    const messageBefore = game?.messages?.get?.(id) ?? null;
    const actionsBefore = getTowMessageAutoApplyActions(messageBefore);
    const hadActionsBefore = actionsBefore.length > 0;
    const actions = actionsBefore.filter((entry) => !executedActionKeys.has(getActionKey(entry)));
    let invoked = false;
    for (const { action, dataset } of actions) {
      const done = await invokeTowMessageActionByName(messageBefore, action, dataset);
      if (done) {
        invoked = true;
        executedActionKeys.add(getActionKey({ action, dataset }));
      }
      await new Promise((resolve) => setTimeout(resolve, AUTO_APPLY_ACTION_STEP_DELAY_MS));
    }
    anyInvoked = anyInvoked || invoked;
    const messageAfter = game?.messages?.get?.(id) ?? null;
    const actionsAfter = getTowMessageAutoApplyActions(messageAfter);
    const hasPendingActionsAfter = actionsAfter.some((entry) => !executedActionKeys.has(getActionKey(entry)));
    if (!hasPendingActionsAfter && (invoked || hadActionsBefore || anyInvoked)) {
      settledNoActionsChecks += 1;
      if (settledNoActionsChecks >= AUTO_APPLY_ACTION_SETTLE_CHECKS_REQUIRED) return true;
    } else {
      settledNoActionsChecks = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return anyInvoked;
}