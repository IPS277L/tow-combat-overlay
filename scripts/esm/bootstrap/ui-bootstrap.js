export function ensureTowCombatOverlayStylesheetLoaded() {
  const explicitHrefs = [
    "modules/tow-combat-overlay/styles/dialog-base.css",
    "modules/tow-combat-overlay/styles/dialog-selectors.css",
    "modules/tow-combat-overlay/styles/chat-cards.css",
    "modules/tow-combat-overlay/styles/status-tooltip.css",
    "modules/tow-combat-overlay/styles/control-panel.css",
    "modules/tow-combat-overlay/styles/top-panel.css"
  ];
  const links = Array.from(document.querySelectorAll("link[rel='stylesheet']"));
  const loadedHrefs = new Set(
    links.map((link) => String(link.getAttribute("href") ?? ""))
  );
  let injected = false;
  for (const explicitHref of explicitHrefs) {
    const alreadyLoaded = Array.from(loadedHrefs).some((href) => href.includes(explicitHref));
    if (alreadyLoaded) continue;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = explicitHref;
    document.head.appendChild(link);
    loadedHrefs.add(explicitHref);
    injected = true;
  }
  return injected;
}

export function requestTowCombatOverlayViewportSync() {
  const stateKey = "__towCombatOverlayViewportSyncState";
  if (!game) {
    window.dispatchEvent(new Event("resize"));
    return;
  }
  if (!game[stateKey]) {
    game[stateKey] = {
      queued: false,
      delayedTimerId: null
    };
  }
  const syncState = game[stateKey];
  if (syncState.queued === true) return;
  syncState.queued = true;

  window.requestAnimationFrame(() => {
    syncState.queued = false;
    window.dispatchEvent(new Event("resize"));
    if (syncState.delayedTimerId !== null) {
      window.clearTimeout(syncState.delayedTimerId);
    }
    syncState.delayedTimerId = window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
      syncState.delayedTimerId = null;
    }, 220);
  });
}

export function ensureTowCombatOverlaySidebarObserver() {
  const stateKey = "__towCombatOverlaySidebarObserver";
  if (!game) return;
  const sidebarElement = document.getElementById("sidebar");
  if (!(sidebarElement instanceof HTMLElement)) return;

  const existing = game[stateKey];
  if (existing?.observer instanceof MutationObserver && existing.element === sidebarElement) {
    return;
  }
  if (existing?.observer instanceof MutationObserver) {
    existing.observer.disconnect();
  }

  const observer = new MutationObserver((mutations) => {
    const shouldSync = mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "class");
    if (shouldSync) requestTowCombatOverlayViewportSync();
  });

  observer.observe(sidebarElement, {
    attributes: true,
    attributeFilter: ["class"]
  });
  game[stateKey] = {
    observer,
    element: sidebarElement
  };
}
