import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";
import { getTowCombatOverlayOverlayApi } from "../api/module-api-registry.js";
import {
  canTowCombatOverlayUserViewControl,
  getTowCombatOverlayDisplaySetting,
  isTowCombatOverlayDisplaySettingEnabled
} from "./register-settings.js";
import {
  towCombatOverlayEnsureControlPanel,
  towCombatOverlayRemoveControlPanel
} from "../overlay/panel/control-panel-service.js";
import { writeSavedPanelPosition } from "../overlay/panel/shared/state.js";
import {
  towCombatOverlayEnsureTopPanel,
  towCombatOverlayRemoveTopPanel
} from "../overlay/top-panel/top-panel-service.js";
import { TOP_PANEL_ID } from "../overlay/top-panel/top-panel-constants.js";
import { writeSavedTopPanelPosition } from "../overlay/top-panel/top-panel-state.js";
import { requestTowCombatOverlayViewportSync } from "./ui-bootstrap.js";

function syncControlPanelButtonsDragDrop(enabled = true) {
  const panelElement = document.getElementById("tow-combat-overlay-control-panel");
  if (!(panelElement instanceof HTMLElement)) return;
  const slotElements = panelElement.querySelectorAll(".tow-combat-overlay-control-panel__slot");
  for (const slotElement of slotElements) {
    if (!(slotElement instanceof HTMLElement)) continue;
    slotElement.draggable = !!enabled;
  }
}

export function syncTowCombatOverlayDisplaySettings(changedSettingKey = "") {
  const { settings } = getTowCombatOverlayConstants();
  const overlayApi = getTowCombatOverlayOverlayApi();
  let didChange = false;
  const normalizedChangedSettingKey = String(changedSettingKey ?? "").trim();
  const shouldRebuildControlPanel = normalizedChangedSettingKey === settings.controlPanelEnableStatuses
    || normalizedChangedSettingKey === settings.controlPanelEnableStatusRow
    || normalizedChangedSettingKey === settings.controlPanelEnableAbilities
    || normalizedChangedSettingKey === settings.controlPanelEnableWounds
    || normalizedChangedSettingKey === settings.controlPanelEnableTemporaryEffects
    || normalizedChangedSettingKey === settings.controlPanelEnablePortrait
    || normalizedChangedSettingKey === settings.controlPanelEnableName
    || normalizedChangedSettingKey === settings.controlPanelEnableStats
    || normalizedChangedSettingKey === settings.controlPanelEnableImage
    || normalizedChangedSettingKey === settings.controlPanelEnableGridButtons
    || normalizedChangedSettingKey === settings.controlPanelEnableActionButtons
    || normalizedChangedSettingKey === settings.controlPanelEnableWeaponsButtons
    || normalizedChangedSettingKey === settings.controlPanelEnableMagicButtons
    || normalizedChangedSettingKey === settings.controlPanelEnableItemsRarity
    || normalizedChangedSettingKey === settings.controlPanelEnableTooltips
    || normalizedChangedSettingKey === settings.controlPanelShowTooltipClickBehaviorText
    || normalizedChangedSettingKey === settings.controlPanelEnableNameTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableStatsTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableStatusesTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableAbilitiesTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableWoundsTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableTemporaryEffectsTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableButtonsTooltip
    || normalizedChangedSettingKey === settings.controlPanelShowDeadPortraitStatus
    || normalizedChangedSettingKey === settings.controlPanelPositionMode;
  if (normalizedChangedSettingKey === settings.controlPanelPositionMode) {
    const positionMode = String(getTowCombatOverlayDisplaySetting(settings.controlPanelPositionMode, "free")).trim();
    if (positionMode === "free") {
      const panelElement = document.getElementById("tow-combat-overlay-control-panel");
      if (panelElement instanceof HTMLElement) writeSavedPanelPosition(panelElement);
    }
  }
  if (normalizedChangedSettingKey === settings.tokensPanelPositionMode) {
    const positionMode = String(getTowCombatOverlayDisplaySetting(settings.tokensPanelPositionMode, "free")).trim();
    if (positionMode === "free") {
      const panelElement = document.getElementById(TOP_PANEL_ID);
      if (panelElement instanceof HTMLElement) writeSavedTopPanelPosition(panelElement);
    }
  }

  const wantsEnabled = isTowCombatOverlayDisplaySettingEnabled(settings.enableOverlay, true)
    && canTowCombatOverlayUserViewControl(settings.tokenLayoutMinimumRole, "all");
  const wantsControlPanel = isTowCombatOverlayDisplaySettingEnabled(settings.enableControlPanel, true)
    && canTowCombatOverlayUserViewControl(settings.controlPanelMinimumRole, "all");
  const wantsTopPanel = isTowCombatOverlayDisplaySettingEnabled(settings.enableTopPanel, true)
    && canTowCombatOverlayUserViewControl(settings.tokensPanelMinimumRole, "all");

  if (!overlayApi) {
    if (!wantsControlPanel) towCombatOverlayRemoveControlPanel();
    if (wantsTopPanel) {
      void towCombatOverlayEnsureTopPanel().catch((error) => {
        console.error("[tow-combat-overlay] Failed to initialize top panel.", error);
      });
    } else {
      towCombatOverlayRemoveTopPanel();
    }
    return false;
  }
  const isEnabled = typeof overlayApi.isEnabled === "function"
    ? !!overlayApi.isEnabled()
    : false;

  if (wantsEnabled && !isEnabled && typeof overlayApi.enable === "function") {
    overlayApi.enable();
    didChange = true;
  }

  if (!wantsEnabled && isEnabled && typeof overlayApi.disable === "function") {
    overlayApi.disable();
    didChange = true;
  }
  if (wantsEnabled && typeof overlayApi.refreshAll === "function") {
    void Promise.resolve(overlayApi.refreshAll()).catch((error) => {
      console.error("[tow-combat-overlay] Failed to refresh token overlays after settings update.", error);
    });
  }

  if (wantsControlPanel) {
    if (shouldRebuildControlPanel) towCombatOverlayRemoveControlPanel();
    void towCombatOverlayEnsureControlPanel()
      .then(() => {
        if (shouldRebuildControlPanel || normalizedChangedSettingKey === settings.controlPanelPositionMode) {
          requestTowCombatOverlayViewportSync();
        }
      })
      .catch((error) => {
        console.error("[tow-combat-overlay] Failed to initialize control panel.", error);
      });
    if (normalizedChangedSettingKey === settings.controlPanelEnableButtonsDragDrop) {
      syncControlPanelButtonsDragDrop(
        isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnableButtonsDragDrop, false)
      );
    }
  } else {
    towCombatOverlayRemoveControlPanel();
  }

  if (wantsTopPanel) {
    void towCombatOverlayEnsureTopPanel().catch((error) => {
      console.error("[tow-combat-overlay] Failed to initialize top panel.", error);
    });
  } else {
    towCombatOverlayRemoveTopPanel();
  }

  return didChange;
}
