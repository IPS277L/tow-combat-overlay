import {
  KEYS,
  STATUS_PALETTE_ICON_SIZE
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
  ensureStatusIconMask,
  syncStatusIconMaskPosition
} from "./status-palette-visuals.js";
import {
  centerOverflowText,
  getStatusChipIconInset,
  getStatusPaletteFitScale,
  getStatusPaletteInsets,
  getStatusPaletteLayoutForToken,
  layoutStatusSpritesCentered
} from "./status-palette-layout.js";
import {
  STATUS_CHIP_SIZE,
  STATUS_CHIP_VARIANT,
  STATUS_FORCE_ACTIVE,
  STATUS_MAX_VISIBLE_CHIPS,
  STATUS_OVERFLOW_COUNT,
  STATUS_OVERFLOW_TEXT_COLOR,
  STATUS_OVERFLOW_TEXT,
  STATUS_RENDER_VERSION,
  STATUS_TOOLTIP_DATA
} from "./status-palette-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import { isTowCombatOverlayDisplaySettingEnabled } from "../../bootstrap/register-settings.js";
import {
  buildOverflowTooltipListMarkup,
  clearStatusIconHandler,
  clearStatusPalette,
  clearStatusPaletteBackdrop,
  hideDefaultStatusPanel,
  restoreCoreTokenHoverVisuals,
  restoreDefaultStatusPanel
} from "./internal/status-palette-lifecycle.js";
import { stylePaletteSprite } from "./internal/status-palette-chip-styling.js";
export { towCombatOverlayHideCoreTokenHoverVisuals } from "./internal/status-palette-lifecycle.js";

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
