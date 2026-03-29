import { towCombatOverlayApplyRollVisibility } from "../combat/core.js";
import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";

function getTowCombatOverlayChatVisibilityMetadata() {
  const { moduleId, flags } = getTowCombatOverlayConstants();
  return {
    moduleId: String(moduleId ?? "").trim(),
    chatVisibilityFlagKey: String(flags?.chatVisibility ?? "chatVisibility").trim()
  };
}

function getTowCombatOverlaySensitiveTableMetadata() {
  const tableSettings = game?.settings?.get?.("whtow", "tableSettings");
  const miscastTableId = String(tableSettings?.miscast ?? "").trim();
  const woundsTableId = String(tableSettings?.wounds ?? "").trim();
  const configuredIds = [miscastTableId, woundsTableId].filter(Boolean);
  const configuredNames = configuredIds
    .map((id) => String(game?.tables?.get?.(id)?.name ?? "").trim().toLowerCase())
    .filter(Boolean);
  return {
    ids: configuredIds,
    names: configuredNames
  };
}

function hasTowCombatOverlaySensitiveTableIdInValues(values = []) {
  const normalizedValues = Array.isArray(values)
    ? values.map((value) => String(value ?? "").trim().toLowerCase()).filter(Boolean)
    : [];
  if (!normalizedValues.length) return false;
  const tables = getTowCombatOverlaySensitiveTableMetadata();
  if (!tables.ids.length) return false;
  return tables.ids.some((id) => {
    const normalizedId = String(id ?? "").trim().toLowerCase();
    if (!normalizedId) return false;
    return normalizedValues.some((value) => value.includes(normalizedId));
  });
}

function collectTowCombatOverlayPrimitiveStringValuesDeep(value, output = []) {
  if (value == null) return output;
  if (Array.isArray(value)) {
    for (const entry of value) collectTowCombatOverlayPrimitiveStringValuesDeep(entry, output);
    return output;
  }
  if (typeof value === "object") {
    for (const entry of Object.values(value)) collectTowCombatOverlayPrimitiveStringValuesDeep(entry, output);
    return output;
  }
  output.push(String(value));
  return output;
}

function isTowCombatOverlaySensitiveTableFlavorText(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return false;
  const tables = getTowCombatOverlaySensitiveTableMetadata();
  if (!tables.names.length) return false;
  const hasSensitiveName = tables.names.some((name) => text.includes(name));
  if (!hasSensitiveName) return false;
  const looksLikeTableDraw = text.includes("draws a result from");
  const looksLikeRollFlavor = tables.names.some((name) => text === name);
  return looksLikeTableDraw || looksLikeRollFlavor;
}

function isTowCombatOverlaySensitiveTableMessageData(data) {
  if (!data || typeof data !== "object") return false;
  const coreFlags = data?.flags?.core;
  if (coreFlags && typeof coreFlags === "object") {
    const coreFlagStrings = collectTowCombatOverlayPrimitiveStringValuesDeep(coreFlags, []);
    if (hasTowCombatOverlaySensitiveTableIdInValues(coreFlagStrings)) return true;
  }

  const flavor = String(data.flavor ?? "").trim().toLowerCase();
  const content = String(data.content ?? "").trim().toLowerCase();
  const hasRollPayload = Array.isArray(data.rolls) && data.rolls.length > 0;
  if (hasRollPayload && isTowCombatOverlaySensitiveTableFlavorText(flavor)) return true;
  if (content.includes("draws a result from") && isTowCombatOverlaySensitiveTableFlavorText(content)) return true;
  if (flavor.includes("draws a result from") && isTowCombatOverlaySensitiveTableFlavorText(flavor)) return true;
  return false;
}

function isTowCombatOverlaySensitiveTableDrawMessageData(data) {
  if (!data || typeof data !== "object") return false;
  const flavor = String(data.flavor ?? "").trim().toLowerCase();
  const content = String(data.content ?? "").trim().toLowerCase();
  const drawText = "draws a result from";
  const flavorLooksDraw = flavor.includes(drawText) && isTowCombatOverlaySensitiveTableFlavorText(flavor);
  const contentLooksDraw = content.includes(drawText) && isTowCombatOverlaySensitiveTableFlavorText(content);
  return flavorLooksDraw || contentLooksDraw;
}

function isTowCombatOverlaySensitiveTableItemFollowupMessageData(data) {
  if (!data || typeof data !== "object") return false;
  const type = String(data.type ?? "").trim().toLowerCase();
  if (type !== "item") return false;
  const itemData = data?.system?.itemData;
  if (!itemData || typeof itemData !== "object") return false;
  if (isTowCombatOverlaySensitiveTableMessageData(data)) return false;
  return true;
}

function doesTowCombatOverlayFollowupItemMatchDrawMessage(itemMessageData, drawMessageData) {
  const itemName = String(itemMessageData?.system?.itemData?.name ?? "").trim().toLowerCase();
  if (!itemName) return false;
  const drawFlavor = String(drawMessageData?.flavor ?? "").trim().toLowerCase();
  const drawContent = String(drawMessageData?.content ?? "").trim().toLowerCase();
  if (drawFlavor.includes(itemName)) return true;
  if (drawContent.includes(itemName)) return true;
  return false;
}

function doTowCombatOverlayStrongSpeakerRefsMatch(leftMessageLike, rightMessageLike) {
  const leftSpeaker = leftMessageLike?.speaker;
  const rightSpeaker = rightMessageLike?.speaker;
  if (!leftSpeaker || !rightSpeaker) return true;

  const leftActor = String(leftSpeaker.actor ?? "").trim();
  const rightActor = String(rightSpeaker.actor ?? "").trim();
  if (leftActor && rightActor) return leftActor === rightActor;

  const leftToken = String(leftSpeaker.token ?? "").trim();
  const rightToken = String(rightSpeaker.token ?? "").trim();
  if (leftToken && rightToken) {
    const leftScene = String(leftSpeaker.scene ?? "").trim();
    const rightScene = String(rightSpeaker.scene ?? "").trim();
    if (leftScene && rightScene) return leftScene === rightScene && leftToken === rightToken;
    return leftToken === rightToken;
  }

  return true;
}

function getTowCombatOverlayChatVisibilityFlagFromData(data) {
  if (!data || typeof data !== "object") return null;
  const { moduleId, chatVisibilityFlagKey } = getTowCombatOverlayChatVisibilityMetadata();
  if (!moduleId || !chatVisibilityFlagKey) return null;
  const moduleFlags = data?.flags?.[moduleId];
  if (!moduleFlags || typeof moduleFlags !== "object") return null;
  const flag = moduleFlags?.[chatVisibilityFlagKey];
  return flag && typeof flag === "object" ? flag : null;
}

function hasTowCombatOverlayVisibilityRestriction(data) {
  if (!data || typeof data !== "object") return false;
  let visibilityFlag = getTowCombatOverlayChatVisibilityFlagFromData(data);
  if (!visibilityFlag && typeof data?.getFlag === "function") {
    const { moduleId, chatVisibilityFlagKey } = getTowCombatOverlayChatVisibilityMetadata();
    const liveFlag = data.getFlag(moduleId, chatVisibilityFlagKey);
    if (liveFlag && typeof liveFlag === "object") visibilityFlag = liveFlag;
  }
  if (visibilityFlag?.mode === "censored") return true;
  const whisper = Array.isArray(data.whisper) ? data.whisper : [];
  if (whisper.length > 0) return true;
  return data.blind === true;
}

function isTowCombatOverlayLikelyTableFollowupMessage(data) {
  if (!data || typeof data !== "object") return false;
  if (isTowCombatOverlaySensitiveTableMessageData(data)) return true;
  if (isTowCombatOverlaySensitiveTableItemFollowupMessageData(data)) return true;
  return false;
}

function getTowCombatOverlayMessageTimestamp(message) {
  const timestamp = Number(message?.timestamp ?? message?._source?.timestamp ?? NaN);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function findTowCombatOverlayRecentRestrictedMessageForFollowup(createData, creatingUserId = "") {
  const now = Date.now();
  const recencyWindowMs = 4_000;
  const messages = Array.from(game?.messages ?? []);
  const message = messages[messages.length - 1];
  if (!message) return null;

  const incomingIsSensitive = isTowCombatOverlaySensitiveTableMessageData(createData);
  const incomingIsItemFollowup = isTowCombatOverlaySensitiveTableItemFollowupMessageData(createData);
  if (!incomingIsSensitive && !incomingIsItemFollowup) return null;

  const messageUserId = String(message?.author?.id ?? message?.user?.id ?? message?.user ?? "").trim();
  if (creatingUserId && messageUserId && messageUserId !== creatingUserId) return null;
  if (!hasTowCombatOverlayVisibilityRestriction(message)) return null;

  const messageTs = getTowCombatOverlayMessageTimestamp(message);
  if (messageTs > 0 && (now - messageTs) > recencyWindowMs) return null;

  if (incomingIsSensitive && isTowCombatOverlaySensitiveTableMessageData(message)) return message;
  if (incomingIsItemFollowup && isTowCombatOverlaySensitiveTableMessageData(message)) {
    const isDrawMessage = isTowCombatOverlaySensitiveTableDrawMessageData(message);
    const isRollMessage = Array.isArray(message?.rolls) && message.rolls.length > 0;
    if (!isDrawMessage && !isRollMessage) return null;
    if (!doTowCombatOverlayStrongSpeakerRefsMatch(createData, message)) return null;
    if (isDrawMessage && !doesTowCombatOverlayFollowupItemMatchDrawMessage(createData, message)) {
      // Some Wounds tables do not echo the result item name in the draw text.
      // In that case, allow immediate chained follow-up by speaker/user/time guard.
    }
    return message;
  }
  return null;
}

export function towCombatOverlayApplyTableVisibilityRelay(messageDoc, createData, userId) {
  const creatingUserId = String(userId ?? "").trim();
  const currentUserId = String(game?.user?.id ?? "").trim();
  if (creatingUserId && currentUserId && creatingUserId !== currentUserId) return;

  const sourceData = (createData && typeof createData === "object")
    ? createData
    : (messageDoc?.toObject?.() ?? {});
  if (!isTowCombatOverlayLikelyTableFollowupMessage(sourceData)) return;
  if (hasTowCombatOverlayVisibilityRestriction(sourceData)) return;

  const sourceMessage = findTowCombatOverlayRecentRestrictedMessageForFollowup(sourceData, creatingUserId);
  if (!sourceMessage) return;

  const updateData = {};
  towCombatOverlayApplyRollVisibility(updateData, {
    sourceMessage,
    censorForUnauthorized: true
  });
  if (!Object.keys(updateData).length) return;
  messageDoc.updateSource(updateData);
}
