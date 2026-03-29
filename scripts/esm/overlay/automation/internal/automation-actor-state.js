export function snapshotActorState(actor) {
  const statuses = new Set(Array.from(actor?.statuses ?? []).map((status) => String(status)));
  for (const effect of Array.from(actor?.effects?.contents ?? [])) {
    for (const status of Array.from(effect?.statuses ?? [])) statuses.add(String(status));
  }
  const wounds = Number(actor?.itemTypes?.wound?.length ?? 0);
  return { statuses, wounds };
}

export async function captureSettledActorState(actor, baselineState, settleMs = 700) {
  const started = Date.now();
  let last = snapshotActorState(actor);
  let stableFor = 0;

  while (Date.now() - started < settleMs) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const current = snapshotActorState(actor);
    const sameWounds = current.wounds === last.wounds;
    const sameStatuses = current.statuses.size === last.statuses.size
      && Array.from(current.statuses).every((status) => last.statuses.has(status));
    if (sameWounds && sameStatuses) {
      stableFor += 80;
      if (stableFor >= 160) return current;
    } else {
      stableFor = 0;
      last = current;
    }
  }

  const finalState = snapshotActorState(actor);
  if ((finalState.wounds ?? 0) < (baselineState?.wounds ?? 0)) return last;
  return finalState;
}

export async function deriveSourceStatusHints(
  sourceActor,
  sourceBeforeState,
  { deriveAppliedStatusLabels, towCombatOverlayLocalize, towCombatOverlayResolveConditionLabel } = {}
) {
  if (!sourceActor || !sourceBeforeState) return [];
  const sourceAfterState = await captureSettledActorState(sourceActor, sourceBeforeState, 500);
  return deriveAppliedStatusLabels(sourceBeforeState, sourceAfterState, {
    localize: towCombatOverlayLocalize,
    resolveConditionLabel: towCombatOverlayResolveConditionLabel
  });
}
