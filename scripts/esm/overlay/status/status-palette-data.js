import {
  towCombatOverlayLocalizeSystemKey,
  towCombatOverlayResolveConditionLabel
} from "../shared/shared.js";

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
