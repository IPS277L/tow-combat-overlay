import {
  KEYS,
  getLayoutBorderColor,
  getLayoutBorderStyle
} from "../../runtime/overlay-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import { isTowCombatOverlayDisplaySettingEnabled } from "../../bootstrap/register-settings.js";

function isTokenLayoutBorderEnabled() {
  const { settings } = getTowCombatOverlayConstants();
  return isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutShowBorder, true);
}

function isTokenLayoutDeadVisualEnabled() {
  const { settings } = getTowCombatOverlayConstants();
  return isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutShowDeadVisuals, true);
}

export function towCombatOverlayClearDisplayObject(displayObject) {
  if (!displayObject) return;
  displayObject.parent?.removeChild(displayObject);
  displayObject.destroy({ children: true });
}

export function towCombatOverlayEnsureTokenOverlayInteractivity(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  if (typeof tokenObject[KEYS.tokenInteractiveChildrenOriginal] === "undefined") {
    tokenObject[KEYS.tokenInteractiveChildrenOriginal] = tokenObject.interactiveChildren === true;
  }
  if (typeof tokenObject[KEYS.tokenHitAreaOriginal] === "undefined") {
    tokenObject[KEYS.tokenHitAreaOriginal] = tokenObject.hitArea ?? null;
  }
  tokenObject.interactiveChildren = true;
}

export function towCombatOverlayUpdateTokenOverlayHitArea(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const tokenCornerPoints = [
    { x: 0, y: 0 },
    { x: tokenObject.w, y: 0 },
    { x: 0, y: tokenObject.h },
    { x: tokenObject.w, y: tokenObject.h }
  ];
  const points = [...tokenCornerPoints];
  const overlayChildren = [
    tokenObject[KEYS.nameLabel],
    tokenObject[KEYS.statusPaletteLayer]
  ].filter((child) => child && !child.destroyed);

  for (const child of overlayChildren) {
    const bounds = child.getBounds?.();
    if (!bounds) continue;
    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x, y: bounds.y + bounds.height },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
    ];
    for (const corner of corners) {
      const local = tokenObject.toLocal(corner);
      points.push({ x: local.x, y: local.y });
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;

  // Keep overlay zone/border horizontally symmetric around token center.
  const centerX = Number(tokenObject.w ?? 0) / 2;
  const leftExtent = Math.max(0, centerX - minX);
  const rightExtent = Math.max(0, maxX - centerX);
  const halfWidth = Math.max(leftExtent, rightExtent);
  minX = centerX - halfWidth;
  maxX = centerX + halfWidth;

  const pad = 3;
  const hitBounds = {
    x: minX - pad,
    y: minY - pad,
    width: Math.max(1, (maxX - minX) + (pad * 2)),
    height: Math.max(1, (maxY - minY) + (pad * 2))
  };
  tokenObject.hitArea = new PIXI.Rectangle(hitBounds.x, hitBounds.y, hitBounds.width, hitBounds.height);
  // Border is always drawn around the token image; hit area may still extend to overlay children.
  towCombatOverlayDrawCustomLayoutBorder(tokenObject);
}

export function towCombatOverlayRestoreTokenOverlayInteractivity(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const prior = tokenObject[KEYS.tokenInteractiveChildrenOriginal];
  if (typeof prior !== "boolean") return;
  tokenObject.interactiveChildren = prior;
  delete tokenObject[KEYS.tokenInteractiveChildrenOriginal];
  if (KEYS.tokenHitAreaOriginal in tokenObject) {
    tokenObject.hitArea = tokenObject[KEYS.tokenHitAreaOriginal];
    delete tokenObject[KEYS.tokenHitAreaOriginal];
  }
}

export function towCombatOverlayEnsureCustomLayoutBorder(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return null;
  let border = tokenObject[KEYS.layoutBorder];
  if (!border || border.destroyed || border.parent !== tokenObject) {
    if (border && !border.destroyed) towCombatOverlayClearDisplayObject(border);
    border = new PIXI.Graphics();
    border.eventMode = "none";
    tokenObject.addChild(border);
    tokenObject[KEYS.layoutBorder] = border;
  }
  return border;
}

export function towCombatOverlayDrawCustomLayoutBorder(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const border = towCombatOverlayEnsureCustomLayoutBorder(tokenObject);
  if (!border) return;
  border.clear();
  const tokenWidth = Math.max(1, Number(tokenObject?.w ?? 0));
  const tokenHeight = Math.max(1, Number(tokenObject?.h ?? 0));
  if (!Number.isFinite(tokenWidth) || !Number.isFinite(tokenHeight)) return;
  const borderStyle = getLayoutBorderStyle(tokenObject);
  const borderColor = getLayoutBorderColor(tokenObject);
  border.lineStyle({
    width: borderStyle.width,
    color: borderColor,
    alpha: borderStyle.alpha,
    alignment: 0.5,
    cap: "round",
    join: "round"
  });
  border.drawRoundedRect(0, 0, tokenWidth, tokenHeight, borderStyle.radius);
}

export function towCombatOverlayUpdateCustomLayoutBorderVisibility(tokenObject, { hovered = null, controlled = null } = {}) {
  if (!tokenObject || tokenObject.destroyed) return;
  const border = towCombatOverlayEnsureCustomLayoutBorder(tokenObject);
  if (!border) return;
  if (!isTokenLayoutBorderEnabled()) {
    border.visible = false;
    return;
  }
  const isHovered = (typeof hovered === "boolean") ? hovered : (tokenObject.hover === true || tokenObject._hover === true);
  const isControlled = (typeof controlled === "boolean") ? controlled : (tokenObject.controlled === true || tokenObject._controlled === true);
  border.visible = tokenObject.visible && (isHovered || isControlled);
}

export function towCombatOverlayClearCustomLayoutBorder(tokenObject) {
  const border = tokenObject?.[KEYS.layoutBorder];
  if (border) towCombatOverlayClearDisplayObject(border);
  delete tokenObject?.[KEYS.layoutBorder];
}

export async function towCombatOverlayBringTokenToFront(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const tokenDocument = tokenObject.document ?? null;
  if (tokenDocument?.isOwner && typeof tokenDocument.update === "function") {
    const sorts = (canvas?.tokens?.placeables ?? [])
      .map((token) => Number(token?.document?.sort ?? NaN))
      .filter((value) => Number.isFinite(value));
    const highestSort = sorts.length ? Math.max(...sorts) : Number(tokenDocument.sort ?? 0);
    const currentSort = Number(tokenDocument.sort ?? 0);
    if (Number.isFinite(highestSort) && currentSort <= highestSort) {
      if (currentSort < highestSort) await tokenDocument.update({ sort: highestSort + 1 });
      return;
    }
  }

  const layer = tokenObject.layer ?? canvas?.tokens;
  if (typeof layer?.bringToFront === "function") {
    layer.bringToFront(tokenObject);
    return;
  }
  if (typeof tokenObject.bringToFront === "function") {
    tokenObject.bringToFront();
    return;
  }

  const parent = tokenObject.parent;
  if (!parent || typeof parent.setChildIndex !== "function" || !Array.isArray(parent.children)) return;
  const topIndex = Math.max(0, parent.children.length - 1);
  const currentIndex = typeof parent.getChildIndex === "function" ? parent.getChildIndex(tokenObject) : -1;
  if (currentIndex === topIndex) return;
  parent.setChildIndex(tokenObject, topIndex);
}

export function towCombatOverlayGetDeadFilterTargets(tokenObject) {
  return [tokenObject?.mesh, tokenObject?.icon].filter(Boolean);
}

export function towCombatOverlayEnsureDeadVisual(tokenObject) {
  if (!tokenObject) return;
  if (!isTokenLayoutDeadVisualEnabled()) {
    towCombatOverlayClearDeadVisual(tokenObject);
    return;
  }
  const hasDead = !!tokenObject.document?.actor?.hasCondition?.("dead");
  if (!hasDead) {
    towCombatOverlayClearDeadVisual(tokenObject);
    return;
  }
  if (tokenObject[KEYS.deadVisualState]) towCombatOverlayClearDeadVisual(tokenObject);

  const targets = towCombatOverlayGetDeadFilterTargets(tokenObject);
  const entries = [];
  for (const displayObject of targets) {
    const originalFilters = Array.isArray(displayObject.filters) ? [...displayObject.filters] : [];
    const originalAlpha = Number(displayObject.alpha ?? 1);
    const originalTint = Number(displayObject.tint ?? 0xFFFFFF);
    const deadFilter = new PIXI.ColorMatrixFilter();
    deadFilter.reset();
    // Use a single explicit grayscale+darken matrix to avoid renderer/API color casts.
    const deadLuma = 0.56;
    const lr = 0.2126 * deadLuma;
    const lg = 0.7152 * deadLuma;
    const lb = 0.0722 * deadLuma;
    deadFilter.matrix = [
      lr, lg, lb, 0, 0,
      lr, lg, lb, 0, 0,
      lr, lg, lb, 0, 0,
      0, 0, 0, 1, 0
    ];
    displayObject.alpha = Math.max(0.18, originalAlpha * 0.92);
    if ("tint" in displayObject) displayObject.tint = 0xFFFFFF;
    displayObject.filters = [...originalFilters, deadFilter];
    entries.push({ displayObject, originalFilters, deadFilter, originalAlpha, originalTint });
  }

  tokenObject[KEYS.deadVisualState] = { entries };
}

export function towCombatOverlayClearDeadVisual(tokenObject) {
  const state = tokenObject?.[KEYS.deadVisualState];
  if (!state) return;

  for (const entry of state.entries ?? []) {
    const displayObject = entry?.displayObject;
    if (!displayObject || displayObject.destroyed) continue;
    displayObject.filters = Array.isArray(entry.originalFilters) ? entry.originalFilters : null;
    if (typeof entry.originalAlpha === "number") displayObject.alpha = entry.originalAlpha;
    if (typeof entry.originalTint === "number" && "tint" in displayObject) displayObject.tint = entry.originalTint;
  }

  delete tokenObject[KEYS.deadVisualState];
}

