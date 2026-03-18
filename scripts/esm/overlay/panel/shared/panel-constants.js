export const PANEL_ID = "tow-combat-overlay-control-panel";
export const PANEL_SELECTION_ID = "tow-combat-overlay-selection-panel";
export const PANEL_TEMPLATE_PATH = "modules/tow-combat-overlay/templates/overlay/control-panel.hbs";
export const PANEL_SELECTION_TEMPLATE_PATH = "modules/tow-combat-overlay/templates/overlay/control-panel-selection.hbs";
export const PANEL_STATE_KEY = "__towCombatOverlayControlPanelState";
export const PANEL_VIEWPORT_MARGIN_PX = 8;
export const PANEL_SELECTION_GAP_PX = 0;
export const PANEL_FALLBACK_ITEM_ICON = "icons/svg/item-bag.svg";
export const PANEL_RESILIENCE_ICON = "icons/svg/shield.svg";
export const PANEL_SPEED_ICON = "icons/svg/wingfoot.svg";
export const PANEL_ROLL_ICON = "icons/svg/d20-grey.svg";
export const PANEL_DICE_ICON = "icons/svg/d10-grey.svg";
export const PANEL_ATTACK_PICK_CURSOR = "crosshair";
export const PANEL_MANOEUVRE_ICON_BY_KEY = {
  run: "icons/skills/movement/feet-winged-boots-brown.webp",
  charge: "icons/skills/melee/strike-sword-steel-yellow.webp",
  moveQuietly: "icons/magic/nature/stealth-hide-beast-eyes-green.webp",
  moveCarefully: "icons/magic/nature/root-vine-entangle-foot-green.webp"
};
export const PANEL_MANOEUVRE_ORDER = ["charge", "run", "moveQuietly", "moveCarefully"];
export const PANEL_RECOVER_ICON_BY_KEY = {
  recover: "icons/consumables/potions/bottle-round-label-cork-red.webp",
  treat: "icons/skills/wounds/injury-stapled-flesh-tan.webp",
  condition: "icons/skills/wounds/injury-pain-body-orange.webp"
};
export const PANEL_RECOVER_ORDER = ["treat", "condition", "recover"];
export const PANEL_ACTIONS_ORDER = ["help", "defence", "aim", "improvise", "accumulatePower"];
export const PANEL_ACTION_ICON_BY_KEY = {
  aim: "icons/skills/targeting/crosshair-ringed-gray.webp",
  help: "icons/skills/social/diplomacy-handshake.webp",
  improvise: "icons/magic/time/hourglass-tilted-glowing-gold.webp",
  defence: "icons/equipment/shield/heater-wooden-antlers-blue.webp",
  accumulatePower: "icons/magic/symbols/rune-sigil-black-pink.webp",
  unarmed: "icons/weapons/clubs/club-banded-steel.webp"
};
export const PANEL_UNARMED_FLAG_KEY = "generatedUnarmedAction";
export const PANEL_UNARMED_ACTION_ID = "unarmed";
export const PANEL_UNARMED_CLEANUP_POLL_MS = 250;
export const PANEL_UNARMED_OPPOSED_DISCOVERY_GRACE_MS = 2000;
export const PANEL_MAIN_GRID_MIN_COLUMNS = 7;
export const PANEL_MAIN_GRID_MIN_ROWS = 2;
export const PANEL_REORDERABLE_GROUP_KEYS = new Set(["manoeuvre", "recover", "actions", "attacks", "magic"]);

