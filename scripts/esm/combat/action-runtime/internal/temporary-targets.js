export async function withTemporaryUserTargets(targetToken, callback) {
  const targetId = String(targetToken?.id ?? "").trim();
  if (!targetId || typeof callback !== "function") return callback?.();
  const previousTargetIds = Array.from(game?.user?.targets ?? [])
    .map((token) => String(token?.id ?? "").trim())
    .filter(Boolean);
  const placeables = Array.isArray(canvas?.tokens?.placeables) ? canvas.tokens.placeables : [];
  const setByToggle = (ids) => {
    const idSet = new Set((Array.isArray(ids) ? ids : []).map((id) => String(id ?? "").trim()).filter(Boolean));
    let usedToggle = false;
    for (const tokenObject of placeables) {
      if (typeof tokenObject?.setTarget !== "function") continue;
      usedToggle = true;
      tokenObject.setTarget(idSet.has(String(tokenObject.id ?? "")), {
        releaseOthers: false,
        groupSelection: false,
        user: game.user
      });
    }
    return usedToggle;
  };

  const usedToggle = setByToggle([targetId]);
  if (!usedToggle) {
    const updateTargets = game?.user?.updateTokenTargets;
    if (typeof updateTargets === "function") {
      const updateResult = updateTargets.call(game.user, [targetId]);
      if (updateResult && typeof updateResult.then === "function") await updateResult;
    } else {
      return callback();
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    return await callback();
  } finally {
    if (!setByToggle(previousTargetIds)) {
      const updateTargets = game?.user?.updateTokenTargets;
      if (typeof updateTargets === "function") {
        const restoreResult = updateTargets.call(game.user, previousTargetIds);
        if (restoreResult && typeof restoreResult.then === "function") await restoreResult;
      }
    }
  }
}
