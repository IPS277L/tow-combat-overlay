export function createPanelConditionToggleService({
  moduleKey,
  runActorOpLock,
  canEditActor,
  warnNoPermission,
  addActorCondition,
  removeActorCondition,
  getActorStatusSet,
  getActorEffectsByStatus
} = {}) {
  async function setActorConditionState(actor, conditionId, active) {
    if (!actor || !conditionId) return;
    const id = String(conditionId);
    if (id !== "staggered" && typeof actor.toggleStatusEffect === "function") {
      try {
        await actor.toggleStatusEffect(id, { active });
        return;
      } catch (_error) {
        // Fall through to adapter-driven methods.
      }
    }
    if (active) await addActorCondition(actor, id);
    else await removeActorCondition(actor, id);
  }

  async function toggleConditionFromPanel(actor, conditionId) {
    if (!actor || !conditionId) return;
    if (!canEditActor(actor)) {
      warnNoPermission(actor);
      return;
    }
    const id = String(conditionId);
    const applyToggle = async () => {
      const active = getActorStatusSet(actor).has(id);
      if (!active) {
        await setActorConditionState(actor, id, true);
        return;
      }
      await setActorConditionState(actor, id, false);
      for (let i = 0; i < 4; i++) {
        if (!getActorStatusSet(actor).has(id)) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      for (const effect of getActorEffectsByStatus(actor, id)) {
        const liveEffect = effect?.id ? actor.effects?.get?.(effect.id) : null;
        if (liveEffect) await liveEffect.delete();
      }
    };

    if (game?.[moduleKey]) {
      await runActorOpLock(actor, `condition:${id}`, applyToggle);
      return;
    }
    await applyToggle();
  }

  return {
    toggleConditionFromPanel
  };
}

