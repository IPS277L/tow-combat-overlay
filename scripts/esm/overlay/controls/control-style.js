import {
  KEYS,
  NAME_TYPE_STACK_OVERLAP_PX,
  NAME_TYPE_TO_TOKEN_OFFSET_PX,
  PreciseTextClass,
  TOKEN_CONTROL_PAD
} from "../../runtime/overlay-constants.js";
import {
  towCombatOverlayBindTooltipHandlers,
  towCombatOverlayForEachSceneToken,
  towCombatOverlayGetOverlayEdgePadPx,
  towCombatOverlayGetTokenOverlayScale
} from "../shared/core-helpers.js";
import { towCombatOverlayClearDisplayObject } from "../layout-state.js";
import { getTypeTooltipData } from "../shared/shared.js";
import {
  formatActorTypeLabel,
  towCombatOverlayGetActorTypeLabel,
  towCombatOverlayGetNameStyle,
  towCombatOverlayGetNameTypeStyle,
  towCombatOverlayTuneOverlayText
} from "./control-style-foundation.js";
export {
  towCombatOverlayCreateOverlayIconSprite,
  towCombatOverlayDrawHitBoxRect,
  towCombatOverlayGetControlStyle,
  towCombatOverlayGetActorTypeLabel,
  towCombatOverlayGetIconValueStyle,
  towCombatOverlayGetNameStyle,
  towCombatOverlayGetNameTypeStyle,
  towCombatOverlayTuneOverlayText
} from "./control-style-foundation.js";

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
  typeText.text = formatActorTypeLabel(typeLabel);
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

