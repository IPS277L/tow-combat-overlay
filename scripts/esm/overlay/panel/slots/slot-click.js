export function createPanelSlotClickService({
  panelId,
  panelUnarmedActionId,
  parsePanelButtonKey,
  getSingleControlledActor,
  getSingleControlledToken,
  canEditActor,
  warnNoPermission,
  isAltModifier,
  isShiftModifier,
  isCtrlModifier,
  clearPanelAttackPickMode,
  startPanelAimPickMode,
  startPanelHelpPickMode,
  startPanelAttackPickMode,
  runPanelAimAction,
  runPanelHelpAction,
  resetPanelAccumulatePowerValues,
  resolveActorMiscastState,
  runPanelAccumulatePowerAction,
  runPanelActorAction,
  runPanelRecoverAction,
  runPanelManoeuvreAction,
  spellRequiresTargetPick,
  withTemporaryUserTargets,
  runPanelCastSpecificSpellFromAccumulatedPower,
  spellTargetsSelf,
  updateSelectionDisplay,
  withTemporaryPanelUnarmedAbility,
  setupAbilityTestWithDamage,
  runPanelUnarmedAttackOnTarget,
  ensurePanelAttackResourceStateBeforeUse,
  resolvePanelAttackAmmoState,
  writePanelAttackAmmoState,
  runPanelAttackOnTarget
} = {}) {
  function getPanelElement(slotElement) {
    return slotElement.closest(`#${panelId}`);
  }

  async function handleSlotClick(slotElement, event) {
    if (String(slotElement.dataset.itemType ?? "").trim() === "empty") return;
    const rawItemGroup = String(slotElement.dataset.itemGroup ?? "").trim();
    const rawItemId = String(slotElement.dataset.itemId ?? "").trim();
    const orderKey = String(slotElement.dataset.itemOrderKey ?? "").trim();
    const topChipType = String(slotElement.dataset.itemTopChipType ?? "").trim();
    const parsedOrderKey = parsePanelButtonKey(orderKey);
    const itemGroup = rawItemGroup || String(parsedOrderKey?.groupKey ?? "").trim();
    const itemId = rawItemId || String(parsedOrderKey?.itemId ?? "").trim();
    if (itemGroup === "topChips") {
      if (topChipType === "temporaryEffects" && itemId) {
        if (event?.button !== 2) return;
        const actor = getSingleControlledActor();
        if (!actor) return;
        if (!canEditActor(actor)) {
          warnNoPermission(actor);
          return;
        }
        const liveEffect = actor.effects?.get?.(itemId) ?? null;
        if (!liveEffect || typeof liveEffect.delete !== "function") return;
        await liveEffect.delete();
        const panelElement = getPanelElement(slotElement);
        if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
        return;
      }

      if (topChipType === "abilities" && itemId) {
        const actor = getSingleControlledActor();
        const sourceItemName = String(slotElement.dataset.itemName ?? "").trim().toLowerCase();
        const item = actor?.items?.get?.(itemId)
          ?? actor?.items?.find?.((entry) => String(entry?.name ?? "").trim().toLowerCase() === sourceItemName)
          ?? null;
        if (item?.sheet?.render) item.sheet.render(true);
      }
      return;
    }

    if (itemGroup === "temporaryEffects" && itemId) {
      if (event?.button !== 2) return;
      const actor = getSingleControlledActor();
      if (!actor) return;
      if (!canEditActor(actor)) {
        warnNoPermission(actor);
        return;
      }
      const liveEffect = actor.effects?.get?.(itemId) ?? null;
      if (!liveEffect || typeof liveEffect.delete !== "function") return;
      await liveEffect.delete();
      const panelElement = getPanelElement(slotElement);
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      return;
    }

    if (itemGroup === "actions" && itemId) {
      const actor = getSingleControlledActor();
      const sourceToken = getSingleControlledToken();
      if (!actor) return;
      if (!canEditActor(actor)) {
        warnNoPermission(actor);
        return;
      }
      if (itemId === "aim") {
        const useDefaultDialog = isAltModifier(event);
        const selfRoll = isShiftModifier(event);
        const panelElement = getPanelElement(slotElement);
        if (!(panelElement instanceof HTMLElement)) return;
        if (selfRoll) {
          clearPanelAttackPickMode();
          await runPanelAimAction(actor, sourceToken, {
            autoRoll: !useDefaultDialog,
            targetToken: null
          });
        } else if (sourceToken) {
          startPanelAimPickMode(panelElement, slotElement, sourceToken, event, {
            preferDefaultDialog: useDefaultDialog
          });
        }
        if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
        return;
      }
      if (itemId === "help") {
        const useDefaultDialog = isAltModifier(event);
        const selfRoll = isShiftModifier(event);
        const panelElement = getPanelElement(slotElement);
        if (!(panelElement instanceof HTMLElement)) return;
        if (selfRoll) {
          clearPanelAttackPickMode();
          await runPanelHelpAction(actor, sourceToken, {
            autoRoll: !useDefaultDialog,
            targetToken: null
          });
        } else if (sourceToken) {
          startPanelHelpPickMode(panelElement, slotElement, sourceToken, event, {
            preferDefaultDialog: useDefaultDialog
          });
        }
        if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
        return;
      }
      if (itemId === "accumulatePower") {
        if (isCtrlModifier(event)) {
          await resetPanelAccumulatePowerValues(actor);
          const panelElement = getPanelElement(slotElement);
          if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
          return;
        }
        const miscastState = resolveActorMiscastState(actor);
        if (miscastState.atLimit) {
          if (typeof actor?.system?.rollMiscast === "function") {
            await actor.system.rollMiscast();
          }
          const panelElement = getPanelElement(slotElement);
          if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
          return;
        }
        const useDefaultDialog = isAltModifier(event);
        await runPanelAccumulatePowerAction(actor, { autoRoll: !useDefaultDialog });
        const panelElement = getPanelElement(slotElement);
        if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
        return;
      }
      const useDefaultDialog = isAltModifier(event);
      await runPanelActorAction(actor, itemId, { autoRoll: !useDefaultDialog });
      const panelElement = getPanelElement(slotElement);
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      return;
    }

    if (itemGroup === "recover" && itemId) {
      const actor = getSingleControlledActor();
      if (!actor) return;
      if (!canEditActor(actor)) {
        warnNoPermission(actor);
        return;
      }
      const useDefaultDialog = isAltModifier(event);
      await runPanelRecoverAction(actor, itemId, { autoRoll: !useDefaultDialog });
      const panelElement = getPanelElement(slotElement);
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      return;
    }

    if (itemGroup === "manoeuvre" && itemId) {
      const actor = getSingleControlledActor();
      if (!actor) return;
      if (!canEditActor(actor)) {
        warnNoPermission(actor);
        return;
      }
      const useDefaultDialog = isAltModifier(event);
      await runPanelManoeuvreAction(actor, itemId, { autoRoll: !useDefaultDialog });
      const panelElement = getPanelElement(slotElement);
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      return;
    }

    if (itemGroup === "magic" && itemId) {
      const sourceToken = getSingleControlledToken();
      const actor = getSingleControlledActor();
      if (!actor) return;
      if (!canEditActor(actor)) {
        warnNoPermission(actor);
        return;
      }
      const sourceItemName = String(slotElement.dataset.itemName ?? "").trim().toLowerCase();
      const item = actor?.items?.get?.(itemId)
        ?? actor?.items?.find?.((entry) => String(entry?.name ?? "").trim().toLowerCase() === sourceItemName)
        ?? null;
      if (!item) return;
      const altHeld = isAltModifier(event);
      const shiftHeld = isShiftModifier(event);
      const panelElement = getPanelElement(slotElement);

      if (altHeld) {
        const requiresPick = spellRequiresTargetPick(item);
        if (requiresPick && sourceToken && panelElement instanceof HTMLElement) {
          startPanelAttackPickMode(panelElement, slotElement, sourceToken, { id: "spell-manual-cast" }, event, {
            preferDefaultDialog: true,
            onTargetAttack: async (targetToken) => {
              await withTemporaryUserTargets(targetToken, async () => {
                await runPanelCastSpecificSpellFromAccumulatedPower(actor, item, {
                  autoRollCastingTest: false,
                  autoProcessApply: false,
                  allowTargetPick: false,
                  sourceToken,
                  panelElement,
                  slotElement,
                  originEvent: event
                });
              });
            }
          });
          return;
        }

        if (spellTargetsSelf(item) && sourceToken) {
          await withTemporaryUserTargets(sourceToken, async () => {
            await runPanelCastSpecificSpellFromAccumulatedPower(actor, item, {
              autoRollCastingTest: false,
              autoProcessApply: false,
              allowTargetPick: false,
              sourceToken,
              panelElement,
              slotElement,
              originEvent: event
            });
          });
        } else {
          await runPanelCastSpecificSpellFromAccumulatedPower(actor, item, {
            autoRollCastingTest: false,
            autoProcessApply: false,
            allowTargetPick: false,
            sourceToken,
            panelElement,
            slotElement,
            originEvent: event
          });
        }
        if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
        return;
      }

      await runPanelCastSpecificSpellFromAccumulatedPower(actor, item, {
        autoRollCastingTest: false,
        autoProcessApply: true,
        allowTargetPick: !shiftHeld,
        sourceToken,
        panelElement,
        slotElement,
        originEvent: event
      });
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      return;
    }

    if (itemGroup === "abilities" && itemId) {
      const actor = getSingleControlledActor();
      const sourceItemName = String(slotElement.dataset.itemName ?? "").trim().toLowerCase();
      const item = actor?.items?.get?.(itemId)
        ?? actor?.items?.find?.((entry) => String(entry?.name ?? "").trim().toLowerCase() === sourceItemName)
        ?? null;
      if (item?.sheet?.render) item.sheet.render(true);
      return;
    }

    if (itemGroup !== "attacks" || !itemId) return;

    const sourceToken = getSingleControlledToken();
    const sourceActor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
    if (!sourceToken || !sourceActor) return;

    if (itemId === panelUnarmedActionId) {
      const altHeld = isAltModifier(event);
      const shiftHeld = isShiftModifier(event);
      const panelElement = getPanelElement(slotElement);
      if (!(panelElement instanceof HTMLElement)) return;

      if (altHeld && shiftHeld) {
        clearPanelAttackPickMode();
        await withTemporaryPanelUnarmedAbility(sourceActor, async (unarmedAbility) => (
          setupAbilityTestWithDamage(sourceActor, unarmedAbility, { autoRoll: false })
        ));
        return;
      }

      if (shiftHeld) {
        clearPanelAttackPickMode();
        await withTemporaryPanelUnarmedAbility(sourceActor, async (unarmedAbility) => (
          setupAbilityTestWithDamage(sourceActor, unarmedAbility, { autoRoll: true })
        ));
        return;
      }

      startPanelAttackPickMode(panelElement, slotElement, sourceToken, { id: panelUnarmedActionId }, event, {
        preferDefaultDialog: altHeld,
        onTargetAttack: async (targetToken, { autoRoll }) => {
          await withTemporaryPanelUnarmedAbility(sourceActor, async (unarmedAbility) => (
            runPanelUnarmedAttackOnTarget(sourceToken, targetToken, unarmedAbility, { autoRoll })
          ));
        }
      });
      return;
    }

    const slotItemName = String(slotElement.dataset.itemName ?? "").trim().toLowerCase();
    const attackItem = sourceActor.items?.get?.(itemId)
      ?? sourceActor.items?.find?.((item) => String(item?.name ?? "").trim().toLowerCase() === slotItemName)
      ?? null;
    if (!attackItem) return;
    const altHeld = isAltModifier(event);
    const ctrlHeld = isCtrlModifier(event);
    const shiftHeld = isShiftModifier(event);
    const panelElement = getPanelElement(slotElement);
    if (!(panelElement instanceof HTMLElement)) return;

    const consumeAttackResource = async () => {
      const gate = await ensurePanelAttackResourceStateBeforeUse(sourceActor, attackItem);
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      return gate;
    };
    const attackAmmoState = resolvePanelAttackAmmoState(attackItem);
    if (ctrlHeld && attackAmmoState.isRanged && attackAmmoState.usesReloadFlow) {
      clearPanelAttackPickMode();
      if (typeof attackItem?.update === "function") {
        const reloadTargetRaw = Number(attackItem?.system?.reload?.value);
        const reloadCurrentRaw = Number(attackItem?.system?.reload?.current);
        if (Number.isFinite(reloadTargetRaw) && reloadTargetRaw > 0 && Number.isFinite(reloadCurrentRaw)) {
          await attackItem.update({
            "system.reload.current": Math.max(Math.trunc(reloadTargetRaw), Math.trunc(reloadCurrentRaw))
          });
        }
      }
      await writePanelAttackAmmoState(attackItem, {
        current: attackAmmoState.ammoMax,
        reloadProgress: 0
      });
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      return;
    }
    if (attackAmmoState.isRanged && attackAmmoState.usesReloadFlow && attackAmmoState.current <= 0) {
      await consumeAttackResource();
      return;
    }

    if (altHeld && shiftHeld) {
      clearPanelAttackPickMode();
      const gate = await consumeAttackResource();
      if (gate?.blocked) return;
      await setupAbilityTestWithDamage(sourceActor, attackItem, { autoRoll: false });
      return;
    }

    if (shiftHeld) {
      clearPanelAttackPickMode();
      const gate = await consumeAttackResource();
      if (gate?.blocked) return;
      await setupAbilityTestWithDamage(sourceActor, attackItem, { autoRoll: true });
      return;
    }

    startPanelAttackPickMode(panelElement, slotElement, sourceToken, attackItem, event, {
      preferDefaultDialog: altHeld,
      onTargetAttack: async (targetToken, { autoRoll }) => {
        const gate = await consumeAttackResource();
        if (gate?.blocked) return;
        await runPanelAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll });
      }
    });
  }

  return {
    handleSlotClick
  };
}

