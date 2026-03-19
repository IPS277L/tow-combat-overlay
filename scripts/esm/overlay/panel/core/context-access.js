export function createPanelContextAccessService({
  panelStateKey
} = {}) {

  function getSingleControlledToken() {
    const controlledTokens = Array.isArray(canvas?.tokens?.controlled)
      ? canvas.tokens.controlled.filter((token) => token && !token.destroyed)
      : [];
    return controlledTokens.length === 1 ? controlledTokens[0] : null;
  }

  function getSingleControlledActor() {
    const token = getSingleControlledToken();
    return token?.actor ?? token?.document?.actor ?? null;
  }

  function getControlPanelState() {
    if (!game) return null;
    if (!game[panelStateKey]) game[panelStateKey] = {};
    return game[panelStateKey];
  }

  return {
    getSingleControlledToken,
    getSingleControlledActor,
    getControlPanelState
  };
}


