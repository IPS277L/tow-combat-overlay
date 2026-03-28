import {
  ATTACK_CALL_DEDUPE_MS,
  DAMAGE_RENDER_DEDUPE_MS,
  SHIFT_KEY
} from "../runtime/action-constants.js";
import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";
import { resolveTowCombatOverlayMessageRefId } from "../shared/message-reference.js";

const attackCallDeduper = new Map();
const damageRenderDeduper = new Map();
const {
  moduleId: TOW_MODULE_ID,
  flags: { chatVisibility: TOW_CHAT_VISIBILITY_FLAG }
} = getTowCombatOverlayConstants();

export function towCombatOverlayIsShiftHeld() {
  return game.keyboard.isModifierActive(SHIFT_KEY);
}

export function towCombatOverlayShouldExecuteAttack(actor, { manual = false } = {}) {
  if (!actor) return false;

  const key = `${game.user.id}:${actor.id}:${manual ? "manual" : "auto"}`;
  const now = Date.now();
  const last = Number(attackCallDeduper.get(key) ?? 0);
  if (now - last < ATTACK_CALL_DEDUPE_MS) return false;

  attackCallDeduper.set(key, now);

  if (attackCallDeduper.size > 200) {
    for (const [entryKey, ts] of attackCallDeduper.entries()) {
      if (now - Number(ts) > ATTACK_CALL_DEDUPE_MS * 3) attackCallDeduper.delete(entryKey);
    }
  }

  return true;
}

export function towCombatOverlayToElement(appElement) {
  if (!appElement) return null;
  if (appElement instanceof HTMLElement) return appElement;
  if (appElement[0] instanceof HTMLElement) return appElement[0];
  return null;
}

export function towCombatOverlayApplyDialogClass(renderHtml, className) {
  if (!renderHtml || !className) return;

  const jqRoot = renderHtml?.closest?.(".app.dialog");
  if (jqRoot?.addClass) {
    jqRoot.addClass(className);
    return;
  }

  const element = towCombatOverlayToElement(renderHtml);
  if (!element) return;

  const directLooksLikeDialog = element.classList?.contains("dialog")
    || element.classList?.contains("application")
    || element.classList?.contains("window-app");
  if (directLooksLikeDialog) {
    element.classList.add(className);
    return;
  }

  const dialogRoot = element.closest?.(".app.dialog")
    ?? element.closest?.(".application.dialog")
    ?? element.closest?.(".application")
    ?? null;
  if (dialogRoot?.classList) dialogRoot.classList.add(className);
}

export function towCombatOverlayBindClick(renderHtml, selector, handler) {
  if (!renderHtml || !selector || typeof handler !== "function") return;

  const jqMatches = renderHtml?.find?.(selector);
  if (jqMatches?.on) {
    jqMatches.on("click", handler);
    return;
  }

  const element = towCombatOverlayToElement(renderHtml);
  if (!element) return;
  for (const match of element.querySelectorAll(selector)) {
    match.addEventListener("click", handler);
  }
}

function towCombatOverlayFindRenderedDialogElementByMarker(markerId) {
  const marker = document.querySelector(`[data-tow-selector-dialog-id="${markerId}"]`);
  if (!marker) return null;
  return marker.closest(".app.window-app.dialog")
    ?? marker.closest(".application.dialog")
    ?? marker.closest(".application")
    ?? null;
}

export function towCombatOverlayOpenSelectorDialog({
  title,
  content,
  width = 560,
  height = null,
  onRender
} = {}) {
  const markerId = foundry?.utils?.randomID?.() ?? `tow-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const wrappedContent = `<div data-tow-selector-dialog-id="${towCombatOverlayEscapeHtml(markerId)}">${String(content ?? "")}</div>`;
  const DialogV2Class = foundry?.applications?.api?.DialogV2;
  if (typeof DialogV2Class === "function") {
    try {
      const dialogV2Config = {
        title,
        window: {
          title
        },
        content: wrappedContent,
        width,
        position: { width }
      };
      if (Number.isFinite(Number(height)) && Number(height) > 0) {
        dialogV2Config.height = Number(height);
        dialogV2Config.position.height = Number(height);
      }
      const dialogV2 = new DialogV2Class(dialogV2Config);
      dialogV2.render(true);
      if (typeof onRender === "function") {
        const bindOnceReady = (attempt = 0) => {
          const fromApp = towCombatOverlayToElement(dialogV2.element);
          const root = fromApp ?? towCombatOverlayFindRenderedDialogElementByMarker(markerId);
          if (root) {
            if (root.dataset.towSelectorBound === markerId) return;
            root.dataset.towSelectorBound = markerId;
            onRender(root, dialogV2);
            return;
          }
          if (attempt >= 30) return;
          setTimeout(() => bindOnceReady(attempt + 1), 50);
        };
        towCombatOverlayScheduleSoon(() => bindOnceReady(0));
      }
      return dialogV2;
    } catch (_error) {
      // Fall through to V1 Dialog.
    }
  }

  const dialogV1Data = {
    title,
    content: wrappedContent,
    buttons: {},
    render: (html) => {
      if (typeof onRender === "function") onRender(html, dialogV1);
    }
  };
  const dialogV1Options = {
    width,
    ...(Number.isFinite(Number(height)) && Number(height) > 0 ? { height: Number(height) } : {})
  };
  const dialogV1 = new Dialog(dialogV1Data, dialogV1Options);
  dialogV1.render(true);
  return dialogV1;
}

export function towCombatOverlayScheduleSoon(callback) {
  if (typeof window?.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      void callback();
    });
    return;
  }
  Promise.resolve().then(() => {
    void callback();
  });
}

export function towCombatOverlayEscapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

export function towCombatOverlayLocalize(key, fallback = "") {
  const localized = game?.i18n?.localize?.(key);
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? "");
}

export function towCombatOverlayApplyRollVisibility(
  chatData = {},
  {
    sourceMessage = null,
    rollMode = null,
    censorForUnauthorized = false
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

  const root = towCombatOverlayToRenderedElement(renderHtml);
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

export async function towCombatOverlayRenderTemplate(path, data = {}) {
  const renderer = foundry?.applications?.handlebars?.renderTemplate;
  if (typeof renderer !== "function") {
    throw new Error("[tow-combat-overlay] Missing foundry.applications.handlebars.renderTemplate");
  }
  return renderer(path, data);
}

function towCombatOverlayIsRangedAttack(attackItem) {
  return (attackItem.system.attack.range?.max ?? 0) > 0;
}

function towCombatOverlayIsWeaponAttack(item) {
  if (item.type !== "ability" || !item.system?.attack) return false;
  if (item.system?.isAttack === true) return true;
  return typeof item.system.attack.skill === "string" && item.system.attack.skill.length > 0;
}

export function towCombatOverlayGetSortedWeaponAttacks(actor) {
  return actor.items
    .filter(towCombatOverlayIsWeaponAttack)
    .sort((a, b) => {
      const aRanged = towCombatOverlayIsRangedAttack(a);
      const bRanged = towCombatOverlayIsRangedAttack(b);
      if (aRanged !== bRanged) return aRanged ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

export function towCombatOverlayGetAttackMeta(attack) {
  const skill = attack.system?.attack?.skill;
  const skillLabel = game.oldworld?.config?.skills?.[skill]
    ?? skill
    ?? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.Attack", "Attack");
  const isRanged = attack.system?.isRanged || towCombatOverlayIsRangedAttack(attack);
  const attackType = isRanged
    ? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.Ranged", "Ranged")
    : towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.Melee", "Melee");
  const rangeConfig = game.oldworld?.config?.range ?? {};
  const meleeRangeKey = attack.system?.attack?.range?.melee;
  const minRangeKey = attack.system?.attack?.range?.min;
  const maxRangeKey = attack.system?.attack?.range?.max;
  const rangeLabel = isRanged
    ? `${rangeConfig[minRangeKey] ?? minRangeKey ?? 0}-${rangeConfig[maxRangeKey] ?? maxRangeKey ?? 0}`
    : `${rangeConfig[meleeRangeKey] ?? meleeRangeKey ?? 0}`;
  const damage = Number(attack.system?.damage?.value ?? 0);
  const damageLabel = towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.DamageAbbrev", "DMG");
  return `${attackType} | ${rangeLabel} | ${skillLabel} | ${damageLabel} ${damage}`;
}

export function towCombatOverlayRenderSelectorRowButton(rowData = {}) {
  return towCombatOverlayRenderTemplate(
    "modules/tow-combat-overlay/templates/combat/rows/selector-row.hbs",
    rowData
  );
}

export async function towCombatOverlayWaitForChatMessage(messageId, timeoutMs = 3000) {
  if (!messageId) return null;
  const existing = game.messages.get(messageId);
  if (existing) return existing;

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    let hookId = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (hookId) Hooks.off("createChatMessage", hookId);
      if (timeoutId) clearTimeout(timeoutId);
      resolve(game.messages.get(messageId) ?? null);
    };

    hookId = Hooks.on("createChatMessage", (message) => {
      if (message?.id !== messageId) return;
      finish();
    });

    timeoutId = setTimeout(finish, timeoutMs);
  });
}

function towCombatOverlayGetDamageRenderState() {
  return damageRenderDeduper;
}

function towCombatOverlayMarkDamageRender(dedupe, key) {
  if (!dedupe || !key) return false;
  const now = Date.now();
  const last = Number(dedupe.get(key) ?? 0);
  if (now - last < DAMAGE_RENDER_DEDUPE_MS) return false;
  dedupe.set(key, now);

  if (dedupe.size > 250) {
    for (const [entryKey, ts] of dedupe.entries()) {
      if (now - Number(ts) > DAMAGE_RENDER_DEDUPE_MS * 2) dedupe.delete(entryKey);
    }
  }
  return true;
}

async function towCombatOverlayPostSeparateDamageMessage(message, damage) {
  if (!message) return;
  const targetCount = Number(message.system?.test?.context?.targetSpeakers?.length ?? 0);
  if (targetCount > 0) return;

  const dedupe = towCombatOverlayGetDamageRenderState();
  const dedupeKey = `separate:${message.id}`;
  if (!towCombatOverlayMarkDamageRender(dedupe, dedupeKey)) return;

  const content = await towCombatOverlayRenderTemplate("modules/tow-combat-overlay/templates/chat/damage-display.hbs", {
    damageLabel: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Damage", "Damage"),
    damage: Number(damage ?? 0)
  });

  const chatData = {
    content,
    speaker: message.speaker ?? {}
  };
  towCombatOverlayApplyRollVisibility(chatData, {
    sourceMessage: message,
    censorForUnauthorized: true
  });
  await ChatMessage.create(chatData);
}

export async function towCombatOverlayRenderDamageDisplay(message, { damage }) {
  if (!message) return;
  await towCombatOverlayPostSeparateDamageMessage(message, damage);
}

