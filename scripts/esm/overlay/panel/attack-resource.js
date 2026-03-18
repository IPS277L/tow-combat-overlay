export function createPanelAttackResourceService({
  towCombatOverlayArmAutoSubmitDialog,
  armApplyRollModifiersToNextTestDialog,
  withPatchedActionSkillTestContext,
  getTowCombatOverlaySystemAdapter,
  createTowCombatOverlayRollContext,
  resolvePanelAttackAmmoState,
  writePanelAttackAmmoState
} = {}) {
  function armAutoSubmitReloadTestDialog(actor) {
    towCombatOverlayArmAutoSubmitDialog({
      hookName: "renderTestDialog",
      matches: (app) => app?.actor?.id === actor?.id && String(app?.skill ?? "").trim().toLowerCase() === "dexterity",
      submitErrorMessage: "Reload test submit() is unavailable."
    });
  }

  async function rollPanelReloadForAttack(actor, attackItem) {
    if (!actor || !attackItem) return 0;
    armApplyRollModifiersToNextTestDialog(actor, {
      matches: (app) => app?.actor?.id === actor?.id && String(app?.skill ?? "").trim().toLowerCase() === "dexterity"
    });
    armAutoSubmitReloadTestDialog(actor);

    let test = null;
    if (typeof attackItem?.system?.rollReloadTest === "function") {
      test = await withPatchedActionSkillTestContext(actor, () => attackItem.system.rollReloadTest(actor));
    } else {
      test = await getTowCombatOverlaySystemAdapter().setupSkillTest(
        actor,
        "dexterity",
        createTowCombatOverlayRollContext(actor, { appendTitle: ` - Reloading ${String(attackItem?.name ?? "Weapon")}` })
      );
    }

    const rawSuccesses = Number(test?.result?.successes ?? 0);
    return Number.isFinite(rawSuccesses) ? Math.max(0, Math.trunc(rawSuccesses)) : 0;
  }

  async function ensurePanelAttackResourceStateBeforeUse(actor, attackItem) {
    const state = resolvePanelAttackAmmoState(attackItem);
    if (!state.isRanged || !state.usesReloadFlow) return { blocked: false, state };

    if (state.current > 0) {
      await writePanelAttackAmmoState(attackItem, { current: state.current - 1 });
      return { blocked: false, state: { ...state, current: state.current - 1 } };
    }

    const gainedSuccesses = await rollPanelReloadForAttack(actor, attackItem);
    const newProgress = Math.max(0, Math.min(state.reloadTarget, state.reloadProgress + gainedSuccesses));
    const completedReload = newProgress >= state.reloadTarget;
    if (completedReload) {
      await writePanelAttackAmmoState(attackItem, {
        current: state.ammoMax,
        reloadProgress: 0
      });
      return {
        blocked: true,
        reloaded: true,
        state: { ...state, current: state.ammoMax, reloadProgress: 0 }
      };
    }

    await writePanelAttackAmmoState(attackItem, {
      current: 0,
      reloadProgress: newProgress
    });
    return {
      blocked: true,
      reloaded: false,
      state: { ...state, current: 0, reloadProgress: newProgress }
    };
  }

  return {
    armAutoSubmitReloadTestDialog,
    rollPanelReloadForAttack,
    ensurePanelAttackResourceStateBeforeUse
  };
}
