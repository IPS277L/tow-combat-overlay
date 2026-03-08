import {
  ICON_SRC_RES,
  KEYS,
  NAME_TYPE_STACK_OVERLAP_PX,
  NAME_TYPE_TO_TOKEN_OFFSET_PX,
  OVERLAY_CONTROL_ICON_OUTLINE_ALPHA,
  OVERLAY_CONTROL_ICON_OUTLINE_COLOR,
  OVERLAY_CONTROL_ICON_OUTLINE_THICKNESS,
  OVERLAY_CONTROL_ICON_TINT,
  OVERLAY_CONTROL_ROW_GAP_PX,
  OVERLAY_FONT_SIZE,
  OVERLAY_TEXT_RESOLUTION_MAX,
  OVERLAY_TEXT_RESOLUTION_MIN,
  PreciseTextClass,
  TOKEN_CONTROL_PAD
} from "../../runtime/overlay-runtime-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/constants.js";
import {
  towCombatOverlayBindTooltipHandlers,
  towCombatOverlayForEachSceneToken,
  towCombatOverlayGetOverlayEdgePadPx,
  towCombatOverlayGetTokenOverlayScale
} from "../shared/core-helpers-service.js";
import { towCombatOverlayClearDisplayObject, towCombatOverlayGetResilienceValue } from "../layout-state-service.js";
import { getTypeTooltipData } from "../shared/shared-service.js";

const { tooltips: MODULE_TOOLTIPS } = getTowCombatOverlayConstants();

function overlayControlsForEachSceneTokenRef(callback) {
  return towCombatOverlayForEachSceneToken(callback);
}

function overlayControlsGetTokenOverlayScaleRef(tokenObject) {
  return towCombatOverlayGetTokenOverlayScale(tokenObject);
}

function overlayControlsGetOverlayEdgePadPxRef(tokenObject) {
  return towCombatOverlayGetOverlayEdgePadPx(tokenObject) ?? TOKEN_CONTROL_PAD;
}

function overlayControlsBindTooltipHandlersRef(displayObject, getTooltipData) {
  return towCombatOverlayBindTooltipHandlers(displayObject, getTooltipData);
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

export function towCombatOverlayTuneOverlayText(textObject) {
  if (!textObject) return;
  textObject.roundPixels = true;
  const devicePixelRatio = Math.max(1, Number(window.devicePixelRatio ?? 1));
  const canvasScale = Number(canvas?.stage?.scale?.x ?? 1);
  const zoom = (Number.isFinite(canvasScale) && canvasScale > 0) ? canvasScale : 1;
  const zoomBoost = zoom < 1 ? (1 / zoom) : 1;
  const resolution = Math.min(
    OVERLAY_TEXT_RESOLUTION_MAX,
    Math.max(OVERLAY_TEXT_RESOLUTION_MIN, Math.ceil(devicePixelRatio * zoomBoost))
  );
  if ("resolution" in textObject && textObject.resolution !== resolution) {
    textObject.resolution = resolution;
    textObject.dirty = true;
  }
}

export function towCombatOverlayDrawHitBoxRect(graphics, x, y, width, height) {
  graphics.clear();
  graphics.beginFill(0x000000, 0.001);
  graphics.drawRoundedRect(x, y, width, height, 6);
  graphics.endFill();
}

export function towCombatOverlayUpdateNameLabel(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const actor = tokenObject.document?.actor ?? null;
  const actorName = String(actor?.name ?? "").trim();
  const nameplateName = String(tokenObject.nameplate?.text ?? "").trim();
  const documentName = String(tokenObject.document?.name ?? "").trim();
  const fallbackName = String(
    tokenObject.name
      ?? actorName
      ?? ""
  ).trim();
  const tokenName = actorName || nameplateName || documentName || fallbackName;
  const typeLabel = towCombatOverlayGetActorTypeLabel(actor).toLowerCase();
  if (!tokenName) {
    const labelContainer = tokenObject[KEYS.nameLabel];
    if (!labelContainer) return;
    labelContainer.parent?.removeChild(labelContainer);
    labelContainer.destroy({ children: true });
    delete tokenObject[KEYS.nameLabel];
    return;
  }

  let labelContainer = tokenObject[KEYS.nameLabel];
  if (
    !labelContainer ||
    labelContainer.destroyed ||
    labelContainer.parent !== tokenObject ||
    !labelContainer[KEYS.nameLabelNameText] ||
    !labelContainer[KEYS.nameLabelTypeText]
  ) {
    if (labelContainer && !labelContainer.destroyed) {
      labelContainer.parent?.removeChild(labelContainer);
      labelContainer.destroy({ children: true });
    }

    labelContainer = new PIXI.Container();
    labelContainer.eventMode = "static";
    labelContainer.interactive = true;
    labelContainer.cursor = "help";

    const nameText = new PreciseTextClass("", towCombatOverlayGetNameStyle());
    towCombatOverlayTuneOverlayText(nameText);
    nameText.anchor.set(0.5, 1);
    nameText.eventMode = "none";

    const typeText = new PreciseTextClass("", towCombatOverlayGetNameTypeStyle());
    towCombatOverlayTuneOverlayText(typeText);
    typeText.anchor.set(0.5, 1);
    typeText.eventMode = "none";

    labelContainer.addChild(nameText);
    labelContainer.addChild(typeText);
    labelContainer[KEYS.nameLabelNameText] = nameText;
    labelContainer[KEYS.nameLabelTypeText] = typeText;
    labelContainer[KEYS.nameLabelMarker] = true;
    labelContainer[KEYS.nameLabelTokenId] = tokenObject.id;

    tokenObject.addChild(labelContainer);
    tokenObject[KEYS.nameLabel] = labelContainer;
  }

  const nameText = labelContainer[KEYS.nameLabelNameText];
  const typeText = labelContainer[KEYS.nameLabelTypeText];
  towCombatOverlayTuneOverlayText(nameText);
  towCombatOverlayTuneOverlayText(typeText);
  if (!labelContainer[KEYS.nameLabelTooltipBinding]) {
    labelContainer[KEYS.nameLabelTooltipBinding] = overlayControlsBindTooltipHandlersRef(
      labelContainer,
      () => getTypeTooltipData(actor)
    );
  }
  nameText.text = tokenName;
  typeText.text = `<${typeLabel}>`;
  const labelScale = overlayControlsGetTokenOverlayScaleRef(tokenObject);
  const edgePad = overlayControlsGetOverlayEdgePadPxRef(tokenObject);
  const inverseScale = (labelScale > 0) ? (1 / labelScale) : 1;
  const tokenEdgePad = edgePad * inverseScale;
  const tokenOffset = NAME_TYPE_TO_TOKEN_OFFSET_PX * inverseScale * (edgePad / TOKEN_CONTROL_PAD);
  const typeBounds = typeText.getLocalBounds();
  const typeTop = typeBounds.y;
  const typeBottom = typeBounds.y + typeBounds.height;
  typeText.position.set(0, Math.round(-(tokenEdgePad + typeBottom) + tokenOffset));

  const nameBounds = nameText.getLocalBounds();
  const nameBottom = nameBounds.y + nameBounds.height;
  nameText.position.set(0, Math.round((typeText.y + typeTop) + NAME_TYPE_STACK_OVERLAP_PX - nameBottom));
  const combinedMinX = Math.min(nameBounds.x, typeBounds.x);
  const combinedMinY = Math.min(nameText.y + nameBounds.y, typeText.y + typeBounds.y);
  const combinedMaxX = Math.max(nameBounds.x + nameBounds.width, typeBounds.x + typeBounds.width);
  const combinedMaxY = Math.max(nameText.y + nameBounds.y + nameBounds.height, typeText.y + typeBounds.y + typeBounds.height);
  labelContainer.hitArea = new PIXI.Rectangle(
    Math.floor(combinedMinX - 4),
    Math.floor(combinedMinY - 2),
    Math.max(8, Math.ceil((combinedMaxX - combinedMinX) + 8)),
    Math.max(8, Math.ceil((combinedMaxY - combinedMinY) + 4))
  );
  labelContainer.position.set(Math.round(tokenObject.w / 2), 0);
  labelContainer.scale.set(labelScale);

  const labelBottomLocal = labelContainer.y + (combinedMaxY * labelScale);
  const targetBottomLocal = -edgePad;
  const deltaY = Math.round(targetBottomLocal - labelBottomLocal);
  if (deltaY !== 0) labelContainer.y += deltaY;

  labelContainer.visible = tokenObject.visible;
}

export function towCombatOverlayUpdateResilienceLabel(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const resilience = towCombatOverlayGetResilienceValue(tokenObject.document);
  if (resilience === null || resilience === undefined) {
    const label = tokenObject[KEYS.resilienceLabel];
    if (!label) return;
    label.parent?.removeChild(label);
    label.destroy();
    delete tokenObject[KEYS.resilienceLabel];
    return;
  }

  let label = tokenObject[KEYS.resilienceLabel];
  const staleLabel = !!label && (
    label.destroyed ||
    label.parent == null ||
    label.parent !== tokenObject
  );
  if (staleLabel) {
    towCombatOverlayClearDisplayObject(label);
    delete tokenObject[KEYS.resilienceLabel];
    label = null;
  }

  if (!label) {
    label = new PIXI.Container();
    label.eventMode = "passive";
    label.interactiveChildren = true;

    const hitBox = new PIXI.Graphics();
    hitBox.eventMode = "static";
    hitBox.interactive = true;
    hitBox.buttonMode = true;
    hitBox.cursor = "help";

    const icon = towCombatOverlayCreateOverlayIconSprite(ICON_SRC_RES, OVERLAY_FONT_SIZE + 1);
    const valueText = new PreciseTextClass("", towCombatOverlayGetIconValueStyle());
    towCombatOverlayTuneOverlayText(valueText);
    valueText.anchor.set(0, 0.5);
    valueText.eventMode = "none";

    label.addChild(hitBox);
    label.addChild(icon);
    label.addChild(valueText);
    label[KEYS.resilienceLabelHitBox] = hitBox;
    label[KEYS.resilienceLabelIcon] = icon;
    label[KEYS.resilienceLabelValueText] = valueText;
    tokenObject.addChild(label);
    tokenObject[KEYS.resilienceLabel] = label;

    overlayControlsBindTooltipHandlersRef(hitBox, () => MODULE_TOOLTIPS.resilience);
  }

  const hitBox = label[KEYS.resilienceLabelHitBox];
  const icon = label[KEYS.resilienceLabelIcon];
  const valueText = label[KEYS.resilienceLabelValueText];
  if (!hitBox || !icon || !valueText) {
    towCombatOverlayClearDisplayObject(label);
    delete tokenObject[KEYS.resilienceLabel];
    return towCombatOverlayUpdateResilienceLabel(tokenObject);
  }

  valueText.text = `${resilience}`;
  towCombatOverlayTuneOverlayText(valueText);
  const gap = 4;
  const padX = 0;
  const padY = 0;
  icon.position.set(0, Math.round(-icon.height / 2));
  valueText.position.set(Math.round(icon.width + gap), 0);
  const iconBounds = icon.getLocalBounds();
  const valueBounds = valueText.getLocalBounds();
  const hitLeft = Math.min(icon.x + iconBounds.x, valueText.x + valueBounds.x);
  const hitTop = Math.min(icon.y + iconBounds.y, valueText.y + valueBounds.y);
  const hitRight = Math.max(
    icon.x + iconBounds.x + iconBounds.width,
    valueText.x + valueBounds.x + valueBounds.width
  );
  const hitBottom = Math.max(
    icon.y + iconBounds.y + iconBounds.height,
    valueText.y + valueBounds.y + valueBounds.height
  );
  towCombatOverlayDrawHitBoxRect(
    hitBox,
    Math.round(hitLeft - padX),
    Math.round(hitTop - padY),
    Math.round(Math.max(1, (hitRight - hitLeft) + (padX * 2))),
    Math.round(Math.max(1, (hitBottom - hitTop) + (padY * 2)))
  );

  const overlayScale = overlayControlsGetTokenOverlayScaleRef(tokenObject);
  const edgePad = overlayControlsGetOverlayEdgePadPxRef(tokenObject);
  const rowGap = OVERLAY_CONTROL_ROW_GAP_PX;
  const rightTopY = (tokenObject.h / 2) - ((rowGap * overlayScale) / 2);
  label.position.set(Math.round(tokenObject.w + edgePad), Math.round(rightTopY));
  label.scale.set(overlayScale);
  icon.alpha = 1;
  valueText.alpha = 1;
  label.visible = tokenObject.visible;
}

export function towCombatOverlayClearAllResilienceLabels() {
  overlayControlsForEachSceneTokenRef((token) => {
    const label = token[KEYS.resilienceLabel];
    if (!label) return;
    label.parent?.removeChild(label);
    label.destroy();
    delete token[KEYS.resilienceLabel];
  });
}

export function towCombatOverlayClearAllNameLabels() {
  overlayControlsForEachSceneTokenRef((token) => {
    const labelContainer = token[KEYS.nameLabel];
    if (!labelContainer) return;
    labelContainer.parent?.removeChild(labelContainer);
    labelContainer.destroy({ children: true });
    delete token[KEYS.nameLabel];
  });

  const orphaned = [];
  for (const child of canvas.tokens.children ?? []) {
    if (child?.[KEYS.nameLabelMarker] === true) orphaned.push(child);
  }
  for (const labelContainer of orphaned) towCombatOverlayClearDisplayObject(labelContainer);
}
