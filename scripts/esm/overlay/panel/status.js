import { getTowCombatOverlayConstants } from "../../runtime/constants.js";
import { towCombatOverlayLocalizeSystemKey, towCombatOverlayResolveConditionLabel } from "../shared/shared.js";

const { tooltips: MODULE_TOOLTIPS } = getTowCombatOverlayConstants();
const PANEL_WOUND_STATE_KEYS = Object.freeze(["unwounded", "wounded", "defeated"]);
const PANEL_WOUND_STATE_LABELS = Object.freeze({
  unwounded: "Unwounded",
  wounded: "Wounded",
  defeated: "Defeated"
});

function localizeMaybe(key, fallback = "") {
  const localized = game?.i18n?.localize?.(String(key ?? ""));
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? key ?? "");
}

export function getAllConditionEntries() {
  const conditions = game.oldworld?.config?.conditions ?? {};
  return Object.entries(conditions)
    .map(([id, data]) => {
      const key = String(id ?? "").trim();
      if (!key) return null;
      const rawLabel = String(data?.name ?? key);
      const label = rawLabel.startsWith("TOW.") ? localizeMaybe(rawLabel, key) : rawLabel;
      const img = String(data?.img ?? data?.icon ?? `/systems/whtow/assets/icons/conditions/${key}.svg`);
      return {
        id: key,
        img,
        label
      };
    })
    .filter(Boolean);
}

export function getActorStatusSet(actor) {
  const statuses = new Set(Array.from(actor?.statuses ?? []).map((s) => String(s)));
  for (const effect of Array.from(actor?.effects?.contents ?? [])) {
    for (const status of Array.from(effect?.statuses ?? [])) statuses.add(String(status));
  }
  return statuses;
}

export function getActorEffectsByStatus(actor, conditionId) {
  const id = String(conditionId ?? "");
  if (!id) return [];
  return Array.from(actor?.effects?.contents ?? []).filter((effect) => (
    Array.from(effect?.statuses ?? []).map(String).includes(id)
  ));
}

function getPanelActorWoundItems(actor) {
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

function getPanelActorWoundCount(actor) {
  return getPanelActorWoundItems(actor).length;
}

function getPanelWoundStateActionText(actor, stateData) {
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

function getPanelWoundStateImage(actor, stateData, woundIconSrc) {
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

function getPanelWoundStateEntries(actor, woundIconSrc) {
  if (!actor || actor.type !== "npc" || actor.system?.hasThresholds !== true) return [];
  const woundsData = actor.system?.wounds ?? {};
  return PANEL_WOUND_STATE_KEYS.map((key) => {
    const stateData = woundsData?.[key] ?? {};
    const action = getPanelWoundStateActionText(actor, stateData);
    const image = getPanelWoundStateImage(actor, stateData, woundIconSrc);
    const rangeRaw = Array.isArray(stateData?.range) ? stateData.range : [];
    const min = Number(rangeRaw[0]);
    const max = Number(rangeRaw[1]);
    return {
      key,
      label: PANEL_WOUND_STATE_LABELS[key] ?? key,
      action,
      image,
      min: Number.isFinite(min) ? Math.trunc(min) : null,
      max: Number.isFinite(max) ? Math.trunc(max) : null
    };
  });
}

function resolvePanelCurrentWoundStateKey(actor, woundCount, entries) {
  const thresholdKey = String(actor?.system?.thresholdAtWounds?.(woundCount) ?? "").trim();
  if (PANEL_WOUND_STATE_KEYS.includes(thresholdKey)) return thresholdKey;
  for (const entry of entries) {
    if (!Number.isFinite(entry.min) || !Number.isFinite(entry.max)) continue;
    if (woundCount >= entry.min && woundCount <= entry.max) return entry.key;
  }
  return PANEL_WOUND_STATE_KEYS[0];
}

function formatPanelWoundRangeText(entry) {
  if (!entry) return "";
  if (Number.isFinite(entry.min) && Number.isFinite(entry.max)) {
    if (entry.min === entry.max) return `${entry.min}`;
    return `${entry.min}-${entry.max}`;
  }
  return "any";
}

export function updatePanelWoundActionIndicator(panelElement, actor, {
  woundIconSrc,
  escapeHtml
} = {}) {
  if (!(panelElement instanceof HTMLElement)) return;
  const indicatorElement = panelElement.querySelector("[data-wound-action-indicator]");
  if (!(indicatorElement instanceof HTMLElement)) return;
  let indicatorImage = indicatorElement.querySelector(".tow-combat-overlay-control-panel__wound-action-indicator-image");
  if (!(indicatorImage instanceof HTMLImageElement)) {
    indicatorImage = document.createElement("img");
    indicatorImage.classList.add("tow-combat-overlay-control-panel__wound-action-indicator-image");
    indicatorImage.alt = "";
    indicatorImage.src = "";
    indicatorElement.replaceChildren(indicatorImage);
  }

  const htmlEscape = (typeof escapeHtml === "function") ? escapeHtml : (value) => String(value ?? "");
  const entries = getPanelWoundStateEntries(actor, woundIconSrc).filter((entry) => !!entry.action);
  if (!entries.length) {
    indicatorElement.style.display = "none";
    indicatorImage.src = "";
    indicatorImage.alt = "";
    indicatorElement.classList.remove("is-active");
    indicatorElement.dataset.tooltipTitle = "";
    indicatorElement.dataset.tooltipDescription = "";
    indicatorElement.setAttribute("aria-hidden", "true");
    return;
  }

  const woundCount = getPanelActorWoundCount(actor);
  const currentKey = resolvePanelCurrentWoundStateKey(actor, woundCount, entries);
  const currentEntry = entries.find((entry) => entry.key === currentKey) ?? entries[0];
  const currentLabel = String(currentEntry?.label ?? "Wound action").trim();

  const lines = entries.map((entry) => {
    const range = formatPanelWoundRangeText(entry);
    const prefix = entry.key === currentKey ? "<strong>&#9656; </strong>" : "";
    return `${prefix}<strong>${htmlEscape(entry.label)}</strong> (${htmlEscape(range)}): ${htmlEscape(entry.action)}`;
  });

  indicatorImage.src = String(currentEntry?.image ?? woundIconSrc);
  indicatorImage.alt = currentLabel;
  indicatorElement.style.display = "inline-flex";
  indicatorElement.classList.toggle("is-active", currentKey !== "unwounded");
  indicatorElement.dataset.tooltipTitle = "Wound Actions";
  indicatorElement.dataset.tooltipDescription = lines.join("<br>");
  indicatorElement.setAttribute("aria-hidden", "false");
}

export function getConditionTooltipData(conditionId) {
  const key = String(conditionId ?? "").trim();
  if (!key) return null;
  const condition = game.oldworld?.config?.conditions?.[key] ?? {};
  const rawName = String(condition?.name ?? key);
  const rawDescription = String(condition?.description ?? "");
  const name = rawName.startsWith("TOW.")
    ? towCombatOverlayLocalizeSystemKey(rawName, towCombatOverlayResolveConditionLabel(key))
    : rawName;
  const localizedDescription = rawDescription.startsWith("TOW.")
    ? towCombatOverlayLocalizeSystemKey(rawDescription, rawDescription)
    : rawDescription;
  const shortDescription = localizedDescription
    ? (localizedDescription.split(/(?<=[.!?])\s+/)[0] ?? localizedDescription).trim()
    : "";
  const clickHint = "<em>Left click: toggle this condition.</em>";
  return {
    title: String(name || MODULE_TOOLTIPS?.conditionTitle || "Condition"),
    description: shortDescription ? `${clickHint}<br><br>${shortDescription}` : clickHint
  };
}
