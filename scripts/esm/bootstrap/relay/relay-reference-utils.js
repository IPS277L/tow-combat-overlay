import { resolveTowCombatOverlayMessageRefId as resolveMessageRefId } from "../../shared/message-reference.js";

export function resolveTowCombatOverlayMessageRefId(value) {
  return resolveMessageRefId(value);
}

export function normalizeTowCombatOverlayRollMode(value) {
  const mode = String(value ?? "").trim().toLowerCase();
  return ["publicroll", "gmroll", "blindroll", "selfroll"].includes(mode) ? mode : "";
}

export function collectTowCombatOverlayActorRefsFromCreateData(data = {}) {
  const refs = new Set();
  const add = (value) => {
    const normalized = String(value ?? "").trim();
    if (normalized) refs.add(normalized);
  };
  add(data?.speaker?.actor);
  add(data?.system?.test?.context?.actor);
  add(data?.system?.context?.actor);
  add(data?.system?.actor?.id);
  add(data?.system?.actor?.uuid);
  return refs;
}

export function collectTowCombatOverlayTokenRefsFromCreateData(data = {}) {
  const refs = new Set();
  const add = (value) => {
    const normalized = String(value ?? "").trim();
    if (normalized) refs.add(normalized);
  };
  add(data?.speaker?.token);
  add(data?.system?.defender?.token);
  add(data?.system?.attacker?.token);
  const targetCandidates = [
    data?.system?.test?.context?.targets,
    data?.system?.context?.targets,
    data?.system?.test?.targets,
    data?.system?.targets
  ];
  for (const rawTargets of targetCandidates) {
    if (Array.isArray(rawTargets)) {
      for (const entry of rawTargets) {
        add(entry?.token);
        add(entry?.tokenId);
        if (!entry?.actor && !entry?.actorId) add(entry?.id);
      }
      continue;
    }
    if (rawTargets && typeof rawTargets === "object") {
      for (const [key, value] of Object.entries(rawTargets)) {
        add(value?.token);
        add(value?.tokenId);
        if (!value?.actor && !value?.actorId) add(value?.id ?? key);
      }
    }
  }
  return refs;
}

export function collectTowCombatOverlayActorRefsFromTokens(...tokens) {
  const refs = new Set();
  for (const token of tokens) {
    const actor = token?.actor ?? token?.document?.actor ?? null;
    const actorId = String(actor?.id ?? "").trim();
    const actorUuid = String(actor?.uuid ?? "").trim();
    if (actorId) refs.add(actorId);
    if (actorUuid) refs.add(actorUuid);
  }
  return refs;
}

export function collectTowCombatOverlayTokenRefsFromTokens(...tokens) {
  const refs = new Set();
  for (const token of tokens) {
    const tokenId = String(token?.id ?? token?.document?.id ?? "").trim();
    if (tokenId) refs.add(tokenId);
  }
  return refs;
}

export function collectTowCombatOverlayRefsFromMessage(message = null) {
  const actorRefs = new Set();
  const tokenRefs = new Set();
  const source = message?.toObject?.() ?? message ?? {};
  for (const ref of collectTowCombatOverlayActorRefsFromCreateData(source)) actorRefs.add(ref);
  for (const ref of collectTowCombatOverlayTokenRefsFromCreateData(source)) tokenRefs.add(ref);
  return { actorRefs, tokenRefs };
}
