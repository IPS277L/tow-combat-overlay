export const MODULE_KEY = "towMacroToggleOverlay";
export const PreciseTextClass = foundry.canvas.containers.PreciseText;

export const KEYS = Object.freeze({
  woundUI: "_towWoundControlUI",
  woundUiMarker: "_towOverlayWoundUiMarker",
  woundUiTokenId: "_towOverlayWoundUiTokenId",
  nameLabel: "_towNameLabel",
  nameLabelMarker: "_towOverlayNameLabelMarker",
  nameLabelTokenId: "_towOverlayNameLabelTokenId",
  resilienceLabel: "_towResilienceLabel",
  defaultEffectsVisible: "_towDefaultEffectsVisible",
  statusPaletteLayer: "_towStatusPaletteLayer",
  statusPaletteBackdrop: "_towStatusPaletteBackdrop",
  statusPaletteMarker: "_towOverlayStatusPaletteMarker",
  statusPaletteTokenId: "_towOverlayStatusPaletteTokenId",
  statusPaletteMetrics: "_towStatusPaletteMetrics",
  deadVisualState: "_towDeadVisualState",
  statusIconHandler: "_towStatusIconHandler",
  statusIconTooltipOverHandler: "_towStatusIconTooltipOverHandler",
  statusIconTooltipMoveHandler: "_towStatusIconTooltipMoveHandler",
  statusIconTooltipOutHandler: "_towStatusIconTooltipOutHandler",
  tokenInteractiveChildrenOriginal: "_towTokenInteractiveChildrenOriginal",
  tokenHitAreaOriginal: "_towTokenHitAreaOriginal",
  coreTooltipVisible: "_towCoreTooltipVisible",
  coreTooltipRenderable: "_towCoreTooltipRenderable",
  coreNameplateVisible: "_towCoreNameplateVisible",
  coreNameplateRenderable: "_towCoreNameplateRenderable",
  coreBorderVisible: "_towCoreBorderVisible",
  coreBorderAlpha: "_towCoreBorderAlpha",
  layoutBorder: "_towLayoutBorder",
  layoutBounds: "_towLayoutBounds"
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
export const STATUS_TOOLTIP_DOM_CLASS = "tow-overlay-status-tooltip";
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

function overlayRuntimeGetTokenOverlayScaleRef(tokenObject) {
  return globalThis.towCombatOverlayGetTokenOverlayScale(tokenObject);
}

function overlayRuntimeClampNumberRef(value, min, max) {
  return globalThis.towCombatOverlayClampNumber(value, min, max);
}

function overlayRuntimeRoundToRef(value, digits) {
  return globalThis.towCombatOverlayRoundTo(value, digits);
}

export function getLayoutBorderStyle(tokenObject) {
  const overlayScale = overlayRuntimeGetTokenOverlayScaleRef(tokenObject);
  const width = overlayRuntimeClampNumberRef(LAYOUT_BORDER_WIDTH * Math.pow(overlayScale, LAYOUT_BORDER_SCALE_EXP), 0.68, 2.1);
  const radius = overlayRuntimeClampNumberRef(LAYOUT_BORDER_RADIUS * Math.pow(overlayScale, LAYOUT_BORDER_RADIUS_SCALE_EXP), 2.8, 8.5);
  const alpha = overlayRuntimeClampNumberRef(LAYOUT_BORDER_ALPHA * (0.78 + (overlayScale * 0.22)), 0.68, 1);
  return {
    width: overlayRuntimeRoundToRef(width),
    radius: overlayRuntimeRoundToRef(radius),
    alpha: overlayRuntimeRoundToRef(alpha)
  };
}

export function getStatusSpecialBgStyle(iconSize, baseFillAlpha) {
  const size = Number(iconSize);
  const sizeSafe = Number.isFinite(size) && size > 0 ? size : STATUS_PALETTE_ICON_SIZE;
  const iconScale = overlayRuntimeClampNumberRef(sizeSafe / STATUS_PALETTE_ICON_SIZE, STATUS_SPECIAL_BG_ICON_SCALE_MIN, STATUS_SPECIAL_BG_ICON_SCALE_MAX);
  const pad = overlayRuntimeClampNumberRef(STATUS_PALETTE_SPECIAL_BG_PAD * Math.pow(iconScale, STATUS_SPECIAL_BG_RADIUS_SCALE_EXP), 0.45, 2.4);
  const outlineWidth = overlayRuntimeClampNumberRef(
    STATUS_PALETTE_SPECIAL_BG_OUTLINE_WIDTH * Math.pow(iconScale, STATUS_SPECIAL_BG_OUTLINE_SCALE_EXP),
    0.28,
    2.2
  );
  const radius = overlayRuntimeClampNumberRef(
    STATUS_PALETTE_SPECIAL_BG_RADIUS * Math.pow(iconScale, STATUS_SPECIAL_BG_RADIUS_SCALE_EXP),
    1.25,
    6
  );
  const outlineAlpha = overlayRuntimeClampNumberRef(
    STATUS_PALETTE_SPECIAL_BG_OUTLINE_ALPHA * (0.72 + (iconScale * 0.28)),
    0.26,
    0.9
  );
  const fillAlpha = overlayRuntimeClampNumberRef(Number(baseFillAlpha) * (0.76 + (iconScale * 0.24)), 0.16, 0.9);
  return {
    pad: overlayRuntimeRoundToRef(pad),
    outlineWidth: overlayRuntimeRoundToRef(outlineWidth),
    radius: overlayRuntimeRoundToRef(radius),
    outlineAlpha: overlayRuntimeRoundToRef(outlineAlpha),
    fillAlpha: overlayRuntimeRoundToRef(fillAlpha)
  };
}

export function getStatusPaletteBackdropStyle(iconSize) {
  const size = Number(iconSize);
  const sizeSafe = Number.isFinite(size) && size > 0 ? size : STATUS_PALETTE_ICON_SIZE;
  const iconScale = overlayRuntimeClampNumberRef(sizeSafe / STATUS_PALETTE_ICON_SIZE, STATUS_SPECIAL_BG_ICON_SCALE_MIN, 1.3);
  return {
    padX: overlayRuntimeRoundToRef(overlayRuntimeClampNumberRef(STATUS_PALETTE_BACKDROP_PAD_X * Math.pow(iconScale, 0.95), 2.2, 9)),
    padY: overlayRuntimeRoundToRef(overlayRuntimeClampNumberRef(STATUS_PALETTE_BACKDROP_PAD_Y * Math.pow(iconScale, 0.95), 1.8, 7)),
    borderWidth: overlayRuntimeRoundToRef(overlayRuntimeClampNumberRef(STATUS_PALETTE_BACKDROP_BORDER_WIDTH * Math.pow(iconScale, 1.05), 0.45, 1.8)),
    radius: overlayRuntimeRoundToRef(overlayRuntimeClampNumberRef(STATUS_PALETTE_BACKDROP_RADIUS * Math.pow(iconScale, 0.98), 2.8, 10)),
    fillAlpha: overlayRuntimeRoundToRef(overlayRuntimeClampNumberRef(STATUS_PALETTE_BACKDROP_FILL_ALPHA * (0.84 + (iconScale * 0.16)), 0.14, 0.34)),
    borderAlpha: overlayRuntimeRoundToRef(overlayRuntimeClampNumberRef(STATUS_PALETTE_BACKDROP_BORDER_ALPHA * (0.9 + (iconScale * 0.1)), 0.32, 0.62))
  };
}

export function getTowCombatOverlayOverlayRuntimeConstants() {
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

Object.assign(globalThis, {
  MODULE_KEY,
  PreciseTextClass,
  KEYS,
  STATUS_PALETTE_ICON_SIZE,
  STATUS_PALETTE_ICON_GAP,
  STATUS_PALETTE_ROWS,
  TOKEN_CONTROL_PAD,
  NAME_TYPE_STACK_OVERLAP_PX,
  NAME_TYPE_TO_TOKEN_OFFSET_PX,
  STATUS_PALETTE_TOKEN_PAD,
  STATUS_PALETTE_INACTIVE_TINT,
  STATUS_PALETTE_INACTIVE_ALPHA,
  STATUS_PALETTE_ACTIVE_TINT,
  STATUS_PALETTE_STAGGERED_RING,
  STATUS_PALETTE_DEAD_RING,
  STATUS_PALETTE_SPECIAL_BG_PAD,
  STATUS_PALETTE_SPECIAL_BG_RADIUS,
  STATUS_PALETTE_SPECIAL_BG_OUTLINE,
  STATUS_PALETTE_SPECIAL_BG_OUTLINE_WIDTH,
  STATUS_PALETTE_SPECIAL_BG_OUTLINE_ALPHA,
  STATUS_PALETTE_SPECIAL_BG_STAGGERED_ALPHA,
  STATUS_PALETTE_SPECIAL_BG_DEAD_ALPHA,
  STATUS_PALETTE_BACKDROP_COLOR,
  STATUS_PALETTE_BACKDROP_FILL_ALPHA,
  STATUS_PALETTE_BACKDROP_BORDER_COLOR,
  STATUS_PALETTE_BACKDROP_BORDER_ALPHA,
  STATUS_PALETTE_BACKDROP_BORDER_WIDTH,
  STATUS_PALETTE_BACKDROP_RADIUS,
  STATUS_PALETTE_BACKDROP_PAD_X,
  STATUS_PALETTE_BACKDROP_PAD_Y,
  LAYOUT_BORDER_COLOR,
  LAYOUT_BORDER_ALPHA,
  LAYOUT_BORDER_WIDTH,
  LAYOUT_BORDER_RADIUS,
  OVERLAY_FONT_SIZE,
  DRAG_START_THRESHOLD_PX,
  DRAG_LINE_OUTER_COLOR,
  DRAG_LINE_OUTER_ALPHA,
  DRAG_LINE_OUTER_WIDTH,
  DRAG_LINE_INNER_COLOR,
  DRAG_LINE_INNER_ALPHA,
  DRAG_LINE_INNER_WIDTH,
  DRAG_ARROW_SIZE,
  DRAG_ENDPOINT_OUTER_RADIUS,
  DRAG_ENDPOINT_RING_WIDTH,
  DRAG_STYLE_SCALE_EXP,
  ATTACK_DEDUPE_WINDOW_MS,
  TARGET_DEDUPE_WINDOW_MS,
  AUTO_DEFENCE_WAIT_MS,
  AUTO_APPLY_WAIT_MS,
  OPPOSED_LINK_WAIT_MS,
  AUTO_STAGGER_PATCH_MS,
  FLOW_CARD_FONT_SIZE,
  FLOW_CARD_CHIP_FONT_SIZE,
  ACTOR_OVERLAY_RESYNC_DELAYS_MS,
  DEAD_SYNC_DEBOUNCE_MS,
  DEAD_TO_WOUND_SYNC_DEBOUNCE_MS,
  STATUS_TOOLTIP_FONT_SIZE,
  STATUS_TOOLTIP_MAX_WIDTH,
  STATUS_TOOLTIP_PAD_X,
  STATUS_TOOLTIP_PAD_Y,
  STATUS_TOOLTIP_OFFSET_X,
  STATUS_TOOLTIP_OFFSET_Y,
  STATUS_TOOLTIP_BG_COLOR,
  STATUS_TOOLTIP_BG_ALPHA,
  STATUS_TOOLTIP_BORDER_COLOR,
  STATUS_TOOLTIP_BORDER_ALPHA,
  STATUS_TOOLTIP_DOM_CLASS,
  OVERLAY_TEXT_RESOLUTION_MIN,
  OVERLAY_TEXT_RESOLUTION_MAX,
  OVERLAY_CONTROL_ICON_TINT,
  OVERLAY_CONTROL_ICON_OUTLINE_COLOR,
  OVERLAY_CONTROL_ICON_OUTLINE_THICKNESS,
  OVERLAY_CONTROL_ICON_OUTLINE_ALPHA,
  OVERLAY_TOKEN_BASE_PX,
  OVERLAY_SCALE_MIN,
  OVERLAY_SCALE_MAX,
  OVERLAY_SCALE_EXP_SMALL,
  OVERLAY_SCALE_EXP_LARGE,
  OVERLAY_EDGE_PAD_MIN_FACTOR,
  OVERLAY_EDGE_PAD_EXP,
  LAYOUT_BORDER_SCALE_EXP,
  LAYOUT_BORDER_RADIUS_SCALE_EXP,
  STATUS_SPECIAL_BG_ICON_SCALE_MIN,
  STATUS_SPECIAL_BG_ICON_SCALE_MAX,
  STATUS_SPECIAL_BG_OUTLINE_SCALE_EXP,
  STATUS_SPECIAL_BG_RADIUS_SCALE_EXP,
  WOUND_ITEM_TYPE,
  ICON_SRC_ATK,
  ICON_SRC_DEF,
  ICON_SRC_WOUND,
  ICON_SRC_RES,
  getLayoutBorderStyle,
  getStatusSpecialBgStyle,
  getStatusPaletteBackdropStyle
});

globalThis.getTowCombatOverlayOverlayRuntimeConstants = getTowCombatOverlayOverlayRuntimeConstants;
