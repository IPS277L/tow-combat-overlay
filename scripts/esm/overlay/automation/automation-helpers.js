export function getDialogButtonTokens(config) {
  const tokens = [];
  const add = (value) => {
    const token = String(value ?? "").trim().toLowerCase();
    if (!token) return;
    if (!tokens.includes(token)) tokens.push(token);
  };

  if (Array.isArray(config?.buttons)) {
    for (const button of config.buttons) {
      add(button?.action);
      add(button?.id);
      add(button?.label);
      add(button?.name);
      add(button?.text);
    }
    return tokens;
  }

  const buttons = config?.buttons ?? {};
  for (const [key, button] of Object.entries(buttons)) {
    add(key);
    add(button?.action);
    add(button?.id);
    add(button?.label);
    add(button?.name);
    add(button?.text);
  }
  return tokens;
}

export function isLikelyStaggerChoiceDialog(config) {
  const title = String(config?.window?.title ?? "").toLowerCase();
  const content = String(config?.content ?? "").toLowerCase();
  const buttonTokens = getDialogButtonTokens(config);
  const mentionsStagger = title.includes("stagger") || content.includes("stagger");
  const mentionsChoicePrompt = content.includes("choose from the following options");
  const hasWoundChoice = buttonTokens.some((token) => token.includes("wound"));
  const hasProneChoice = buttonTokens.some((token) => token.includes("prone"));
  const hasGiveChoice = buttonTokens.some((token) => token.includes("give"));
  const hasExpectedChoices = hasWoundChoice && (hasProneChoice || hasGiveChoice);

  if (hasExpectedChoices && (mentionsStagger || mentionsChoicePrompt)) return true;
  if (mentionsStagger && mentionsChoicePrompt) return true;
  return false;
}

export function deriveAppliedStatusLabels(before, after, {
  localize,
  resolveConditionLabel
} = {}) {
  const labels = [];
  const add = (label) => {
    if (!label) return;
    if (!labels.includes(label)) labels.push(label);
  };

  if ((after?.wounds ?? 0) > (before?.wounds ?? 0)) {
    add(localize?.("TOWCOMBATOVERLAY.Status.Wound", "Wound") ?? "Wound");
  }

  const beforeStatuses = before?.statuses ?? new Set();
  const afterStatuses = after?.statuses ?? new Set();
  for (const statusId of afterStatuses) {
    if (beforeStatuses.has(statusId)) continue;
    const label = resolveConditionLabel?.(statusId) ?? String(statusId ?? "");
    add(label);
  }
  return labels;
}

export function getFlowNamesModel(attackerName, defenderName) {
  const combinedLen = `${attackerName} vs. ${defenderName}`.length;
  const needsStacked = combinedLen > 34 || attackerName.length > 18 || defenderName.length > 18;
  return {
    attackerName,
    defenderName,
    needsStacked
  };
}
