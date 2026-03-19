const TOP_PANEL_ORDER_STORAGE_KEY = "tow-combat-overlay.top-panel-order.v1";
const TOP_PANEL_POSITION_STORAGE_KEY = "tow-combat-overlay.top-panel-position.v1";
const TOP_PANEL_DRAG_UNLOCKED_STORAGE_KEY = "tow-combat-overlay.top-panel-drag-unlocked.v1";

function getTopPanelOrderStorageKey(sceneId) {
  const safeSceneId = String(sceneId ?? "").trim();
  if (!safeSceneId) return "";
  return `${TOP_PANEL_ORDER_STORAGE_KEY}:${safeSceneId}`;
}

export function readSavedTopPanelTokenOrder(sceneId) {
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

export function writeSavedTopPanelTokenOrder(sceneId, tokenIds) {
  const storageKey = getTopPanelOrderStorageKey(sceneId);
  if (!storageKey) return;
  if (!Array.isArray(tokenIds)) return;

  const normalizedIds = tokenIds
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);

  if (!normalizedIds.length) {
    try {
      window.localStorage.removeItem(storageKey);
    } catch (_error) {
      // Ignore storage errors.
    }
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set(normalizedIds))));
  } catch (_error) {
    // Ignore storage errors.
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

export function readSavedTopPanelDragUnlocked() {
  try {
    const raw = window.localStorage.getItem(TOP_PANEL_DRAG_UNLOCKED_STORAGE_KEY);
    if (raw == null) return true;
    return raw !== "false";
  } catch (_error) {
    return true;
  }
}

export function writeSavedTopPanelDragUnlocked(unlocked) {
  try {
    window.localStorage.setItem(TOP_PANEL_DRAG_UNLOCKED_STORAGE_KEY, unlocked ? "true" : "false");
  } catch (_error) {
    // Ignore storage errors.
  }
}
