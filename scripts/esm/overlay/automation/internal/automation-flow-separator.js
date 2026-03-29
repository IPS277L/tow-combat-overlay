export async function postFlowSeparatorCard(
  opposed,
  {
    sourceStatusHints = [],
    targetStatusHints = [],
    sourceMessage = null,
    towCombatOverlayLocalize,
    towCombatOverlayResolveConditionLabel,
    getFlowNamesModel,
    towCombatOverlayRenderTemplate,
    towCombatOverlayApplyRollVisibility,
    resolveFlowVisibilitySourceMessage
  } = {}
) {
  const attackerName = opposed?.attackerToken?.name ?? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Attacker", "Attacker");
  const defenderName = opposed?.defenderToken?.name ?? opposed?.defender?.alias ?? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Defender", "Defender");
  const outcome = opposed?.result?.outcome ?? "resolved";
  const outcomeText = String(outcome);
  const outcomeLabel = outcomeText.charAt(0).toUpperCase() + outcomeText.slice(1).toLowerCase();
  const margin = Number(opposed?.result?.successes ?? 0);
  const marginLabel = `${margin >= 0 ? "+" : ""}${margin}`;
  const damageValue = Number(opposed?.result?.damage?.value ?? 0);
  const damageLabel = Number.isFinite(damageValue) && damageValue > 0 ? String(damageValue) : "0";

  const statusLabels = [];
  const pushStatus = (label) => {
    if (!label) return;
    if (!statusLabels.includes(label)) statusLabels.push(label);
  };

  const damageMessageKey = String(opposed?.result?.damage?.message ?? "");
  if (damageMessageKey.includes("TakesWound")) {
    pushStatus(towCombatOverlayLocalize("TOWCOMBATOVERLAY.Status.Wound", "Wound"));
  }
  if (damageMessageKey.includes("GainsStaggered")) {
    pushStatus(towCombatOverlayLocalize("TOWCOMBATOVERLAY.Status.Staggered", "Staggered"));
  }
  if (damageMessageKey.includes("SuffersFault")) {
    pushStatus(towCombatOverlayLocalize("TOWCOMBATOVERLAY.Status.Fault", "Fault"));
  }

  const effectStatuses = Array.isArray(opposed?.attackerTest?.damageEffects)
    ? opposed.attackerTest.damageEffects.flatMap((effect) => Array.from(effect?.statuses ?? []))
    : [];
  for (const status of effectStatuses) {
    const key = String(status ?? "");
    const label = towCombatOverlayResolveConditionLabel(key);
    pushStatus(label);
  }

  for (const label of targetStatusHints) pushStatus(label);
  const targetStatusLabels = [...statusLabels];
  const sourceStatusLabels = Array.from(new Set((sourceStatusHints ?? []).filter(Boolean)));

  const getOutcomeTone = (value) => {
    if (value === "success") return "success";
    if (value === "failure") return "failure";
    return "neutral";
  };
  const getMarginTone = (value) => {
    if (value > 0) return "success";
    if (value < 0) return "failure";
    return "neutral";
  };
  const getDamageTone = (value) => (value > 0 ? "failure" : "neutral");

  const statusToneFor = (label) => {
    const key = String(label).toLowerCase();
    if (key.includes("wound")) return "wound";
    if (key.includes("stagger")) return "staggered";
    if (key.includes("prone")) return "prone";
    if (key.includes("fault")) return "fault";
    return "default";
  };

  const toStatusItems = (labels) => (labels.length
    ? labels.map((label) => ({ label, tone: statusToneFor(label) }))
    : [{ label: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.None", "None"), tone: "none" }]);

  const namesModel = getFlowNamesModel(attackerName, defenderName);
  const sourceStatusMarkup = (await Promise.all(
    toStatusItems(sourceStatusLabels).map((item) => towCombatOverlayRenderTemplate(
      "modules/tow-combat-overlay/templates/chat/rows/status-chip.hbs",
      item
    ))
  )).join("");
  const targetStatusMarkup = (await Promise.all(
    toStatusItems(targetStatusLabels).map((item) => towCombatOverlayRenderTemplate(
      "modules/tow-combat-overlay/templates/chat/rows/status-chip.hbs",
      item
    ))
  )).join("");
  const content = await towCombatOverlayRenderTemplate("modules/tow-combat-overlay/templates/chat/flow-separator.hbs", {
    attackerName: namesModel.attackerName,
    defenderName: namesModel.defenderName,
    namesStacked: namesModel.needsStacked,
    vsLabel: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Vs", "vs."),
    sourceLabel: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Source", "Source"),
    targetLabel: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Target", "Target"),
    marginLabelText: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Margin", "Margin"),
    damageLabelText: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Damage", "Damage"),
    outcomeLabel,
    marginLabel,
    damageLabel,
    outcomeTone: getOutcomeTone(outcome),
    marginTone: getMarginTone(margin),
    damageTone: getDamageTone(damageValue),
    sourceStatusMarkup,
    targetStatusMarkup
  });

  const chatData = {
    content,
    speaker: { alias: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.CombatFlowAlias", "Combat Flow") }
  };
  const visibilitySourceMessage = resolveFlowVisibilitySourceMessage(sourceMessage, null);
  towCombatOverlayApplyRollVisibility(chatData, {
    sourceMessage: visibilitySourceMessage,
    censorForUnauthorized: true
  });
  await ChatMessage.create(chatData);
}
