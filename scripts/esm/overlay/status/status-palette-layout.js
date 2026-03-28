import {
  STATUS_PALETTE_ICON_GAP,
  STATUS_PALETTE_ICON_SIZE
} from "../../runtime/overlay-constants.js";
import {
  CHIP_ICON_TOTAL_INSET,
  STATUS_CHIP_SIZE,
  STATUS_ICON_SIZE_MAX,
  STATUS_ICON_SIZE_MIN,
  STATUS_OVERFLOW_COUNT,
  STATUS_TARGET_CHIPS_PER_ROW,
  STATUS_TOKEN_INSET_BOTTOM,
  STATUS_TOKEN_INSET_X
} from "./status-palette-constants.js";
import { syncStatusIconMaskPosition } from "./status-palette-visuals.js";

export function centerOverflowText(overflowText, iconSize) {
  if (!overflowText) return;
  const center = Math.round(iconSize / 2);
  overflowText.anchor.set(0.5, 0.5);
  overflowText.position.set(center, center - 1);
}

export function getStatusPaletteInsets(tokenWidth) {
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

export function getStatusPaletteLayoutForToken(tokenObject, expectedCount) {
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

export function getStatusPaletteFitScale(tokenObject, totalWidth, iconSize, iconGap) {
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

export function getStatusChipIconInset(chipSize) {
  const safeSize = Math.max(1, Number(chipSize) || STATUS_PALETTE_ICON_SIZE);
  const insetScale = safeSize / 27;
  const baseInset = CHIP_ICON_TOTAL_INSET * insetScale;
  return Math.max(2, Math.round(baseInset));
}

export function layoutStatusSpritesCentered(sprites, columns, iconSize, iconGap) {
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
