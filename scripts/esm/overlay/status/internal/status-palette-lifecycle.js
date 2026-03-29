import { KEYS } from "../../../runtime/overlay-constants.js";
import { buildTooltipChipListMarkup } from "../../shared/tooltip-markup.js";
import { clearStatusIconMask } from "../status-palette-visuals.js";

export function buildOverflowTooltipListMarkup(entries = []) {
  return buildTooltipChipListMarkup(entries, {
    resolveTitle: (entry) => String(entry?.displayName ?? entry?.tooltipData?.name ?? entry?.id ?? "").trim() || "?",
    resolveImage: (entry) => String(entry?.img ?? "").trim()
  });
}

export function clearStatusIconHandler(sprite) {
  const keys = [
    KEYS.statusIconHandler,
    KEYS.statusIconTooltipOverHandler,
    KEYS.statusIconTooltipMoveHandler,
    KEYS.statusIconTooltipOutHandler
  ];
  for (const key of keys) {
    const handler = sprite?.[key];
    if (!handler) continue;
    if (key === KEYS.statusIconHandler) {
      sprite.off("pointerdown", handler);
      sprite.off("contextmenu", handler);
    } else if (key === KEYS.statusIconTooltipOverHandler) sprite.off("pointerover", handler);
    else if (key === KEYS.statusIconTooltipMoveHandler) sprite.off("pointermove", handler);
    else {
      sprite.off("pointerout", handler);
      sprite.off("pointerupoutside", handler);
      sprite.off("pointercancel", handler);
    }
    delete sprite[key];
  }
  clearStatusIconMask(sprite);
}

export function clearStatusPalette(tokenObject) {
  const layer = tokenObject?.[KEYS.statusPaletteLayer];
  if (!layer) return;
  for (const child of layer.children ?? []) clearStatusIconHandler(child);
  layer.removeChildren().forEach((child) => child.destroy());
  layer.parent?.removeChild(layer);
  layer.destroy();
  delete tokenObject[KEYS.statusPaletteLayer];
  delete tokenObject[KEYS.statusPaletteMetrics];
}

export function hideDefaultStatusPanel(tokenObject) {
  const effects = tokenObject?.effects;
  if (!effects) return;
  if (typeof tokenObject[KEYS.defaultEffectsVisible] === "undefined") {
    tokenObject[KEYS.defaultEffectsVisible] = effects.visible !== false;
  }
  effects.visible = false;
}

export function restoreDefaultStatusPanel(tokenObject) {
  const effects = tokenObject?.effects;
  if (!effects) return;
  const prior = tokenObject[KEYS.defaultEffectsVisible];
  effects.visible = (typeof prior === "boolean") ? prior : true;
  delete tokenObject[KEYS.defaultEffectsVisible];
}

export function towCombatOverlayHideCoreTokenHoverVisuals(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const tooltip = tokenObject?.tooltip;
  const nameplate = tokenObject?.nameplate;
  const border = tokenObject?.border;
  if (tooltip) {
    if (typeof tokenObject[KEYS.coreTooltipVisible] === "undefined") tokenObject[KEYS.coreTooltipVisible] = tooltip.visible !== false;
    if (typeof tokenObject[KEYS.coreTooltipRenderable] === "undefined") tokenObject[KEYS.coreTooltipRenderable] = tooltip.renderable !== false;
    tooltip.visible = false;
    tooltip.renderable = false;
  }
  if (nameplate) {
    if (typeof tokenObject[KEYS.coreNameplateVisible] === "undefined") tokenObject[KEYS.coreNameplateVisible] = nameplate.visible !== false;
    if (typeof tokenObject[KEYS.coreNameplateRenderable] === "undefined") tokenObject[KEYS.coreNameplateRenderable] = nameplate.renderable !== false;
    nameplate.visible = false;
    nameplate.renderable = false;
  }
  if (border) {
    if (typeof tokenObject[KEYS.coreBorderVisible] === "undefined") tokenObject[KEYS.coreBorderVisible] = border.visible !== false;
    if (typeof tokenObject[KEYS.coreBorderAlpha] === "undefined") tokenObject[KEYS.coreBorderAlpha] = Number(border.alpha ?? 1);
    border.visible = false;
    if ("alpha" in border) border.alpha = 0;
  }
}

export function restoreCoreTokenHoverVisuals(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const tooltip = tokenObject?.tooltip;
  const nameplate = tokenObject?.nameplate;
  const border = tokenObject?.border;
  if (tooltip && typeof tokenObject[KEYS.coreTooltipVisible] === "boolean") tooltip.visible = tokenObject[KEYS.coreTooltipVisible];
  if (tooltip && typeof tokenObject[KEYS.coreTooltipRenderable] === "boolean") tooltip.renderable = tokenObject[KEYS.coreTooltipRenderable];
  if (nameplate && typeof tokenObject[KEYS.coreNameplateVisible] === "boolean") nameplate.visible = tokenObject[KEYS.coreNameplateVisible];
  if (nameplate && typeof tokenObject[KEYS.coreNameplateRenderable] === "boolean") nameplate.renderable = tokenObject[KEYS.coreNameplateRenderable];
  if (border && typeof tokenObject[KEYS.coreBorderVisible] === "boolean") border.visible = tokenObject[KEYS.coreBorderVisible];
  if (border && typeof tokenObject[KEYS.coreBorderAlpha] === "number" && "alpha" in border) border.alpha = tokenObject[KEYS.coreBorderAlpha];
  delete tokenObject[KEYS.coreTooltipVisible];
  delete tokenObject[KEYS.coreTooltipRenderable];
  delete tokenObject[KEYS.coreNameplateVisible];
  delete tokenObject[KEYS.coreNameplateRenderable];
  delete tokenObject[KEYS.coreBorderVisible];
  delete tokenObject[KEYS.coreBorderAlpha];
}

export function clearStatusPaletteBackdrop(layer) {
  let backdrop = layer[KEYS.statusPaletteBackdrop];
  if (!backdrop) return;
  backdrop.parent?.removeChild(backdrop);
  backdrop.destroy();
  delete layer[KEYS.statusPaletteBackdrop];
}
