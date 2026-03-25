const PANEL_LOCAL_STORAGE_KEY = "tow-combat-overlay.control-panel-position.v1";
const PANEL_BUTTON_ORDER_LOCAL_STORAGE_KEY = "tow-combat-overlay.control-panel-button-order.v1";

function getPanelButtonOrderStorageKey(scope = "global") {
  const rawScope = String(scope ?? "global").trim() || "global";
  return `${PANEL_BUTTON_ORDER_LOCAL_STORAGE_KEY}:${rawScope}`;
}

export function clampPanelCoordinate(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  if (max < min) return min;
  return Math.min(max, Math.max(min, numeric));
}

export function readSavedPanelPosition() {
  try {
    const raw = window.localStorage.getItem(PANEL_LOCAL_STORAGE_KEY);
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

export function writeSavedPanelPosition(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return;
  try {
    const payload = {
      left: Number(panelElement.style.left.replace("px", "")),
      top: Number(panelElement.style.top.replace("px", ""))
    };
    if (!Number.isFinite(payload.left) || !Number.isFinite(payload.top)) return;
    window.localStorage.setItem(PANEL_LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage errors.
  }
}

export function toPanelButtonKey(groupKey, itemId) {
  const group = String(groupKey ?? "").trim();
  const id = String(itemId ?? "").trim();
  if (!group || !id) return "";
  return `${group}:${id}`;
}

export function parsePanelButtonKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const separatorIndex = raw.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex >= raw.length - 1) return null;
  const groupKey = raw.slice(0, separatorIndex).trim();
  const itemId = raw.slice(separatorIndex + 1).trim();
  if (!groupKey || !itemId) return null;
  return { groupKey, itemId };
}

export function isSyntheticEmptySlotKey(value) {
  const parsed = parsePanelButtonKey(value);
  if (!parsed) return false;
  return String(parsed.itemId ?? "").startsWith("empty-slot-");
}

export function readSavedPanelButtonKeyOrder(scope = "global") {
  try {
    const raw = window.localStorage.getItem(getPanelButtonOrderStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const keys = parsed
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => !!parsePanelButtonKey(entry));
    return keys.length ? Array.from(new Set(keys)) : null;
  } catch (_error) {
    return null;
  }
}

export function writeSavedPanelButtonKeyOrder(buttonKeys, scope = "global") {
  if (!Array.isArray(buttonKeys)) return;
  const keys = buttonKeys
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => !!parsePanelButtonKey(entry));
  if (!keys.length) return;
  try {
    window.localStorage.setItem(getPanelButtonOrderStorageKey(scope), JSON.stringify(Array.from(new Set(keys))));
  } catch (_error) {
    // Ignore storage errors.
  }
}

export function clearSavedPanelButtonKeyOrder(scope = "global") {
  try {
    window.localStorage.removeItem(getPanelButtonOrderStorageKey(scope));
  } catch (_error) {
    // Ignore storage errors.
  }
}

export function resolvePanelButtonOrderScope(token = null) {
  const tokenUuid = String(token?.document?.uuid ?? token?.document?.id ?? token?.id ?? "").trim();
  if (tokenUuid) return `token:${tokenUuid}`;
  const actorUuid = String(token?.actor?.uuid ?? token?.document?.actor?.uuid ?? "").trim();
  if (actorUuid) return `actor:${actorUuid}`;
  return "global";
}
