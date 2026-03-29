export function towCombatOverlayToElement(appElement) {
  if (!appElement) return null;
  if (appElement instanceof HTMLElement) return appElement;
  if (appElement[0] instanceof HTMLElement) return appElement[0];
  return null;
}

export function towCombatOverlayApplyDialogClass(renderHtml, className) {
  if (!renderHtml || !className) return;

  const jqRoot = renderHtml?.closest?.(".app.dialog");
  if (jqRoot?.addClass) {
    jqRoot.addClass(className);
    return;
  }

  const element = towCombatOverlayToElement(renderHtml);
  if (!element) return;

  const directLooksLikeDialog = element.classList?.contains("dialog")
    || element.classList?.contains("application")
    || element.classList?.contains("window-app");
  if (directLooksLikeDialog) {
    element.classList.add(className);
    return;
  }

  const dialogRoot = element.closest?.(".app.dialog")
    ?? element.closest?.(".application.dialog")
    ?? element.closest?.(".application")
    ?? null;
  if (dialogRoot?.classList) dialogRoot.classList.add(className);
}

export function towCombatOverlayBindClick(renderHtml, selector, handler) {
  if (!renderHtml || !selector || typeof handler !== "function") return;

  const jqMatches = renderHtml?.find?.(selector);
  if (jqMatches?.on) {
    jqMatches.on("click", handler);
    return;
  }

  const element = towCombatOverlayToElement(renderHtml);
  if (!element) return;
  for (const match of element.querySelectorAll(selector)) {
    match.addEventListener("click", handler);
  }
}

function towCombatOverlayFindRenderedDialogElementByMarker(markerId) {
  const marker = document.querySelector(`[data-tow-selector-dialog-id="${markerId}"]`);
  if (!marker) return null;
  return marker.closest(".app.window-app.dialog")
    ?? marker.closest(".application.dialog")
    ?? marker.closest(".application")
    ?? null;
}

export function towCombatOverlayOpenSelectorDialog({
  title,
  content,
  width = 560,
  height = null,
  onRender
} = {}) {
  const markerId = foundry?.utils?.randomID?.() ?? `tow-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const wrappedContent = `<div data-tow-selector-dialog-id="${towCombatOverlayEscapeHtml(markerId)}">${String(content ?? "")}</div>`;
  const DialogV2Class = foundry?.applications?.api?.DialogV2;
  if (typeof DialogV2Class === "function") {
    try {
      const dialogV2Config = {
        title,
        window: {
          title
        },
        content: wrappedContent,
        width,
        position: { width }
      };
      if (Number.isFinite(Number(height)) && Number(height) > 0) {
        dialogV2Config.height = Number(height);
        dialogV2Config.position.height = Number(height);
      }
      const dialogV2 = new DialogV2Class(dialogV2Config);
      dialogV2.render(true);
      if (typeof onRender === "function") {
        const bindOnceReady = (attempt = 0) => {
          const fromApp = towCombatOverlayToElement(dialogV2.element);
          const root = fromApp ?? towCombatOverlayFindRenderedDialogElementByMarker(markerId);
          if (root) {
            if (root.dataset.towSelectorBound === markerId) return;
            root.dataset.towSelectorBound = markerId;
            onRender(root, dialogV2);
            return;
          }
          if (attempt >= 30) return;
          setTimeout(() => bindOnceReady(attempt + 1), 50);
        };
        towCombatOverlayScheduleSoon(() => bindOnceReady(0));
      }
      return dialogV2;
    } catch (_error) {
      // Fall through to V1 Dialog.
    }
  }

  const dialogV1Data = {
    title,
    content: wrappedContent,
    buttons: {},
    render: (html) => {
      if (typeof onRender === "function") onRender(html, dialogV1);
    }
  };
  const dialogV1Options = {
    width,
    ...(Number.isFinite(Number(height)) && Number(height) > 0 ? { height: Number(height) } : {})
  };
  const dialogV1 = new Dialog(dialogV1Data, dialogV1Options);
  dialogV1.render(true);
  return dialogV1;
}

export function towCombatOverlayScheduleSoon(callback) {
  if (typeof window?.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      void callback();
    });
    return;
  }
  Promise.resolve().then(() => {
    void callback();
  });
}

export function towCombatOverlayEscapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

export function towCombatOverlayLocalize(key, fallback = "") {
  const localized = game?.i18n?.localize?.(key);
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? "");
}

export async function towCombatOverlayRenderTemplate(path, data = {}) {
  const renderer = foundry?.applications?.handlebars?.renderTemplate;
  if (typeof renderer !== "function") {
    throw new Error("[tow-combat-overlay] Missing foundry.applications.handlebars.renderTemplate");
  }
  return renderer(path, data);
}