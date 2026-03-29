import { getTowCombatOverlayConstants } from "../../../runtime/module-constants.js";
import {
  ACTION_RELAY_WAIT_NOTICE_COOLDOWN_MS,
  ACTION_RELAY_WAIT_NOTICE_DELAY_MS
} from "../../../runtime/action-constants.js";

const {
  moduleId: TOW_MODULE_ID,
  sockets: TOW_SOCKETS,
  flags: TOW_FLAGS
} = getTowCombatOverlayConstants();

export function createActionRelayRuntime() {
  let lastRelayWaitNoticeAt = 0;

  function getActionRelayFlagKey() {
    return String(TOW_FLAGS?.actionRelayRequest ?? "actionRelayRequest");
  }

  function buildRelayPayloadFingerprint(payload = {}) {
    return JSON.stringify({
      requesterId: String(payload?.requesterId ?? "").trim(),
      actionType: String(payload?.actionType ?? "").trim(),
      sourceTokenId: String(payload?.sourceTokenId ?? "").trim(),
      targetTokenId: String(payload?.targetTokenId ?? "").trim(),
      attackerMessageId: String(payload?.attackerMessageId ?? "").trim(),
      opposedMessageId: String(payload?.opposedMessageId ?? "").trim(),
      preferredSkill: String(payload?.preferredSkill ?? "").trim(),
      autoRoll: payload?.autoRoll === false ? false : true,
      rollMode: String(payload?.rollMode ?? "").trim(),
      timestamp: Number(payload?.timestamp ?? 0)
    });
  }

  function isRelayRequestStillPending(payload = {}) {
    const currentUser = game?.user;
    const relayFlagKey = getActionRelayFlagKey();
    const currentFlag = currentUser?.getFlag?.(TOW_MODULE_ID, relayFlagKey);
    if (!currentFlag || typeof currentFlag !== "object") return false;
    return buildRelayPayloadFingerprint(currentFlag) === buildRelayPayloadFingerprint(payload);
  }

  function resolveCanvasTokenById(tokenId) {
    const id = String(tokenId ?? "").trim();
    if (!id) return null;
    const tokenByScene = canvas?.scene?.tokens?.get?.(id)?.object ?? null;
    if (tokenByScene) return tokenByScene;
    const placeables = Array.isArray(canvas?.tokens?.placeables) ? canvas.tokens.placeables : [];
    return placeables.find((token) => String(token?.id ?? "") === id) ?? null;
  }

  function shouldShowRelayWaitNotice(payload = {}) {
    const actionType = String(payload?.actionType ?? "").trim().toLowerCase();
    if (!actionType) return false;
    if (actionType === "defence") {
      const targetToken = resolveCanvasTokenById(payload?.targetTokenId);
      const opposedId = String(targetToken?.actor?.system?.opposed?.id ?? "").trim();
      if (!opposedId) return true;
      const opposedMessage = game?.messages?.get?.(opposedId) ?? null;
      if (!opposedMessage) return true;
      const computed = opposedMessage?.system?.result?.computed === true;
      const applied = opposedMessage?.system?.result?.damage?.applied === true;
      return !(computed || applied);
    }
    return true;
  }

  function scheduleRelayWaitNotice(payload = {}) {
    setTimeout(() => {
      if (!isRelayRequestStillPending(payload)) return;
      const now = Date.now();
      if (now - lastRelayWaitNoticeAt < ACTION_RELAY_WAIT_NOTICE_COOLDOWN_MS) return;
      if (!shouldShowRelayWaitNotice(payload)) return;
      lastRelayWaitNoticeAt = now;
      ui?.notifications?.info?.("Waiting for an active GM client to continue this action.");
    }, ACTION_RELAY_WAIT_NOTICE_DELAY_MS);
  }

  function hasActiveGmUser() {
    const users = game?.users ? Array.from(game.users) : [];
    return users.some((user) => user?.isGM === true && user?.active === true);
  }

  function requestGmActionRelay(type, payload = {}) {
    const actionType = String(type ?? "").trim();
    if (!actionType || game?.user?.isGM === true) return false;
    if (!hasActiveGmUser()) return false;
    const socket = game?.socket;
    if (!socket?.emit) return false;

    const relayPayload = {
      ...payload,
      actionType,
      rollMode: String(game?.settings?.get?.("core", "rollMode") ?? "").trim(),
      requesterId: String(game?.user?.id ?? "").trim(),
      timestamp: Date.now()
    };

    const currentUser = game?.user;
    const relayFlagKey = getActionRelayFlagKey();
    if (currentUser?.setFlag) {
      void Promise.resolve(currentUser.setFlag(TOW_MODULE_ID, relayFlagKey, relayPayload)).catch(() => {});
    }

    const requestType = String(TOW_SOCKETS?.actionRelayRequest ?? "actionRelayRequest");
    socket.emit(`module.${TOW_MODULE_ID}`, {
      type: requestType,
      payload: relayPayload
    });
    scheduleRelayWaitNotice(relayPayload);
    return true;
  }

  return {
    requestGmActionRelay
  };
}
