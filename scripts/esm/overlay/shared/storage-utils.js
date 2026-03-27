export function normalizeStringList(values, { predicate = null } = {}) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(
    values
      .map((value) => String(value ?? "").trim())
      .filter((value) => {
        if (!value) return false;
        if (typeof predicate !== "function") return true;
        return predicate(value);
      })
  ));
}

export function clampCoordinate(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  if (max < min) return min;
  return Math.min(max, Math.max(min, numeric));
}

export function readSavedPosition(storageKey) {
  const key = String(storageKey ?? "").trim();
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
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

export function writeSavedPosition(storageKey, element) {
  const key = String(storageKey ?? "").trim();
  if (!key) return;
  if (!(element instanceof HTMLElement)) return;
  try {
    const payload = {
      left: Number(String(element.style.left ?? "").replace("px", "")),
      top: Number(String(element.style.top ?? "").replace("px", ""))
    };
    if (!Number.isFinite(payload.left) || !Number.isFinite(payload.top)) return;
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage errors.
  }
}
