import {
  KEYS,
  STATUS_PALETTE_ICON_GAP,
  STATUS_PALETTE_ICON_SIZE,
  STATUS_PALETTE_INACTIVE_ALPHA,
  STATUS_PALETTE_INACTIVE_TINT
} from "../../runtime/overlay-constants.js";
import {
  clearStatusTooltip,
  hideStatusTooltip
} from "../shared/shared.js";
import {
  towCombatOverlayBindTooltipHandlers,
  towCombatOverlayForEachSceneToken,
  towCombatOverlayGetActorFromToken
} from "../shared/core-helpers.js";
import { towCombatOverlayTuneTextForScale } from "../shared/text-rendering.js";
import {
  towCombatOverlayClearCustomLayoutBorder,
  towCombatOverlayClearDeadVisual,
  towCombatOverlayClearDisplayObject,
  towCombatOverlayRestoreTokenOverlayInteractivity
} from "../layout-state.js";
import {
  getActorStatusSet,
  getAllConditionEntries,
  getConditionTooltipData,
  getTemporaryEffectEntries,
  getWoundsAbilityEntry
} from "./status-palette-data.js";
import {
  applyStatusIconSpriteStyle,
  clearStatusIconMask,
  ensureStatusIconMask,
  syncStatusIconMaskPosition
} from "./status-palette-visuals.js";
import {
  CHIP_ACTIVE_BORDER,
  CHIP_ACTIVE_FILL,
  CHIP_BORDER_WIDTH,
  CHIP_EFFECT_BORDER,
  CHIP_EFFECT_BORDER_ALPHA,
  CHIP_EFFECT_FILL,
  CHIP_EFFECT_FILL_ALPHA,
  CHIP_ICON_TOTAL_INSET,
  CHIP_INACTIVE_BORDER,
  CHIP_INACTIVE_BORDER_ALPHA,
  CHIP_INACTIVE_FILL,
  STATUS_ABILITY_ACTIVE_INNER_RING_ALPHA,
  STATUS_ABILITY_ACTIVE_INNER_RING_COLOR,
  STATUS_ABILITY_ACTIVE_OUTER_RING_ALPHA,
  STATUS_ABILITY_ACTIVE_OUTER_RING_COLOR,
  STATUS_CHIP_SIZE,
  STATUS_CHIP_VARIANT,
  STATUS_FORCE_ACTIVE,
  STATUS_ICON_SIZE_MAX,
  STATUS_ICON_SIZE_MIN,
  STATUS_MAX_VISIBLE_CHIPS,
  STATUS_OVERFLOW_COUNT,
  STATUS_OVERFLOW_TEXT_COLOR,
  STATUS_OVERFLOW_TEXT,
  STATUS_RENDER_VERSION,
  STATUS_TARGET_CHIPS_PER_ROW,
  STATUS_TOKEN_INSET_BOTTOM,
  STATUS_TOKEN_INSET_X,
  STATUS_TOOLTIP_DATA
} from "./status-palette-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import { isTowCombatOverlayDisplaySettingEnabled } from "../../bootstrap/register-settings.js";
import { buildTooltipChipListMarkup } from "../shared/tooltip-markup.js";

function getTokenLayoutPaletteVisibilitySettings() {
  const { settings } = getTowCombatOverlayConstants();
  const enableStatusRow = isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableStatusRow, true);
  return {
    enableStatusRow,
    enableStatuses: enableStatusRow
      && isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableStatuses, true),
    enableWounds: enableStatusRow
      && isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableWounds, true),
    enableTemporaryEffects: enableStatusRow
      && isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableTemporaryEffects, true),
    enableStatusesTooltip: isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableTooltips, true)
      && isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableStatusesTooltip, true),
    enableWoundsTooltip: isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableTooltips, true)
      && isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableWoundsTooltip, true),
    enableTemporaryEffectsTooltip: isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableTooltips, true)
      && isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableTemporaryEffectsTooltip, true),
    enableOverflowTooltip: isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableTooltips, true)
      && isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableOverflowTooltip, true)
  };
}

function buildOverflowTooltipListMarkup(entries = []) {
  return buildTooltipChipListMarkup(entries, {
    resolveTitle: (entry) => String(entry?.displayName ?? entry?.tooltipData?.name ?? entry?.id ?? "").trim() || "?",
    resolveImage: (entry) => String(entry?.img ?? "").trim()
  });
}

function centerOverflowText(overflowText, iconSize) {
  if (!overflowText) return;
  const center = Math.round(iconSize / 2);
  overflowText.anchor.set(0.5, 0.5);
  overflowText.position.set(center, center - 1);
}

function clearStatusIconHandler(sprite) {
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

function clearStatusPalette(tokenObject) {
  const layer = tokenObject?.[KEYS.statusPaletteLayer];
  if (!layer) return;
  for (const child of layer.children ?? []) clearStatusIconHandler(child);
  layer.removeChildren().forEach((child) => child.destroy());
  layer.parent?.removeChild(layer);
  layer.destroy();
  delete tokenObject[KEYS.statusPaletteLayer];
  delete tokenObject[KEYS.statusPaletteMetrics];
}

function hideDefaultStatusPanel(tokenObject) {
  const effects = tokenObject?.effects;
  if (!effects) return;
  if (typeof tokenObject[KEYS.defaultEffectsVisible] === "undefined") {
    tokenObject[KEYS.defaultEffectsVisible] = effects.visible !== false;
  }
  effects.visible = false;
}

function restoreDefaultStatusPanel(tokenObject) {
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

function restoreCoreTokenHoverVisuals(tokenObject) {
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

function stylePaletteSprite(sprite, actor, conditionId, activeStatuses = null, forceActive = false) {
  const statuses = activeStatuses instanceof Set ? activeStatuses : getActorStatusSet(actor);
  const active = forceActive || statuses.has(String(conditionId ?? ""));
  const isOverflow = Number(sprite?.[STATUS_OVERFLOW_COUNT] ?? 0) > 0;
  const variant = String(sprite?.[STATUS_CHIP_VARIANT] ?? "condition");
  const chipSize = Number.isFinite(Number(sprite?.[STATUS_CHIP_SIZE]))
    ? Number(sprite[STATUS_CHIP_SIZE])
    : STATUS_PALETTE_ICON_SIZE;
  const radius = Math.max(1, chipSize / 2);
  const centerX = isOverflow ? (Number(sprite?.x ?? 0) + radius) : Number(sprite?.x ?? 0);
  const centerY = isOverflow ? (Number(sprite?.y ?? 0) + radius) : Number(sprite?.y ?? 0);
  const parent = sprite?.parent;

  let chipBg = sprite?.[KEYS.statusPaletteBg];
  if (!chipBg || chipBg.destroyed || chipBg.parent !== parent) {
    if (chipBg && !chipBg.destroyed) chipBg.destroy();
    chipBg = new PIXI.Graphics();
    chipBg.eventMode = "none";
    sprite[KEYS.statusPaletteBg] = chipBg;
    if (parent) {
      const index = Math.max(0, parent.getChildIndex(sprite));
      parent.addChildAt(chipBg, index);
    }
  }

  if (isOverflow) {
    chipBg.clear();
    chipBg.lineStyle({ width: CHIP_BORDER_WIDTH, color: CHIP_INACTIVE_BORDER, alpha: CHIP_INACTIVE_BORDER_ALPHA, alignment: 0.5 });
    chipBg.beginFill(CHIP_INACTIVE_FILL, 0.9);
    chipBg.drawCircle(centerX, centerY, Math.max(1, radius - (CHIP_BORDER_WIDTH * 0.5)));
    chipBg.endFill();
    sprite.tint = 0xFFFFFF;
    sprite.alpha = 1;
    return;
  }

  if (!active) {
    chipBg.clear();
    chipBg.lineStyle({ width: CHIP_BORDER_WIDTH, color: CHIP_INACTIVE_BORDER, alpha: CHIP_INACTIVE_BORDER_ALPHA, alignment: 0.5 });
    chipBg.beginFill(CHIP_INACTIVE_FILL, 0.9);
    chipBg.drawCircle(centerX, centerY, Math.max(1, radius - (CHIP_BORDER_WIDTH * 0.5)));
    chipBg.endFill();
    sprite.tint = STATUS_PALETTE_INACTIVE_TINT;
    sprite.alpha = STATUS_PALETTE_INACTIVE_ALPHA;
    return;
  }

  chipBg.clear();
  const isEffectLike = variant === "effect" || variant === "ability";
  const isAbilityActive = variant === "ability" && active;
  const activeBorder = isAbilityActive ? 0xD64A4A : (isEffectLike ? CHIP_EFFECT_BORDER : CHIP_ACTIVE_BORDER);
  const activeBorderAlpha = isAbilityActive ? 0.96 : (isEffectLike ? CHIP_EFFECT_BORDER_ALPHA : 1);
  const activeFill = isAbilityActive ? 0x5C1616 : (isEffectLike ? CHIP_EFFECT_FILL : CHIP_ACTIVE_FILL);
  const activeFillAlpha = isAbilityActive ? 0.9 : (isEffectLike ? CHIP_EFFECT_FILL_ALPHA : 1);
  chipBg.lineStyle({
    width: CHIP_BORDER_WIDTH,
    color: activeBorder,
    alpha: activeBorderAlpha,
    alignment: 0.5
  });
  chipBg.beginFill(activeFill, activeFillAlpha);
  chipBg.drawCircle(centerX, centerY, Math.max(1, radius - (CHIP_BORDER_WIDTH * 0.5)));
  chipBg.endFill();
  if (isAbilityActive) {
    // Mirror control-panel active wound chip finish:
    // inset highlight + subtle outer ring.
    chipBg.lineStyle({
      width: 1,
      color: STATUS_ABILITY_ACTIVE_INNER_RING_COLOR,
      alpha: STATUS_ABILITY_ACTIVE_INNER_RING_ALPHA,
      alignment: 1
    });
    chipBg.drawCircle(centerX, centerY, Math.max(1, radius - 1.5));
    chipBg.lineStyle({
      width: 1,
      color: STATUS_ABILITY_ACTIVE_OUTER_RING_COLOR,
      alpha: STATUS_ABILITY_ACTIVE_OUTER_RING_ALPHA,
      alignment: 0
    });
    chipBg.drawCircle(centerX, centerY, Math.max(1, radius + 0.5));
  }
  sprite.tint = 0xFFFFFF;
  sprite.alpha = 0.98;
}

function clearStatusPaletteBackdrop(layer) {
  let backdrop = layer[KEYS.statusPaletteBackdrop];
  if (!backdrop) return;
  backdrop.parent?.removeChild(backdrop);
  backdrop.destroy();
  delete layer[KEYS.statusPaletteBackdrop];
}

function getStatusPaletteInsets(tokenWidth) {
  const tinyToken = Number(tokenWidth) <= 40;
  if (!tinyToken) {
    return {
      insetX: STATUS_TOKEN_INSET_X,
      insetBottom: STATUS_TOKEN_INSET_BOTTOM
    };
  }

  return {
    insetX: Math.max(1, Math.round(STATUS_TOKEN_INSET_X * 0.5)),
    insetBottom: Math.max(1, Math.round(STATUS_TOKEN_INSET_BOTTOM * 0.5))
  };
}

function getStatusPaletteLayoutForToken(tokenObject, expectedCount) {
  const count = Math.max(0, Number(expectedCount ?? 0) || 0);
  let iconSize = STATUS_PALETTE_ICON_SIZE;
  let iconGap = STATUS_PALETTE_ICON_GAP;
  const tokenWidth = Number(tokenObject?.w ?? NaN);
  const hasTokenWidth = Number.isFinite(tokenWidth) && tokenWidth > 0;
  if (!hasTokenWidth) return { columns: Math.max(1, count), iconSize, iconGap };

  const { insetX } = getStatusPaletteInsets(tokenWidth);
  const widthSafe = Math.max(1, tokenWidth - (insetX * 2));
  const ratio = STATUS_PALETTE_ICON_GAP / Math.max(1, STATUS_PALETTE_ICON_SIZE);
  const denom = STATUS_TARGET_CHIPS_PER_ROW + ((STATUS_TARGET_CHIPS_PER_ROW - 1) * ratio);
  const scaledSize = widthSafe / Math.max(1, denom);
  iconSize = Math.round(Math.min(STATUS_ICON_SIZE_MAX, Math.max(STATUS_ICON_SIZE_MIN, scaledSize)));
  iconGap = Math.round(iconSize * ratio);
  if (count <= 1) return { columns: Math.max(1, count), iconSize, iconGap };
  const columns = Math.max(1, Math.min(count, STATUS_TARGET_CHIPS_PER_ROW));
  return { columns, iconSize, iconGap };
}

function getStatusPaletteFitScale(tokenObject, totalWidth, iconSize, iconGap) {
  const tokenWidth = Math.max(1, Number(tokenObject?.w ?? 0));
  const { insetX } = getStatusPaletteInsets(tokenWidth);
  const availableWidth = Math.max(1, tokenWidth - (insetX * 2));
  const sizeSafe = Math.max(1, Number(iconSize) || STATUS_PALETTE_ICON_SIZE);
  const gapSafe = Math.max(0, Number(iconGap) || 0);
  const targetRowWidth = (
    STATUS_TARGET_CHIPS_PER_ROW * sizeSafe
  ) + (
    (STATUS_TARGET_CHIPS_PER_ROW - 1) * gapSafe
  );
  const widthBasis = Math.max(
    1,
    Number(totalWidth) || 1,
    targetRowWidth
  );
  const widthScale = availableWidth / widthBasis;
  return Math.max(0.1, Math.min(1, widthScale));
}

function getStatusChipIconInset(chipSize) {
  const safeSize = Math.max(1, Number(chipSize) || STATUS_PALETTE_ICON_SIZE);
  const insetScale = safeSize / 27;
  const baseInset = CHIP_ICON_TOTAL_INSET * insetScale;
  return Math.max(2, Math.round(baseInset));
}

function layoutStatusSpritesCentered(sprites, columns, iconSize, iconGap) {
  const list = Array.isArray(sprites) ? sprites : [];
  const count = list.length;
  const columnsSafe = Math.max(1, Number(columns) || 1);
  const sizeSafe = Math.max(1, Number(iconSize) || STATUS_PALETTE_ICON_SIZE);
  const gapSafe = Math.max(0, Number(iconGap) || 0);
  if (count <= 0) return { totalWidth: 0, totalHeight: 0 };

  const rowStride = sizeSafe + gapSafe;
  const maxItemsInRow = Math.min(columnsSafe, count);
  const maxRowWidth = (maxItemsInRow * sizeSafe) + ((maxItemsInRow - 1) * gapSafe);
  const totalRows = Math.ceil(count / columnsSafe);
  const totalHeight = (totalRows * sizeSafe) + ((totalRows - 1) * gapSafe);

  for (let row = 0; row < totalRows; row++) {
    const rowStart = row * columnsSafe;
    const rowCount = Math.min(columnsSafe, Math.max(0, count - rowStart));
    if (rowCount <= 0) continue;
    const rowWidth = (rowCount * sizeSafe) + ((rowCount - 1) * gapSafe);
    const rowOffsetX = Math.round((maxRowWidth - rowWidth) / 2);
    for (let col = 0; col < rowCount; col++) {
      const index = rowStart + col;
      const sprite = list[index];
      if (!sprite) continue;
      const isOverflow = Number(sprite?.[STATUS_OVERFLOW_COUNT] ?? 0) > 0;
      const chipSize = Number.isFinite(Number(sprite?.[STATUS_CHIP_SIZE]))
        ? Number(sprite[STATUS_CHIP_SIZE])
        : sizeSafe;
      const half = chipSize / 2;
      const baseX = rowOffsetX + (col * rowStride);
      const baseY = row * rowStride;
      const posX = isOverflow ? baseX : (baseX + half);
      const posY = isOverflow ? baseY : (baseY + half);
      sprite.position.set(
        Math.round(posX),
        Math.round(posY)
      );
      syncStatusIconMaskPosition(sprite);
    }
  }

  return { totalWidth: maxRowWidth, totalHeight };
}

export function setupStatusPalette(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const actor = towCombatOverlayGetActorFromToken(tokenObject);
  if (!actor) return;
  const visibilitySettings = getTokenLayoutPaletteVisibilitySettings();
  if (!visibilitySettings.enableStatusRow) {
    clearStatusPalette(tokenObject);
    restoreDefaultStatusPanel(tokenObject);
    return;
  }
  hideDefaultStatusPanel(tokenObject);
  const allConditions = getAllConditionEntries();
  const activeStatuses = getActorStatusSet(actor);
  const woundAbility = visibilitySettings.enableWounds ? getWoundsAbilityEntry(actor) : null;
  const temporaryEffects = visibilitySettings.enableTemporaryEffects ? getTemporaryEffectEntries(actor) : [];
  const entries = [
    ...(visibilitySettings.enableStatuses ? allConditions : [])
      .filter((entry) => activeStatuses.has(String(entry?.id ?? "")))
      .map((entry) => {
        const conditionTooltipData = getConditionTooltipData(entry?.id);
        const displayName = String(conditionTooltipData?.name ?? entry?.id ?? "").trim() || "Condition";
        return {
          key: `condition:${String(entry?.id ?? "")}`,
          id: String(entry?.id ?? ""),
          img: String(entry?.img ?? "").trim(),
          variant: "condition",
          forceActive: false,
          displayName,
          tooltipData: visibilitySettings.enableStatusesTooltip
            ? conditionTooltipData
            : { name: "", description: "" }
        };
      }),
    ...(woundAbility
      ? [{
        key: String(woundAbility?.key ?? ""),
        id: String(woundAbility?.id ?? ""),
        img: String(woundAbility?.img ?? "").trim(),
        variant: "ability",
        forceActive: woundAbility?.isActive === true,
        overflowCount: 0,
        displayName: String(woundAbility?.name ?? "Wounds").trim() || "Wounds",
        tooltipData: visibilitySettings.enableWoundsTooltip
          ? {
            name: String(woundAbility?.name ?? "Wounds"),
            description: String(woundAbility?.description ?? "")
          }
          : { name: "", description: "" }
      }]
      : []),
    ...temporaryEffects.map((entry) => ({
      key: String(entry?.key ?? ""),
      id: String(entry?.id ?? ""),
      img: String(entry?.img ?? "").trim(),
      variant: "effect",
      forceActive: true,
      overflowCount: 0,
      displayName: String(entry?.name ?? "Effect").trim() || "Effect",
      tooltipData: visibilitySettings.enableTemporaryEffectsTooltip
        ? {
          name: String(entry?.name ?? "Effect"),
          description: String(entry?.description ?? "")
        }
        : { name: "", description: "" }
    }))
  ].filter((entry) => !!entry.key && !!entry.id && !!entry.img);
  const hiddenOverflowEntries = entries.length > STATUS_MAX_VISIBLE_CHIPS
    ? entries.slice(STATUS_MAX_VISIBLE_CHIPS)
    : [];
  const visibleEntries = entries.length > STATUS_MAX_VISIBLE_CHIPS
    ? [
      ...entries.slice(0, STATUS_MAX_VISIBLE_CHIPS),
      {
        key: `overflow:${hiddenOverflowEntries.length}`,
        id: `__overflow__:${hiddenOverflowEntries.length}`,
        img: "",
        variant: "overflow",
        forceActive: true,
        overflowCount: hiddenOverflowEntries.length,
        tooltipData: visibilitySettings.enableOverflowTooltip
          ? {
            name: `+${hiddenOverflowEntries.length}`,
            description: buildOverflowTooltipListMarkup(hiddenOverflowEntries) || `+${hiddenOverflowEntries.length} more`
          }
          : { name: "", description: "" }
      }
    ]
    : entries;
  if (!visibleEntries.length) return clearStatusPalette(tokenObject);

  const expectedCount = visibleEntries.length;
  const expectedIdsSignature = visibleEntries.map((entry) => String(entry?.key ?? "")).join("|");
  const expectedStateSignature = visibleEntries.map((entry) => (
    `${String(entry?.key ?? "")}:${String(entry?.variant ?? "")}:${entry?.forceActive === true ? "1" : "0"}:${String(entry?.img ?? "")}`
  )).join("|");
  const { columns, iconSize, iconGap } = getStatusPaletteLayoutForToken(tokenObject, expectedCount);
  let layer = tokenObject[KEYS.statusPaletteLayer];
  const iconChildrenCount = layer
    ? (layer.children?.filter((child) => child?.[KEYS.statusConditionId]).length ?? 0)
    : 0;
  const shouldRebuild = !layer
    || layer.destroyed
    || layer.parent !== tokenObject
    || iconChildrenCount !== expectedCount
    || tokenObject[KEYS.statusPaletteMetrics]?.iconSize !== iconSize
    || tokenObject[KEYS.statusPaletteMetrics]?.iconGap !== iconGap
    || tokenObject[KEYS.statusPaletteMetrics]?.idsSignature !== expectedIdsSignature
    || tokenObject[KEYS.statusPaletteMetrics]?.stateSignature !== expectedStateSignature
    || tokenObject[KEYS.statusPaletteMetrics]?.renderVersion !== STATUS_RENDER_VERSION;

  if (shouldRebuild) {
    clearStatusPalette(tokenObject);
    layer = new PIXI.Container();
    layer.eventMode = "static";
    layer.interactive = true;
    layer.interactiveChildren = true;
    layer[KEYS.statusPaletteMarker] = true;
    layer[KEYS.statusPaletteTokenId] = tokenObject.id;
    tokenObject.addChild(layer);
    tokenObject[KEYS.statusPaletteLayer] = layer;

    for (let i = 0; i < visibleEntries.length; i++) {
      const entry = visibleEntries[i];
      const isOverflow = Number(entry?.overflowCount ?? 0) > 0;
      const sprite = isOverflow
        ? new PIXI.Container()
        : PIXI.Sprite.from(entry.img);
      const chipSize = iconSize;
      const scaledInset = getStatusChipIconInset(chipSize);
      const iconDrawSize = isOverflow ? chipSize : Math.max(2, Math.round(chipSize - scaledInset));
      if (!isOverflow) {
        applyStatusIconSpriteStyle(sprite, iconDrawSize);
        ensureStatusIconMask(sprite, layer, chipSize);
      }
      sprite.eventMode = "static";
      sprite.interactive = true;
      if (isOverflow) {
        sprite.hitArea = new PIXI.Circle(iconSize / 2, iconSize / 2, iconSize / 2);
      }
      sprite[KEYS.statusConditionId] = entry.id;
      sprite[KEYS.statusConditionImg] = entry.img;
      sprite[KEYS.statusIconSize] = iconSize;
      sprite[STATUS_CHIP_SIZE] = chipSize;
      sprite[STATUS_CHIP_VARIANT] = String(entry?.variant ?? "condition");
      sprite[STATUS_FORCE_ACTIVE] = entry.forceActive === true;
      sprite[STATUS_TOOLTIP_DATA] = entry.tooltipData;
      sprite[STATUS_OVERFLOW_COUNT] = Number(entry?.overflowCount ?? 0) || 0;
      if (isOverflow) {
        const overflowText = new PIXI.Text(`+${sprite[STATUS_OVERFLOW_COUNT]}`, {
          fontFamily: "CaslonPro, Signika, serif",
          fontSize: Math.max(9, Math.round(iconSize * 0.52)),
          fontWeight: "700",
          fill: STATUS_OVERFLOW_TEXT_COLOR,
          strokeThickness: 0,
          align: "center"
        });
        overflowText.eventMode = "none";
        centerOverflowText(overflowText, iconSize);
        towCombatOverlayTuneTextForScale(overflowText, iconSize / Math.max(1, STATUS_PALETTE_ICON_SIZE));
        sprite.addChild(overflowText);
        sprite[STATUS_OVERFLOW_TEXT] = overflowText;
      }
      towCombatOverlayBindTooltipHandlers(sprite, () => (sprite?.[STATUS_TOOLTIP_DATA] ?? { name: "", description: "" }), {
        over: KEYS.statusIconTooltipOverHandler,
        move: KEYS.statusIconTooltipMoveHandler,
        out: KEYS.statusIconTooltipOutHandler
      }, {
        theme: "panel",
        descriptionIsHtml: true
      });
      layer.addChild(sprite);
    }
    tokenObject[KEYS.statusPaletteMetrics] = {
      iconSize,
      iconGap,
      idsSignature: expectedIdsSignature,
      stateSignature: expectedStateSignature,
      renderVersion: STATUS_RENDER_VERSION
    };
  }

  const statusSprites = layer.children?.filter((child) => child?.[KEYS.statusConditionId]) ?? [];
  const { totalWidth, totalHeight } = layoutStatusSpritesCentered(statusSprites, columns, iconSize, iconGap);
  const tokenWidth = Math.max(1, Number(tokenObject?.w ?? 0));
  const { insetX, insetBottom } = getStatusPaletteInsets(tokenWidth);
  const availableWidth = Math.max(1, tokenWidth - (insetX * 2));
  const fitScale = getStatusPaletteFitScale(tokenObject, totalWidth, iconSize, iconGap);
  const scaledWidth = totalWidth * fitScale;
  const scaledHeight = totalHeight * fitScale;
  layer.scale.set(fitScale);
  layer.position.set(
    Math.round(insetX + ((availableWidth - scaledWidth) / 2)),
    Math.round(Math.max(0, tokenObject.h - scaledHeight - insetBottom))
  );
  clearStatusPaletteBackdrop(layer);
  layer.visible = tokenObject.visible;
  for (let i = 0; i < statusSprites.length; i++) {
    const sprite = statusSprites[i];
    const entry = visibleEntries[i] ?? null;
    if (entry) {
      const nextImg = String(entry?.img ?? "").trim();
      const priorImg = String(sprite?.[KEYS.statusConditionImg] ?? "").trim();
      const isOverflow = Number(entry?.overflowCount ?? 0) > 0;
      sprite[STATUS_CHIP_VARIANT] = String(entry?.variant ?? "condition");
      sprite[STATUS_FORCE_ACTIVE] = entry?.forceActive === true;
      sprite[STATUS_TOOLTIP_DATA] = entry?.tooltipData ?? sprite?.[STATUS_TOOLTIP_DATA] ?? { name: "", description: "" };
      if (!isOverflow && sprite instanceof PIXI.Sprite && nextImg && nextImg !== priorImg) {
        sprite.texture = PIXI.Texture.from(nextImg);
      }
      sprite[KEYS.statusConditionImg] = nextImg || priorImg;
    }
    if (Number(sprite?.[STATUS_OVERFLOW_COUNT] ?? 0) <= 0 && sprite instanceof PIXI.Sprite) {
      const chipSize = Number.isFinite(Number(sprite?.[STATUS_CHIP_SIZE]))
        ? Number(sprite[STATUS_CHIP_SIZE])
        : Math.max(1, Number(iconSize) || 1);
      const scaledInset = getStatusChipIconInset(chipSize);
      const iconDrawSize = Math.max(2, Math.round(chipSize - scaledInset));
      applyStatusIconSpriteStyle(sprite, iconDrawSize);
      ensureStatusIconMask(sprite, layer, chipSize);
      syncStatusIconMaskPosition(sprite);
    }
    const overflowText = sprite?.[STATUS_OVERFLOW_TEXT];
    if (overflowText) {
      overflowText.text = `+${Number(sprite?.[STATUS_OVERFLOW_COUNT] ?? 0)}`;
      centerOverflowText(overflowText, iconSize);
      towCombatOverlayTuneTextForScale(overflowText, iconSize / Math.max(1, STATUS_PALETTE_ICON_SIZE));
    }
    sprite.cursor = "default";
    stylePaletteSprite(
      sprite,
      actor,
      sprite[KEYS.statusConditionId],
      activeStatuses,
      sprite?.[STATUS_FORCE_ACTIVE] === true
    );
  }
}

export function clearAllStatusOverlays() {
  hideStatusTooltip();
  towCombatOverlayForEachSceneToken((token) => {
    for (const sprite of token.effects?.children ?? []) clearStatusIconHandler(sprite);
    clearStatusPalette(token);
    restoreDefaultStatusPanel(token);
    restoreCoreTokenHoverVisuals(token);
    towCombatOverlayClearDeadVisual(token);
    towCombatOverlayRestoreTokenOverlayInteractivity(token);
    towCombatOverlayClearCustomLayoutBorder(token);
  });
  for (const child of canvas.tokens.children ?? []) {
    if (child?.[KEYS.statusPaletteMarker] === true) towCombatOverlayClearDisplayObject(child);
  }
  clearStatusTooltip();
}

export function hideDefaultStatusPanelForOverlay(tokenObject) {
  hideDefaultStatusPanel(tokenObject);
}
