export function createSpellDirectTestPatchScope({ createTowCombatOverlayRollContext } = {}) {
  let directTestPatchInstalled = false;
  let directTestPatchOriginalFromData = null;
  let directTestPatchNextContextId = 1;
  const directTestPatchContexts = new Map();

  function resolveActorRefsFromTestData(sourceData = {}) {
    return [
      String(sourceData?.actor?.id ?? "").trim(),
      String(sourceData?.actor?.uuid ?? "").trim(),
      String(sourceData?.speaker?.actor ?? "").trim(),
      String(sourceData?.context?.actor ?? "").trim()
    ].filter(Boolean);
  }

  function installDirectTestPatch(OldWorldTestClass) {
    if (!OldWorldTestClass || directTestPatchInstalled) return;
    const originalFromData = OldWorldTestClass?.fromData;
    if (typeof originalFromData !== "function") return;

    directTestPatchOriginalFromData = originalFromData;
    OldWorldTestClass.fromData = function patchedTowCombatOverlaySpellApplyFromData(data, ...args) {
      const sourceData = data && typeof data === "object" ? data : {};
      const refs = resolveActorRefsFromTestData(sourceData);
      let resolvedActor = null;

      for (const context of directTestPatchContexts.values()) {
        for (const ref of refs) {
          const actor = context.actorMap.get(ref);
          if (!actor) continue;
          resolvedActor = actor;
          break;
        }
        if (resolvedActor) break;
      }

      if (!resolvedActor) {
        return directTestPatchOriginalFromData.call(this, data, ...args);
      }

      const rollFields = createTowCombatOverlayRollContext(resolvedActor).fields ?? {};
      const nextData = foundry.utils.deepClone(sourceData);
      const existingBonus = Number(nextData?.bonus ?? NaN);
      const existingPenalty = Number(nextData?.penalty ?? NaN);

      if ((!Number.isFinite(existingBonus) || existingBonus === 0) && Number(rollFields.bonus ?? 0) !== 0) {
        nextData.bonus = Number(rollFields.bonus ?? 0);
      }
      if ((!Number.isFinite(existingPenalty) || existingPenalty === 0) && Number(rollFields.penalty ?? 0) !== 0) {
        nextData.penalty = Number(rollFields.penalty ?? 0);
      }

      return directTestPatchOriginalFromData.call(this, nextData, ...args);
    };
    directTestPatchInstalled = true;
  }

  function maybeRestoreDirectTestPatch(OldWorldTestClass) {
    if (!directTestPatchInstalled || directTestPatchContexts.size > 0) return;
    if (!OldWorldTestClass || typeof directTestPatchOriginalFromData !== "function") return;
    if (OldWorldTestClass.fromData !== directTestPatchOriginalFromData) {
      OldWorldTestClass.fromData = directTestPatchOriginalFromData;
    }
    directTestPatchInstalled = false;
    directTestPatchOriginalFromData = null;
  }

  async function withPatchedDirectTests(actors, callback) {
    const actorMap = new Map();
    for (const actor of Array.isArray(actors) ? actors : []) {
      const actorId = String(actor?.id ?? "").trim();
      const actorUuid = String(actor?.uuid ?? "").trim();
      if (actorId) actorMap.set(actorId, actor);
      if (actorUuid) actorMap.set(actorUuid, actor);
    }

    const OldWorldTestClass = game?.oldworld?.config?.rollClasses?.OldWorldTest
      ?? game?.oldworld?.config?.OldWorldTest
      ?? null;
    if (!OldWorldTestClass || typeof OldWorldTestClass?.fromData !== "function") {
      return callback();
    }

    installDirectTestPatch(OldWorldTestClass);
    const contextId = `ctx-${directTestPatchNextContextId++}`;
    directTestPatchContexts.set(contextId, { actorMap });

    try {
      return await callback();
    } finally {
      directTestPatchContexts.delete(contextId);
      maybeRestoreDirectTestPatch(OldWorldTestClass);
    }
  }

  return {
    withPatchedDirectTests
  };
}
