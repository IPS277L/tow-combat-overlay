import { towCombatOverlayLocalizeSystemKey } from "../shared/shared.js";
import {
  getActorEffectsByStatus,
  getActorStatusSet,
  getAllConditionEntries
} from "../panel/shared/status.js";
import { resolveTemporaryEffectDescription } from "../panel/shared/description.js";
import { getOverlayWoundIndicatorData } from "../shared/wound-chip-data.js";
import {
  TOP_PANEL_CHIP_MAX_PER_ROW,
  TOP_PANEL_CHIP_TOOLTIP_FALLBACK,
  TOP_PANEL_WOUND_STATE_KEYS
} from "./top-panel-constants.js";
import { localizeMaybe } from "./top-panel-shared.js";

function getConditionEntryLookup() {
  const entries = getAllConditionEntries();
  const map = new Map();
  for (const entry of entries) {
    const key = String(entry?.id ?? "").trim();
    if (!key) continue;
    map.set(key, entry);
  }
  return { entries, map };
}

function getTopPanelWoundStateChipData(actor, conditionId) {
  const key = String(conditionId ?? "").trim();
  if (!actor || actor.type !== "npc" || actor.system?.hasThresholds !== true) return null;
  if (!TOP_PANEL_WOUND_STATE_KEYS.has(key)) return null;

  const stateData = actor.system?.wounds?.[key] ?? null;
  if (!stateData || typeof stateData !== "object") return null;

  const effectId = String(stateData?.effect?.id ?? "").trim();
  const liveEffect = effectId ? actor?.effects?.get?.(effectId) ?? null : null;
  const img = String(
    stateData?.effect?.document?.img
    ?? stateData?.effect?.document?.icon
    ?? stateData?.img
    ?? stateData?.icon
    ?? liveEffect?.img
    ?? liveEffect?.icon
    ?? ""
  ).trim();
  const description = String(
    stateData?.description
    ?? stateData?.effect?.document?.name
    ?? liveEffect?.name
    ?? ""
  ).trim();

  return { img, description };
}

export function getActiveConditionChips(actor) {
  if (!actor) return [];
  const { entries } = getConditionEntryLookup();
  const activeStatusSet = getActorStatusSet(actor);
  if (!activeStatusSet.size) return [];

  const chips = [];
  for (const entry of entries) {
    const id = String(entry.id ?? "").trim();
    if (!id || !activeStatusSet.has(id)) continue;
    const conditionData = game?.oldworld?.config?.conditions?.[id] ?? {};
    const rawDescription = String(conditionData?.description ?? "").trim();
    const description = rawDescription.startsWith("TOW.")
      ? towCombatOverlayLocalizeSystemKey(rawDescription, "")
      : rawDescription;
    const woundStateChipData = getTopPanelWoundStateChipData(actor, id);
    const liveEffects = getActorEffectsByStatus(actor, id)
      .filter((effect) => effect && !effect.disabled && !effect.isSuppressed);
    const liveImage = String(
      liveEffects[0]?.img
      ?? liveEffects[0]?.icon
      ?? ""
    ).trim();
    chips.push({
      type: "condition",
      key: `condition:${id}`,
      title: String(entry.label ?? id),
      description: woundStateChipData?.description || description || TOP_PANEL_CHIP_TOOLTIP_FALLBACK,
      img: woundStateChipData?.img || liveImage || String(entry.img ?? "").trim()
    });
  }

  return chips;
}

export function getTemporaryEffectChips(actor) {
  if (!actor) return [];
  const conditionKeys = new Set(
    Object.keys(game?.oldworld?.config?.conditions ?? {}).map((key) => String(key ?? "").toLowerCase())
  );

  return Array.from(actor?.effects?.contents ?? [])
    .filter((effect) => {
      if (!effect) return false;
      if (effect.disabled || effect.isSuppressed) return false;
      if (effect.transfer) return false;
      const statuses = Array.from(effect.statuses ?? []).map((status) => String(status ?? "").toLowerCase());
      if (statuses.some((status) => conditionKeys.has(status))) return false;
      return true;
    })
    .sort((left, right) => Number(left?.sort ?? 0) - Number(right?.sort ?? 0))
    .map((effect) => ({
      type: "effect",
      key: `effect:${String(effect?.id ?? "")}`,
      title: String(effect?.name ?? localizeMaybe("TOWCOMBATOVERLAY.Label.Condition", "Condition")).trim(),
      description: resolveTemporaryEffectDescription(effect) || TOP_PANEL_CHIP_TOOLTIP_FALLBACK,
      img: String(effect?.img ?? effect?.icon ?? "icons/svg/aura.svg").trim()
    }));
}

export function getWoundsAbilityChip(actor) {
  if (!actor) return null;
  const woundIndicatorData = getOverlayWoundIndicatorData(actor);
  if (!woundIndicatorData) return null;
  if (woundIndicatorData.isActive !== true) return null;
  return {
    type: "ability",
    key: "ability:wound-actions",
    title: String(woundIndicatorData.title ?? localizeMaybe("TOWCOMBATOVERLAY.Tooltip.Wounds.Title", "Wounds")).trim(),
    description: String(woundIndicatorData.description ?? TOP_PANEL_CHIP_TOOLTIP_FALLBACK).trim(),
    img: String(woundIndicatorData.image ?? "").trim(),
    active: woundIndicatorData.isActive === true
  };
}

export function limitChipList(items, maxCount = TOP_PANEL_CHIP_MAX_PER_ROW, overflowType = "overflow") {
  const list = Array.isArray(items) ? items : [];
  if (list.length <= maxCount) return list;
  const visible = list.slice(0, maxCount);
  const overflowCount = list.length - maxCount;
  const hiddenChips = list.slice(maxCount);
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const hiddenChipsMarkup = hiddenChips
    .map((chip) => {
      const title = escapeHtml(String(chip?.title ?? "").trim() || "?");
      const imageSrc = String(chip?.img ?? "").trim();
      if (imageSrc) {
        const safeImageSrc = escapeHtml(imageSrc);
        return `<div class="tow-combat-overlay-status-tooltip__chip-row"><span class="tow-combat-overlay-status-tooltip__chip-icon"><img src="${safeImageSrc}" alt="" /></span><span>${title}</span></div>`;
      }
      return `<div class="tow-combat-overlay-status-tooltip__chip-row"><span>${title}</span></div>`;
    })
    .join("");
  visible.push({
    type: overflowType,
    key: `overflow:${overflowType}:${overflowCount}`,
    title: `+${overflowCount}`,
    description: hiddenChipsMarkup
      ? `<div class="tow-combat-overlay-status-tooltip__chip-list">${hiddenChipsMarkup}</div>`
      : `+${overflowCount} more`,
    img: ""
  });
  return visible;
}

function isChipTooltipEnabled(chip, tooltipConfig = {}) {
  const enabledByType = (tooltipConfig && typeof tooltipConfig.enabledByType === "object" && tooltipConfig.enabledByType !== null)
    ? tooltipConfig.enabledByType
    : {};
  const chipType = String(chip?.type ?? "").trim().toLowerCase();
  if (chipType in enabledByType) return enabledByType[chipType] !== false;
  return tooltipConfig.defaultEnabled !== false;
}

export function createTopPanelChipElement(chip, tooltipConfig = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("tow-combat-overlay-top-panel__chip", `is-${String(chip?.type ?? "ability")}`);
  button.classList.toggle("is-active", chip?.active === true);
  button.dataset.chipType = String(chip?.type ?? "ability");
  const tooltipEnabled = isChipTooltipEnabled(chip, tooltipConfig);
  const tooltipTitle = String(chip?.title ?? "").trim();
  const tooltipDescription = String(chip?.description ?? TOP_PANEL_CHIP_TOOLTIP_FALLBACK).trim();
  if (tooltipEnabled) {
    button.dataset.tooltipTitle = tooltipTitle;
    button.dataset.tooltipDescription = tooltipDescription;
  } else {
    button.removeAttribute("data-tooltip-title");
    button.removeAttribute("data-tooltip-description");
  }
  button.setAttribute("aria-label", tooltipTitle || "Info");

  const chipImage = String(chip?.img ?? "").trim();
  if (chipImage) {
    const image = document.createElement("img");
    image.classList.add("tow-combat-overlay-top-panel__chip-image");
    image.src = chipImage;
    image.alt = "";
    button.appendChild(image);
  } else {
    const text = document.createElement("span");
    text.classList.add("tow-combat-overlay-top-panel__chip-text");
    text.textContent = String(chip?.title ?? "").trim() || "?";
    button.appendChild(text);
  }

  return button;
}

export function createTopPanelChipGroup(groupKey, chips = [], tooltipConfig = {}) {
  const groupElement = document.createElement("div");
  groupElement.classList.add("tow-combat-overlay-top-panel__chip-group", `is-${groupKey}`);
  for (const chip of chips) {
    groupElement.appendChild(createTopPanelChipElement(chip, tooltipConfig));
  }
  return groupElement;
}
