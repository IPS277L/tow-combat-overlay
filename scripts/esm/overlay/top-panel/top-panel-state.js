import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import {
  TOP_PANEL_ORDER_STORAGE_KEY,
  TOP_PANEL_POSITION_STORAGE_KEY
} from "./top-panel-constants.js";
import {
  clampCoordinate,
  normalizeStringList,
  readSavedPosition,
  writeSavedPosition
} from "../shared/storage-utils.js";

function getTopPanelOrderStorageKey(sceneId) {
  const safeSceneId = String(sceneId ?? "").trim();
  if (!safeSceneId) return "";
  return `${TOP_PANEL_ORDER_STORAGE_KEY}:${safeSceneId}`;
}

function canUpdateTopPanelWorldOrderSetting() {
  return game?.user?.isGM === true;
}

function hasActiveGameMaster() {
  const users = game?.users ? Array.from(game.users) : [];
  return users.some((user) => user?.isGM === true && user?.active === true);
}

function getTopPanelOrderKeys() {
  const { moduleId, settings, flags, sockets } = getTowCombatOverlayConstants();
  return {
    moduleId,
    settingKey: String(settings?.tokensPanelTokenOrderByScene ?? "tokensPanelTokenOrderByScene"),
    requestFlagKey: String(flags?.topPanelOrderRequest ?? "topPanelOrderRequest"),
    requestSocketType: String(sockets?.topPanelOrderRequest ?? "topPanelOrderRequest")
  };
}

function readTopPanelWorldOrderState() {
  const { moduleId, settingKey } = getTopPanelOrderKeys();
  try {
    const raw = game?.settings?.get?.(moduleId, settingKey);
    return (raw && typeof raw === "object") ? raw : {};
  } catch (_error) {
    return {};
  }
}

function normalizeTopPanelTokenIds(tokenIds) {
  return normalizeStringList(tokenIds);
}

function requestTopPanelWorldOrderUpdate(sceneId, tokenIds) {
  const safeSceneId = String(sceneId ?? "").trim();
  if (!safeSceneId) return;
  const currentUser = game?.user;
  const {
    moduleId,
    requestFlagKey,
    requestSocketType
  } = getTopPanelOrderKeys();
  try {
    const payload = {
      sceneId: safeSceneId,
      tokenIds: normalizeTopPanelTokenIds(tokenIds),
      requesterId: String(currentUser?.id ?? "").trim(),
      timestamp: Date.now()
    };
    if (currentUser?.setFlag) {
      void Promise.resolve(currentUser.setFlag(moduleId, requestFlagKey, payload)).catch(() => {});
    }
    const socket = game?.socket;
    if (socket?.emit) {
      socket.emit(`module.${moduleId}`, {
        type: requestSocketType,
        payload
      });
    }
  } catch (_error) {
    // Ignore relay errors.
  }
}

function readSavedTopPanelTokenOrderLocal(sceneId) {
  const storageKey = getTopPanelOrderStorageKey(sceneId);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ids = normalizeTopPanelTokenIds(parsed);
    return ids.length ? ids : null;
  } catch (_error) {
    return null;
  }
}

function writeSavedTopPanelTokenOrderLocal(sceneId, tokenIds) {
  const storageKey = getTopPanelOrderStorageKey(sceneId);
  if (!storageKey) return;
  const normalizedIds = normalizeTopPanelTokenIds(tokenIds);
  try {
    if (!normalizedIds.length) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(normalizedIds));
  } catch (_error) {
    // Ignore storage errors.
  }
}

export async function applyTopPanelWorldOrderUpdate(sceneId, tokenIds) {
  const safeSceneId = String(sceneId ?? "").trim();
  if (!safeSceneId || !canUpdateTopPanelWorldOrderSetting()) return false;
  const { moduleId, settingKey } = getTopPanelOrderKeys();

  const nextTokenIds = normalizeTopPanelTokenIds(tokenIds);
  const currentState = readTopPanelWorldOrderState();
  const currentSceneIds = normalizeTopPanelTokenIds(currentState?.[safeSceneId]);
  const isUnchanged = (
    currentSceneIds.length === nextTokenIds.length
    && currentSceneIds.every((tokenId, index) => tokenId === nextTokenIds[index])
  );
  if (isUnchanged) return false;

  const nextState = { ...currentState };
  if (nextTokenIds.length) nextState[safeSceneId] = nextTokenIds;
  else delete nextState[safeSceneId];

  try {
    await game?.settings?.set?.(moduleId, settingKey, nextState);
    return true;
  } catch (_error) {
    return false;
  }
}

export function readSavedTopPanelTokenOrder(sceneId) {
  const safeSceneId = String(sceneId ?? "").trim();
  if (!safeSceneId) return null;
  const { moduleId, settingKey } = getTopPanelOrderKeys();

  try {
    const rawWorldState = game?.settings?.get?.(moduleId, settingKey);
    const worldState = (rawWorldState && typeof rawWorldState === "object") ? rawWorldState : null;
    const hasSceneEntry = !!worldState && Object.prototype.hasOwnProperty.call(worldState, safeSceneId);
    if (hasSceneEntry) {
      return normalizeTopPanelTokenIds(worldState[safeSceneId]);
    }
  } catch (_error) {
    // Fall back to local storage.
  }

  return readSavedTopPanelTokenOrderLocal(safeSceneId);
}

export function writeSavedTopPanelTokenOrder(sceneId, tokenIds) {
  const safeSceneId = String(sceneId ?? "").trim();
  if (!safeSceneId) return;
  if (!Array.isArray(tokenIds)) return;

  const normalizedIds = normalizeTopPanelTokenIds(tokenIds);

  // Keep local snapshot for immediate UI feedback and offline/no-GM fallback.
  writeSavedTopPanelTokenOrderLocal(safeSceneId, normalizedIds);

  if (canUpdateTopPanelWorldOrderSetting()) {
    void applyTopPanelWorldOrderUpdate(safeSceneId, normalizedIds);
    return;
  }

  if (hasActiveGameMaster()) {
    requestTopPanelWorldOrderUpdate(safeSceneId, normalizedIds);
  }
}

export function clampTopPanelCoordinate(value, min, max) {
  return clampCoordinate(value, min, max);
}

export function readSavedTopPanelPosition() {
  return readSavedPosition(TOP_PANEL_POSITION_STORAGE_KEY);
}

export function writeSavedTopPanelPosition(panelElement) {
  writeSavedPosition(TOP_PANEL_POSITION_STORAGE_KEY, panelElement);
}
