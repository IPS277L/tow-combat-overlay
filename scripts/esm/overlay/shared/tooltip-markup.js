export function escapeTooltipHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildTooltipChipListMarkup(entries = [], {
  resolveTitle = null,
  resolveImage = null
} = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const rows = list
    .map((entry) => {
      const titleValue = (typeof resolveTitle === "function")
        ? resolveTitle(entry)
        : String(entry?.title ?? "").trim();
      const title = escapeTooltipHtml(titleValue || "?");
      const imageSrcValue = (typeof resolveImage === "function")
        ? resolveImage(entry)
        : String(entry?.img ?? "").trim();
      const imageSrc = String(imageSrcValue ?? "").trim();
      if (!imageSrc) return `<div class="tow-combat-overlay-status-tooltip__chip-row"><span>${title}</span></div>`;
      return `<div class="tow-combat-overlay-status-tooltip__chip-row"><span class="tow-combat-overlay-status-tooltip__chip-icon"><img src="${escapeTooltipHtml(imageSrc)}" alt="" /></span><span>${title}</span></div>`;
    })
    .join("");
  return rows ? `<div class="tow-combat-overlay-status-tooltip__chip-list">${rows}</div>` : "";
}
