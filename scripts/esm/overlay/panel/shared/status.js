import { getTowCombatOverlayConstants } from "../../../runtime/module-constants.js";
import { towCombatOverlayLocalizeSystemKey, towCombatOverlayResolveConditionLabel } from "../../shared/shared.js";
import { getOverlayWoundIndicatorData } from "../../shared/wound-chip-data.js";

const { tooltips: MODULE_TOOLTIPS } = getTowCombatOverlayConstants();

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
  const indicatorData = getOverlayWoundIndicatorData(actor, { woundIconSrc, escapeHtml: htmlEscape });
  if (!indicatorData) {
    indicatorElement.style.display = "none";
    indicatorImage.src = "";
    indicatorImage.alt = "";
    indicatorElement.classList.remove("is-active");
    indicatorElement.dataset.tooltipTitle = "";
    indicatorElement.dataset.tooltipDescription = "";
    indicatorElement.setAttribute("aria-hidden", "true");
    return;
  }

  indicatorImage.src = String(indicatorData.image ?? "");
  indicatorImage.alt = String(indicatorData.label ?? "");
  indicatorElement.style.display = "inline-flex";
  indicatorElement.classList.toggle("is-active", indicatorData.isActive === true);
  indicatorElement.dataset.tooltipTitle = String(indicatorData.title ?? "").trim();
  indicatorElement.dataset.tooltipDescription = String(indicatorData.description ?? "");
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
  const clickHint = localizeMaybe("TOWCOMBATOVERLAY.Tooltip.Panel.ConditionToggleHint", "<em>Left click: toggle this condition.</em>");
  return {
    title: String(name || MODULE_TOOLTIPS?.conditionTitle || localizeMaybe("TOWCOMBATOVERLAY.Label.Condition", "Condition")),
    description: shortDescription ? `${clickHint}<br><br>${shortDescription}` : clickHint
  };
}


