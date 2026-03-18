export function normalizeItemDescription(item) {
  const descriptionSource = item?.system?.description
    ?? item?.system?.summary
    ?? item?.description
    ?? item?.flags?.core?.description
    ?? "";
  return normalizeDescriptionSource(descriptionSource);
}

export function resolveTemporaryEffectDescription(effect) {
  if (!effect) return "";

  const direct = normalizeDescriptionSource(
    effect?.description
    ?? effect?.system?.description
    ?? effect?.flags?.core?.description
    ?? ""
  );
  if (direct) return direct;

  const sourceItemFromGetter = effect?.sourceItem ?? null;
  const sourceItemUuid = String(effect?.system?.sourceData?.item ?? "").trim();
  const sourceItemFromUuid = (!sourceItemFromGetter && sourceItemUuid && typeof fromUuidSync === "function")
    ? fromUuidSync(sourceItemUuid)
    : null;
  const sourceItem = sourceItemFromGetter ?? sourceItemFromUuid;
  if (sourceItem) {
    const fromSourceItem = normalizeDescriptionSource(
      sourceItem?.system?.description
      ?? sourceItem?.description
      ?? ""
    );
    if (fromSourceItem) return fromSourceItem;
  }

  return "";
}

export function escapePanelHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeDescriptionTextSource(descriptionSource) {
  let raw = descriptionSource;
  if (raw && typeof raw === "object") {
    raw = raw?.value
      ?? raw?.public
      ?? raw?.text
      ?? raw?.content
      ?? raw?.description
      ?? "";
  }
  const html = (typeof raw === "string") ? raw : "";
  if (!html) return "";

  const refLabels = [];
  const refTokenized = html.replace(/@[\w.]+\[[^\]]+\](?:\{([^}]+)\})?/g, (_full, label) => {
    const index = refLabels.length;
    const safeLabel = String(label ?? "Reference").trim() || "Reference";
    refLabels.push(safeLabel);
    return `__TOW_REF_${index}__`;
  });

  const temp = document.createElement("div");
  temp.innerHTML = refTokenized
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "</p>\n");

  let text = String(temp.textContent ?? temp.innerText ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  for (let index = 0; index < refLabels.length; index += 1) {
    const token = `__TOW_REF_${index}__`;
    text = text.split(token).join(refLabels[index]);
  }
  return text;
}

function normalizeDescriptionSource(descriptionSource) {
  const normalizedText = normalizeDescriptionTextSource(descriptionSource);
  if (!normalizedText) return "";
  return escapePanelHtml(normalizedText).replace(/\n/g, "<br>");
}

export function resolvePanelAttackSpecialPropertyText(item) {
  if (!item) return "";

  const isMeaningfulPropertyLine = (line) => {
    const value = String(line ?? "").trim();
    if (!value) return false;
    if (/^[-–—]$/.test(value)) return false;
    if (/^(1h|2h|one[- ]handed|two[- ]handed)$/i.test(value)) return false;
    if (/^melee$/i.test(value)) return false;
    if (/^(close|short|medium|long|extreme)(\s*-\s*(close|short|medium|long|extreme))*$/i.test(value)) return false;
    if (/^(range|optimum range)\s*:/i.test(value)) return false;
    return true;
  };

  const candidateSources = [
    item?.system?.attack?.traits,
    item?.system?.traits,
    item?.system?.trait,
    item?.system?.qualities,
    item?.system?.quality,
    item?.system?.properties,
    item?.system?.special,
    item?.system?.specialRules,
    item?.system?.rules
  ];

  const lines = [];
  const appendLines = (value) => {
    const normalized = normalizeDescriptionTextSource(value);
    if (!normalized) return;
    for (const line of normalized.split("\n").map((entry) => entry.trim()).filter((entry) => isMeaningfulPropertyLine(entry))) {
      lines.push(line);
    }
  };

  for (const source of candidateSources) {
    if (Array.isArray(source)) {
      for (const entry of source) appendLines(entry);
      continue;
    }
    if (source && typeof source === "object") {
      appendLines(source?.value);
      appendLines(source?.text);
      appendLines(source?.public);
      appendLines(source?.description);
      appendLines(source?.label);
      appendLines(source?.name);
      continue;
    }
    appendLines(source);
  }

  if (!lines.length) {
    const descriptionSource = item?.system?.description ?? item?.system?.summary ?? item?.description ?? "";
    const firstDescriptionLine = normalizeDescriptionTextSource(descriptionSource).split("\n").map((line) => line.trim()).find(Boolean) ?? "";
    const looksLikeExplicitProperty = /\b(on charge|ignore|ignores|success(?:es)?\s+to\s+reload|pierc|brutal|impale|bleed|stagger|prone|\+\d+\s*(?:damage|d\d+))\b/i.test(firstDescriptionLine);
    if (isMeaningfulPropertyLine(firstDescriptionLine) && looksLikeExplicitProperty) lines.push(firstDescriptionLine);
  }

  const deduped = [];
  const seen = new Set();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(line);
  }
  return deduped.join("\n");
}

export function resolvePanelAttackSpecialPropertyMarkup(item) {
  const text = resolvePanelAttackSpecialPropertyText(item);
  if (!text) return "";
  return escapePanelHtml(text).replace(/\n/g, "<br>");
}
