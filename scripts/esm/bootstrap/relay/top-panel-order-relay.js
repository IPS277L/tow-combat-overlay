import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import { applyTopPanelWorldOrderUpdate } from "../../overlay/top-panel/top-panel-state.js";
import { ensureTowCombatOverlayActionRelayFlagHook } from "./action-relay-runtime.js";

export function ensureTowCombatOverlayTopPanelOrderRelayHook() {
  const { moduleId, flags } = getTowCombatOverlayConstants();
  const requestFlagKey = String(flags?.topPanelOrderRequest ?? "topPanelOrderRequest");
  const stateKey = "__towCombatOverlayTopPanelOrderRelayHookId";
  if (!game) return null;
  const existingState = game[stateKey];
  if (existingState && typeof existingState === "object") return existingState;

  const processedRequestFingerprintByUserId = new Map();

  const buildRequestFingerprint = (payload, fallbackRequesterId = "") => {
    const sceneId = String(payload?.sceneId ?? "").trim();
    const tokenIds = Array.isArray(payload?.tokenIds) ? payload.tokenIds : [];
    const timestampValue = Number(payload?.timestamp);
    return JSON.stringify({
      sceneId,
      tokenIds,
      requesterId: String(payload?.requesterId ?? fallbackRequesterId).trim(),
      timestamp: Number.isFinite(timestampValue) ? timestampValue : 0
    });
  };

  const handleOrderRequestPayload = async (payload, requestUser = null) => {
    if (!payload || typeof payload !== "object") return false;
    const sourceUserId = String(requestUser?.id ?? payload?.requesterId ?? "").trim();
    if (!sourceUserId) return false;
    const sceneId = String(payload.sceneId ?? "").trim();
    if (!sceneId) return false;
    const tokenIds = Array.isArray(payload.tokenIds) ? payload.tokenIds : [];
    const fingerprint = buildRequestFingerprint(payload, sourceUserId);
    if (processedRequestFingerprintByUserId.get(sourceUserId) === fingerprint) return false;
    processedRequestFingerprintByUserId.set(sourceUserId, fingerprint);
    const didApply = await applyTopPanelWorldOrderUpdate(sceneId, tokenIds);
    if (requestUser?.unsetFlag) {
      void Promise.resolve(requestUser.unsetFlag(moduleId, requestFlagKey)).catch(() => {});
    }
    return didApply;
  };

  const didUpdateTouchTopPanelRequest = (changed) => {
    const moduleFlags = changed?.flags?.[moduleId];
    if (moduleFlags && Object.prototype.hasOwnProperty.call(moduleFlags, requestFlagKey)) return true;
    if (!foundry?.utils?.flattenObject || !changed || typeof changed !== "object") return false;
    const flattened = foundry.utils.flattenObject(changed);
    const rootPath = `flags.${moduleId}.${requestFlagKey}`;
    return Object.keys(flattened).some((key) => key === rootPath || key.startsWith(`${rootPath}.`) || key.startsWith(`${rootPath}.-=`));
  };

  const hookId = Hooks.on("updateUser", (user, changed) => {
    if (game?.user?.isGM !== true) return;
    if (!didUpdateTouchTopPanelRequest(changed)) return;
    const payload = user?.getFlag?.(moduleId, requestFlagKey);
    if (!payload || typeof payload !== "object") return;
    void Promise.resolve(handleOrderRequestPayload(payload, user)).catch(() => {});
  });
  const relayState = {
    hookId,
    handleOrderRequestPayload
  };
  game[stateKey] = relayState;
  return relayState;
}

export function ensureTowCombatOverlayTopPanelOrderSocketRelay() {
  const { moduleId, sockets } = getTowCombatOverlayConstants();
  const requestSocketType = String(sockets?.topPanelOrderRequest ?? "topPanelOrderRequest");
  const actionRelaySocketType = String(sockets?.actionRelayRequest ?? "actionRelayRequest");
  const stateKey = "__towCombatOverlayTopPanelOrderSocketRelayBound";
  if (!game || game[stateKey] === true) return;
  const socket = game?.socket;
  if (!socket?.on) return;
  const relayState = ensureTowCombatOverlayTopPanelOrderRelayHook();
  const handleOrderRequestPayload = relayState?.handleOrderRequestPayload;
  if (typeof handleOrderRequestPayload !== "function") return;
  const actionRelayState = ensureTowCombatOverlayActionRelayFlagHook();
  const handleRelayPayload = actionRelayState?.handleRelayPayload;

  socket.on(`module.${moduleId}`, (message) => {
    if (game?.user?.isGM !== true) return;
    if (!message || typeof message !== "object") return;
    const type = String(message.type ?? "").trim();
    const payload = message.payload;
    if (type === requestSocketType) {
      const requesterId = String(payload?.requesterId ?? "").trim();
      const requestUser = requesterId ? game?.users?.get?.(requesterId) : null;
      void Promise.resolve(handleOrderRequestPayload(payload, requestUser ?? null)).catch(() => {});
      return;
    }
    if (type === actionRelaySocketType) {
      if (typeof handleRelayPayload !== "function") return;
      const requesterId = String(payload?.requesterId ?? "").trim();
      const requestUser = requesterId ? game?.users?.get?.(requesterId) : null;
      void Promise.resolve(handleRelayPayload(payload, requestUser ?? null)).catch((error) => {
        console.error("[tow-combat-overlay] Failed to handle action relay payload.", error);
      });
    }
  });

  game[stateKey] = true;
}

async function runTowCombatOverlayTopPanelOrderFlagSweep() {
  const { moduleId, flags } = getTowCombatOverlayConstants();
  const requestFlagKey = String(flags?.topPanelOrderRequest ?? "topPanelOrderRequest");
  if (!game || game?.user?.isGM !== true) return;
  const relayState = ensureTowCombatOverlayTopPanelOrderRelayHook();
  const handleOrderRequestPayload = relayState?.handleOrderRequestPayload;
  if (typeof handleOrderRequestPayload !== "function") return;

  const users = game?.users ? Array.from(game.users) : [];
  for (const user of users) {
    const payload = user?.getFlag?.(moduleId, requestFlagKey);
    if (!payload || typeof payload !== "object") continue;
    await handleOrderRequestPayload(payload, user);
  }
}

export function ensureTowCombatOverlayTopPanelOrderBackoffSweeps() {
  const stateKey = "__towCombatOverlayTopPanelOrderBackoffSweepState";
  if (!game) return;
  if (game[stateKey] === true) return;
  game[stateKey] = true;
  const delays = [0, 2000, 10000];
  for (const delayMs of delays) {
    window.setTimeout(() => {
      void runTowCombatOverlayTopPanelOrderFlagSweep().catch(() => {});
    }, delayMs);
  }
}