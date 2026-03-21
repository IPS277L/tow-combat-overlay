import {
  STATUS_ICON_MASK_ALPHA,
  STATUS_ICON_MASK_RADIUS_INSET
} from "./status-palette-constants.js";

const STATUS_ICON_MASK = "_towCombatOverlayStatusIconMask";

export function applyStatusIconSpriteStyle(sprite, iconDrawSize) {
  if (!(sprite instanceof PIXI.Sprite)) return;
  const iconSizeSafe = Math.max(1, Number(iconDrawSize) || 1);
  if (typeof sprite.anchor?.set === "function") sprite.anchor.set(0, 0);
  sprite.scale.set(1, 1);
  const bounds = sprite.getLocalBounds();
  const boundsWidth = Math.max(1, Number(bounds?.width ?? 0));
  const boundsHeight = Math.max(1, Number(bounds?.height ?? 0));
  const fitScale = iconSizeSafe / Math.max(boundsWidth, boundsHeight);
  sprite.scale.set(fitScale, fitScale);
  const centerX = Number(bounds?.x ?? 0) + (boundsWidth / 2);
  const centerY = Number(bounds?.y ?? 0) + (boundsHeight / 2);
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) sprite.pivot.set(centerX, centerY);
}

export function ensureStatusIconMask(sprite, layer, chipSize) {
  if (!(sprite instanceof PIXI.Sprite)) return null;
  if (!(layer instanceof PIXI.Container)) return null;
  const radius = Math.max(1, (Math.max(1, Number(chipSize) || 1) / 2) - STATUS_ICON_MASK_RADIUS_INSET);
  let maskShape = sprite?.[STATUS_ICON_MASK];
  if (!(maskShape instanceof PIXI.Graphics) || maskShape.destroyed || maskShape.parent !== layer) {
    if (maskShape instanceof PIXI.Graphics && !maskShape.destroyed) maskShape.destroy();
    maskShape = new PIXI.Graphics();
    maskShape.eventMode = "none";
    maskShape.interactive = false;
    maskShape.alpha = STATUS_ICON_MASK_ALPHA;
    layer.addChild(maskShape);
    sprite[STATUS_ICON_MASK] = maskShape;
  }
  maskShape.clear();
  maskShape.beginFill(0xFFFFFF, 1);
  maskShape.drawCircle(0, 0, radius);
  maskShape.endFill();
  sprite.mask = maskShape;
  return maskShape;
}

export function syncStatusIconMaskPosition(sprite) {
  const maskShape = sprite?.[STATUS_ICON_MASK];
  if (!(maskShape instanceof PIXI.Graphics) || maskShape.destroyed) return;
  const x = Math.round(Number(sprite?.x ?? 0));
  const y = Math.round(Number(sprite?.y ?? 0));
  maskShape.position.set(x, y);
}

export function clearStatusIconMask(sprite) {
  const maskShape = sprite?.[STATUS_ICON_MASK];
  if (maskShape instanceof PIXI.Graphics && !maskShape.destroyed) {
    sprite.mask = null;
    maskShape.parent?.removeChild(maskShape);
    maskShape.destroy();
  }
  if (sprite && STATUS_ICON_MASK in sprite) delete sprite[STATUS_ICON_MASK];
}
