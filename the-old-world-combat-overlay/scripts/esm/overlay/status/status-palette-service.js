import {
  KEYS,
  OVERLAY_FONT_SIZE,
  STATUS_PALETTE_ACTIVE_TINT,
  STATUS_PALETTE_BACKDROP_COLOR,
  STATUS_PALETTE_ICON_GAP,
  STATUS_PALETTE_ICON_SIZE,
  STATUS_PALETTE_INACTIVE_ALPHA,
  STATUS_PALETTE_INACTIVE_TINT,
  STATUS_PALETTE_ROWS,
  STATUS_PALETTE_SPECIAL_BG_DEAD_ALPHA,
  STATUS_PALETTE_SPECIAL_BG_OUTLINE,
  STATUS_PALETTE_SPECIAL_BG_STAGGERED_ALPHA,
  STATUS_PALETTE_DEAD_RING,
  STATUS_PALETTE_STAGGERED_RING,
  getStatusPaletteBackdropStyle,
  getStatusSpecialBgStyle
} from "../../runtime/overlay-runtime-constants.js";
import { clearStatusTooltip, hideStatusTooltip, runActorOpLock } from "../shared/shared-service.js";
import {
  towCombatOverlayBindTooltipHandlers,
  towCombatOverlayCanEditActor,
  towCombatOverlayForEachSceneToken,
  towCombatOverlayGetActorFromToken,
  towCombatOverlayGetMouseButton,
  towCombatOverlayGetOverlayEdgePadPx,
  towCombatOverlayGetTokenOverlayScale,
  towCombatOverlayPreventPointerDefault,
  towCombatOverlayWarnNoPermission
} from "../shared/core-helpers-service.js";
import {
  towCombatOverlayClearCustomLayoutBorder,
  towCombatOverlayClearDeadVisual,
  towCombatOverlayClearDisplayObject,
  towCombatOverlayRestoreTokenOverlayInteractivity
} from "../layout-state-service.js";
import { towCombatOverlayAddActorCondition, towCombatOverlayRemoveActorCondition } from "../shared/actions-bridge-service.js";

function getIconSrc(displayObject) {
  return (
    displayObject?.texture?.baseTexture?.resource?.source?.src ||
    displayObject?.texture?.baseTexture?.resource?.url ||
    displayObject?.texture?.baseTexture?.resource?.src ||
    ""
  );
}

function normalizeIconSrc(src) {
  return String(src ?? "").trim().toLowerCase().split("?")[0];
}

function getActorEffects(actor) {
  return Array.from(actor?.effects?.contents ?? []);
}

function getActorStatusSet(actor) {
  const statuses = new Set(Array.from(actor?.statuses ?? []).map((s) => String(s)));
  for (const effect of getActorEffects(actor)) {
    for (const status of Array.from(effect?.statuses ?? [])) statuses.add(String(status));
  }
  return statuses;
}

function getActorEffectsByStatus(actor, conditionId) {
  const id = String(conditionId ?? "");
  if (!id) return [];
  return getActorEffects(actor).filter((effect) => Array.from(effect?.statuses ?? []).map(String).includes(id));
}

function getAllConditionEntries() {
  const conditions = game.oldworld?.config?.conditions ?? {};
  return Object.entries(conditions)
    .map(([id, data]) => ({
      id: String(id),
      img: String(data?.img ?? data?.icon ?? `/systems/whtow/assets/icons/conditions/${id}.svg`)
    }))
    .filter((entry) => !!entry.id && !!entry.img);
}

function getConditionTooltipData(conditionId) {
  const condition = game.oldworld?.config?.conditions?.[String(conditionId ?? "")] ?? {};
  const rawName = String(condition?.name ?? conditionId ?? "Condition");
  const rawDescription = String(condition?.description ?? "");
  const name = rawName.startsWith("TOW.") ? game.i18n.localize(rawName) : rawName;
  const localizedDescription = rawDescription.startsWith("TOW.") ? game.i18n.localize(rawDescription) : rawDescription;
  const shortDescription = localizedDescription ? (localizedDescription.split(/(?<=[.!?])\s+/)[0] ?? localizedDescription).trim() : "";
  return { name: String(name ?? conditionId ?? "Condition"), description: String(shortDescription ?? "") };
}

async function setActorConditionState(actor, conditionId, active) {
  if (!actor || !conditionId) return;
  const id = String(conditionId);
  if (id !== "staggered" && typeof actor.toggleStatusEffect === "function") {
    try {
      await actor.toggleStatusEffect(id, { active });
      return;
    } catch (_error) {}
  }
  if (active) await towCombatOverlayAddActorCondition(actor, id);
  else await towCombatOverlayRemoveActorCondition(actor, id);
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

async function toggleConditionFromPalette(actor, conditionId) {
  if (!actor || !conditionId) return;
  if (!towCombatOverlayCanEditActor(actor)) {
    towCombatOverlayWarnNoPermission(actor);
    return;
  }
  const id = String(conditionId);
  await runActorOpLock(actor, `condition:${id}`, async () => {
    const active = getActorStatusSet(actor).has(id);
    if (!active) return setActorConditionState(actor, id, true);
    await setActorConditionState(actor, id, false);
    for (let i = 0; i < 4; i++) {
      if (!getActorStatusSet(actor).has(id)) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    for (const effect of getActorEffectsByStatus(actor, id)) {
      const liveEffect = effect?.id ? actor.effects?.get?.(effect.id) : null;
      if (liveEffect) await liveEffect.delete();
    }
  });
}

function stylePaletteSprite(sprite, actor, conditionId, activeStatuses = null) {
  const statuses = activeStatuses instanceof Set ? activeStatuses : getActorStatusSet(actor);
  const active = statuses.has(String(conditionId ?? ""));
  const key = String(conditionId ?? "").toLowerCase();
  const iconSrc = normalizeIconSrc(getIconSrc(sprite));
  const conditionImgSrc = normalizeIconSrc(sprite?.[KEYS.statusConditionImg] ?? "");
  const specialKind = key.includes("stagger") || conditionImgSrc.includes("staggered.svg") || iconSrc.includes("staggered.svg")
    ? "staggered"
    : key.includes("dead") || conditionImgSrc.includes("dead.svg") || iconSrc.includes("dead.svg")
      ? "dead"
      : null;

  const clearSpecialBg = () => {
    const bg = sprite[KEYS.statusPaletteBg];
    if (!bg) return;
    bg.parent?.removeChild(bg);
    bg.destroy();
    delete sprite[KEYS.statusPaletteBg];
  };

  const applySpecialBg = (color, alpha) => {
    let bg = sprite[KEYS.statusPaletteBg];
    if (!bg || bg.destroyed) {
      bg = new PIXI.Graphics();
      bg.eventMode = "none";
      sprite[KEYS.statusPaletteBg] = bg;
      const parent = sprite.parent;
      if (parent) parent.addChildAt(bg, Math.min(1, parent.children.length));
    }
    const size = Number.isFinite(Number(sprite[KEYS.statusIconSize]))
      ? Number(sprite[KEYS.statusIconSize])
      : STATUS_PALETTE_ICON_SIZE;
    const bgStyle = getStatusSpecialBgStyle(size, alpha);
    bg.clear();
    bg.lineStyle({ width: bgStyle.outlineWidth, color: STATUS_PALETTE_SPECIAL_BG_OUTLINE, alpha: bgStyle.outlineAlpha, alignment: 0.5 });
    bg.beginFill(color, bgStyle.fillAlpha);
    bg.drawRoundedRect(sprite.x - bgStyle.pad, sprite.y - bgStyle.pad, Math.max(2, size + (bgStyle.pad * 2)), Math.max(2, size + (bgStyle.pad * 2)), bgStyle.radius);
    bg.endFill();
  };

  if (!active) {
    sprite.tint = STATUS_PALETTE_INACTIVE_TINT;
    sprite.alpha = STATUS_PALETTE_INACTIVE_ALPHA;
    clearSpecialBg();
    return;
  }

  sprite.tint = STATUS_PALETTE_ACTIVE_TINT;
  sprite.alpha = 0.98;
  if (specialKind === "staggered") return applySpecialBg(STATUS_PALETTE_STAGGERED_RING, STATUS_PALETTE_SPECIAL_BG_STAGGERED_ALPHA);
  if (specialKind === "dead") return applySpecialBg(STATUS_PALETTE_DEAD_RING, STATUS_PALETTE_SPECIAL_BG_DEAD_ALPHA);
  clearSpecialBg();
}

function drawStatusPaletteBackdrop(layer, { iconSize, totalWidth, totalHeight, backdropStyle = null }) {
  let backdrop = layer[KEYS.statusPaletteBackdrop];
  if (!backdrop || backdrop.destroyed || backdrop.parent !== layer) {
    if (backdrop && !backdrop.destroyed) backdrop.destroy();
    backdrop = new PIXI.Graphics();
    backdrop.eventMode = "none";
    layer.addChildAt(backdrop, 0);
    layer[KEYS.statusPaletteBackdrop] = backdrop;
  }
  const style = backdropStyle ?? getStatusPaletteBackdropStyle(iconSize);
  backdrop.clear();
  backdrop.beginFill(STATUS_PALETTE_BACKDROP_COLOR, style.fillAlpha);
  backdrop.drawRoundedRect(-style.padX, -style.padY, Math.max(2, totalWidth + (style.padX * 2)), Math.max(2, totalHeight + (style.padY * 2)), style.radius);
  backdrop.endFill();
}

export function setupStatusPalette(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const actor = towCombatOverlayGetActorFromToken(tokenObject);
  if (!actor) return;
  const conditions = getAllConditionEntries();
  if (!conditions.length) return clearStatusPalette(tokenObject);

  const expectedCount = conditions.length;
  const overlayScale = towCombatOverlayGetTokenOverlayScale(tokenObject);
  const iconSize = Math.max(6, Math.round((OVERLAY_FONT_SIZE + 2) * overlayScale));
  const iconGap = Math.max(1, Math.round(STATUS_PALETTE_ICON_GAP * (iconSize / STATUS_PALETTE_ICON_SIZE)));
  let layer = tokenObject[KEYS.statusPaletteLayer];
  const iconChildrenCount = layer
    ? (layer.children?.filter((child) => child?.[KEYS.statusConditionId]).length ?? 0)
    : 0;
  const shouldRebuild = !layer || layer.destroyed || layer.parent !== tokenObject || iconChildrenCount !== expectedCount || tokenObject[KEYS.statusPaletteMetrics]?.iconSize !== iconSize || tokenObject[KEYS.statusPaletteMetrics]?.iconGap !== iconGap;

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

    const columns = Math.max(1, Math.ceil(expectedCount / STATUS_PALETTE_ROWS));
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const sprite = PIXI.Sprite.from(condition.img);
      sprite.width = iconSize;
      sprite.height = iconSize;
      sprite.eventMode = "static";
      sprite.interactive = true;
      sprite.cursor = towCombatOverlayCanEditActor(actor) ? "pointer" : "default";
      sprite[KEYS.statusConditionId] = condition.id;
      sprite[KEYS.statusConditionImg] = condition.img;
      sprite[KEYS.statusIconSize] = iconSize;
      const col = i % columns;
      const row = Math.floor(i / columns);
      sprite.position.set(col * (iconSize + iconGap), row * (iconSize + iconGap));
      const onDown = async (event) => {
        towCombatOverlayPreventPointerDefault(event);
        if (towCombatOverlayGetMouseButton(event) !== 0) return;
        await toggleConditionFromPalette(actor, condition.id);
      };
      sprite.on("pointerdown", onDown);
      sprite[KEYS.statusIconHandler] = onDown;
      towCombatOverlayBindTooltipHandlers(sprite, () => getConditionTooltipData(condition.id), {
        over: KEYS.statusIconTooltipOverHandler,
        move: KEYS.statusIconTooltipMoveHandler,
        out: KEYS.statusIconTooltipOutHandler
      });
      layer.addChild(sprite);
    }
    tokenObject[KEYS.statusPaletteMetrics] = { iconSize, iconGap };
  }

  const columns = Math.max(1, Math.ceil(expectedCount / STATUS_PALETTE_ROWS));
  const totalRows = Math.ceil(expectedCount / columns);
  const totalWidth = (columns * iconSize) + ((columns - 1) * iconGap);
  const totalHeight = (totalRows * iconSize) + ((totalRows - 1) * iconGap);
  const edgePad = towCombatOverlayGetOverlayEdgePadPx(tokenObject);
  const backdropStyle = getStatusPaletteBackdropStyle(iconSize);
  layer.position.set(
    Math.round((tokenObject.w - totalWidth) / 2),
    Math.round(tokenObject.h + edgePad + backdropStyle.padY)
  );
  drawStatusPaletteBackdrop(layer, { iconSize, totalWidth, totalHeight, backdropStyle });
  layer.visible = tokenObject.visible;
  const activeStatuses = getActorStatusSet(actor);
  for (const sprite of layer.children?.filter((child) => child?.[KEYS.statusConditionId]) ?? []) {
    sprite.cursor = towCombatOverlayCanEditActor(actor) ? "pointer" : "default";
    stylePaletteSprite(sprite, actor, sprite[KEYS.statusConditionId], activeStatuses);
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
