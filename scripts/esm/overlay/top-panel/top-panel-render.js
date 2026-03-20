import { towCombatOverlayRenderTemplate } from "../../combat/core.js";
import {
  getPrimaryTokenName,
  getPrimaryTokenTypeLabel
} from "../panel/selection/selection-display.js";
import {
  TOP_PANEL_CHIP_MAX_PER_ROW,
  TOP_PANEL_ID,
  TOP_PANEL_TEMPLATE_PATH
} from "./top-panel-constants.js";
import {
  createTopPanelChipGroup,
  getActiveConditionChips,
  getTemporaryEffectChips,
  limitChipList
} from "./top-panel-chips.js";
import {
  getOrderedSceneTokens,
  syncTopPanelListBottomPadding,
  syncTopPanelWidth
} from "./top-panel-layout.js";
import {
  applyTopPanelHoveredCardHighlight,
  clearLinkedTopPanelHover
} from "./top-panel-interactions.js";
import { formatMaybe, getTopPanelState, localizeMaybe } from "./top-panel-shared.js";

export function getTokenPortraitSrc(token) {
  const textureSrc = String(token?.document?.texture?.src ?? "").trim();
  if (textureSrc) return textureSrc;
  return String(token?.actor?.img ?? token?.document?.actor?.img ?? "icons/svg/mystery-man.svg").trim();
}

function resolveTokenDispositionClass(token) {
  const disposition = Number(token?.document?.disposition ?? 0);
  if (disposition > 0) return "is-friendly";
  if (disposition < 0) return "is-hostile";
  return "is-neutral";
}

function buildPortraitElement(token) {
  const portrait = document.createElement("button");
  portrait.type = "button";
  portrait.classList.add("tow-combat-overlay-top-panel__portrait", resolveTokenDispositionClass(token));
  if (token.controlled === true) portrait.classList.add("is-controlled");
  if (token.actor?.hasCondition?.("dead")) portrait.classList.add("is-dead");

  portrait.dataset.tokenId = String(token.id ?? "").trim();
  const tokenName = getPrimaryTokenName(token)
    || localizeMaybe("TOWCOMBATOVERLAY.Tooltip.Panel.SelectionTokenFallbackName", "Token");
  const typeLabel = getPrimaryTokenTypeLabel(token) || "-";
  portrait.dataset.tooltipTitle = tokenName;
  portrait.dataset.tooltipDescription = formatMaybe(
    "TOWCOMBATOVERLAY.Tooltip.Panel.SelectionTypeDescription",
    { type: typeLabel },
    `Type: ${typeLabel}`
  );
  portrait.draggable = true;

  const image = document.createElement("img");
  image.classList.add("tow-combat-overlay-top-panel__portrait-image");
  image.src = getTokenPortraitSrc(token);
  image.alt = "";
  portrait.appendChild(image);

  const actor = token.actor ?? token.document?.actor ?? null;
  if (actor) {
    const allChips = limitChipList(
      [...getActiveConditionChips(actor), ...getTemporaryEffectChips(actor)],
      TOP_PANEL_CHIP_MAX_PER_ROW,
      "row-overflow"
    );
    if (allChips.length) {
      const chipsLayer = document.createElement("div");
      chipsLayer.classList.add("tow-combat-overlay-top-panel__chips");
      chipsLayer.appendChild(createTopPanelChipGroup("status-effects", allChips));
      portrait.appendChild(chipsLayer);
    }
  }

  return portrait;
}

export async function createTopPanelElement(bindTopPanelElementEvents) {
  const html = await towCombatOverlayRenderTemplate(TOP_PANEL_TEMPLATE_PATH, {});
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(html ?? "").trim();
  const topPanel = wrapper.firstElementChild;
  if (!(topPanel instanceof HTMLElement) || topPanel.id !== TOP_PANEL_ID) {
    throw new Error("[tow-combat-overlay] Failed to render top panel template.");
  }
  bindTopPanelElementEvents(topPanel);
  return topPanel;
}

export async function renderTopPanelContent() {
  const state = getTopPanelState();
  const panelElement = state?.element;
  if (!(panelElement instanceof HTMLElement) || !panelElement.isConnected) return;
  if (state) clearLinkedTopPanelHover(state, { panelElement });
  syncTopPanelWidth(panelElement);

  const listElement = panelElement.querySelector(".tow-combat-overlay-top-panel__list");
  if (!(listElement instanceof HTMLElement)) return;

  const tokens = getOrderedSceneTokens();
  listElement.innerHTML = "";

  if (!tokens.length) {
    panelElement.dataset.hasTokens = "false";
    listElement.style.paddingBottom = "0px";
    applyTopPanelHoveredCardHighlight(panelElement, "");
    return;
  }

  panelElement.dataset.hasTokens = "true";
  const fragment = document.createDocumentFragment();
  for (const token of tokens) {
    fragment.appendChild(buildPortraitElement(token));
  }
  listElement.appendChild(fragment);
  syncTopPanelListBottomPadding(panelElement);
  applyTopPanelHoveredCardHighlight(panelElement, state?.hoveredCanvasTokenId ?? "");
}

export function queueTopPanelRender() {
  const state = getTopPanelState();
  if (!state) return;
  if (state.renderQueued) return;

  state.renderQueued = true;
  requestAnimationFrame(() => {
    const liveState = getTopPanelState();
    if (!liveState) return;
    liveState.renderQueued = false;
    void renderTopPanelContent();
  });
}
