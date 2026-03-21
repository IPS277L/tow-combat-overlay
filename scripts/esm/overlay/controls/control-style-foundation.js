import {
  OVERLAY_CONTROL_ICON_OUTLINE_ALPHA,
  OVERLAY_CONTROL_ICON_OUTLINE_COLOR,
  OVERLAY_CONTROL_ICON_OUTLINE_THICKNESS,
  OVERLAY_CONTROL_ICON_TINT,
  OVERLAY_FONT_SIZE
} from "../../runtime/overlay-constants.js";
import { towCombatOverlayTuneTextForScale } from "../shared/text-rendering.js";

export function formatActorTypeLabel(typeLabel) {
  const templateKey = "TOWCOMBATOVERLAY.Label.ActorTypeWrapped";
  const localizedTemplate = game?.i18n?.localize?.(templateKey);
  const template = (typeof localizedTemplate === "string" && localizedTemplate !== templateKey)
    ? localizedTemplate
    : "<{type}>";
  return template.replace("{type}", String(typeLabel ?? ""));
}

export function towCombatOverlayGetControlStyle() {
  const style = CONFIG.canvasTextStyle?.clone?.() ?? new PIXI.TextStyle();
  style.fontFamily = "CaslonPro";
  style.fontWeight = "700";
  style.fontSize = OVERLAY_FONT_SIZE;
  style.fill = "#FFF4D8";
  style.stroke = "rgba(5, 5, 5, 0.76)";
  style.strokeThickness = 2;
  style.lineJoin = "round";
  style.miterLimit = 2;
  style.dropShadow = false;
  style.align = "left";
  return style;
}

export function towCombatOverlayGetNameStyle() {
  const style = towCombatOverlayGetControlStyle();
  style.align = "center";
  return style;
}

export function towCombatOverlayGetNameTypeStyle() {
  const style = towCombatOverlayGetControlStyle();
  style.align = "center";
  return style;
}

export function towCombatOverlayGetIconValueStyle() {
  const style = towCombatOverlayGetControlStyle();
  style.fontWeight = "700";
  return style;
}

export function towCombatOverlayCreateOverlayIconSprite(src, size = OVERLAY_FONT_SIZE + 2) {
  const OutlineFilterClass = PIXI?.filters?.OutlineFilter ?? PIXI?.OutlineFilter;
  if (typeof OutlineFilterClass === "function") {
    const sprite = PIXI.Sprite.from(src);
    sprite.width = size;
    sprite.height = size;
    sprite.tint = OVERLAY_CONTROL_ICON_TINT;
    sprite.alpha = 0.98;
    const outline = new OutlineFilterClass(
      OVERLAY_CONTROL_ICON_OUTLINE_THICKNESS,
      OVERLAY_CONTROL_ICON_OUTLINE_COLOR,
      1
    );
    if ("alpha" in outline) outline.alpha = OVERLAY_CONTROL_ICON_OUTLINE_ALPHA;
    sprite.filters = [outline];
    sprite.eventMode = "none";
    return sprite;
  }

  const container = new PIXI.Container();
  container.eventMode = "none";
  const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1]
  ];
  for (const [dx, dy] of offsets) {
    const strokeSprite = PIXI.Sprite.from(src);
    strokeSprite.width = size;
    strokeSprite.height = size;
    strokeSprite.tint = OVERLAY_CONTROL_ICON_OUTLINE_COLOR;
    strokeSprite.alpha = OVERLAY_CONTROL_ICON_OUTLINE_ALPHA;
    strokeSprite.position.set(dx, dy);
    strokeSprite.eventMode = "none";
    container.addChild(strokeSprite);
  }

  const sprite = PIXI.Sprite.from(src);
  sprite.width = size;
  sprite.height = size;
  sprite.tint = OVERLAY_CONTROL_ICON_TINT;
  sprite.alpha = 0.98;
  sprite.eventMode = "none";
  container.addChild(sprite);
  return container;
}

export function towCombatOverlayGetActorTypeLabel(actor) {
  const systemType = String(actor?.system?.type ?? "").trim();
  if (systemType) return systemType;
  const actorType = String(actor?.type ?? "").trim();
  if (actorType) return actorType;
  return "actor";
}

export function towCombatOverlayTuneOverlayText(textObject, renderScale = 1) {
  towCombatOverlayTuneTextForScale(textObject, renderScale);
}

export function towCombatOverlayDrawHitBoxRect(graphics, x, y, width, height) {
  graphics.clear();
  graphics.beginFill(0x000000, 0.001);
  graphics.drawRoundedRect(x, y, width, height, 6);
  graphics.endFill();
}

