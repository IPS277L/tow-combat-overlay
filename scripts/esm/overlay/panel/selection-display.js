import {
  towCombatOverlayGetMaxWoundLimit
} from "../layout/wound-state.js";

function toReadableTypeLabel(rawType) {
  const value = String(rawType ?? "").trim();
  if (!value) return "";
  if (value !== value.toLowerCase()) return value;
  return value
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getPrimaryTokenIconSrc(token) {
  const textureSrc = String(token?.document?.texture?.src ?? "").trim();
  if (textureSrc) return textureSrc;
  const actorImg = String(token?.actor?.img ?? "").trim();
  if (actorImg) return actorImg;
  return "";
}

export function getPrimaryTokenName(token) {
  const actor = token?.document?.actor ?? token?.actor ?? null;
  const actorName = String(actor?.name ?? "").trim();
  const nameplateName = String(token?.nameplate?.text ?? "").trim();
  const documentName = String(token?.document?.name ?? "").trim();
  const fallbackName = String(token?.name ?? actorName ?? "").trim();
  return actorName || nameplateName || documentName || fallbackName || "Selected token";
}

export function getPrimaryTokenTypeLabel(token) {
  const actor = token?.actor ?? token?.document?.actor;
  const systemType = String(actor?.system?.type ?? "").trim();
  const actorType = String(actor?.type ?? "").trim();
  const typeKey = (systemType || actorType).toLowerCase();
  const npcTypeLabelKey = game.oldworld?.config?.npcType?.[typeKey];
  if (typeof npcTypeLabelKey === "string" && npcTypeLabelKey.length > 0) {
    const localized = game?.i18n?.localize?.(npcTypeLabelKey);
    if (typeof localized === "string" && localized !== npcTypeLabelKey) return localized;
  }
  return toReadableTypeLabel(systemType || actorType || "Actor");
}

export function formatStatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return String(Math.trunc(numeric));
}

export function formatWoundsWithMax(token, woundsValue) {
  const current = formatStatNumber(woundsValue);
  if (current === "-") return current;
  const actor = token?.actor ?? token?.document?.actor ?? null;
  const max = towCombatOverlayGetMaxWoundLimit(actor);
  if (!Number.isFinite(Number(max)) || Number(max) <= 0) return current;
  const maxText = formatStatNumber(max);
  return `${current}/${maxText}`;
}

export function formatMiscastDiceValue(token) {
  const actor = token?.actor ?? token?.document?.actor;
  const miscasts = Number(actor?.system?.magic?.miscasts ?? NaN);
  if (!Number.isFinite(miscasts)) return "-";
  const current = Math.max(0, Math.trunc(miscasts));
  const maxRaw = Number(actor?.system?.magic?.level ?? NaN);
  const max = Number.isFinite(maxRaw) ? Math.max(0, Math.trunc(maxRaw)) : 0;
  return `${current}/${max}`;
}

export function actorHasMagicCasting(actor) {
  const magicLevel = Number(actor?.system?.magic?.level ?? NaN);
  const hasMagicLevel = Number.isFinite(magicLevel) && magicLevel > 0;
  const spellCount = Number(actor?.itemTypes?.spell?.length ?? 0);
  return hasMagicLevel || spellCount > 0;
}

export function getSpeedLabel(token) {
  const actor = token?.actor ?? token?.document?.actor;
  const speedRaw = actor?.system?.speed;
  let speedKey = "";

  if (typeof speedRaw === "string") speedKey = speedRaw;
  else if (speedRaw && typeof speedRaw === "object") {
    const objectKey = speedRaw.value ?? speedRaw.key ?? speedRaw.current ?? speedRaw.type ?? "";
    speedKey = typeof objectKey === "string" ? objectKey : "";
  }

  const normalizedKey = String(speedKey ?? "").trim().toLowerCase();
  if (!normalizedKey) return "-";
  const mapEntry = game.oldworld?.config?.speed?.[normalizedKey];
  if (typeof mapEntry === "string" && mapEntry.length > 0) {
    const localized = game?.i18n?.localize?.(mapEntry);
    if (typeof localized === "string" && localized !== mapEntry) return localized;
  }
  return toReadableTypeLabel(normalizedKey);
}
