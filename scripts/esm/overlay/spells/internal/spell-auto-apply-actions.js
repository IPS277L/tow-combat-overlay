import { getMessageActionsByPrefix } from "../../shared/chat-message-action-helpers.js";
import {
  AUTO_APPLY_ACTION_DEFAULT_ATTEMPTS,
  AUTO_APPLY_ACTION_DEFAULT_INTERVAL_MS,
  AUTO_APPLY_ACTION_MIN_INTERVAL_MS,
  AUTO_APPLY_ACTION_PRIORITY_ENTRIES,
  AUTO_APPLY_ACTION_SETTLE_CHECKS_REQUIRED,
  AUTO_APPLY_ACTION_STEP_DELAY_MS
} from "../../shared/auto-apply-action-constants.js";

export async function invokeAutoApplyActionsInMessage(messageId, { invokeChatMessageActionByName } = {}) {
  const id = String(messageId ?? "").trim();
  if (!id || typeof invokeChatMessageActionByName !== "function") return false;
  const message = game?.messages?.get?.(id) ?? null;
  if (!message) return false;
  const actions = getMessageActionsByPrefix(message, {
    actionPrefix: "apply",
    priorityEntries: AUTO_APPLY_ACTION_PRIORITY_ENTRIES
  });
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
    await new Promise((resolve) => setTimeout(resolve, AUTO_APPLY_ACTION_STEP_DELAY_MS));
  }
  return invoked;
}

export async function waitAndInvokeAutoApplyActionsInMessage(
  messageId,
  {
    attempts = AUTO_APPLY_ACTION_DEFAULT_ATTEMPTS,
    intervalMs = AUTO_APPLY_ACTION_DEFAULT_INTERVAL_MS,
    invokeChatMessageActionByName
  } = {}
) {
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
    const currentMessage = game?.messages?.get?.(String(messageId ?? "").trim()) ?? null;
    const actionsBefore = getMessageActionsByPrefix(currentMessage, {
      actionPrefix: "apply",
      priorityEntries: AUTO_APPLY_ACTION_PRIORITY_ENTRIES
    });
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
      await new Promise((resolve) => setTimeout(resolve, AUTO_APPLY_ACTION_STEP_DELAY_MS));
    }
    anyInvoked = anyInvoked || invoked;
    const latestMessage = game?.messages?.get?.(String(messageId ?? "").trim()) ?? null;
    const actionsAfter = getMessageActionsByPrefix(latestMessage, {
      actionPrefix: "apply",
      priorityEntries: AUTO_APPLY_ACTION_PRIORITY_ENTRIES
    });
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
