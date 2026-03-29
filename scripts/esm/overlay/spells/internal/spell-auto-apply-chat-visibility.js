import { collectActorReferenceSet } from "../../shared/actor-reference-helpers.js";

function resolveCreateDataActorRefs(data = {}) {
  const refs = new Set();
  const add = (value) => {
    const next = String(value ?? "").trim();
    if (next) refs.add(next);
  };

  add(data?.speaker?.actor);
  add(data?.system?.test?.context?.actor);
  add(data?.system?.context?.actor);
  add(data?.system?.actor?.id);
  add(data?.system?.actor?.uuid);
  return refs;
}

export async function withScopedInheritedChatVisibility(
  sourceMessage,
  affectedActors,
  callback,
  { towCombatOverlayApplyRollVisibility } = {}
) {
  const applyVisibility = towCombatOverlayApplyRollVisibility;
  if (!sourceMessage || typeof applyVisibility !== "function") return callback();

  const sourceUserId = String(
    sourceMessage?.author?.id
    ?? sourceMessage?.user?.id
    ?? sourceMessage?.user
    ?? ""
  ).trim();
  const actorRefs = collectActorReferenceSet(affectedActors);
  const hookId = Hooks.on("preCreateChatMessage", (messageDoc, createData, _options, userId) => {
    const creatingUserId = String(userId ?? "").trim();
    if (sourceUserId && creatingUserId && creatingUserId !== sourceUserId) return;

    if (actorRefs.size > 0) {
      const messageActorRefs = resolveCreateDataActorRefs(createData);
      const matchesActor = Array.from(messageActorRefs).some((ref) => actorRefs.has(ref));
      if (!matchesActor) return;
    }

    const updateData = {};
    applyVisibility(updateData, {
      sourceMessage,
      censorForUnauthorized: true
    });
    if (!Object.keys(updateData).length) return;
    messageDoc.updateSource(updateData);
  });

  try {
    return await callback();
  } finally {
    Hooks.off("preCreateChatMessage", hookId);
  }
}
