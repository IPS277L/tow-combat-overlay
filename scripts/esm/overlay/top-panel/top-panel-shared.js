import { TOP_PANEL_ID, TOP_PANEL_STATE_KEY } from "./top-panel-constants.js";

export function getTopPanelState() {
  if (!game) return null;
  if (!game[TOP_PANEL_STATE_KEY]) game[TOP_PANEL_STATE_KEY] = {};
  return game[TOP_PANEL_STATE_KEY];
}

export function localizeMaybe(key, fallback = "") {
  const localized = game?.i18n?.localize?.(String(key ?? ""));
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? key ?? "");
}

export function formatMaybe(key, data = {}, fallback = "") {
  const formatted = game?.i18n?.format?.(String(key ?? ""), data);
  if (typeof formatted === "string" && formatted !== key) return formatted;
  return String(fallback ?? key ?? "");
}

export function getTopPanelDragToggleTooltipData(unlocked) {
  if (unlocked) {
    return {
      title: localizeMaybe("TOWCOMBATOVERLAY.Tooltip.TopPanel.DragToggle.Unlocked.Title", "Top Panel: Unlocked"),
      description: localizeMaybe(
        "TOWCOMBATOVERLAY.Tooltip.TopPanel.DragToggle.Unlocked.Description",
        "<em>Click to lock the top panel in place.</em><br><br>Drag and drop is enabled."
      ),
      ariaLabel: localizeMaybe("TOWCOMBATOVERLAY.Tooltip.TopPanel.DragToggle.AriaLock", "Lock panel movement")
    };
  }
  return {
    title: localizeMaybe("TOWCOMBATOVERLAY.Tooltip.TopPanel.DragToggle.Locked.Title", "Top Panel: Locked"),
    description: localizeMaybe(
      "TOWCOMBATOVERLAY.Tooltip.TopPanel.DragToggle.Locked.Description",
      "<em>Click to unlock the top panel for dragging.</em><br><br>Drag and drop is disabled."
    ),
    ariaLabel: localizeMaybe("TOWCOMBATOVERLAY.Tooltip.TopPanel.DragToggle.AriaUnlock", "Unlock panel movement")
  };
}

export function getTopPanelResetTooltipData() {
  return {
    title: localizeMaybe("TOWCOMBATOVERLAY.Tooltip.TopPanel.Reset.Title", "Reset Top Panel Position"),
    description: localizeMaybe(
      "TOWCOMBATOVERLAY.Tooltip.TopPanel.Reset.Description",
      "<em>Click to move the top panel back to its default position.</em>"
    ),
    ariaLabel: localizeMaybe("TOWCOMBATOVERLAY.Tooltip.TopPanel.Reset.Aria", "Reset top panel position")
  };
}

export function removeStaleTopPanels() {
  for (const panel of Array.from(document.querySelectorAll(`#${TOP_PANEL_ID}`))) {
    if (panel instanceof HTMLElement) panel.remove();
  }
}
