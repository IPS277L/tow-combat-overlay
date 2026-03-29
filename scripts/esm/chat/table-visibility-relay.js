import { towCombatOverlayApplyRollVisibility } from "../combat/core.js";
import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";

const {
  moduleId: TOW_MODULE_ID,
  flags: { chatVisibility: TOW_CHAT_VISIBILITY_FLAG }
} = getTowCombatOverlayConstants();

function isTowCombatOverlayGmHiddenRollModeActive() {
  if (game?.user?.isGM !== true) return false;
  const rollMode = String(game?.settings?.get?.("core", "rollMode") ?? "").trim().toLowerCase();
  return rollMode === "gmroll" || rollMode === "blindroll";
}

function getTowCombatOverlayMessageUserId(data) {
  return String(data?.author?.id ?? data?.user?.id ?? data?.user ?? "").trim();
}

function getTowCombatOverlaySpeakerRef(data) {
  const actor = String(data?.speaker?.actor ?? "").trim();
  if (actor) return `actor:${actor}`;
  const token = String(data?.speaker?.token ?? "").trim();
  if (!token) return "";
  const scene = String(data?.speaker?.scene ?? "").trim();
  return scene ? `token:${scene}:${token}` : `token:${token}`;
}

function hasTowCombatOverlayVisibilityRestriction(data) {
  if (!data || typeof data !== "object") return false;
  const flag = data?.flags?.[TOW_MODULE_ID]?.[TOW_CHAT_VISIBILITY_FLAG];
  if (flag?.mode === "censored") return true;
  const whisper = Array.isArray(data.whisper) ? data.whisper : [];
  if (whisper.length > 0) return true;
  return data.blind === true;
}

function isTowCombatOverlayRollBearingMessageData(data) {
  if (!data || typeof data !== "object") return false;
  if (Array.isArray(data.rolls) && data.rolls.length > 0) return true;

  const type = String(data.type ?? "").trim().toLowerCase();
  if (type === "test" || type === "opposed" || type === "roll") return true;

  if (data?.system?.test || data?.system?.context) return true;
  if (data?.system?.attackerMessage || data?.system?.defenderMessage) return true;
  return false;
}

function isTowCombatOverlayPotentialRollFollowupMessageData(data) {
  if (isTowCombatOverlayRollBearingMessageData(data)) return true;
  if (!data || typeof data !== "object") return false;

  const type = String(data.type ?? "").trim().toLowerCase();
  if (type !== "item") return false;
  if (!data?.system?.itemData || typeof data.system.itemData !== "object") return false;
  return !!getTowCombatOverlaySpeakerRef(data);
}

function findTowCombatOverlayRecentRestrictedRollSource(createData, creatingUserId = "") {
  const recencyWindowMs = 4_000;
  const now = Date.now();
  const targetSpeakerRef = getTowCombatOverlaySpeakerRef(createData);
  const messages = Array.from(game?.messages ?? []);

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;

    const messageTs = Number(message?.timestamp ?? message?._source?.timestamp ?? NaN);
    if (Number.isFinite(messageTs) && messageTs > 0 && (now - messageTs) > recencyWindowMs) break;

    const messageData = message?.toObject?.() ?? message;
    if (!isTowCombatOverlayRollBearingMessageData(messageData)) continue;
    if (!hasTowCombatOverlayVisibilityRestriction(messageData)) continue;

    const messageUserId = getTowCombatOverlayMessageUserId(messageData);
    if (creatingUserId && messageUserId && messageUserId !== creatingUserId) continue;

    const sourceSpeakerRef = getTowCombatOverlaySpeakerRef(messageData);
    if (targetSpeakerRef && sourceSpeakerRef && targetSpeakerRef !== sourceSpeakerRef) continue;

    return message;
  }

  return null;
}

export function towCombatOverlayApplyTableVisibilityRelay(messageDoc, createData, userId) {
  const creatingUserId = String(userId ?? "").trim();
  const currentUserId = String(game?.user?.id ?? "").trim();
  if (creatingUserId && currentUserId && creatingUserId !== currentUserId) return;
  if (!messageDoc || !isTowCombatOverlayGmHiddenRollModeActive()) return;

  const liveData = messageDoc?.toObject?.() ?? {};
  if (hasTowCombatOverlayVisibilityRestriction(liveData)) return;

  const sourceData = (createData && typeof createData === "object")
    ? createData
    : liveData;
  if (!isTowCombatOverlayPotentialRollFollowupMessageData(sourceData)) return;

  const sourceMessage = findTowCombatOverlayRecentRestrictedRollSource(sourceData, creatingUserId);

  const updateData = {};
  if (sourceMessage) {
    towCombatOverlayApplyRollVisibility(updateData, {
      sourceMessage,
      censorForUnauthorized: true
    });
  } else {
    towCombatOverlayApplyRollVisibility(updateData, {
      rollMode: String(game?.settings?.get?.("core", "rollMode") ?? "").trim().toLowerCase(),
      censorForUnauthorized: true
    });
  }

  if (!Object.keys(updateData).length) return;
  messageDoc.updateSource(updateData);
}
