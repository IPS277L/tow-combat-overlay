export async function withPatchedPanelActionSkillTestContext(actor, callback, {
  createRollContext
} = {}) {
  if (!actor || typeof callback !== "function") return callback?.();
  if (typeof actor.setupSkillTest !== "function") return callback();
  if (typeof createRollContext !== "function") return callback();

  const originalSetupSkillTest = actor.setupSkillTest;
  const boundOriginal = originalSetupSkillTest.bind(actor);
  const patchedSetupSkillTest = function patchedTowCombatOverlayActionSkillTest(skill, context = {}) {
    return boundOriginal(skill, createRollContext(actor, context));
  };
  actor.setupSkillTest = patchedSetupSkillTest;

  try {
    return await callback();
  } finally {
    if (actor.setupSkillTest === patchedSetupSkillTest) {
      actor.setupSkillTest = originalSetupSkillTest;
    }
  }
}
