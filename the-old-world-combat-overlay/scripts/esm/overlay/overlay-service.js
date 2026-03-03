import {
  ACTOR_OVERLAY_RESYNC_DELAYS_MS,
  KEYS,
  MODULE_KEY,
  OVERLAY_FONT_SIZE,
  STATUS_PALETTE_ACTIVE_TINT,
  STATUS_PALETTE_BACKDROP_COLOR,
  STATUS_PALETTE_DEAD_RING,
  STATUS_PALETTE_ICON_GAP,
  STATUS_PALETTE_ICON_SIZE,
  STATUS_PALETTE_INACTIVE_ALPHA,
  STATUS_PALETTE_INACTIVE_TINT,
  STATUS_PALETTE_ROWS,
  STATUS_PALETTE_SPECIAL_BG_DEAD_ALPHA,
  STATUS_PALETTE_SPECIAL_BG_OUTLINE,
  STATUS_PALETTE_SPECIAL_BG_STAGGERED_ALPHA,
  STATUS_PALETTE_STAGGERED_RING,
  getStatusPaletteBackdropStyle,
  getStatusSpecialBgStyle
} from "../overlay-runtime-constants.js";
import {
  registerTowCombatOverlayHooks,
  unregisterTowCombatOverlayHooks
} from "../register-overlay-hooks.js";
import {
  clearStatusTooltip,
  getTypeTooltipData,
  hideStatusTooltip,
  runActorOpLock,
  showOverlayTooltip
} from "./shared-service.js";
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
} from "./core-helpers-service.js";
import { towCombatOverlayGetActorTokenObjects } from "./core-helpers-service.js";
import "./automation-service.js";
import {
  towCombatOverlayBringTokenToFront,
  towCombatOverlayClearCustomLayoutBorder,
  towCombatOverlayClearDeadVisual,
  towCombatOverlayClearDisplayObject,
  towCombatOverlayEnsureDeadVisual,
  towCombatOverlayEnsureTokenOverlayInteractivity,
  towCombatOverlayGetMaxWoundLimit,
  towCombatOverlayPrimeDeadPresence,
  towCombatOverlayQueueWoundSyncFromDeadState,
  towCombatOverlayRestoreTokenOverlayInteractivity,
  towCombatOverlayUpdateCustomLayoutBorderVisibility,
  towCombatOverlayUpdateTokenOverlayHitArea
} from "./layout-state-service.js";
import {
  towCombatOverlayAddActorCondition,
  towCombatOverlayRemoveActorCondition
} from "./actions-bridge-service.js";
import {
  towCombatOverlayClearAllNameLabels,
  towCombatOverlayClearAllResilienceLabels,
  towCombatOverlayClearAllWoundControls,
  towCombatOverlayGetActorTypeLabel,
  towCombatOverlayUpdateNameLabel,
  towCombatOverlayUpdateResilienceLabel,
  towCombatOverlayUpdateWoundControlUI
} from "./controls-service.js";

function overlayServiceCanEditActorRef(actor) {
  return towCombatOverlayCanEditActor(actor);
}

function overlayServiceWarnNoPermissionRef(actor) {
  return towCombatOverlayWarnNoPermission(actor);
}

function overlayServiceGetActorFromTokenRef(tokenObject) {
  return towCombatOverlayGetActorFromToken(tokenObject);
}

function overlayServiceForEachSceneTokenRef(callback) {
  return towCombatOverlayForEachSceneToken(callback);
}

function overlayServiceGetTokenOverlayScaleRef(tokenObject) {
  return towCombatOverlayGetTokenOverlayScale(tokenObject);
}

function overlayServiceGetOverlayEdgePadPxRef(tokenObject) {
  return towCombatOverlayGetOverlayEdgePadPx(tokenObject);
}

function overlayServicePreventPointerDefaultRef(event) {
  return towCombatOverlayPreventPointerDefault(event);
}

function overlayServiceGetMouseButtonRef(event) {
  return towCombatOverlayGetMouseButton(event);
}

function overlayServiceBindTooltipHandlersRef(displayObject, getTooltipData, keyStore) {
  return towCombatOverlayBindTooltipHandlers(displayObject, getTooltipData, keyStore);
}

async function overlayServiceAddActorConditionRef(actor, condition) {
  return towCombatOverlayAddActorCondition(actor, condition);
}

async function overlayServiceRemoveActorConditionRef(actor, condition) {
  return towCombatOverlayRemoveActorCondition(actor, condition);
}

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

function extractConditionIdFromSrc(src) {
  const match = normalizeIconSrc(src).match(/\/conditions\/([a-z0-9_-]+)\.svg$/);
  return match?.[1] ?? null;
}

function getActorEffects(actor) {
  return Array.from(actor?.effects?.contents ?? []);
}

function getEffectIconSrc(effect) {
  return normalizeIconSrc(effect?.img ?? effect?.icon ?? "");
}

async function setActorConditionState(actor, conditionId, active) {
  if (!actor || !conditionId) return;
  const id = String(conditionId);
  const keepCustomFlow = id === "staggered";
  if (!keepCustomFlow && typeof actor.toggleStatusEffect === "function") {
    try {
      await actor.toggleStatusEffect(id, { active });
      return;
    } catch (_error) {
    }
  }

  if (active) await overlayServiceAddActorConditionRef(actor, id);
  else await overlayServiceRemoveActorConditionRef(actor, id);
}

function getActorStatusSet(actor) {
  const statuses = new Set(Array.from(actor?.statuses ?? []).map((s) => String(s)));
  for (const effect of getActorEffects(actor)) {
    for (const status of Array.from(effect?.statuses ?? [])) {
      statuses.add(String(status));
    }
  }
  return statuses;
}

function getActorEffectsByStatus(actor, conditionId) {
  const id = String(conditionId ?? "");
  if (!id) return [];
  return getActorEffects(actor).filter((effect) => {
    const statuses = Array.from(effect?.statuses ?? []).map((status) => String(status));
    return statuses.includes(id);
  });
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
  const localizedDescription = rawDescription.startsWith("TOW.")
    ? game.i18n.localize(rawDescription)
    : rawDescription;
  const shortDescription = localizedDescription
    ? (localizedDescription.split(/(?<=[.!?])\s+/)[0] ?? localizedDescription).trim()
    : "";
  return {
    name: String(name ?? conditionId ?? "Condition"),
    description: String(shortDescription ?? "")
  };
}

function resolveEffectFromIcon(actor, sprite) {
  const spriteSrc = normalizeIconSrc(getIconSrc(sprite));
  if (!spriteSrc) return null;
  return getActorEffects(actor).find((effect) => getEffectIconSrc(effect) === spriteSrc) ?? null;
}

async function removeStatusIconEffect(tokenObject, sprite) {
  const actor = overlayServiceGetActorFromTokenRef(tokenObject);
  if (!actor) return;
  if (!overlayServiceCanEditActorRef(actor)) {
    overlayServiceWarnNoPermissionRef(actor);
    return;
  }

  const effect = resolveEffectFromIcon(actor, sprite);
  const conditionId = extractConditionIdFromSrc(getIconSrc(sprite));
  const removeKey = effect?.id ?? conditionId ?? normalizeIconSrc(getIconSrc(sprite));
  if (!removeKey) return;

  await runActorOpLock(actor, `remove:${removeKey}`, async () => {
    if (effect?.id) {
      const liveEffect = actor.effects?.get?.(effect.id);
      if (liveEffect) await liveEffect.delete();
    } else if (conditionId && actor.hasCondition?.(conditionId)) {
      await setActorConditionState(actor, conditionId, false);
    }
  });
}

function clearStatusIconHandler(sprite) {
  const handler = sprite?.[KEYS.statusIconHandler];
  if (handler) {
    sprite.off("pointerdown", handler);
    sprite.off("contextmenu", handler);
    delete sprite[KEYS.statusIconHandler];
  }
  const overHandler = sprite?.[KEYS.statusIconTooltipOverHandler];
  if (overHandler) {
    sprite.off("pointerover", overHandler);
    delete sprite[KEYS.statusIconTooltipOverHandler];
  }
  const moveHandler = sprite?.[KEYS.statusIconTooltipMoveHandler];
  if (moveHandler) {
    sprite.off("pointermove", moveHandler);
    delete sprite[KEYS.statusIconTooltipMoveHandler];
  }
  const outHandler = sprite?.[KEYS.statusIconTooltipOutHandler];
  if (outHandler) {
    sprite.off("pointerout", outHandler);
    sprite.off("pointerupoutside", outHandler);
    sprite.off("pointercancel", outHandler);
    delete sprite[KEYS.statusIconTooltipOutHandler];
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
  const tooltip = tokenObject?.tooltip ?? null;
  if (tooltip) {
    if (typeof tokenObject[KEYS.coreTooltipVisible] === "undefined") {
      tokenObject[KEYS.coreTooltipVisible] = tooltip.visible !== false;
    }
    if (typeof tokenObject[KEYS.coreTooltipRenderable] === "undefined") {
      tokenObject[KEYS.coreTooltipRenderable] = tooltip.renderable !== false;
    }
    tooltip.visible = false;
    tooltip.renderable = false;
  }

  const nameplate = tokenObject?.nameplate ?? null;
  if (nameplate) {
    if (typeof tokenObject[KEYS.coreNameplateVisible] === "undefined") {
      tokenObject[KEYS.coreNameplateVisible] = nameplate.visible !== false;
    }
    if (typeof tokenObject[KEYS.coreNameplateRenderable] === "undefined") {
      tokenObject[KEYS.coreNameplateRenderable] = nameplate.renderable !== false;
    }
    nameplate.visible = false;
    nameplate.renderable = false;
  }

  const border = tokenObject.border ?? null;
  if (border) {
    if (typeof tokenObject[KEYS.coreBorderVisible] === "undefined") {
      tokenObject[KEYS.coreBorderVisible] = border.visible !== false;
    }
    if (typeof tokenObject[KEYS.coreBorderAlpha] === "undefined") {
      tokenObject[KEYS.coreBorderAlpha] = Number(border.alpha ?? 1);
    }
    border.visible = false;
    if ("alpha" in border) border.alpha = 0;
  }
}

function restoreCoreTokenHoverVisuals(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const tooltip = tokenObject?.tooltip ?? null;
  if (tooltip && typeof tokenObject[KEYS.coreTooltipVisible] === "boolean") {
    tooltip.visible = tokenObject[KEYS.coreTooltipVisible];
  }
  if (tooltip && typeof tokenObject[KEYS.coreTooltipRenderable] === "boolean") {
    tooltip.renderable = tokenObject[KEYS.coreTooltipRenderable];
  }
  delete tokenObject[KEYS.coreTooltipVisible];
  delete tokenObject[KEYS.coreTooltipRenderable];

  const nameplate = tokenObject?.nameplate ?? null;
  if (nameplate && typeof tokenObject[KEYS.coreNameplateVisible] === "boolean") {
    nameplate.visible = tokenObject[KEYS.coreNameplateVisible];
  }
  if (nameplate && typeof tokenObject[KEYS.coreNameplateRenderable] === "boolean") {
    nameplate.renderable = tokenObject[KEYS.coreNameplateRenderable];
  }
  delete tokenObject[KEYS.coreNameplateVisible];
  delete tokenObject[KEYS.coreNameplateRenderable];

  const border = tokenObject.border ?? null;
  if (border && typeof tokenObject[KEYS.coreBorderVisible] === "boolean") {
    border.visible = tokenObject[KEYS.coreBorderVisible];
  }
  if (border && typeof tokenObject[KEYS.coreBorderAlpha] === "number" && "alpha" in border) {
    border.alpha = tokenObject[KEYS.coreBorderAlpha];
  }
  delete tokenObject[KEYS.coreBorderVisible];
  delete tokenObject[KEYS.coreBorderAlpha];
}

async function toggleConditionFromPalette(actor, conditionId) {
  if (!actor || !conditionId) return;
  if (!overlayServiceCanEditActorRef(actor)) {
    overlayServiceWarnNoPermissionRef(actor);
    return;
  }
  const id = String(conditionId);
  await runActorOpLock(actor, `condition:${id}`, async () => {
    const isActive = getActorStatusSet(actor).has(id);
    if (!isActive) {
      await setActorConditionState(actor, id, true);
      return;
    }

    await setActorConditionState(actor, id, false);
    let stillActive = getActorStatusSet(actor).has(id);
    if (stillActive) {
      for (let i = 0; i < 4; i++) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        stillActive = getActorStatusSet(actor).has(id);
        if (!stillActive) break;
      }
    }
    if (!stillActive) return;

    for (const effect of getActorEffectsByStatus(actor, id)) {
      if (!effect?.id) continue;
      const liveEffect = actor.effects?.get?.(effect.id);
      if (!liveEffect) continue;
      await liveEffect.delete();
    }
  });
}

function stylePaletteSprite(sprite, actor, conditionId, activeStatuses = null) {
  const statuses = activeStatuses instanceof Set ? activeStatuses : getActorStatusSet(actor);
  const active = statuses.has(String(conditionId ?? ""));
  const key = String(conditionId ?? "").toLowerCase();
  const iconSrc = normalizeIconSrc(getIconSrc(sprite));
  const conditionImgSrc = normalizeIconSrc(sprite?._towConditionImg ?? "");
  const specialKind = (() => {
    if (key.includes("stagger")) return "staggered";
    if (key.includes("dead")) return "dead";
    if (conditionImgSrc.includes("/conditions/staggered.svg")) return "staggered";
    if (conditionImgSrc.includes("/conditions/dead.svg")) return "dead";
    if (iconSrc.includes("/conditions/staggered.svg")) return "staggered";
    if (iconSrc.includes("/conditions/dead.svg")) return "dead";
    return null;
  })();

  const clearLegacySpecials = () => {
    const ring = sprite._towPaletteRing;
    if (ring) {
      ring.parent?.removeChild(ring);
      ring.destroy();
      delete sprite._towPaletteRing;
    }
    const filter = sprite._towPaletteFilter;
    if (filter) {
      filter.destroy?.();
      delete sprite._towPaletteFilter;
    }
    delete sprite._towPaletteFilterKind;
    sprite.filters = null;
  };

  const clearSpecialBg = () => {
    const bg = sprite._towPaletteBg;
    if (!bg) return;
    bg.parent?.removeChild(bg);
    bg.destroy();
    delete sprite._towPaletteBg;
  };

  const applySpecialBg = (color, alpha) => {
    let bg = sprite._towPaletteBg;
    if (!bg || bg.destroyed) {
      bg = new PIXI.Graphics();
      bg.eventMode = "none";
      bg._towPaletteHelper = true;
      sprite._towPaletteBg = bg;
      const parent = sprite.parent;
      if (parent) {
        const backdrop = parent[KEYS.statusPaletteBackdrop];
        const backdropIndex = (backdrop && backdrop.parent === parent)
          ? Math.max(0, parent.getChildIndex(backdrop) + 1)
          : 0;
        parent.addChildAt(bg, Math.min(backdropIndex, parent.children.length));
      }
    } else if (bg.parent !== sprite.parent) {
      const parent = sprite.parent;
      bg.parent?.removeChild(bg);
      if (parent) {
        const backdrop = parent[KEYS.statusPaletteBackdrop];
        const backdropIndex = (backdrop && backdrop.parent === parent)
          ? Math.max(0, parent.getChildIndex(backdrop) + 1)
          : 0;
        parent.addChildAt(bg, Math.min(backdropIndex, parent.children.length));
      }
    }

    const size = Number.isFinite(Number(sprite._towIconSize)) ? Number(sprite._towIconSize) : STATUS_PALETTE_ICON_SIZE;
    const bgStyle = getStatusSpecialBgStyle(size, alpha);
    bg.clear();
    bg.lineStyle({
      width: bgStyle.outlineWidth,
      color: STATUS_PALETTE_SPECIAL_BG_OUTLINE,
      alpha: bgStyle.outlineAlpha,
      alignment: 0.5
    });
    bg.beginFill(color, bgStyle.fillAlpha);
    bg.drawRoundedRect(
      sprite.x - bgStyle.pad,
      sprite.y - bgStyle.pad,
      Math.max(2, size + (bgStyle.pad * 2)),
      Math.max(2, size + (bgStyle.pad * 2)),
      bgStyle.radius
    );
    bg.endFill();
  };

  if (!active) {
    sprite.tint = STATUS_PALETTE_INACTIVE_TINT;
    sprite.alpha = STATUS_PALETTE_INACTIVE_ALPHA;
    clearLegacySpecials();
    clearSpecialBg();
    return;
  }

  clearLegacySpecials();
  sprite.alpha = 0.98;

  if (specialKind === "staggered") {
    sprite.tint = STATUS_PALETTE_ACTIVE_TINT;
    applySpecialBg(STATUS_PALETTE_STAGGERED_RING, STATUS_PALETTE_SPECIAL_BG_STAGGERED_ALPHA);
    return;
  }

  if (specialKind === "dead") {
    sprite.tint = STATUS_PALETTE_ACTIVE_TINT;
    applySpecialBg(STATUS_PALETTE_DEAD_RING, STATUS_PALETTE_SPECIAL_BG_DEAD_ALPHA);
    return;
  }

  sprite.tint = STATUS_PALETTE_ACTIVE_TINT;
  clearSpecialBg();
}

function drawStatusPaletteBackdrop(layer, { iconSize, totalWidth, totalHeight }) {
  if (!layer || layer.destroyed) return;
  let backdrop = layer[KEYS.statusPaletteBackdrop];
  if (!backdrop || backdrop.destroyed || backdrop.parent !== layer) {
    if (backdrop && !backdrop.destroyed) {
      backdrop.parent?.removeChild(backdrop);
      backdrop.destroy();
    }
    backdrop = new PIXI.Graphics();
    backdrop.eventMode = "none";
    layer.addChildAt(backdrop, 0);
    layer[KEYS.statusPaletteBackdrop] = backdrop;
  } else if (layer.getChildIndex(backdrop) !== 0) {
    layer.setChildIndex(backdrop, 0);
  }

  const style = getStatusPaletteBackdropStyle(iconSize);
  backdrop.clear();
  backdrop.beginFill(STATUS_PALETTE_BACKDROP_COLOR, style.fillAlpha);
  backdrop.drawRoundedRect(
    -style.padX,
    -style.padY,
    Math.max(2, totalWidth + (style.padX * 2)),
    Math.max(2, totalHeight + (style.padY * 2)),
    style.radius
  );
  backdrop.endFill();
}

function setupStatusPalette(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const actor = overlayServiceGetActorFromTokenRef(tokenObject);
  if (!actor) return;

  const conditions = getAllConditionEntries();
  if (!conditions.length) {
    clearStatusPalette(tokenObject);
    return;
  }

  const expectedCount = conditions.length;
  const overlayScale = overlayServiceGetTokenOverlayScaleRef(tokenObject);
  const iconSize = Math.max(6, Math.round((OVERLAY_FONT_SIZE + 2) * overlayScale));
  const iconGap = Math.max(1, Math.round(STATUS_PALETTE_ICON_GAP * (iconSize / STATUS_PALETTE_ICON_SIZE)));
  let layer = tokenObject[KEYS.statusPaletteLayer];
  const iconChildrenCount = layer
    ? (layer.children?.filter((child) => child?._towConditionId).length ?? 0)
    : 0;
  const shouldRebuild = !layer
    || layer.destroyed
    || layer.parent !== tokenObject
    || iconChildrenCount !== expectedCount
    || tokenObject[KEYS.statusPaletteMetrics]?.iconSize !== iconSize
    || tokenObject[KEYS.statusPaletteMetrics]?.iconGap !== iconGap;

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
      sprite.cursor = overlayServiceCanEditActorRef(actor) ? "pointer" : "default";
      sprite._towConditionId = condition.id;
      sprite._towConditionImg = condition.img;
      sprite._towIconSize = iconSize;

      const col = i % columns;
      const row = Math.floor(i / columns);
      sprite.position.set(
        col * (iconSize + iconGap),
        row * (iconSize + iconGap)
      );

      const onDown = async (event) => {
        overlayServicePreventPointerDefaultRef(event);
        if (overlayServiceGetMouseButtonRef(event) !== 0) return;
        await toggleConditionFromPalette(actor, condition.id);
      };
      sprite.on("pointerdown", onDown);
      sprite[KEYS.statusIconHandler] = onDown;
      overlayServiceBindTooltipHandlersRef(
        sprite,
        () => getConditionTooltipData(condition.id),
        {
          over: KEYS.statusIconTooltipOverHandler,
          move: KEYS.statusIconTooltipMoveHandler,
          out: KEYS.statusIconTooltipOutHandler
        }
      );

      layer.addChild(sprite);
    }
    tokenObject[KEYS.statusPaletteMetrics] = { iconSize, iconGap };
  }

  const columns = Math.max(1, Math.ceil(expectedCount / STATUS_PALETTE_ROWS));
  const totalRows = Math.ceil(expectedCount / columns);
  const totalWidth = (columns * iconSize) + ((columns - 1) * iconGap);
  const totalHeight = (totalRows * iconSize) + ((totalRows - 1) * iconGap);
  const posX = Math.round((tokenObject.w - totalWidth) / 2);
  const edgePad = overlayServiceGetOverlayEdgePadPxRef(tokenObject);
  const posY = Math.round(tokenObject.h + edgePad);
  layer.position.set(posX, posY);
  drawStatusPaletteBackdrop(layer, { iconSize, totalWidth, totalHeight });

  layer.visible = tokenObject.visible;
  const activeStatuses = getActorStatusSet(actor);

  for (const sprite of layer.children?.filter((child) => child?._towConditionId) ?? []) {
    sprite.cursor = overlayServiceCanEditActorRef(actor) ? "pointer" : "default";
    stylePaletteSprite(sprite, actor, sprite._towConditionId, activeStatuses);
  }
}

function clearAllStatusOverlays() {
  hideStatusTooltip();
  overlayServiceForEachSceneTokenRef((token) => {
    for (const sprite of token.effects?.children ?? []) clearStatusIconHandler(sprite);
    clearStatusPalette(token);
    restoreDefaultStatusPanel(token);
    restoreCoreTokenHoverVisuals(token);
    towCombatOverlayClearDeadVisual(token);
    towCombatOverlayRestoreTokenOverlayInteractivity(token);
    towCombatOverlayClearCustomLayoutBorder(token);
  });

  const orphaned = [];
  for (const child of canvas.tokens.children ?? []) {
    if (child?.[KEYS.statusPaletteMarker] === true) orphaned.push(child);
  }
  for (const layer of orphaned) towCombatOverlayClearDisplayObject(layer);
  clearStatusTooltip();
}

export function towCombatOverlayRefreshTokenOverlay(tokenObject) {
  towCombatOverlayPrimeDeadPresence(overlayServiceGetActorFromTokenRef(tokenObject));
  towCombatOverlayEnsureTokenOverlayInteractivity(tokenObject);
  hideDefaultStatusPanel(tokenObject);
  towCombatOverlayHideCoreTokenHoverVisuals(tokenObject);
  setupStatusPalette(tokenObject);
  towCombatOverlayUpdateWoundControlUI(tokenObject);
  towCombatOverlayUpdateNameLabel(tokenObject);
  towCombatOverlayUpdateResilienceLabel(tokenObject);
  towCombatOverlayUpdateTokenOverlayHitArea(tokenObject);
  towCombatOverlayUpdateCustomLayoutBorderVisibility(tokenObject);
  towCombatOverlayEnsureDeadVisual(tokenObject);
}

export function towCombatOverlayRefreshActorOverlays(actor) {
  towCombatOverlayPrimeDeadPresence(actor);
  towCombatOverlayQueueWoundSyncFromDeadState(actor);
  for (const tokenObject of towCombatOverlayGetActorTokenObjects(actor)) {
    towCombatOverlayRefreshTokenOverlay(tokenObject);
  }
}

export function towCombatOverlayQueueActorOverlayResync(actor) {
  if (!actor) return;
  const state = game[MODULE_KEY];
  if (!state) return;
  if (!state.actorOverlayResyncTimers) state.actorOverlayResyncTimers = new Map();

  const key = actor.uuid ?? actor.id;
  if (!key) return;

  const existing = state.actorOverlayResyncTimers.get(key);
  if (Array.isArray(existing)) {
    for (const timer of existing) clearTimeout(timer);
  }

  const timers = ACTOR_OVERLAY_RESYNC_DELAYS_MS.map((delayMs) => setTimeout(() => {
    towCombatOverlayRefreshActorOverlays(actor);
  }, delayMs));
  state.actorOverlayResyncTimers.set(key, timers);
}

export function towCombatOverlayRefreshAllOverlays() {
  overlayServiceForEachSceneTokenRef((token) => {
    towCombatOverlayRefreshTokenOverlay(token);
  });
}

function registerHooks() {
  return registerTowCombatOverlayHooks();
}

function unregisterHooks(hookIds) {
  unregisterTowCombatOverlayHooks(hookIds);
}

export function towCombatOverlayIsEnabled() {
  return !!game[MODULE_KEY];
}

export function towCombatOverlayEnable() {
  if (game[MODULE_KEY]) return false;
  const hookIds = registerHooks();
  game[MODULE_KEY] = {
    ...hookIds,
    recentAttacks: new Map(),
    recentTargets: new Map(),
    autoApplyArmed: new Set(),
    actorOverlayResyncTimers: new Map(),
    deadSyncTimers: new Map(),
    deadToWoundSyncTimers: new Map(),
    deadPresenceByActor: new Map(),
    deadSyncInFlight: new Set(),
    statusRemoveInFlight: new Set(),
    statusRemoveQueue: new Map(),
    lastCanvasScale: Number(canvas?.stage?.scale?.x ?? 1)
  };
  towCombatOverlayRefreshAllOverlays();
  ui.notifications.info("Overlay enabled: wounds + resilience + status highlights.");
  return true;
}

export function towCombatOverlayDisable() {
  const state = game[MODULE_KEY];
  if (!state) return false;
  unregisterHooks(state);
  if (state?.actorOverlayResyncTimers instanceof Map) {
    for (const timers of state.actorOverlayResyncTimers.values()) {
      if (!Array.isArray(timers)) continue;
      for (const timer of timers) clearTimeout(timer);
    }
    state.actorOverlayResyncTimers.clear();
  }
  if (state?.deadSyncTimers instanceof Map) {
    for (const entry of state.deadSyncTimers.values()) {
      if (typeof entry?.cancel === "function") entry.cancel();
      else clearTimeout(entry);
    }
    state.deadSyncTimers.clear();
  }
  if (state?.deadToWoundSyncTimers instanceof Map) {
    for (const entry of state.deadToWoundSyncTimers.values()) {
      if (typeof entry?.cancel === "function") entry.cancel();
      else clearTimeout(entry);
    }
    state.deadToWoundSyncTimers.clear();
  }
  if (state?.deadPresenceByActor instanceof Map) state.deadPresenceByActor.clear();
  if (state?.deadSyncInFlight instanceof Set) state.deadSyncInFlight.clear();
  if (state?.statusRemoveInFlight instanceof Set) state.statusRemoveInFlight.clear();
  if (state?.statusRemoveQueue instanceof Map) state.statusRemoveQueue.clear();
  if (state?.staggerWaitPatch && typeof foundry.applications?.api?.Dialog?.wait === "function") {
    foundry.applications.api.Dialog.wait = state.staggerWaitPatch.originalWait;
  }
  delete game[MODULE_KEY];

  towCombatOverlayClearAllWoundControls();
  towCombatOverlayClearAllNameLabels();
  towCombatOverlayClearAllResilienceLabels();
  clearAllStatusOverlays();
  ui.notifications.info("Overlay disabled.");
  return true;
}

export function towCombatOverlayToggle() {
  return towCombatOverlayIsEnabled() ? towCombatOverlayDisable() : towCombatOverlayEnable();
}
