export function createPanelElementFactoryService({
  panelTemplatePath,
  panelSelectionTemplatePath,
  panelId,
  panelSelectionId,
  iconSrcWound,
  panelResilienceIcon,
  panelSpeedIcon,
  panelRollIcon,
  panelDiceIcon,
  getAllConditionEntries,
  towCombatOverlayRenderTemplate
} = {}) {
  function getPanelTemplateData() {
    const statuses = getAllConditionEntries();
    return { statuses };
  }

  async function createSelectionPanelElement() {
    const html = await towCombatOverlayRenderTemplate(panelSelectionTemplatePath, {
      icons: {
        wound: iconSrcWound,
        resilience: panelResilienceIcon,
        speed: panelSpeedIcon,
        roll: panelRollIcon,
        dice: panelDiceIcon
      }
    });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = String(html ?? "").trim();
    const selectionPanel = wrapper.firstElementChild;
    if (!(selectionPanel instanceof HTMLElement) || selectionPanel.id !== panelSelectionId) {
      throw new Error("[tow-combat-overlay] Failed to render selection panel template.");
    }
    return selectionPanel;
  }

  async function createControlPanelElement() {
    const html = await towCombatOverlayRenderTemplate(panelTemplatePath, getPanelTemplateData());
    const wrapper = document.createElement("div");
    wrapper.innerHTML = String(html ?? "").trim();
    const panelElement = wrapper.firstElementChild;
    if (!(panelElement instanceof HTMLElement) || panelElement.id !== panelId) {
      throw new Error("[tow-combat-overlay] Failed to render control panel template.");
    }
    return { panelElement, selectionPanelElement: await createSelectionPanelElement() };
  }

  return {
    getPanelTemplateData,
    createSelectionPanelElement,
    createControlPanelElement
  };
}
