export function createPanelStatsStatusBindingsService({
  moduleTooltips,
  getSingleControlledToken,
  getControlPanelState,
  updateSelectionDisplay,
  getTypeTooltipData,
  bindPanelTooltipEvent,
  getConditionTooltipData,
  toggleConditionFromPanel,
  updateStatusDisplay,
  getPrimaryTokenName,
  getPrimaryTokenTypeLabel,
  towCombatOverlayGetActorWoundItemCount,
  towCombatOverlayAddActorWound,
  towCombatOverlayRemoveWound,
  towCombatOverlayAddWound,
  towCombatOverlayIsShiftModifier,
  towCombatOverlayIsCtrlModifier
} = {}) {
  function localize(key, fallback = "") {
    const localized = game?.i18n?.localize?.(String(key ?? ""));
    if (typeof localized === "string" && localized !== key) return localized;
    return String(fallback ?? key ?? "");
  }

  function format(key, data = {}, fallback = "") {
    const formatted = game?.i18n?.format?.(String(key ?? ""), data);
    if (typeof formatted === "string" && formatted !== key) return formatted;
    return String(fallback ?? key ?? "");
  }

  function getPanelStatTooltipData(statKey) {
    const key = String(statKey ?? "").trim();
    if (!key) return null;

    if (key === "tokenType") {
      const token = getSingleControlledToken();
      if (token?.actor || token?.document?.actor) return getTypeTooltipData(token.actor ?? token.document.actor);
      return {
        title: localize("TOWCOMBATOVERLAY.Tooltip.Panel.TokenType.Title", "Type"),
        description: moduleTooltips.actorType.defaultDescription
      };
    }
    if (key === "resilience") return moduleTooltips.resilience;
    if (key === "wounds") {
      const title = String(moduleTooltips?.wounds?.title ?? "Wounds");
      const baseDescription = String(moduleTooltips?.wounds?.description ?? "").trim();
      const hint = localize(
        "TOWCOMBATOVERLAY.Tooltip.Panel.Wounds.InteractionHint",
        "<em>Left click: +1 wound &middot; Right click: -1 wound &middot; Shift+click: roll on wounds &middot; Ctrl+click: reset to 0</em>"
      );
      const cleanedBaseDescription = baseDescription
        .replace(/Left-?click adds 1 wound\.?\s*Right-?click removes 1 wound\.?/gi, "")
        .trim();
      const description = cleanedBaseDescription ? `${hint}<br><br>${cleanedBaseDescription}` : hint;
      return { title, description };
    }
    if (key === "speed") return moduleTooltips.speed;
    if (key === "miscastDice") {
      const title = String(moduleTooltips?.miscastDice?.title ?? "Miscast Dice");
      const baseDescription = String(moduleTooltips?.miscastDice?.description ?? "").trim();
      const hint = localize(
        "TOWCOMBATOVERLAY.Tooltip.Panel.MiscastDice.InteractionHint",
        "<em>Left click: +1 die &middot; Right click: -1 die &middot; Shift+click: roll miscast table &middot; Ctrl+click: reset to 0</em>"
      );
      const description = baseDescription ? `${hint}<br><br>${baseDescription}` : hint;
      return { title, description };
    }
    return null;
  }

  function bindPanelStatsTooltipEvents(panelElement) {
    const statRows = Array.from(panelElement.querySelectorAll(".tow-combat-overlay-control-panel__stat-row[data-stat-row]"));
    for (const statRow of statRows) {
      if (!(statRow instanceof HTMLElement)) continue;
      const statKey = String(statRow.dataset.statRow ?? "");
      bindPanelTooltipEvent(statRow, () => getPanelStatTooltipData(statKey));
    }
  }

  function bindPanelWoundsStatEvents(panelElement) {
    const woundsRow = panelElement.querySelector(".tow-combat-overlay-control-panel__stat-row[data-stat-row='wounds']");
    if (!(woundsRow instanceof HTMLElement)) return;

    const resetActorWoundsToZero = async (actor) => {
      const maxPasses = Math.max(1, towCombatOverlayGetActorWoundItemCount(actor) + 5);
      for (let i = 0; i < maxPasses; i += 1) {
        const count = towCombatOverlayGetActorWoundItemCount(actor);
        if (count <= 0) break;
        await towCombatOverlayRemoveWound(actor);
      }
    };

    woundsRow.addEventListener("click", async (event) => {
      event.preventDefault();
      const token = getSingleControlledToken();
      const actor = token?.actor ?? token?.document?.actor ?? null;
      if (!actor) return;
      if (towCombatOverlayIsShiftModifier(event)) {
        await towCombatOverlayAddActorWound(actor, { roll: true });
        updateSelectionDisplay(panelElement);
        return;
      }
      if (towCombatOverlayIsCtrlModifier(event)) {
        await resetActorWoundsToZero(actor);
        updateSelectionDisplay(panelElement);
        return;
      }
      await towCombatOverlayAddWound(actor);
      updateSelectionDisplay(panelElement);
    });

    woundsRow.addEventListener("contextmenu", async (event) => {
      event.preventDefault();
      const token = getSingleControlledToken();
      const actor = token?.actor ?? token?.document?.actor ?? null;
      if (!actor) return;
      await towCombatOverlayRemoveWound(actor);
      updateSelectionDisplay(panelElement);
    });
  }

  function bindSelectionPanelStatEvents(selectionPanelElement) {
    if (!(selectionPanelElement instanceof HTMLElement)) return;
    const speedRow = selectionPanelElement.querySelector("[data-selection-stat-row='speed']");
    const resilienceRow = selectionPanelElement.querySelector("[data-selection-stat-row='resilience']");
    const woundsRow = selectionPanelElement.querySelector("[data-selection-stat-row='wounds']");
    const miscastDiceRow = selectionPanelElement.querySelector("[data-selection-stat-row='miscastDice']");

    if (speedRow instanceof HTMLElement) {
      bindPanelTooltipEvent(speedRow, () => getPanelStatTooltipData("speed"));
      speedRow.addEventListener("click", (event) => event.preventDefault());
      speedRow.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    if (resilienceRow instanceof HTMLElement) {
      bindPanelTooltipEvent(resilienceRow, () => getPanelStatTooltipData("resilience"));
      resilienceRow.addEventListener("click", (event) => event.preventDefault());
      resilienceRow.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    if (woundsRow instanceof HTMLElement) {
      bindPanelTooltipEvent(woundsRow, () => getPanelStatTooltipData("wounds"));
      const resetActorWoundsToZero = async (actor) => {
        const maxPasses = Math.max(1, towCombatOverlayGetActorWoundItemCount(actor) + 5);
        for (let i = 0; i < maxPasses; i += 1) {
          const count = towCombatOverlayGetActorWoundItemCount(actor);
          if (count <= 0) break;
          await towCombatOverlayRemoveWound(actor);
        }
      };
      woundsRow.addEventListener("click", async (event) => {
        event.preventDefault();
        const token = getSingleControlledToken();
        const actor = token?.actor ?? token?.document?.actor ?? null;
        if (!actor) return;
        if (towCombatOverlayIsShiftModifier(event)) {
          await towCombatOverlayAddActorWound(actor, { roll: true });
          const panelElement = getControlPanelState()?.element;
          if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
          return;
        }
        if (towCombatOverlayIsCtrlModifier(event)) {
          await resetActorWoundsToZero(actor);
          const panelElement = getControlPanelState()?.element;
          if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
          return;
        }
        await towCombatOverlayAddWound(actor);
        const panelElement = getControlPanelState()?.element;
        if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      });
      woundsRow.addEventListener("contextmenu", async (event) => {
        event.preventDefault();
        const token = getSingleControlledToken();
        const actor = token?.actor ?? token?.document?.actor ?? null;
        if (!actor) return;
        await towCombatOverlayRemoveWound(actor);
        const panelElement = getControlPanelState()?.element;
        if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      });
    }

    if (miscastDiceRow instanceof HTMLElement) {
      bindPanelTooltipEvent(miscastDiceRow, () => getPanelStatTooltipData("miscastDice"));
      miscastDiceRow.addEventListener("click", async (event) => {
        event.preventDefault();
        const token = getSingleControlledToken();
        const actor = token?.actor ?? token?.document?.actor ?? null;
        if (!actor || typeof actor.update !== "function") return;
        if (towCombatOverlayIsShiftModifier(event)) {
          if (typeof actor?.system?.rollMiscast === "function") {
            await actor.system.rollMiscast();
          }
          const panelElement = getControlPanelState()?.element;
          if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
          return;
        }
        if (towCombatOverlayIsCtrlModifier(event)) {
          await actor.update({ "system.magic.miscasts": 0 });
          const panelElement = getControlPanelState()?.element;
          if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
          return;
        }
        const currentRaw = Number(actor?.system?.magic?.miscasts ?? NaN);
        const current = Number.isFinite(currentRaw) ? Math.max(0, Math.trunc(currentRaw)) : 0;
        await actor.update({ "system.magic.miscasts": current + 1 });
        const panelElement = getControlPanelState()?.element;
        if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      });
      miscastDiceRow.addEventListener("contextmenu", async (event) => {
        event.preventDefault();
        const token = getSingleControlledToken();
        const actor = token?.actor ?? token?.document?.actor ?? null;
        if (!actor || typeof actor.update !== "function") return;
        const currentRaw = Number(actor?.system?.magic?.miscasts ?? NaN);
        const current = Number.isFinite(currentRaw) ? Math.max(0, Math.trunc(currentRaw)) : 0;
        await actor.update({ "system.magic.miscasts": Math.max(0, current - 1) });
        const panelElement = getControlPanelState()?.element;
        if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      });
    }
  }

  function bindSelectionNameTooltipEvent(selectionPanelElement) {
    if (!(selectionPanelElement instanceof HTMLElement)) return;
    const nameElement = selectionPanelElement.querySelector(".tow-combat-overlay-control-panel__selection-name");
    if (!(nameElement instanceof HTMLElement)) return;
    bindPanelTooltipEvent(nameElement, () => {
      const token = getSingleControlledToken();
      if (!token) return null;
      const tokenName = getPrimaryTokenName(token) || localize("TOWCOMBATOVERLAY.Tooltip.Panel.SelectionTokenFallbackName", "Token");
      const typeLabel = getPrimaryTokenTypeLabel(token) || "-";
      return {
        title: tokenName,
        description: format("TOWCOMBATOVERLAY.Tooltip.Panel.SelectionTypeDescription", { type: typeLabel }, `Type: ${typeLabel}`)
      };
    });
  }

  function bindPanelStatusesTooltipEvents(panelElement) {
    const statusElements = Array.from(panelElement.querySelectorAll(".tow-combat-overlay-control-panel__status-icon[data-status-id]"));
    for (const statusElement of statusElements) {
      if (!(statusElement instanceof HTMLElement)) continue;
      const conditionId = String(statusElement.dataset.statusId ?? "");
      bindPanelTooltipEvent(statusElement, () => getConditionTooltipData(conditionId));
      statusElement.addEventListener("click", async (event) => {
        event.preventDefault();
        const token = getSingleControlledToken();
        const actor = token?.actor ?? token?.document?.actor ?? null;
        if (!actor || !conditionId) return;
        await toggleConditionFromPanel(actor, conditionId);
        updateStatusDisplay(panelElement, token);
      });
      statusElement.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });
    }

    const woundActionIndicator = panelElement.querySelector("[data-wound-action-indicator]");
    if (woundActionIndicator instanceof HTMLElement) {
      bindPanelTooltipEvent(woundActionIndicator, () => {
        const title = String(woundActionIndicator.dataset.tooltipTitle ?? "").trim();
        if (!title) return null;
        const description = String(woundActionIndicator.dataset.tooltipDescription ?? "").trim();
        return { title, description };
      });
    }
  }

  return {
    getPanelStatTooltipData,
    bindPanelStatsTooltipEvents,
    bindPanelWoundsStatEvents,
    bindSelectionPanelStatEvents,
    bindSelectionNameTooltipEvent,
    bindPanelStatusesTooltipEvents
  };
}

