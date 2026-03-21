import {
  towCombatOverlayLocalizeSystemKey,
  towCombatOverlayResolveConditionLabel
} from "../shared/shared.js";
import { resolveTemporaryEffectDescription } from "../panel/shared/description.js";
import { getOverlayWoundIndicatorData } from "../shared/wound-chip-data.js";

export function getIconSrc(displayObject) {
  return (
    displayObject?.texture?.baseTexture?.resource?.source?.src ||
    displayObject?.texture?.baseTexture?.resource?.url ||
    displayObject?.texture?.baseTexture?.resource?.src ||
    ""
  );
}

export function normalizeIconSrc(src) {
  return String(src ?? "").trim().toLowerCase().split("?")[0];
}

export function getActorEffects(actor) {
  return Array.from(actor?.effects?.contents ?? []);
}

export function getActorStatusSet(actor) {
  const statuses = new Set(Array.from(actor?.statuses ?? []).map((s) => String(s)));
  for (const effect of getActorEffects(actor)) {
    for (const status of Array.from(effect?.statuses ?? [])) statuses.add(String(status));
  }
  return statuses;
}

export function getActorEffectsByStatus(actor, conditionId) {
  const id = String(conditionId ?? "");
  if (!id) return [];
  return getActorEffects(actor).filter((effect) => Array.from(effect?.statuses ?? []).map(String).includes(id));
}

export function getAllConditionEntries() {
  const conditions = game.oldworld?.config?.conditions ?? {};
  return Object.entries(conditions)
    .map(([id, data]) => ({
      id: String(id),
      img: String(data?.img ?? data?.icon ?? `/systems/whtow/assets/icons/conditions/${id}.svg`)
    }))
    .filter((entry) => !!entry.id && !!entry.img);
}

export function getConditionTooltipData(conditionId) {
  const condition = game.oldworld?.config?.conditions?.[String(conditionId ?? "")] ?? {};
  const rawName = String(condition?.name ?? conditionId ?? "Condition");
  const rawDescription = String(condition?.description ?? "");
  const name = rawName.startsWith("TOW.")
    ? towCombatOverlayLocalizeSystemKey(rawName, towCombatOverlayResolveConditionLabel(conditionId))
    : rawName;
  const localizedDescription = rawDescription.startsWith("TOW.")
    ? towCombatOverlayLocalizeSystemKey(rawDescription, rawDescription)
    : rawDescription;
  const shortDescription = localizedDescription
    ? (localizedDescription.split(/(?<=[.!?])\s+/)[0] ?? localizedDescription).trim()
    : "";
  return { name: String(name ?? conditionId ?? "Condition"), description: String(shortDescription ?? "") };
}

export function getTemporaryEffectEntries(actor) {
  if (!actor) return [];
  const conditionKeys = new Set(
    Object.keys(game?.oldworld?.config?.conditions ?? {}).map((key) => String(key ?? "").toLowerCase())
  );

  return getActorEffects(actor)
    .filter((effect) => {
      if (!effect) return false;
      if (effect.disabled || effect.isSuppressed) return false;
      if (effect.transfer) return false;
      const statuses = Array.from(effect.statuses ?? []).map((status) => String(status ?? "").toLowerCase());
      if (statuses.some((status) => conditionKeys.has(status))) return false;
      return true;
    })
    .sort((left, right) => Number(left?.sort ?? 0) - Number(right?.sort ?? 0))
    .map((effect) => {
      const id = String(effect?.id ?? "");
      const name = String(effect?.name ?? "Effect").trim() || "Effect";
      const description = resolveTemporaryEffectDescription(effect) || "No description.";
      const img = String(effect?.img ?? effect?.icon ?? "icons/svg/aura.svg").trim();
      return {
        id,
        key: `effect:${id}`,
        name,
        description,
        img
      };
    });
}

export function getWoundsAbilityEntry(actor) {
  if (!actor) return null;
  const woundIndicatorData = getOverlayWoundIndicatorData(actor);
  if (!woundIndicatorData) return null;
  if (woundIndicatorData.isActive !== true) return null;
  return {
    id: "__wound_actions__",
    key: "ability:wound-actions",
    name: String(woundIndicatorData.title ?? "Wounds").trim(),
    description: String(woundIndicatorData.description ?? "No description.").trim(),
    img: String(woundIndicatorData.image ?? "").trim(),
    isActive: woundIndicatorData.isActive === true
  };
}
