import { getTowCombatOverlayConstants } from "../runtime/constants.js";

const {
  flags: MODULE_FLAGS,
  labels: MODULE_LABELS,
  moduleId: MODULE_ID
} = getTowCombatOverlayConstants();

const DEFAULT_ACTOR_ROLL_MODIFIER_STATE = Object.freeze({
  diceModifier: 0,
  rollState: "normal"
});

const ROLL_STATES = Object.freeze(["normal", "glorious", "grim"]);

function normalizeDiceModifier(value) {
  const numeric = Math.trunc(Number(value) || 0);
  return Math.max(-9, Math.min(9, numeric));
}

function normalizeRollState(value) {
  const candidate = String(value ?? "").trim().toLowerCase();
  return ROLL_STATES.includes(candidate) ? candidate : DEFAULT_ACTOR_ROLL_MODIFIER_STATE.rollState;
}

export function getTowCombatOverlayDefaultActorRollModifierState() {
  return {
    diceModifier: DEFAULT_ACTOR_ROLL_MODIFIER_STATE.diceModifier,
    rollState: DEFAULT_ACTOR_ROLL_MODIFIER_STATE.rollState
  };
}

export function normalizeTowCombatOverlayActorRollModifierState(state) {
  const source = state && typeof state === "object" ? state : {};
  return {
    diceModifier: normalizeDiceModifier(source.diceModifier),
    rollState: normalizeRollState(source.rollState)
  };
}

export function getTowCombatOverlayActorRollModifierState(actor) {
  const rawState = actor?.getFlag?.(MODULE_ID, MODULE_FLAGS.actorRollModifier) ?? null;
  return normalizeTowCombatOverlayActorRollModifierState(rawState);
}

export function getTowCombatOverlayActorRollState(actor) {
  return getTowCombatOverlayActorRollModifierState(actor).rollState;
}

export function getTowCombatOverlayActorRollModifierStateLabel(state) {
  const normalized = normalizeTowCombatOverlayActorRollModifierState(state);
  return MODULE_LABELS.rollState[normalized.rollState] ?? MODULE_LABELS.rollState.normal;
}

export function getTowCombatOverlayActorRollModifierFields(actor) {
  const state = getTowCombatOverlayActorRollModifierState(actor);
  return {
    bonus: Math.max(0, state.diceModifier),
    penalty: Math.max(0, -state.diceModifier),
    glorious: state.rollState === "glorious" ? 1 : 0,
    grim: state.rollState === "grim" ? 1 : 0
  };
}

export function createTowCombatOverlayRollContext(actor, baseContext = {}) {
  const context = foundry.utils.deepClone(baseContext ?? {});
  const modifierFields = getTowCombatOverlayActorRollModifierFields(actor);
  const nextFields = foundry.utils.mergeObject(
    {
      bonus: 0,
      penalty: 0,
      glorious: 0,
      grim: 0
    },
    context.fields ?? {}
  );
  context.fields = foundry.utils.mergeObject(nextFields, modifierFields);
  return context;
}

export async function setTowCombatOverlayActorRollModifierState(actor, nextState) {
  if (!actor?.setFlag) return null;
  const normalized = normalizeTowCombatOverlayActorRollModifierState(nextState);
  const isDefault = normalized.diceModifier === 0 && normalized.rollState === DEFAULT_ACTOR_ROLL_MODIFIER_STATE.rollState;
  if (isDefault && actor.unsetFlag) {
    await actor.unsetFlag(MODULE_ID, MODULE_FLAGS.actorRollModifier);
    return getTowCombatOverlayDefaultActorRollModifierState();
  }
  await actor.setFlag(MODULE_ID, MODULE_FLAGS.actorRollModifier, normalized);
  return normalized;
}

export async function adjustTowCombatOverlayActorRollModifierDice(actor, delta) {
  const current = getTowCombatOverlayActorRollModifierState(actor);
  return setTowCombatOverlayActorRollModifierState(actor, {
    ...current,
    diceModifier: current.diceModifier + (Math.trunc(Number(delta) || 0))
  });
}

export async function cycleTowCombatOverlayActorRollState(actor, step = 1) {
  const current = getTowCombatOverlayActorRollModifierState(actor);
  const currentIndex = Math.max(0, ROLL_STATES.indexOf(current.rollState));
  const nextIndex = ((currentIndex + Math.trunc(Number(step) || 0)) % ROLL_STATES.length + ROLL_STATES.length) % ROLL_STATES.length;
  return setTowCombatOverlayActorRollModifierState(actor, {
    ...current,
    rollState: ROLL_STATES[nextIndex]
  });
}
