function addUniqueActor(actors, actor) {
  if (!actor) return;
  if (actors.some((entry) => entry === actor || String(entry?.uuid ?? "") === String(actor?.uuid ?? ""))) return;
  actors.push(actor);
}

export function resolveActorFromReference(reference) {
  const value = String(reference ?? "").trim();
  if (!value) return null;

  const actorById = game?.actors?.get?.(value) ?? null;
  if (actorById) return actorById;

  const tokenById = canvas?.tokens?.get?.(value)
    ?? canvas?.tokens?.placeables?.find?.((token) => String(token?.id ?? "").trim() === value)
    ?? null;
  return tokenById?.actor ?? tokenById?.document?.actor ?? null;
}

export function collectMessageTargetActors(rawTargets) {
  const actors = [];

  if (Array.isArray(rawTargets)) {
    for (const entry of rawTargets) {
      addUniqueActor(actors, resolveActorFromReference(
        entry?.actor
        ?? entry?.actorId
        ?? entry?.token
        ?? entry?.tokenId
        ?? entry?.id
        ?? entry
      ));
    }
    return actors;
  }

  if (rawTargets instanceof Set) {
    for (const entry of rawTargets) addUniqueActor(actors, resolveActorFromReference(entry?.id ?? entry));
    return actors;
  }

  if (rawTargets && typeof rawTargets === "object") {
    for (const [key, value] of Object.entries(rawTargets)) {
      addUniqueActor(actors, resolveActorFromReference(
        value?.actor
        ?? value?.actorId
        ?? value?.token
        ?? value?.tokenId
        ?? value?.id
        ?? key
      ));
    }
  }

  return actors;
}

export function collectPotentialApplyActors(message, dataset = {}) {
  const actors = [];
  addUniqueActor(actors, resolveActorFromReference(
    message?.speaker?.actor
    ?? message?.system?.test?.context?.actor
    ?? message?.system?.context?.actor
  ));

  const targetCandidates = [
    message?.system?.test?.context?.targets,
    message?.system?.context?.targets,
    message?.system?.test?.targets,
    message?.system?.targets
  ];
  for (const rawTargets of targetCandidates) {
    for (const actor of collectMessageTargetActors(rawTargets)) addUniqueActor(actors, actor);
  }

  for (const [key, value] of Object.entries(dataset ?? {})) {
    const lowerKey = String(key ?? "").trim().toLowerCase();
    if (!lowerKey || lowerKey === "action") continue;
    if (!/(actor|token|target)/i.test(lowerKey)) continue;
    addUniqueActor(actors, resolveActorFromReference(value));
  }

  for (const token of Array.from(game?.user?.targets ?? [])) {
    addUniqueActor(actors, token?.actor ?? token?.document?.actor ?? null);
  }

  return actors;
}

export function collectActorReferenceSet(actors = []) {
  const refs = new Set();
  for (const actor of Array.isArray(actors) ? actors : []) {
    const actorId = String(actor?.id ?? "").trim();
    const actorUuid = String(actor?.uuid ?? "").trim();
    if (actorId) refs.add(actorId);
    if (actorUuid) refs.add(actorUuid);
  }
  return refs;
}

export function messageHasExplicitTargets(message) {
  const candidates = [
    message?.system?.test?.context?.targets,
    message?.system?.context?.targets,
    message?.system?.test?.targets,
    message?.system?.targets
  ];
  return candidates.some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value instanceof Set || value instanceof Map) return value.size > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return false;
  });
}
