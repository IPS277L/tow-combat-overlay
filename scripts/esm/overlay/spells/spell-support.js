import { SPELL_SELF_TARGET_VALUES } from "./spell-targeting-constants.js";

export function createPanelSpellSupportService({
  towCombatOverlayArmAutoSubmitDialog,
  getTowCombatOverlayActorRollModifierFields
} = {}) {
  let panelItemUseRollCompatibilityPatched = false;

  function armAutoResolveSpellTriggeredTestDialogs(sourceActor = null, {
    timeoutMs = 20000,
    matches = null
  } = {}) {
    const sourceActorId = String(sourceActor?.id ?? "").trim();
    const sourceActorUuid = String(sourceActor?.uuid ?? "").trim();

    return towCombatOverlayArmAutoSubmitDialog({
      hookName: "renderTestDialog",
      matches: (app) => {
        if (!app || app._towCombatOverlaySpellAutoResolved === true) return false;
        if (typeof matches === "function" && !matches(app)) return false;

        if (sourceActorId || sourceActorUuid) {
          const appActorId = String(app?.actor?.id ?? "").trim();
          const appActorUuid = String(app?.actor?.uuid ?? app?.context?.actor ?? "").trim();
          const actorMatchesSource = (sourceActorId && appActorId === sourceActorId)
            || (sourceActorUuid && appActorUuid === sourceActorUuid);
          if (!actorMatchesSource && typeof matches !== "function") return false;
        }

        app._towCombatOverlaySpellAutoResolved = true;
        return true;
      },
      submitErrorMessage: "TestDialog.submit() is unavailable.",
      beforeSubmit: async (app) => {
        // Spell apply handlers can open follow-up tests where app.actor is not the
        // original spell caster, but the caster's panel roll state should still drive
        // the auto-triggered spell test flow.
        const actor = sourceActor ?? app?.actor ?? null;
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
    const requiresPick = !targetValue || !SPELL_SELF_TARGET_VALUES.includes(targetValue);
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

