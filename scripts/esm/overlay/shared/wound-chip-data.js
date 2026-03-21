import { ICON_SRC_WOUND } from "../../runtime/overlay-constants.js";

const WOUND_STATE_KEYS = Object.freeze(["unwounded", "wounded", "defeated"]);
const WOUND_STATE_LABELS = Object.freeze({
  unwounded: localizeMaybe("TOWCOMBATOVERLAY.Label.WoundState.Unwounded", "Unwounded"),
  wounded: localizeMaybe("TOWCOMBATOVERLAY.Label.WoundState.Wounded", "Wounded"),
  defeated: localizeMaybe("TOWCOMBATOVERLAY.Label.WoundState.Defeated", "Defeated")
});

function localizeMaybe(key, fallback = "") {
  const localized = game?.i18n?.localize?.(String(key ?? ""));
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? key ?? "");
}

function getActorWoundItems(actor) {
  if (!actor) return [];
  const fromCollection = Array.isArray(actor.items?.contents)
    ? actor.items.contents.filter((item) => item?.type === "wound")
    : [];
  const fromTyped = Array.isArray(actor.itemTypes?.wound)
    ? actor.itemTypes.wound.filter((item) => item?.type === "wound")
    : [];
  if (!fromCollection.length) return fromTyped;
  if (!fromTyped.length) return fromCollection;
  const seen = new Set();
  const merged = [];
  for (const wound of [...fromCollection, ...fromTyped]) {
    const key = String(wound?.id ?? wound?._id ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(wound);
  }
  return merged;
}

function getActorWoundCount(actor) {
  return getActorWoundItems(actor).length;
}

function getWoundStateActionText(actor, stateData) {
  const description = String(stateData?.description ?? "").trim();
  if (description) return description;
  const effectName = String(
    stateData?.effect?.document?.name
    ?? actor?.effects?.get?.(stateData?.effect?.id)?.name
    ?? ""
  ).trim();
  if (effectName) return effectName;
  return "";
}

function getWoundStateImage(actor, stateData, woundIconSrc) {
  const directImage = String(
    stateData?.effect?.document?.img
    ?? stateData?.effect?.document?.icon
    ?? stateData?.img
    ?? stateData?.icon
    ?? ""
  ).trim();
  if (directImage) return directImage;
  const effectId = String(stateData?.effect?.id ?? "").trim();
  const liveImage = String(actor?.effects?.get?.(effectId)?.img ?? "").trim();
  if (liveImage) return liveImage;
  return woundIconSrc;
}

function getWoundStateEntries(actor, woundIconSrc) {
  if (!actor || actor.type !== "npc" || actor.system?.hasThresholds !== true) return [];
  const woundsData = actor.system?.wounds ?? {};
  return WOUND_STATE_KEYS.map((key) => {
    const stateData = woundsData?.[key] ?? {};
    const action = getWoundStateActionText(actor, stateData);
    const image = getWoundStateImage(actor, stateData, woundIconSrc);
    const rangeRaw = Array.isArray(stateData?.range) ? stateData.range : [];
    const min = Number(rangeRaw[0]);
    const max = Number(rangeRaw[1]);
    return {
      key,
      label: WOUND_STATE_LABELS[key] ?? key,
      action,
      image,
      min: Number.isFinite(min) ? Math.trunc(min) : null,
      max: Number.isFinite(max) ? Math.trunc(max) : null
    };
  });
}

function resolveCurrentWoundStateKey(actor, woundCount, entries) {
  const thresholdKey = String(actor?.system?.thresholdAtWounds?.(woundCount) ?? "").trim();
  if (WOUND_STATE_KEYS.includes(thresholdKey)) return thresholdKey;
  for (const entry of entries) {
    if (!Number.isFinite(entry.min) || !Number.isFinite(entry.max)) continue;
    if (woundCount >= entry.min && woundCount <= entry.max) return entry.key;
  }
  return WOUND_STATE_KEYS[0];
}

function formatWoundRangeText(entry) {
  if (!entry) return "";
  if (Number.isFinite(entry.min) && Number.isFinite(entry.max)) {
    if (entry.min === entry.max) return `${entry.min}`;
    return `${entry.min}-${entry.max}`;
  }
  return localizeMaybe("TOWCOMBATOVERLAY.Label.WoundRange.Any", "any");
}

export function getOverlayWoundIndicatorData(actor, { woundIconSrc, escapeHtml } = {}) {
  const resolvedWoundIconSrc = String(woundIconSrc ?? "").trim() || ICON_SRC_WOUND;
  const htmlEscape = (typeof escapeHtml === "function") ? escapeHtml : (value) => String(value ?? "");
  const entries = getWoundStateEntries(actor, resolvedWoundIconSrc).filter((entry) => !!entry.action);
  if (!entries.length) return null;

  const woundCount = getActorWoundCount(actor);
  const currentKey = resolveCurrentWoundStateKey(actor, woundCount, entries);
  const currentEntry = entries.find((entry) => entry.key === currentKey) ?? entries[0];
  const title = localizeMaybe("TOWCOMBATOVERLAY.Tooltip.Panel.WoundActions.Title", "Wound Actions");
  const label = String(currentEntry?.label ?? title).trim();
  const lines = entries.map((entry) => {
    const range = formatWoundRangeText(entry);
    const prefix = entry.key === currentKey ? "<strong>&#9656; </strong>" : "";
    return `${prefix}<strong>${htmlEscape(entry.label)}</strong> (${htmlEscape(range)}): ${htmlEscape(entry.action)}`;
  });

  return {
    title,
    description: lines.join("<br>"),
    image: String(currentEntry?.image ?? resolvedWoundIconSrc).trim(),
    label,
    isActive: currentKey !== "unwounded"
  };
}
