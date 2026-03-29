import {
  STATUS_PALETTE_ICON_SIZE,
  STATUS_PALETTE_INACTIVE_ALPHA,
  STATUS_PALETTE_INACTIVE_TINT
} from "../../../runtime/overlay-constants.js";
import { getActorStatusSet } from "../status-palette-data.js";
import { KEYS } from "../../../runtime/overlay-constants.js";
import {
  CHIP_ACTIVE_BORDER,
  CHIP_ACTIVE_FILL,
  CHIP_BORDER_WIDTH,
  CHIP_EFFECT_BORDER,
  CHIP_EFFECT_BORDER_ALPHA,
  CHIP_EFFECT_FILL,
  CHIP_EFFECT_FILL_ALPHA,
  CHIP_INACTIVE_BORDER,
  CHIP_INACTIVE_BORDER_ALPHA,
  CHIP_INACTIVE_FILL,
  STATUS_ABILITY_ACTIVE_INNER_RING_ALPHA,
  STATUS_ABILITY_ACTIVE_INNER_RING_COLOR,
  STATUS_ABILITY_ACTIVE_OUTER_RING_ALPHA,
  STATUS_ABILITY_ACTIVE_OUTER_RING_COLOR,
  STATUS_CHIP_SIZE,
  STATUS_CHIP_VARIANT,
  STATUS_OVERFLOW_COUNT
} from "../status-palette-constants.js";

export function stylePaletteSprite(sprite, actor, conditionId, activeStatuses = null, forceActive = false) {
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
