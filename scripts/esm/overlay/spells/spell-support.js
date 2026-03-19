export function createPanelSpellSupportService({
  towCombatOverlayArmAutoSubmitDialog,
  getTowCombatOverlayActorRollModifierFields
} = {}) {
  let panelItemUseRollCompatibilityPatched = false;

  function armAutoResolveSpellTriggeredTestDialogs({ timeoutMs = 20000 } = {}) {
    return towCombatOverlayArmAutoSubmitDialog({
      hookName: "renderTestDialog",
      matches: (app) => {
        if (!app || app._towCombatOverlaySpellAutoResolved === true) return false;
        app._towCombatOverlaySpellAutoResolved = true;
        return true;
      },
      submitErrorMessage: "TestDialog.submit() is unavailable.",
      beforeSubmit: async (app) => {
        const actor = app?.actor ?? null;
        const rollFields = getTowCombatOverlayActorRollModifierFields(actor);
        app.userEntry ??= {};
        app.fields ??= {};
        for (const [key, value] of Object.entries(rollFields)) {
          const numericValue = Number(value ?? 0);
          app.userEntry[key] = numericValue;
          app.fields[key] = numericValue;
        }
      },
      timeoutMs: Math.max(250, Number(timeoutMs) || 0)
    });
  }

  function ensurePanelItemUseRollCompatibility() {
    if (panelItemUseRollCompatibilityPatched) return;
    const ItemUseClass = game?.oldworld?.config?.rollClasses?.ItemUse;
    const originalRoll = ItemUseClass?.prototype?.roll;
    if (!ItemUseClass || typeof originalRoll !== "function") return;
    ItemUseClass.prototype.roll = async function patchedTowCombatOverlayItemUseRoll(...args) {
      const result = await originalRoll.apply(this, args);
      if (!this?._roll) {
        try {
          this._roll = await new Roll("0").roll();
        } catch (_error) {
          // Best-effort compatibility patch only.
        }
      }
      return result;
    };
    panelItemUseRollCompatibilityPatched = true;
  }

  function spellRequiresTargetPick(spell) {
    const targetValue = String(spell?.system?.target?.value ?? "").trim().toLowerCase();
    const SELF_TARGET_KEYS = new Set(["self", "you"]);
    const requiresPick = !targetValue || !SELF_TARGET_KEYS.has(targetValue);
    return requiresPick;
  }

  function spellTargetsSelf(spell) {
    const targetValue = String(spell?.system?.target?.value ?? "").trim().toLowerCase();
    return targetValue === "self" || targetValue === "you";
  }

  function resolveActorMiscastState(actor) {
    const currentRaw = Number(actor?.system?.magic?.miscasts ?? NaN);
    const current = Number.isFinite(currentRaw) ? Math.max(0, Math.trunc(currentRaw)) : 0;
    const maxRaw = Number(actor?.system?.magic?.level ?? NaN);
    const max = Number.isFinite(maxRaw) ? Math.max(0, Math.trunc(maxRaw)) : 0;
    return {
      current,
      max,
      atLimit: max > 0 && current >= max
    };
  }

  return {
    armAutoResolveSpellTriggeredTestDialogs,
    ensurePanelItemUseRollCompatibility,
    spellRequiresTargetPick,
    spellTargetsSelf,
    resolveActorMiscastState
  };
}

