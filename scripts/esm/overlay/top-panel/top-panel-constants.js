export const TOP_PANEL_ID = "tow-combat-overlay-top-panel";
export const TOP_PANEL_STATE_KEY = "__towCombatOverlayTopPanelState";
export const TOP_PANEL_TEMPLATE_PATH = "modules/tow-combat-overlay/templates/overlay/top-panel.hbs";
export const TOP_PANEL_VIEWPORT_MARGIN_PX = 8;
export const TOP_PANEL_CHIP_TOOLTIP_FALLBACK = "No description.";
export const TOP_PANEL_CHIP_MAX_PER_ROW = 17;
export const TOP_PANEL_WOUND_STATE_KEYS = Object.freeze(new Set(["unwounded", "wounded", "defeated"]));
export const TOP_PANEL_HOOKS = Object.freeze([
  "canvasReady",
  "controlToken",
  "createToken",
  "updateToken",
  "deleteToken",
  "refreshToken",
  "updateActor",
  "createActor",
  "deleteActor"
]);
