export function hasRestrictedVisibility(message, { TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG } = {}) {
  if (!message) return false;
  if (typeof message.isContentVisible === "boolean" && message.isContentVisible === false) return true;
  const censoredFlag = message?.getFlag?.(TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG);
  if (censoredFlag?.mode === "censored") return true;
  const whisperIds = Array.isArray(message.whisper) ? message.whisper : [];
  return whisperIds.length > 0 || message.blind === true;
}

function resolveMessageIdRef(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "object") return "";

  const directId = String(value.id ?? value._id ?? "").trim();
  if (directId) return directId;

  const nestedMessage = value.message;
  if (typeof nestedMessage === "string") return nestedMessage.trim();
  if (nestedMessage && typeof nestedMessage === "object") {
    const nestedId = String(nestedMessage.id ?? nestedMessage._id ?? "").trim();
    if (nestedId) return nestedId;
  }

  const messageId = String(value.messageId ?? value.chatMessageId ?? "").trim();
  if (messageId) return messageId;

  return "";
}

export function resolveFlowVisibilitySourceMessage(
  opposedMessage,
  fallbackMessage = null,
  { TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG } = {}
) {
  if (hasRestrictedVisibility(opposedMessage, { TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG })) return opposedMessage;
  if (hasRestrictedVisibility(fallbackMessage, { TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG })) return fallbackMessage;

  const attackerMessageId = resolveMessageIdRef(opposedMessage?.system?.attackerMessage);
  if (attackerMessageId) {
    const attackerMessage = game.messages.get(attackerMessageId);
    if (hasRestrictedVisibility(attackerMessage, { TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG })) return attackerMessage;
  }

  const defenderMessageId = resolveMessageIdRef(opposedMessage?.system?.defenderMessage);
  if (defenderMessageId) {
    const defenderMessage = game.messages.get(defenderMessageId);
    if (hasRestrictedVisibility(defenderMessage, { TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG })) return defenderMessage;
  }

  return fallbackMessage ?? opposedMessage ?? null;
}
