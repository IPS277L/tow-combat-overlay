import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";
import { resolveTowCombatOverlayMessageRefId } from "../shared/message-reference.js";
import { towCombatOverlayToElement } from "./dialog-utils.js";

const {
  moduleId: TOW_MODULE_ID,
  flags: { chatVisibility: TOW_CHAT_VISIBILITY_FLAG }
} = getTowCombatOverlayConstants();

export function towCombatOverlayApplyRollVisibility(
  chatData = {},
  {
    sourceMessage = null,
    rollMode = null,
    censorForUnauthorized = false,
    additionalAllowedUserIds = null
  } = {}
) {
  if (!chatData || typeof chatData !== "object") return chatData;

  const extractVisibilityFromMessage = (message) => {
    if (!message || typeof message !== "object") return null;
    const censoredFlag = message?.getFlag?.(TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG);
    if (censoredFlag?.mode === "censored") {
      const allowedUserIds = Array.isArray(censoredFlag.allowedUserIds)
        ? censoredFlag.allowedUserIds.filter((id) => typeof id === "string" && id.length > 0)
        : [];
      return {
        whisperUserIds: allowedUserIds,
        blind: false
      };
    }

    const whisperUserIds = Array.isArray(message.whisper)
      ? message.whisper.filter((id) => typeof id === "string" && id.length > 0)
      : [];
    return {
      whisperUserIds,
      blind: message.blind === true
    };
  };

  const resolveVisibilityFromRollMode = (mode) => {
    if (typeof mode !== "string" || mode.length === 0) return null;
    const gmWhispers = (ChatMessage?.getWhisperRecipients?.("GM") ?? [])
      .map((user) => user?.id)
      .filter((id) => typeof id === "string" && id.length > 0);
    switch (mode) {
      case "gmroll":
        return { whisperUserIds: gmWhispers, blind: false };
      case "blindroll":
        return { whisperUserIds: gmWhispers, blind: true };
      case "selfroll":
        return {
          whisperUserIds: game?.user?.id ? [game.user.id] : [],
          blind: false
        };
      default:
        return { whisperUserIds: [], blind: false };
    }
  };

  const applyVisibilityToChatData = (visibility) => {
    const whisperUserIds = Array.isArray(visibility?.whisperUserIds)
      ? visibility.whisperUserIds
      : [];
    if (whisperUserIds.length > 0) {
      chatData.whisper = [...whisperUserIds];
    } else {
      delete chatData.whisper;
    }
    if (visibility?.blind === true) chatData.blind = true;
    else delete chatData.blind;
  };

  const isVisibilityRestricted = (visibility) => {
    const whisperUserIds = Array.isArray(visibility?.whisperUserIds)
      ? visibility.whisperUserIds
      : [];
    return whisperUserIds.length > 0 || visibility?.blind === true;
  };

  const convertVisibilityToCensoredFlag = (visibility) => {
    const whisperUserIds = Array.isArray(visibility?.whisperUserIds)
      ? visibility.whisperUserIds
      : [];
    const hasRestriction = isVisibilityRestricted(visibility);
    if (!hasRestriction) return;

    const allowedUserIds = new Set(whisperUserIds);
    const sourceUserId = String(
      sourceMessage?.author?.id
      ?? sourceMessage?.user?.id
      ?? sourceMessage?.user
      ?? game?.user?.id
      ?? ""
    ).trim();
    if (sourceUserId) allowedUserIds.add(sourceUserId);
    const explicitAllowed = Array.isArray(additionalAllowedUserIds)
      ? additionalAllowedUserIds
      : [];
    for (const explicitUserId of explicitAllowed) {
      const normalizedUserId = String(explicitUserId ?? "").trim();
      if (normalizedUserId) allowedUserIds.add(normalizedUserId);
    }
    if (visibility?.blind === true) {
      for (const gmUser of (ChatMessage?.getWhisperRecipients?.("GM") ?? [])) {
        const gmId = String(gmUser?.id ?? "").trim();
        if (gmId) allowedUserIds.add(gmId);
      }
    }

    chatData.flags = chatData.flags && typeof chatData.flags === "object" ? chatData.flags : {};
    chatData.flags[TOW_MODULE_ID] = chatData.flags[TOW_MODULE_ID] && typeof chatData.flags[TOW_MODULE_ID] === "object"
      ? chatData.flags[TOW_MODULE_ID]
      : {};
    chatData.flags[TOW_MODULE_ID][TOW_CHAT_VISIBILITY_FLAG] = {
      mode: "censored",
      allowedUserIds: Array.from(allowedUserIds),
      sourceUserId: sourceUserId || null
    };
    delete chatData.whisper;
    delete chatData.blind;
  };

  let resolvedVisibility = null;

  const copyVisibilityFromSource = () => {
    if (!sourceMessage || typeof sourceMessage !== "object") return false;
    resolvedVisibility = extractVisibilityFromMessage(sourceMessage);
    if (!isVisibilityRestricted(resolvedVisibility)) return false;
    applyVisibilityToChatData(resolvedVisibility);
    return true;
  };

  if (copyVisibilityFromSource()) {
    if (censorForUnauthorized === true) convertVisibilityToCensoredFlag(resolvedVisibility);
    return chatData;
  }

  const resolvedRollMode = rollMode ?? game?.settings?.get?.("core", "rollMode");
  if (typeof resolvedRollMode !== "string" || resolvedRollMode.length === 0) return chatData;

  const applyRollMode = ChatMessage?.applyRollMode;
  if (typeof applyRollMode === "function") {
    applyRollMode(chatData, resolvedRollMode);
    resolvedVisibility = {
      whisperUserIds: Array.isArray(chatData.whisper)
        ? chatData.whisper.filter((id) => typeof id === "string" && id.length > 0)
        : [],
      blind: chatData.blind === true
    };
    if (censorForUnauthorized === true) convertVisibilityToCensoredFlag(resolvedVisibility);
    return chatData;
  }

  resolvedVisibility = resolveVisibilityFromRollMode(resolvedRollMode);
  applyVisibilityToChatData(resolvedVisibility);
  if (censorForUnauthorized === true) convertVisibilityToCensoredFlag(resolvedVisibility);

  return chatData;
}

function towCombatOverlayToRenderedElement(renderHtml) {
  if (!renderHtml) return null;
  if (renderHtml instanceof HTMLElement) return renderHtml;
  if (renderHtml[0] instanceof HTMLElement) return renderHtml[0];
  return null;
}

function towCombatOverlayGetChatVisibilityFlag(message) {
  if (!message?.getFlag) return null;
  const flag = message.getFlag(TOW_MODULE_ID, TOW_CHAT_VISIBILITY_FLAG);
  return flag && typeof flag === "object" ? flag : null;
}

function towCombatOverlayBuildMessageVisibility(message) {
  if (!message || typeof message !== "object") return null;

  const flagData = towCombatOverlayGetChatVisibilityFlag(message);
  if (flagData?.mode === "censored") {
    const allowedUserIds = Array.isArray(flagData.allowedUserIds)
      ? flagData.allowedUserIds.filter((id) => typeof id === "string" && id.length > 0)
      : [];
    if (allowedUserIds.length > 0) {
      return {
        restricted: true,
        allowedUserIds
      };
    }
  }

  const whisperUserIds = Array.isArray(message.whisper)
    ? message.whisper.filter((id) => typeof id === "string" && id.length > 0)
    : [];
  if (whisperUserIds.length === 0 && message.blind !== true) return null;

  const allowed = new Set(whisperUserIds);
  const sourceUserId = String(message?.author?.id ?? message?.user?.id ?? message?.user ?? "").trim();
  if (sourceUserId) allowed.add(sourceUserId);

  if (message.blind === true) {
    for (const gmUser of (ChatMessage?.getWhisperRecipients?.("GM") ?? [])) {
      const gmId = String(gmUser?.id ?? "").trim();
      if (gmId) allowed.add(gmId);
    }
  }

  return {
    restricted: true,
    allowedUserIds: Array.from(allowed)
  };
}

function towCombatOverlayCanCurrentUserSeeVisibility(visibility) {
  if (!visibility?.restricted) return true;
  if (game?.user?.isGM === true) return true;
  const currentUserId = String(game?.user?.id ?? "").trim();
  if (!currentUserId) return false;
  const allowedUserIds = Array.isArray(visibility.allowedUserIds)
    ? visibility.allowedUserIds
    : [];
  return allowedUserIds.includes(currentUserId);
}

function towCombatOverlayIsMessageContentVisibleForCurrentUser(message) {
  if (!message || typeof message !== "object") return true;
  if (typeof message.isContentVisible === "boolean") return message.isContentVisible;
  return true;
}

function towCombatOverlayResolveMessageIdRef(value) {
  return resolveTowCombatOverlayMessageRefId(value);
}

function towCombatOverlayGetLinkedOpposedMessageIds(message) {
  const attackerMessageId = towCombatOverlayResolveMessageIdRef(message?.system?.attackerMessage);
  const defenderMessageId = towCombatOverlayResolveMessageIdRef(message?.system?.defenderMessage);
  return {
    attackerMessageId,
    defenderMessageId
  };
}

function towCombatOverlayResolveOpposedLinkedVisibility(message) {
  if (!message) return null;
  const { attackerMessageId, defenderMessageId } = towCombatOverlayGetLinkedOpposedMessageIds(message);
  if (!attackerMessageId && !defenderMessageId) return null;

  if (attackerMessageId) {
    const attackerMessage = game?.messages?.get?.(attackerMessageId) ?? null;
    if (!towCombatOverlayIsMessageContentVisibleForCurrentUser(attackerMessage)) {
      return { restricted: true, allowedUserIds: [] };
    }
    const visibility = towCombatOverlayBuildMessageVisibility(attackerMessage);
    if (visibility?.restricted) return visibility;
  }
  if (defenderMessageId) {
    const defenderMessage = game?.messages?.get?.(defenderMessageId) ?? null;
    if (!towCombatOverlayIsMessageContentVisibleForCurrentUser(defenderMessage)) {
      return { restricted: true, allowedUserIds: [] };
    }
    const visibility = towCombatOverlayBuildMessageVisibility(defenderMessage);
    if (visibility?.restricted) return visibility;
  }
  return null;
}

function towCombatOverlayCanCurrentUserSeeUncensoredChat(message) {
  const ownVisibility = towCombatOverlayBuildMessageVisibility(message);
  if (ownVisibility?.restricted) return towCombatOverlayCanCurrentUserSeeVisibility(ownVisibility);

  const linkedOpposedVisibility = towCombatOverlayResolveOpposedLinkedVisibility(message);
  if (linkedOpposedVisibility?.restricted) return towCombatOverlayCanCurrentUserSeeVisibility(linkedOpposedVisibility);

  return true;
}

export function towCombatOverlayApplyChatMessageCensorship(message, renderHtml) {
  const ownFlag = towCombatOverlayGetChatVisibilityFlag(message);
  const hasOwnCensoredFlag = ownFlag?.mode === "censored";
  const hasOpposedLinkedRestriction = !!towCombatOverlayResolveOpposedLinkedVisibility(message);
  if (!hasOwnCensoredFlag && !hasOpposedLinkedRestriction) return;
  if (towCombatOverlayCanCurrentUserSeeUncensoredChat(message)) return;

  const root = towCombatOverlayToRenderedElement(renderHtml) ?? towCombatOverlayToElement(renderHtml);
  if (!root) return;

  const messageContent = root.querySelector(".message-content");
  if (!messageContent) return;

  messageContent.innerHTML = `
    <div class="tow-combat-overlay-chat-card tow-combat-overlay-chat-card--censored">
      <div class="dice-roll">
        <div class="dice-result">
          <div class="dice-formula">???</div>
          <div class="dice-total">?</div>
        </div>
      </div>
    </div>
  `;
}
