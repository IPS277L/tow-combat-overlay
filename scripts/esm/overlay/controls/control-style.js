import {
  KEYS,
  NAME_LABEL_MAX_WIDTH_MULTIPLIER,
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
import {
  towCombatOverlayGetNameStyle,
  towCombatOverlayTuneOverlayText
} from "./control-style-foundation.js";
import {
  getPrimaryTokenName,
  getPrimaryTokenNameStrict,
  getPrimaryTokenTypeLabel
} from "../panel/selection/selection-display.js";
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

function overlayControlsBindTooltipHandlersRef(displayObject, getTooltipData, keyStore = null, options = null) {
  return towCombatOverlayBindTooltipHandlers(displayObject, getTooltipData, keyStore, options ?? undefined);
}

export function towCombatOverlayUpdateNameLabel(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const tokenName = getPrimaryTokenNameStrict(tokenObject);
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
    !labelContainer[KEYS.nameLabelNameText]
  ) {
    if (labelContainer && !labelContainer.destroyed) {
      labelContainer.parent?.removeChild(labelContainer);
      labelContainer.destroy({ children: true });
    }

    labelContainer = new PIXI.Container();
    labelContainer.eventMode = "static";
    labelContainer.interactive = true;
    labelContainer.cursor = "help";
    labelContainer.roundPixels = true;

    const nameText = new PreciseTextClass("", towCombatOverlayGetNameStyle());
    towCombatOverlayTuneOverlayText(nameText);
    nameText.anchor.set(0.5, 1);
    nameText.eventMode = "none";
    labelContainer.addChild(nameText);
    labelContainer[KEYS.nameLabelNameText] = nameText;
    labelContainer[KEYS.nameLabelMarker] = true;
    labelContainer[KEYS.nameLabelTokenId] = tokenObject.id;

    tokenObject.addChild(labelContainer);
    tokenObject[KEYS.nameLabel] = labelContainer;
  }

  const nameText = labelContainer[KEYS.nameLabelNameText];
  towCombatOverlayTuneOverlayText(nameText);
  if (!labelContainer[KEYS.nameLabelTooltipBinding]) {
    labelContainer[KEYS.nameLabelTooltipBinding] = overlayControlsBindTooltipHandlersRef(
      labelContainer,
      () => {
        const liveName = getPrimaryTokenName(tokenObject)
          || game?.i18n?.localize?.("TOWCOMBATOVERLAY.Tooltip.Panel.SelectionTokenFallbackName")
          || "Token";
        const typeLabel = getPrimaryTokenTypeLabel(tokenObject) || "-";
        const description = game?.i18n?.format?.(
          "TOWCOMBATOVERLAY.Tooltip.Panel.SelectionTypeDescription",
          { type: typeLabel }
        );
        return {
          title: liveName,
          description: (typeof description === "string" && description !== "TOWCOMBATOVERLAY.Tooltip.Panel.SelectionTypeDescription")
            ? description
            : `Type: ${typeLabel}`
        };
      },
      null,
      { theme: "panel", descriptionIsHtml: true }
    );
  }
  nameText.text = tokenName;
  const labelScale = overlayControlsGetTokenOverlayScaleRef(tokenObject);
  const edgePad = overlayControlsGetOverlayEdgePadPxRef(tokenObject);
  const inverseScale = (labelScale > 0) ? (1 / labelScale) : 1;
  const tokenEdgePad = edgePad * inverseScale;
  const nameBounds = nameText.getLocalBounds();
  const nameBottom = nameBounds.y + nameBounds.height;
  nameText.position.set(0, Math.round(-tokenEdgePad - nameBottom + (2 * inverseScale * (edgePad / TOKEN_CONTROL_PAD))));
  const combinedMinX = nameBounds.x;
  const combinedMinY = nameText.y + nameBounds.y;
  const combinedMaxX = nameBounds.x + nameBounds.width;
  const combinedMaxY = nameText.y + nameBounds.y + nameBounds.height;
  const combinedWidth = Math.max(1, combinedMaxX - combinedMinX);
  const tokenWidthWorld = Math.max(
    1,
    (Number(tokenObject.w ?? 0) * NAME_LABEL_MAX_WIDTH_MULTIPLIER) - (edgePad * 2)
  );
  const maxLocalWidth = Math.max(1, tokenWidthWorld / Math.max(0.0001, labelScale));
  const widthClampScale = Math.min(1, maxLocalWidth / combinedWidth);
  const finalLabelScale = labelScale * widthClampScale;
  towCombatOverlayTuneOverlayText(nameText, finalLabelScale);
  labelContainer.hitArea = new PIXI.Rectangle(
    Math.floor(combinedMinX - 4),
    Math.floor(combinedMinY - 2),
    Math.max(8, Math.ceil((combinedMaxX - combinedMinX) + 8)),
    Math.max(8, Math.ceil((combinedMaxY - combinedMinY) + 4))
  );
  labelContainer.position.set(Math.round(tokenObject.w / 2), 0);
  labelContainer.scale.set(finalLabelScale);

  const labelBottomLocal = labelContainer.y + (combinedMaxY * finalLabelScale);
  const targetBottomLocal = -Math.round(edgePad * 0.1);
  const deltaY = Math.round(targetBottomLocal - labelBottomLocal);
  if (deltaY !== 0) labelContainer.y += deltaY;
  labelContainer.y = Math.round(labelContainer.y);

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
