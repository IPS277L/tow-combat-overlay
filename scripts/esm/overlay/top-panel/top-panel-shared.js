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

export function getTopPanelDragHandleTooltipData() {
  return {
    title: localizeMaybe("TOWCOMBATOVERLAY.Tooltip.TopPanel.DragHandle.Title", "Move Top Panel"),
    description: localizeMaybe(
      "TOWCOMBATOVERLAY.Tooltip.TopPanel.DragHandle.Description",
      "<em>Drag and drop to move the top panel.</em>"
    ),
    ariaLabel: localizeMaybe("TOWCOMBATOVERLAY.Tooltip.TopPanel.DragHandle.Aria", "Drag top panel")
  };
}

export function removeStaleTopPanels() {
  for (const panel of Array.from(document.querySelectorAll(`#${TOP_PANEL_ID}`))) {
    if (panel instanceof HTMLElement) panel.remove();
  }
}
