import { getTowCombatOverlayConstants } from "../../../runtime/module-constants.js";
import { isTowCombatOverlayDisplaySettingEnabled } from "../../../bootstrap/register-settings.js";

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
    const { settings } = getTowCombatOverlayConstants();
    const statuses = getAllConditionEntries();
    const showPortrait = isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnablePortrait, true);
    const showStats = showPortrait
      && isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnableStats, true);
    const showStatusRow = isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnableStatusRow, true);
    return {
      statuses,
      showStatusIcons: showStatusRow
        && isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnableStatuses, true),
      roundLeftWhenStatsDisabled: !showStats
    };
  }

  function getSelectionPanelTemplateData() {
    const { settings } = getTowCombatOverlayConstants();
    const showPortrait = isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnablePortrait, true);
    const showStats = showPortrait
      && isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnableStats, true);
    return {
      icons: {
        wound: iconSrcWound,
        resilience: panelResilienceIcon,
        speed: panelSpeedIcon,
        roll: panelRollIcon,
        dice: panelDiceIcon
      },
      showName: showPortrait
        && isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnableName, true),
      showStats,
      showImage: showPortrait
        && isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnableImage, true),
      showActionButtons: true,
      showSelectionSideStack: showStats
    };
  }

  async function createSelectionPanelElement() {
    const html = await towCombatOverlayRenderTemplate(panelSelectionTemplatePath, getSelectionPanelTemplateData());
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
    getSelectionPanelTemplateData,
    createSelectionPanelElement,
    createControlPanelElement
  };
}
