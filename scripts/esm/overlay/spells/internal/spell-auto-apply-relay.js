import { getTowCombatOverlayConstants } from "../../../runtime/module-constants.js";
import { collectPotentialApplyActors } from "../../shared/actor-reference-helpers.js";

const {
  moduleId: TOW_MODULE_ID,
  sockets: TOW_SOCKETS,
  flags: TOW_FLAGS
} = getTowCombatOverlayConstants();

function hasActiveGmUser() {
  const users = game?.users ? Array.from(game.users) : [];
  return users.some((user) => user?.isGM === true && user?.active === true);
}

export function requestGmSpellAutoApplyRelay(messageId, targetToken = null) {
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

export function hasNonOwnedUserTargets() {
  const targets = Array.from(game?.user?.targets ?? []);
  return targets.some((token) => token?.actor && token.actor.isOwner !== true);
}

export function messageHasNonOwnedApplyTargets(message) {
  const actors = collectPotentialApplyActors(message, {});
  return actors.some((actor) => actor && actor.isOwner !== true);
}
