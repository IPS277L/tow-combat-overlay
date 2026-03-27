import {
  clampCoordinate,
  normalizeStringList,
  readSavedPosition,
  writeSavedPosition
} from "../../shared/storage-utils.js";

const PANEL_LOCAL_STORAGE_KEY = "tow-combat-overlay.control-panel-position.v1";
const PANEL_BUTTON_ORDER_LOCAL_STORAGE_KEY = "tow-combat-overlay.control-panel-button-order.v1";

function getPanelButtonOrderStorageKey(scope = "global") {
  const rawScope = String(scope ?? "global").trim() || "global";
  return `${PANEL_BUTTON_ORDER_LOCAL_STORAGE_KEY}:${rawScope}`;
}

export function clampPanelCoordinate(value, min, max) {
  return clampCoordinate(value, min, max);
}

export function readSavedPanelPosition() {
  return readSavedPosition(PANEL_LOCAL_STORAGE_KEY);
}

export function writeSavedPanelPosition(panelElement) {
  writeSavedPosition(PANEL_LOCAL_STORAGE_KEY, panelElement);
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
    const keys = normalizeStringList(parsed, {
      predicate: (entry) => !!parsePanelButtonKey(entry)
    });
    return keys.length ? keys : null;
  } catch (_error) {
    return null;
  }
}

export function writeSavedPanelButtonKeyOrder(buttonKeys, scope = "global") {
  const keys = normalizeStringList(buttonKeys, {
    predicate: (entry) => !!parsePanelButtonKey(entry)
  });
  if (!keys.length) return;
  try {
    window.localStorage.setItem(getPanelButtonOrderStorageKey(scope), JSON.stringify(keys));
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
