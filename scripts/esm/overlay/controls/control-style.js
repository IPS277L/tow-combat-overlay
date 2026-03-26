import {
  KEYS,
  NAME_LABEL_MAX_WIDTH_MULTIPLIER,
  PreciseTextClass,
  TOKEN_CONTROL_PAD
} from "../../runtime/overlay-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import {
  getTowCombatOverlayDisplaySetting,
  isTowCombatOverlayDisplaySettingEnabled
} from "../../bootstrap/register-settings.js";
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

function isTokenLayoutNameTooltipEnabled() {
  const { settings } = getTowCombatOverlayConstants();
  return isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableTooltips, true)
    && isTowCombatOverlayDisplaySettingEnabled(settings.tokenLayoutEnableNameTooltip, true);
}

function getTokenLayoutNamePosition() {
  const { settings } = getTowCombatOverlayConstants();
  const raw = String(getTowCombatOverlayDisplaySetting(settings.tokenLayoutNamePosition, "bottom")).trim().toLowerCase();
  return raw === "bottom" ? "bottom" : "top";
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
    labelContainer.cursor = isTokenLayoutNameTooltipEnabled() ? "help" : "default";
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
        if (!isTokenLayoutNameTooltipEnabled()) return { title: "", description: "" };
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
  labelContainer.cursor = isTokenLayoutNameTooltipEnabled() ? "help" : "default";
  nameText.text = tokenName;
  const namePosition = getTokenLayoutNamePosition();
  const labelScale = overlayControlsGetTokenOverlayScaleRef(tokenObject);
  const edgePad = overlayControlsGetOverlayEdgePadPxRef(tokenObject);
  const inverseScale = (labelScale > 0) ? (1 / labelScale) : 1;
  const tokenEdgePad = edgePad * inverseScale;
  const nameBounds = nameText.getLocalBounds();
  if (namePosition === "bottom") {
    nameText.anchor.set(0.5, 0);
    nameText.position.set(0, Math.round((Number(tokenObject.h ?? 0) * inverseScale) + tokenEdgePad - nameBounds.y));
  } else {
    nameText.anchor.set(0.5, 1);
    const nameBottom = nameBounds.y + nameBounds.height;
    nameText.position.set(0, Math.round(-tokenEdgePad - nameBottom + (2 * inverseScale * (edgePad / TOKEN_CONTROL_PAD))));
  }
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

  // Re-align after final scale so switching top/bottom is correct on first refresh.
  const postScaleBounds = nameText.getLocalBounds();
  const postScaleTop = labelContainer.y + ((nameText.y + postScaleBounds.y) * finalLabelScale);
  const postScaleBottom = labelContainer.y + ((nameText.y + postScaleBounds.y + postScaleBounds.height) * finalLabelScale);
  if (namePosition === "top") {
    const targetBottomLocal = -Math.round(edgePad * 0.1);
    const deltaY = Math.round(targetBottomLocal - postScaleBottom);
    if (deltaY !== 0) labelContainer.y += deltaY;
  } else {
    const targetTopLocal = Math.round(Number(tokenObject.h ?? 0) + (edgePad * 0.1));
    const deltaY = Math.round(targetTopLocal - postScaleTop);
    if (deltaY !== 0) labelContainer.y += deltaY;
  }
  labelContainer.y = Math.round(labelContainer.y);

  const finalBounds = nameText.getLocalBounds();
  const finalMinX = finalBounds.x;
  const finalMinY = nameText.y + finalBounds.y;
  const finalMaxX = finalBounds.x + finalBounds.width;
  const finalMaxY = nameText.y + finalBounds.y + finalBounds.height;
  labelContainer.hitArea = new PIXI.Rectangle(
    Math.floor(finalMinX - 4),
    Math.floor(finalMinY - 2),
    Math.max(8, Math.ceil((finalMaxX - finalMinX) + 8)),
    Math.max(8, Math.ceil((finalMaxY - finalMinY) + 4))
  );

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
