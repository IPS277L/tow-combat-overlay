const TOP_PANEL_ORDER_STORAGE_KEY = "tow-combat-overlay.top-panel-order.v1";
const TOP_PANEL_POSITION_STORAGE_KEY = "tow-combat-overlay.top-panel-position.v1";
const TOP_PANEL_ORDER_SETTING_KEY = "tokensPanelTokenOrderByScene";
const TOP_PANEL_ORDER_REQUEST_FLAG_KEY = "topPanelOrderRequest";
const MODULE_ID = "tow-combat-overlay";

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

function readTopPanelWorldOrderState() {
  try {
    const raw = game?.settings?.get?.(MODULE_ID, TOP_PANEL_ORDER_SETTING_KEY);
    return (raw && typeof raw === "object") ? raw : {};
  } catch (_error) {
    return {};
  }
}

function normalizeTopPanelTokenIds(tokenIds) {
  if (!Array.isArray(tokenIds)) return [];
  return Array.from(new Set(
    tokenIds
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean)
  ));
}

function requestTopPanelWorldOrderUpdate(sceneId, tokenIds) {
  const safeSceneId = String(sceneId ?? "").trim();
  if (!safeSceneId) return;
  const currentUser = game?.user;
  if (!currentUser?.setFlag) return;
  try {
    const payload = {
      sceneId: safeSceneId,
      tokenIds: normalizeTopPanelTokenIds(tokenIds),
      requesterId: String(currentUser.id ?? "").trim(),
      timestamp: Date.now()
    };
    void Promise.resolve(currentUser.setFlag(MODULE_ID, TOP_PANEL_ORDER_REQUEST_FLAG_KEY, payload)).catch(() => {});
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
    if (!Array.isArray(parsed)) return null;
    const ids = parsed
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean);
    return ids.length ? Array.from(new Set(ids)) : null;
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

export function applyTopPanelWorldOrderUpdate(sceneId, tokenIds) {
  const safeSceneId = String(sceneId ?? "").trim();
  if (!safeSceneId || !canUpdateTopPanelWorldOrderSetting()) return false;

  const nextTokenIds = normalizeTopPanelTokenIds(tokenIds);
  const currentState = readTopPanelWorldOrderState();
  const nextState = { ...currentState };
  if (nextTokenIds.length) nextState[safeSceneId] = nextTokenIds;
  else delete nextState[safeSceneId];

  try {
    void Promise.resolve(game?.settings?.set?.(MODULE_ID, TOP_PANEL_ORDER_SETTING_KEY, nextState)).catch(() => {});
    return true;
  } catch (_error) {
    return false;
  }
}

export function readSavedTopPanelTokenOrder(sceneId) {
  const safeSceneId = String(sceneId ?? "").trim();
  if (!safeSceneId) return null;

  try {
    const rawWorldState = game?.settings?.get?.(MODULE_ID, TOP_PANEL_ORDER_SETTING_KEY);
    const worldState = (rawWorldState && typeof rawWorldState === "object") ? rawWorldState : null;
    const hasSceneEntry = !!worldState && Object.prototype.hasOwnProperty.call(worldState, safeSceneId);
    if (hasSceneEntry) {
      const worldOrderRaw = Array.isArray(worldState[safeSceneId]) ? worldState[safeSceneId] : [];
      const worldIds = worldOrderRaw.map((entry) => String(entry ?? "").trim()).filter(Boolean);
      return Array.from(new Set(worldIds));
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
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  if (max < min) return min;
  return Math.min(max, Math.max(min, numeric));
}

export function readSavedTopPanelPosition() {
  try {
    const raw = window.localStorage.getItem(TOP_PANEL_POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const left = Number(parsed?.left);
    const top = Number(parsed?.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top };
  } catch (_error) {
    return null;
  }
}

export function writeSavedTopPanelPosition(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return;
  try {
    const payload = {
      left: Number(panelElement.style.left.replace("px", "")),
      top: Number(panelElement.style.top.replace("px", ""))
    };
    if (!Number.isFinite(payload.left) || !Number.isFinite(payload.top)) return;
    window.localStorage.setItem(TOP_PANEL_POSITION_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage errors.
  }
}
