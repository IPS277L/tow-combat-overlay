export function parseDatasetFromTag(tagHtml) {
  const dataset = {};
  const attrMatches = Array.from(String(tagHtml ?? "").matchAll(/\bdata-([a-z0-9_-]+)\s*=\s*["']([^"']*)["']/gi));
  for (const match of attrMatches) {
    const rawKey = String(match?.[1] ?? "").trim();
    if (!rawKey) continue;
    const camelKey = rawKey.replace(/-([a-z0-9])/gi, (_m, char) => String(char ?? "").toUpperCase());
    dataset[camelKey] = String(match?.[2] ?? "");
  }
  return dataset;
}

export function getMessageActionsByPrefix(message, {
  actionPrefix = "",
  priorityEntries = []
} = {}) {
  const normalizedPrefix = String(actionPrefix ?? "").trim().toLowerCase();
  const content = String(message?.content ?? "");
  const buttonMatches = Array.from(content.matchAll(/<(button|a)\b[^>]*>/gi));
  const actionsFromContent = buttonMatches
    .map((match) => {
      const tagHtml = String(match?.[0] ?? "");
      const dataset = parseDatasetFromTag(tagHtml);
      const action = String(dataset?.action ?? "").trim();
      if (!action) return null;
      if (normalizedPrefix && !action.toLowerCase().startsWith(normalizedPrefix)) return null;
      return { action, dataset };
    })
    .filter(Boolean);

  const handlers = message?.system?.constructor?.actions ?? message?.system?.actions ?? {};
  const availableHandlerNames = new Set(
    Object.keys(handlers).map((name) => String(name ?? "").trim()).filter(Boolean)
  );

  const unique = [];
  const seen = new Set();
  for (const entry of actionsFromContent) {
    const action = String(entry?.action ?? "").trim();
    if (!availableHandlerNames.has(action)) continue;
    const key = JSON.stringify({ action, dataset: entry?.dataset ?? {} });
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ action, dataset: entry?.dataset ?? {} });
  }

  const priority = new Map(Array.isArray(priorityEntries) ? priorityEntries : []);
  return unique.sort((a, b) => {
    const left = priority.get(String(a?.action ?? "").toLowerCase()) ?? 100;
    const right = priority.get(String(b?.action ?? "").toLowerCase()) ?? 100;
    if (left !== right) return left - right;
    return String(a?.action ?? "").localeCompare(String(b?.action ?? ""));
  });
}
