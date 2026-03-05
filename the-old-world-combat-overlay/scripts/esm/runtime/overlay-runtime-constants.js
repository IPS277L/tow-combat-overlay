export const MODULE_KEY = "towCombatOverlayRuntime";
export const COMBAT_OVERLAY_API_VERSION = "1.0.0";
export const PreciseTextClass = foundry.canvas.containers.PreciseText;

export const KEYS = Object.freeze({
  woundUi: "_towCombatOverlayWoundUi",
  woundUiMarker: "_towCombatOverlayWoundUiMarker",
  woundUiTokenId: "_towCombatOverlayWoundUiTokenId",
  woundUiCountText: "_towCombatOverlayWoundUiCountText",
  woundUiCountIcon: "_towCombatOverlayWoundUiCountIcon",
  woundUiCountHitBox: "_towCombatOverlayWoundUiCountHitBox",
  woundUiAttackHitBox: "_towCombatOverlayWoundUiAttackHitBox",
  woundUiDefenceHitBox: "_towCombatOverlayWoundUiDefenceHitBox",
  woundUiAttackIcon: "_towCombatOverlayWoundUiAttackIcon",
  woundUiActionSeparatorText: "_towCombatOverlayWoundUiActionSeparatorText",
  woundUiDefenceIcon: "_towCombatOverlayWoundUiDefenceIcon",
  woundUiModifierSignText: "_towCombatOverlayWoundUiModifierSignText",
  woundUiModifierText: "_towCombatOverlayWoundUiModifierText",
  woundUiModifierHitBox: "_towCombatOverlayWoundUiModifierHitBox",
  nameLabel: "_towCombatOverlayNameLabel",
  nameLabelMarker: "_towCombatOverlayNameLabelMarker",
  nameLabelTokenId: "_towCombatOverlayNameLabelTokenId",
  nameLabelNameText: "_towCombatOverlayNameLabelNameText",
  nameLabelTypeText: "_towCombatOverlayNameLabelTypeText",
  nameLabelTooltipBinding: "_towCombatOverlayNameLabelTooltipBinding",
  resilienceLabel: "_towCombatOverlayResilienceLabel",
  resilienceLabelHitBox: "_towCombatOverlayResilienceLabelHitBox",
  resilienceLabelIcon: "_towCombatOverlayResilienceLabelIcon",
  resilienceLabelValueText: "_towCombatOverlayResilienceLabelValueText",
  defaultEffectsVisible: "_towCombatOverlayDefaultEffectsVisible",
  statusPaletteLayer: "_towCombatOverlayStatusPaletteLayer",
  statusPaletteBackdrop: "_towCombatOverlayStatusPaletteBackdrop",
  statusPaletteMarker: "_towCombatOverlayStatusPaletteMarker",
  statusPaletteTokenId: "_towCombatOverlayStatusPaletteTokenId",
  statusPaletteMetrics: "_towCombatOverlayStatusPaletteMetrics",
  deadVisualState: "_towCombatOverlayDeadVisualState",
  statusIconHandler: "_towCombatOverlayStatusIconHandler",
  statusIconTooltipOverHandler: "_towCombatOverlayStatusIconTooltipOverHandler",
  statusIconTooltipMoveHandler: "_towCombatOverlayStatusIconTooltipMoveHandler",
  statusIconTooltipOutHandler: "_towCombatOverlayStatusIconTooltipOutHandler",
  statusConditionId: "_towCombatOverlayStatusConditionId",
  statusConditionImg: "_towCombatOverlayStatusConditionImg",
  statusPaletteBg: "_towCombatOverlayStatusPaletteBg",
  statusIconSize: "_towCombatOverlayStatusIconSize",
  tokenInteractiveChildrenOriginal: "_towCombatOverlayTokenInteractiveChildrenOriginal",
  tokenHitAreaOriginal: "_towCombatOverlayTokenHitAreaOriginal",
  coreTooltipVisible: "_towCombatOverlayCoreTooltipVisible",
  coreTooltipRenderable: "_towCombatOverlayCoreTooltipRenderable",
  coreNameplateVisible: "_towCombatOverlayCoreNameplateVisible",
  coreNameplateRenderable: "_towCombatOverlayCoreNameplateRenderable",
  coreBorderVisible: "_towCombatOverlayCoreBorderVisible",
  coreBorderAlpha: "_towCombatOverlayCoreBorderAlpha",
  layoutBorder: "_towCombatOverlayLayoutBorder",
  layoutBounds: "_towCombatOverlayLayoutBounds"
});

export const STATUS_PALETTE_ICON_SIZE = 20;
export const STATUS_PALETTE_ICON_GAP = 2;
export const STATUS_PALETTE_ROWS = 2;
export const TOKEN_CONTROL_PAD = 6;
export const NAME_TYPE_STACK_OVERLAP_PX = 9;
export const NAME_TYPE_TO_TOKEN_OFFSET_PX = 6;
export const STATUS_PALETTE_TOKEN_PAD = TOKEN_CONTROL_PAD;
export const STATUS_PALETTE_INACTIVE_TINT = 0x565656;
export const STATUS_PALETTE_INACTIVE_ALPHA = 0.36;
export const STATUS_PALETTE_ACTIVE_TINT = 0xFFFFFF;
export const STATUS_PALETTE_STAGGERED_RING = 0xFFD54A;
export const STATUS_PALETTE_DEAD_RING = 0xFFFFFF;
export const STATUS_PALETTE_SPECIAL_BG_PAD = 1;
export const STATUS_PALETTE_SPECIAL_BG_RADIUS = 3;
export const STATUS_PALETTE_SPECIAL_BG_OUTLINE = 0x171717;
export const STATUS_PALETTE_SPECIAL_BG_OUTLINE_WIDTH = 1;
export const STATUS_PALETTE_SPECIAL_BG_OUTLINE_ALPHA = 0.72;
export const STATUS_PALETTE_SPECIAL_BG_STAGGERED_ALPHA = 0.58;
export const STATUS_PALETTE_SPECIAL_BG_DEAD_ALPHA = 0.62;
export const STATUS_PALETTE_BACKDROP_COLOR = 0xFFF4D8;
export const STATUS_PALETTE_BACKDROP_FILL_ALPHA = 0.22;
export const STATUS_PALETTE_BACKDROP_BORDER_COLOR = 0xE0C27B;
export const STATUS_PALETTE_BACKDROP_BORDER_ALPHA = 0.46;
export const STATUS_PALETTE_BACKDROP_BORDER_WIDTH = 1;
export const STATUS_PALETTE_BACKDROP_RADIUS = 6;
export const STATUS_PALETTE_BACKDROP_PAD_X = 4;
export const STATUS_PALETTE_BACKDROP_PAD_Y = 3;
export const LAYOUT_BORDER_COLOR = 0xE39A1A;
export const LAYOUT_BORDER_ALPHA = 1;
export const LAYOUT_BORDER_WIDTH = 2;
export const LAYOUT_BORDER_RADIUS = 6;
export const OVERLAY_FONT_SIZE = 22;
export const OVERLAY_CONTROL_ROW_GAP_PX = 32;
export const DRAG_START_THRESHOLD_PX = 8;
export const DRAG_LINE_OUTER_COLOR = 0x1A0909;
export const DRAG_LINE_OUTER_ALPHA = 0.85;
export const DRAG_LINE_OUTER_WIDTH = 7;
export const DRAG_LINE_INNER_COLOR = 0x8F2A2A;
export const DRAG_LINE_INNER_ALPHA = 0.96;
export const DRAG_LINE_INNER_WIDTH = 3;
export const DRAG_ARROW_SIZE = 13;
export const DRAG_ENDPOINT_OUTER_RADIUS = 6;
export const DRAG_ENDPOINT_RING_WIDTH = 2;
export const DRAG_STYLE_SCALE_EXP = 1.05;
export const ATTACK_DEDUPE_WINDOW_MS = 700;
export const TARGET_DEDUPE_WINDOW_MS = 300;
export const AUTO_DEFENCE_WAIT_MS = 4000;
export const AUTO_APPLY_WAIT_MS = 10000;
export const OPPOSED_LINK_WAIT_MS = 700;
export const AUTO_STAGGER_PATCH_MS = 12000;
export const FLOW_CARD_FONT_SIZE = "var(--font-size-16)";
export const FLOW_CARD_CHIP_FONT_SIZE = "var(--font-size-12)";
export const ACTOR_OVERLAY_RESYNC_DELAYS_MS = [50, 180];
export const DEAD_SYNC_DEBOUNCE_MS = 60;
export const DEAD_TO_WOUND_SYNC_DEBOUNCE_MS = 80;
export const STATUS_TOOLTIP_FONT_SIZE = 14;
export const STATUS_TOOLTIP_MAX_WIDTH = 260;
export const STATUS_TOOLTIP_PAD_X = 8;
export const STATUS_TOOLTIP_PAD_Y = 6;
export const STATUS_TOOLTIP_OFFSET_X = 12;
export const STATUS_TOOLTIP_OFFSET_Y = 12;
export const STATUS_TOOLTIP_BG_COLOR = 0x0F0C09;
export const STATUS_TOOLTIP_BG_ALPHA = 0.94;
export const STATUS_TOOLTIP_BORDER_COLOR = 0xC18B2C;
export const STATUS_TOOLTIP_BORDER_ALPHA = 0.9;
export const STATUS_TOOLTIP_DOM_CLASS = "tow-combat-overlay-status-tooltip";
export const OVERLAY_TEXT_RESOLUTION_MIN = 3;
export const OVERLAY_TEXT_RESOLUTION_MAX = 8;
export const OVERLAY_CONTROL_ICON_TINT = 0xFFF4D8;
export const OVERLAY_CONTROL_ICON_OUTLINE_COLOR = 0x2A2620;
export const OVERLAY_CONTROL_ICON_OUTLINE_THICKNESS = 1.4;
export const OVERLAY_CONTROL_ICON_OUTLINE_ALPHA = 0.58;
export const OVERLAY_TOKEN_BASE_PX = 100;
export const OVERLAY_SCALE_MIN = 0.26;
export const OVERLAY_SCALE_MAX = 1.75;
export const OVERLAY_SCALE_EXP_SMALL = 0.85;
export const OVERLAY_SCALE_EXP_LARGE = 0.75;
export const OVERLAY_EDGE_PAD_MIN_FACTOR = 0.58;
export const OVERLAY_EDGE_PAD_EXP = 0.65;
export const LAYOUT_BORDER_SCALE_EXP = 1.15;
export const LAYOUT_BORDER_RADIUS_SCALE_EXP = 0.96;
export const STATUS_SPECIAL_BG_ICON_SCALE_MIN = 0.45;
export const STATUS_SPECIAL_BG_ICON_SCALE_MAX = 1.2;
export const STATUS_SPECIAL_BG_OUTLINE_SCALE_EXP = 1.2;
export const STATUS_SPECIAL_BG_RADIUS_SCALE_EXP = 0.95;

export const WOUND_ITEM_TYPE = "wound";
export const ICON_SRC_ATK = "icons/svg/sword.svg";
export const ICON_SRC_DEF = "icons/svg/shield.svg";
export const ICON_SRC_WOUND = "icons/svg/blood.svg";
export const ICON_SRC_RES = "icons/svg/statue.svg";

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function roundTo(value, digits = 2) {
  const factor = 10 ** Math.max(0, Number(digits) || 0);
  return Math.round(Number(value) * factor) / factor;
}

function getTokenOverlayScale(tokenObject) {
  const width = Number(tokenObject?.w ?? NaN);
  const height = Number(tokenObject?.h ?? NaN);
  const tokenSize = Math.min(width, height);
  if (!Number.isFinite(tokenSize) || tokenSize <= 0) return 1;
  const ratio = tokenSize / OVERLAY_TOKEN_BASE_PX;
  const curvedScale = ratio < 1
    ? Math.pow(ratio, OVERLAY_SCALE_EXP_SMALL)
    : Math.pow(ratio, OVERLAY_SCALE_EXP_LARGE);
  return Math.max(OVERLAY_SCALE_MIN, Math.min(OVERLAY_SCALE_MAX, curvedScale));
}

export function getLayoutBorderStyle(tokenObject) {
  const overlayScale = getTokenOverlayScale(tokenObject);
  const width = clampNumber(LAYOUT_BORDER_WIDTH * Math.pow(overlayScale, LAYOUT_BORDER_SCALE_EXP), 0.68, 2.1);
  const radius = clampNumber(LAYOUT_BORDER_RADIUS * Math.pow(overlayScale, LAYOUT_BORDER_RADIUS_SCALE_EXP), 2.8, 8.5);
  const alpha = clampNumber(LAYOUT_BORDER_ALPHA * (0.78 + (overlayScale * 0.22)), 0.68, 1);
  return {
    width: roundTo(width),
    radius: roundTo(radius),
    alpha: roundTo(alpha)
  };
}

export function getStatusSpecialBgStyle(iconSize, baseFillAlpha) {
  const size = Number(iconSize);
  const sizeSafe = Number.isFinite(size) && size > 0 ? size : STATUS_PALETTE_ICON_SIZE;
  const iconScale = clampNumber(sizeSafe / STATUS_PALETTE_ICON_SIZE, STATUS_SPECIAL_BG_ICON_SCALE_MIN, STATUS_SPECIAL_BG_ICON_SCALE_MAX);
  const pad = clampNumber(STATUS_PALETTE_SPECIAL_BG_PAD * Math.pow(iconScale, STATUS_SPECIAL_BG_RADIUS_SCALE_EXP), 0.45, 2.4);
  const outlineWidth = clampNumber(
    STATUS_PALETTE_SPECIAL_BG_OUTLINE_WIDTH * Math.pow(iconScale, STATUS_SPECIAL_BG_OUTLINE_SCALE_EXP),
    0.28,
    2.2
  );
  const radius = clampNumber(
    STATUS_PALETTE_SPECIAL_BG_RADIUS * Math.pow(iconScale, STATUS_SPECIAL_BG_RADIUS_SCALE_EXP),
    1.25,
    6
  );
  const outlineAlpha = clampNumber(
    STATUS_PALETTE_SPECIAL_BG_OUTLINE_ALPHA * (0.72 + (iconScale * 0.28)),
    0.26,
    0.9
  );
  const fillAlpha = clampNumber(Number(baseFillAlpha) * (0.76 + (iconScale * 0.24)), 0.16, 0.9);
  return {
    pad: roundTo(pad),
    outlineWidth: roundTo(outlineWidth),
    radius: roundTo(radius),
    outlineAlpha: roundTo(outlineAlpha),
    fillAlpha: roundTo(fillAlpha)
  };
}

export function getStatusPaletteBackdropStyle(iconSize) {
  const size = Number(iconSize);
  const sizeSafe = Number.isFinite(size) && size > 0 ? size : STATUS_PALETTE_ICON_SIZE;
  const iconScale = clampNumber(sizeSafe / STATUS_PALETTE_ICON_SIZE, STATUS_SPECIAL_BG_ICON_SCALE_MIN, 1.3);
  return {
    padX: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_PAD_X * Math.pow(iconScale, 0.95), 2.2, 9)),
    padY: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_PAD_Y * Math.pow(iconScale, 0.95), 1.8, 7)),
    borderWidth: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_BORDER_WIDTH * Math.pow(iconScale, 1.05), 0.45, 1.8)),
    radius: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_RADIUS * Math.pow(iconScale, 0.98), 2.8, 10)),
    fillAlpha: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_FILL_ALPHA * (0.84 + (iconScale * 0.16)), 0.14, 0.34)),
    borderAlpha: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_BORDER_ALPHA * (0.9 + (iconScale * 0.1)), 0.32, 0.62))
  };
}

export function getTowCombatOverlayRuntimeConstants() {
  return Object.freeze({
    moduleKey: MODULE_KEY,
    keys: KEYS,
    tokenControlPad: TOKEN_CONTROL_PAD,
    overlayTokenBasePx: OVERLAY_TOKEN_BASE_PX,
    overlayScaleMin: OVERLAY_SCALE_MIN,
    overlayScaleMax: OVERLAY_SCALE_MAX,
    overlayScaleExpSmall: OVERLAY_SCALE_EXP_SMALL,
    overlayScaleExpLarge: OVERLAY_SCALE_EXP_LARGE,
    overlayEdgePadMinFactor: OVERLAY_EDGE_PAD_MIN_FACTOR,
    overlayEdgePadExp: OVERLAY_EDGE_PAD_EXP
  });
}
