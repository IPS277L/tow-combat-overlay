export function createPanelStatusDisplayService({
  getActorStatusSet
} = {}) {
  function updateStatusDisplay(panelElement, token = null) {
    const statusElements = Array.from(panelElement?.querySelectorAll?.(".tow-combat-overlay-control-panel__status-icon[data-status-id]") ?? []);
    if (!statusElements.length) return;
    const actor = token?.actor ?? token?.document?.actor ?? null;
    const activeStatuses = actor ? getActorStatusSet(actor) : new Set();
    for (const statusElement of statusElements) {
      if (!(statusElement instanceof HTMLElement)) continue;
      const conditionId = String(statusElement.dataset.statusId ?? "");
      const isActive = !!conditionId && activeStatuses.has(conditionId);
      statusElement.classList.toggle("is-active", isActive);
    }
  }

  return {
    updateStatusDisplay
  };
}
