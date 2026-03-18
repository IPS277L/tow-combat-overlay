export function createPanelActionControlsService({
  getTowCombatOverlayActorRollModifierState,
  getTowCombatOverlayActorRollModifierStateLabel,
  setTowCombatOverlayActorRollModifierState,
  adjustTowCombatOverlayActorRollModifierDice,
  cycleTowCombatOverlayActorRollState,
  towCombatOverlayCanEditActor,
  towCombatOverlayWarnNoPermission,
  towCombatOverlayIsCtrlModifier,
  bindPanelTooltipEvent,
  getPrimaryTokenTypeLabel,
  getSingleControlledActor
} = {}) {
  function getDiceModifierTooltipData() {
    const actor = getSingleControlledActor();
    const state = getTowCombatOverlayActorRollModifierState(actor);
    const value = `${state.diceModifier >= 0 ? "+" : ""}${state.diceModifier}d10`;
    return {
      title: "Dice Modifier",
      description: `<em>Left click: +1d10 · Right click: -1d10 · Ctrl+click: reset to +0d10</em><br><br>Current: ${value}`
    };
  }

  function getRollStateTooltipData() {
    const actor = getSingleControlledActor();
    const state = getTowCombatOverlayActorRollModifierState(actor);
    const label = getTowCombatOverlayActorRollModifierStateLabel(state);
    return {
      title: "Roll State",
      description: `<em>Left click: next state · Right click: previous state · Ctrl+click: set Common</em><br><br>Current: ${label}`
    };
  }

  function formatActionDiceLabel(actor) {
    const state = getTowCombatOverlayActorRollModifierState(actor);
    const value = Number(state?.diceModifier ?? 0);
    return `${value >= 0 ? "+" : ""}${Math.trunc(value)}d10`;
  }

  function formatActionRollStateLabel(actor) {
    const key = String(getTowCombatOverlayActorRollModifierState(actor)?.rollState ?? "normal").toLowerCase();
    if (key === "grim") return "Grim";
    if (key === "glorious") return "Glorious";
    return "Common";
  }

  function updateActionControlsDisplay(panelElement, token = null) {
    const actor = token?.actor ?? token?.document?.actor ?? null;
    const typeLabels = Array.from(panelElement.querySelectorAll("[data-action-label='tokenType']"));
    const diceLabels = Array.from(panelElement.querySelectorAll("[data-action-label='diceModifier']"));
    const rollStateLabels = Array.from(panelElement.querySelectorAll("[data-action-label='rollState']"));
    for (const typeLabel of typeLabels) {
      if (!(typeLabel instanceof HTMLElement)) continue;
      typeLabel.textContent = token ? getPrimaryTokenTypeLabel(token) : "-";
    }
    for (const diceLabel of diceLabels) {
      if (!(diceLabel instanceof HTMLElement)) continue;
      diceLabel.textContent = actor ? formatActionDiceLabel(actor) : "-";
    }
    for (const rollStateLabel of rollStateLabels) {
      if (!(rollStateLabel instanceof HTMLElement)) continue;
      rollStateLabel.textContent = actor ? formatActionRollStateLabel(actor) : "-";
    }
  }

  function bindPanelActionControls(panelElement, { onUpdated } = {}) {
    const actionButtons = Array.from(panelElement.querySelectorAll("[data-action-control]"));
    if (!actionButtons.length) return;

    const withEditableSingleActor = async (runAction) => {
      const actor = getSingleControlledActor();
      if (!actor) return;
      if (!towCombatOverlayCanEditActor(actor)) {
        towCombatOverlayWarnNoPermission(actor);
        return;
      }
      await runAction(actor);
      if (typeof onUpdated === "function") onUpdated();
    };

    for (const button of actionButtons) {
      if (!(button instanceof HTMLElement)) continue;
      const control = String(button.dataset.actionControl ?? "");
      if (control === "diceModifier") bindPanelTooltipEvent(button, getDiceModifierTooltipData);
      if (control === "rollState") bindPanelTooltipEvent(button, getRollStateTooltipData);

      button.addEventListener("click", async (event) => {
        event.preventDefault();
        if (control === "diceModifier") {
          if (towCombatOverlayIsCtrlModifier(event)) {
            await withEditableSingleActor((actor) => setTowCombatOverlayActorRollModifierState(actor, {
              ...getTowCombatOverlayActorRollModifierState(actor),
              diceModifier: 0
            }));
            return;
          }
          await withEditableSingleActor((actor) => adjustTowCombatOverlayActorRollModifierDice(actor, 1));
          return;
        }
        if (control === "rollState") {
          if (towCombatOverlayIsCtrlModifier(event)) {
            await withEditableSingleActor((actor) => setTowCombatOverlayActorRollModifierState(actor, {
              ...getTowCombatOverlayActorRollModifierState(actor),
              rollState: "normal"
            }));
            return;
          }
          await withEditableSingleActor((actor) => cycleTowCombatOverlayActorRollState(actor, 1));
        }
      });

      button.addEventListener("contextmenu", async (event) => {
        event.preventDefault();
        if (control === "diceModifier") {
          await withEditableSingleActor((actor) => adjustTowCombatOverlayActorRollModifierDice(actor, -1));
          return;
        }
        if (control === "rollState") {
          await withEditableSingleActor((actor) => cycleTowCombatOverlayActorRollState(actor, -1));
        }
      });
    }
  }

  return {
    getDiceModifierTooltipData,
    getRollStateTooltipData,
    updateActionControlsDisplay,
    bindPanelActionControls
  };
}
