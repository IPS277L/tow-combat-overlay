import { PANEL_STATE_KEY } from '../panel/shared/panel-constants.js';
import {
  TOP_PANEL_FOCUS_ANIMATION_MS,
  TOP_PANEL_FOCUS_ZOOM_SCALE,
  TOP_PANEL_ID
} from './top-panel-constants.js';
import { getTopPanelState } from './top-panel-shared.js';

export function selectTokenFromTopPanel(tokenId, event) {
  const token = canvas?.tokens?.get?.(String(tokenId ?? '').trim()) ?? null;
  if (!token || token.destroyed) return;

  const shouldKeepOthers =
    event?.shiftKey === true || event?.ctrlKey === true || event?.metaKey === true;

  if (!shouldKeepOthers && typeof canvas?.tokens?.releaseAll === 'function') {
    canvas.tokens.releaseAll();
  }

  token.control({
    releaseOthers: !shouldKeepOthers
  });
}

export function openTokenSheetFromTopPanel(tokenId) {
  const token = canvas?.tokens?.get?.(String(tokenId ?? '').trim()) ?? null;
  if (!token || token.destroyed) return false;
  const tokenDocument = token.document ?? null;
  const actor = token.actor ?? tokenDocument?.actor ?? null;
  const canOpenSheet = tokenDocument?.isOwner === true || actor?.isOwner === true;
  if (!canOpenSheet) return false;

  if (typeof actor?.sheet?.render === 'function') {
    actor.sheet.render(true);
    return true;
  }

  if (typeof tokenDocument?.sheet?.render === 'function') {
    tokenDocument.sheet.render(true);
    return true;
  }

  return false;
}

export async function focusTokenFromTopPanel(tokenId) {
  const canvasRef = globalThis?.canvas ?? null;
  if (!canvasRef || canvasRef.ready !== true || !canvasRef.scene) return false;

  const token = canvasRef.tokens?.get?.(String(tokenId ?? '').trim()) ?? null;
  if (!token || token.destroyed) return false;
  const center = typeof token.center === 'object' && token.center ? token.center : null;
  const centerX = Number(center?.x ?? NaN);
  const centerY = Number(center?.y ?? NaN);
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return false;

  const currentScale = Number(canvasRef.stage?.scale?.x ?? 1);
  const targetScale = Math.max(
    TOP_PANEL_FOCUS_ZOOM_SCALE,
    Number.isFinite(currentScale) && currentScale > 0 ? currentScale : 1
  );
  if (typeof canvasRef.animatePan !== 'function') return false;
  try {
    await canvasRef.animatePan({
      x: centerX,
      y: centerY,
      scale: targetScale,
      duration: TOP_PANEL_FOCUS_ANIMATION_MS
    });
    return true;
  } catch (error) {
    console.warn('[tow-combat-overlay] Failed to focus token from top panel.', error);
    return false;
  }
}

export function applyTopPanelHoveredCardHighlight(panelElement, tokenId = '') {
  if (!(panelElement instanceof HTMLElement)) return;
  const hoveredId = String(tokenId ?? '').trim();
  const portraits = Array.from(
    panelElement.querySelectorAll('.tow-combat-overlay-top-panel__portrait')
  );
  for (const portrait of portraits) {
    if (!(portrait instanceof HTMLElement)) continue;
    const portraitTokenId = String(portrait.dataset.tokenId ?? '').trim();
    portrait.classList.toggle('is-hover-linked', !!hoveredId && portraitTokenId === hoveredId);
  }
}

function resolveCanvasTokenById(tokenId) {
  const id = String(tokenId ?? '').trim();
  if (!id) return null;
  const token = canvas?.tokens?.get?.(id) ?? null;
  if (!token || token.destroyed) return null;
  return token;
}

function setLinkedTokenHoverState(tokenId, hovered) {
  const token = resolveCanvasTokenById(tokenId);
  if (!token) return;
  const nextHovered = hovered === true;
  try {
    token.hover = nextHovered;
  } catch (_error) {}
  try {
    token._hover = nextHovered;
  } catch (_error) {}
  Hooks.callAll('hoverToken', token, nextHovered);
}

export function clearLinkedTopPanelHover(state, { syncCanvas = true, panelElement = null } = {}) {
  const hoveredTokenId = String(state?.hoveredTokenId ?? '').trim();
  if (!hoveredTokenId) {
    if (panelElement instanceof HTMLElement) applyTopPanelHoveredCardHighlight(panelElement, '');
    return;
  }
  if (syncCanvas) setLinkedTokenHoverState(hoveredTokenId, false);
  if (panelElement instanceof HTMLElement) applyTopPanelHoveredCardHighlight(panelElement, '');
  state.hoveredTokenId = '';
}

export function setLinkedTopPanelHover(
  state,
  tokenId,
  { syncCanvas = true, panelElement = null } = {}
) {
  const nextTokenId = String(tokenId ?? '').trim();
  const currentTokenId = String(state?.hoveredTokenId ?? '').trim();
  if (!nextTokenId) {
    clearLinkedTopPanelHover(state, { syncCanvas, panelElement });
    return;
  }
  if (nextTokenId === currentTokenId) return;
  if (currentTokenId && syncCanvas) setLinkedTokenHoverState(currentTokenId, false);
  if (syncCanvas) setLinkedTokenHoverState(nextTokenId, true);
  if (panelElement instanceof HTMLElement)
    applyTopPanelHoveredCardHighlight(panelElement, nextTokenId);
  state.hoveredTokenId = nextTokenId;
}

export function hasPendingControlPanelTargetPick() {
  const controlPanelState = game?.[PANEL_STATE_KEY];
  return typeof controlPanelState?.pendingAttackPick?.resolveTargetTokenPick === 'function';
}

export async function resolvePendingControlPanelTargetPick(tokenId, event = null) {
  const token = canvas?.tokens?.get?.(String(tokenId ?? '').trim()) ?? null;
  if (!token || token.destroyed) return false;

  const topPanelState = getTopPanelState();
  const topPanelElement = document.getElementById(TOP_PANEL_ID);
  if (topPanelState)
    clearLinkedTopPanelHover(topPanelState, {
      syncCanvas: false,
      panelElement: topPanelElement instanceof HTMLElement ? topPanelElement : null
    });

  const controlPanelState = game?.[PANEL_STATE_KEY];
  const pendingPick = controlPanelState?.pendingAttackPick;
  const resolveTargetTokenPick = pendingPick?.resolveTargetTokenPick;
  if (typeof resolveTargetTokenPick !== 'function') return false;

  try {
    return (await resolveTargetTokenPick(token, event)) === true;
  } catch (error) {
    console.error('[tow-combat-overlay] Failed to resolve target pick from top panel.', error);
    return false;
  }
}
