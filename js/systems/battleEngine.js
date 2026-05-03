// ============================================================================
// BATTLE ENGINE
//
// Turn-based battle resolution. Plug-in compatible: a "battle context" object
// flows through ability/move hooks, accumulating modifications.
//
// Damage formula reference: Bulbapedia "Damage" article — Gen 3+ formula.
// Implementation is independent (not a port of Showdown), but matches Showdown
// outputs to within rounding for the basic case (verified vs known examples).
//
// USAGE:
//   const engine = new BattleEngine({
//     player: { team: [...FakemonInstances], activeIndex: 0 },
//     opponent: { team: [...], activeIndex: 0, isWild: true },
//     onLog: (msg) => {...},
//     onEnd: (result) => {...}
//   });
//   engine.queueAction('player', { type: 'move', moveId: 'tackle' });
//   engine.queueAction('opponent', engine.aiChoose());
//   engine.executeTurn();
// ============================================================================

import { MOVES } from '../data/moves.js';
import { ABILITIES } from '../data/abilities.js';
import { getTypeEffectiveness } from '../data/typeChart.js';

export class BattleEngine {
  constructor(options) {
    this.player = options.player;
    this.opponent = options.opponent;
    this.onLog = options.onLog || (() => {});
    this.onEnd = options.onEnd || (() => {});
    // Battle scene listens to onAnimateMove(moveId, fromOpponent) to play the
    // animation. Fire-and-forget — the scene paces dialogue/animation externally
    // so the engine stays synchronous and easily testable.
    this.onAnimateMove = options.onAnimateMove || (() => {});
    this.weather = null;
    this.weatherTurns = 0;
    this.field = {};
    this.turn = 0;
    this.queued = { player: null, opponent: null };
    this.ended = false;

    // Bind ability stat-modifier closures so effectiveStat can query passive
    // multipliers (Swift Swim, Huge Power, Lead Coat, etc.). Re-bind on switch-in.
    this.bindStatModifiers();

    // Mark starters with firstTurn / justSwitchedIn flags so Ambush, Stakeout etc. fire correctly
    for (const side of ['player', 'opponent']) {
      const mon = this.active(side);
      if (mon) mon.flags = { ...(mon.flags || {}), firstTurn: true, justSwitchedIn: true };
    }

    // Trigger onSwitchIn for both starters
    this.fireAbilityHook('player', 'onSwitchIn');
    this.fireAbilityHook('opponent', 'onSwitchIn');
  }

  bindStatModifiers() {
    for (const side of ['player', 'opponent']) {
      const mon = this.active(side);
      if (!mon) continue;
      mon._abilityStatModifierFn = (statKey, battle) => {
        const ability = ABILITIES[mon.activeAbility];
        if (!ability || typeof ability.onComputeStats !== 'function') return 1;
        const ctx = { user: mon, battle, target: this.active(side === 'player' ? 'opponent' : 'player') };
        let result;
        try { result = ability.onComputeStats(ctx); } catch (e) { return 1; }
        if (!result || !result.modifiers) return 1;
        return result.modifiers[statKey] ?? 1;
      };
    }
  }

  active(side) {
    const s = side === 'player' ? this.player : this.opponent;
    return s.team[s.activeIndex];
  }

  log(msg) { this.onLog(msg); }

  queueAction(side, action) { this.queued[side] = action; }

  // === Action priority resolution ===
  // Action types: { type: 'move', moveId, priorityBoost? } | { type: 'switch', toIndex } | { type: 'item', itemId } | { type: 'flee' }
  resolveOrder() {
    const a = this.queued.player;
    const b = this.queued.opponent;
    const aPrio = this.actionPriority(a, 'player');
    const bPrio = this.actionPriority(b, 'opponent');

    if (aPrio !== bPrio) return aPrio > bPrio ? ['player','opponent'] : ['opponent','player'];

    // Tie → speed
    const aSpe = this.active('player').effectiveStat('spe', this);
    const bSpe = this.active('opponent').effectiveStat('spe', this);
    if (aSpe === bSpe) return Math.random() < 0.5 ? ['player','opponent'] : ['opponent','player'];
    return aSpe > bSpe ? ['player','opponent'] : ['opponent','player'];
  }

  actionPriority(action, side) {
    if (!action) return -10;
    if (action.type === 'switch') return 6;
    if (action.type === 'item')   return 6;
    if (action.type === 'flee')   return 7;
    if (action.type === 'move') {
      const move = MOVES[action.moveId];
      let p = (move && move.priority) ? move.priority : 0;
      // onBeforeMove hooks may boost priority (e.g., Opportunist)
      const ctx = this.makeMoveContext(side, action.moveId);
      const ret = this.fireAbilityHook(side, 'onBeforeMove', ctx);
      if (ret && ret.priorityBoost) p += ret.priorityBoost;
      return p;
    }
    return 0;
  }

  // === Turn execution ===
  executeTurn() {
    if (this.ended) return;
    this.turn++;
    this.log(`-- Turn ${this.turn} --`);

    const order = this.resolveOrder();
    for (const side of order) {
      if (this.ended) break;
      if (this.active(side).isFainted()) continue;
      this.executeAction(side, this.queued[side]);
    }

    // End-of-turn effects: weather, status damage, ability hooks
    this.endOfTurnEffects();

    this.queued = { player: null, opponent: null };
  }

  executeAction(side, action) {
    if (!action) return;
    if (action.type === 'move') return this.executeMove(side, action);
    if (action.type === 'switch') return this.executeSwitch(side, action);
    if (action.type === 'flee') return this.executeFlee(side);
    // item not implemented yet
  }

  executeFlee(side) {
    if (side !== 'player') return;
    if (!this.opponent.isWild) {
      this.log(`There's no running from a Trainer battle!`);
      return;
    }
    this.log(`You got away safely!`);
    this.ended = true;
    this.onEnd({ result: 'fled' });
  }

  executeSwitch(side, action) {
    const slot = side === 'player' ? this.player : this.opponent;
    const cur = this.active(side);
    // Trapping abilities (Shadow Tag, Arena Trap, Magnet Pull) set target.flags.trapped
    // Suction Cups (own flag) is immune to forced switching but a manual switch is allowed.
    // Per ER, trapped blocks voluntary switching. Wild switch is always allowed.
    const isWildOpponent = (side === 'player' && this.opponent.isWild) || (side === 'opponent' && this.player.isWild);
    if (cur && cur.flags && cur.flags.trapped && !isWildOpponent) {
      this.log(`${cur.nickname} can't escape!`);
      return;
    }
    const newMon = slot.team[action.toIndex];
    if (!newMon || newMon.isFainted()) return;
    // Fire onSwitchOut hook on departing mon (Regenerator, Natural Cure)
    this.fireAbilityHook(side, 'onSwitchOut');
    this.log(`${this.active(side).nickname} returned. Go, ${newMon.nickname}!`);
    slot.activeIndex = action.toIndex;
    // Mark new mon: firstTurn (for Ambush, Fake Out), justSwitchedIn (for Stakeout)
    newMon.flags = { ...(newMon.flags || {}), firstTurn: true, justSwitchedIn: true };
    // Reset toxic counter on switch (canon behavior)
    newMon._toxicCounter = 0;
    this.bindStatModifiers();
    this.fireAbilityHook(side, 'onSwitchIn');
  }

  // === Move execution ===
  executeMove(side, action) {
    const user = this.active(side);
    const target = this.active(side === 'player' ? 'opponent' : 'player');
    let move = MOVES[action.moveId];
    if (!move) { this.log(`(${action.moveId} not found)`); return; }

    // Cursed Body / etc. disabled-move check
    if (user.flags && user.flags.disabledMove === action.moveId && (user.flags.disabledTurns || 0) > 0) {
      this.log(`${user.nickname}'s ${move.name} is disabled!`);
      return;
    }

    // Gorilla Tactics / Choice item: locked into one move after first use
    if (user.flags && user.flags.lockedMove && user.flags.lockedMove !== action.moveId) {
      this.log(`${user.nickname} is locked into ${user.flags.lockedMove}!`);
      return;
    }

    // PP check
    if (user.movePP[action.moveId] === undefined || user.movePP[action.moveId] <= 0) {
      this.log(`${user.nickname} has no PP left for ${move.name}!`);
      return;
    }
    user.movePP[action.moveId]--;

    // Status checks (sleep, freeze, paralysis, etc.)
    if (!this.canMove(user)) return;

    // onBeforeMove pre-check (Truant, Magic Bounce, etc.) — can cancel the move
    const beforeCtx = { user, target, move, battle: this };
    const beforeRet = this.fireAbilityHook(side, 'onBeforeMove', beforeCtx);
    if (beforeRet && beforeRet.skipMove) {
      // Refund PP since the move never went off
      user.movePP[action.moveId]++;
      return;
    }

    this.log(`${user.nickname} used ${move.name}!`);
    this.onAnimateMove(action.moveId, side === 'opponent');

    // Long Reach: strip 'contact' flag from this move for the duration of the use.
    // (Cosmetic side-effect in our engine; matters for contact retaliation hooks.)
    if (user.flags && user.flags.longReach && move.flags && move.flags.includes('contact')) {
      move = { ...move, flags: move.flags.filter(f => f !== 'contact') };
    }

    // Accuracy check — applies ability-driven multipliers (Illuminate, Hustle, Hypnotist),
    // Fatal Precision (super-effective never miss, evaluated against expected effectiveness),
    // Deadeye / Sighting System (treated as accuracyMult >= 999),
    // Wonder Skin (defender flag halves accuracy of incoming status moves).
    let accuracy = move.accuracy;
    if (accuracy > 0) {
      const userAccMult = (user.flags && user.flags.accuracyMult) || 1;
      accuracy = accuracy * userAccMult;
      // Wonder Skin: status moves vs target with the flag are halved
      if (move.category === 'status' && target.flags && target.flags.wonderSkin) {
        accuracy = Math.min(accuracy, 50);
      }
      // Fatal Precision: super-effective moves can't miss. Effectiveness isn't computed yet
      // for this hit, so evaluate it against the unmodified move type vs target.
      if (user.flags && user.flags.fatalPrecision) {
        const eff = getTypeEffectiveness(move.type, target.species.types);
        if (eff > 1) accuracy = 999;
      }
      if (accuracy < 999 && Math.random() * 100 >= accuracy) {
        this.log(`${user.nickname}'s attack missed!`);
        // Reset transient single-use flags
        if (user.flags) user.flags.accuracyMult = 1;
        return;
      }
    }
    // Reset transient single-use accuracy flag (it was set by onBeforeMove for THIS move)
    if (user.flags) user.flags.accuracyMult = 1;

    // Status moves apply effects, don't deal damage
    if (move.category === 'status') {
      if (move.effect) this.applyEffect(side, move.effect, { user, target, move });
      return;
    }

    // Damage move — compute hits (Hyper Aggressive, Multi-Headed, Skill Link, Parental Bond, etc.)
    const userAbility = ABILITIES[user.activeAbility] || {};
    let extraHits = userAbility.extraHits || 0;
    // Skill Link: multi-hit moves (move.hits) max out (5 hits)
    if (user.flags && user.flags.skillLink && move.hits) {
      extraHits = Math.max(extraHits, (move.hits.max || 5) - 1);
    } else if (move.hits) {
      // Standard 2-5 hit move: random within range
      const min = move.hits.min || 2;
      const max = move.hits.max || 5;
      extraHits = Math.max(extraHits, min + Math.floor(Math.random() * (max - min + 1)) - 1);
    }
    // Parental Bond: 2 hits, 2nd at 25%
    let parentalBondHit = false;
    if (user.flags && user.flags.parentalBond && extraHits === 0 && move.power > 0) {
      extraHits = 1;
      parentalBondHit = true;
    }
    // Multi-Headed: 2 or 3 hits already chosen via flags.multiHits
    if (user.flags && user.flags.multiHits && extraHits === 0) {
      extraHits = user.flags.multiHits - 1;
      user.flags.multiHits = 0;
    }
    const totalHits = 1 + extraHits;

    let totalDamage = 0;
    let kod = false;

    for (let hit = 0; hit < totalHits; hit++) {
      if (target.isFainted()) break;
      let damage = this.computeDamage(user, target, move);
      // Reduce damage on extra hits if ability says so
      if (hit > 0 && userAbility.extraHitDamageMult) {
        damage = Math.floor(damage * userAbility.extraHitDamageMult);
      }
      // Parental Bond: 2nd hit at 25%
      if (hit > 0 && parentalBondHit) {
        damage = Math.floor(damage * 0.25);
      }

      // ability hooks: user's onModifyDamage
      const modCtx = this.makeMoveContext(side, action.moveId, { damage });
      const userMod = this.fireAbilityHook(side, 'onModifyDamage', modCtx);
      if (userMod && typeof userMod.damage === 'number') damage = Math.floor(userMod.damage);

      // ability hooks: target's onModifyIncomingDamage
      const incomingCtx = { ...modCtx, damage, effectiveness: this.lastEffectiveness };
      const tgtMod = this.fireAbilityHook(side === 'player' ? 'opponent' : 'player', 'onModifyIncomingDamage', incomingCtx);
      if (tgtMod && tgtMod.immune) {
        this.log(`It doesn't affect ${target.nickname}…`);
        return;
      }
      if (tgtMod && typeof tgtMod.damage === 'number') damage = Math.floor(tgtMod.damage);

      damage = Math.max(1, damage);

      const eff = this.lastEffectiveness;
      if (eff === 0) {
        this.log(`It doesn't affect ${target.nickname}…`);
        return;
      }
      kod = target.takeDamage(damage);
      totalDamage += damage;

      if (eff > 1)  this.log(`It's super effective!`);
      if (eff < 1)  this.log(`It's not very effective…`);
      if (this.lastCrit) this.log(`A critical hit!`);

      // Drain
      if (move.drain) user.heal(damage * move.drain);

      // Recoil — Rock Head / Bad Company flag suppresses it.
      // Liquid Ooze handles drain inversion via onTakeDamage hook.
      if (move.recoil && !(user.flags && user.flags.noRecoil)) {
        const recoilDmg = Math.max(1, Math.floor(damage * move.recoil));
        user.takeDamage(recoilDmg);
        this.log(`${user.nickname} is hit by recoil!`);
      }

      // After-damage hooks (Energy Siphon, Static, etc.)
      // fireAbilityHook auto-applies returned effects — don't call applyHookResult manually.
      const adCtx = { user, target, move, damage, battle: this };
      this.fireAbilityHook(side, 'onAfterDamage', adCtx);
      this.fireAbilityHook(side === 'player' ? 'opponent' : 'player', 'onTakeDamage', adCtx);

      // Contact hook (Static, Flame Body, Poison Point, Rough Skin, Iron Barbs, etc.)
      if (move.flags && move.flags.includes('contact')) {
        this.fireAbilityHook(
          side === 'player' ? 'opponent' : 'player',
          'onTakeContact',
          { attacker: user, defender: target, move, damage, battle: this }
        );
      }

      if (kod) break;
    }

    if (totalHits > 1 && !kod) this.log(`Hit ${totalHits} times!`);

    // Secondary effect (status, stat change with chance)
    // Shield Dust: target with this flag suppresses opponent's move secondary effects.
    // Serene Grace / Precise Fist (secondaryChanceMult): user-side multiplier on chance.
    if (!kod && move.effect) {
      const shielded = target.flags && target.flags.shieldDust;
      if (!shielded) {
        let chance = move.effect.chance;
        if (chance !== undefined) {
          let mult = 1;
          if (user.flags && user.flags.sereneGrace) mult *= 2;
          if (user.flags && user.flags.secondaryChanceMult) mult *= user.flags.secondaryChanceMult;
          chance = Math.min(1, chance * mult);
        }
        if (chance === undefined || Math.random() < chance) {
          this.applyEffect(side, move.effect, { user, target, move });
        }
      }
    }

    // Reset transient single-use damage flags so they don't leak to next move
    if (user.flags) {
      user.flags.secondaryChanceMult = 1;
      // Multi-Headed: already reset above. Parental Bond stays armed (it's an ability passive).
    }

    if (kod) {
      this.log(`${target.nickname} fainted!`);
      // After-KO hook (Soul Eater, Predator)
      this.fireAbilityHook(side, 'onAfterKO', { user, target, battle: this });
      this.checkBattleEnd();
    }
  }

  // === DAMAGE FORMULA ===
  // Gen 3+ formula:
  // Base = ((((2*Level/5)+2) * Power * A/D) / 50) + 2
  // then multiplied by: STAB, type effectiveness, crit, random factor (0.85-1.0), burn (if physical)
  computeDamage(user, target, move) {
    const level = user.level;

    // -ate type-changing abilities (Pixilate/Aerilate/Galvanize/Refrigerate/Normalize/Pollinate/Draconize)
    // These change Normal-type moves to their type and apply a 1.1x boost (ER value).
    // Implementation: query onModifyMoveType hook; if it returns a new type, build a modified move.
    const userSide = (user === this.active('player')) ? 'player' : 'opponent';
    const typeMod = this.fireAbilityHook(userSide, 'onModifyMoveType', { user, target, move });
    if (typeMod && typeMod.newType) {
      move = { ...move, type: typeMod.newType, _ateBoosted: true };
    }

    const power = move.power;

    // Ancient Idol: swap atk/spAtk with def/spDef when computing offense
    let A, D;
    const useAncientIdol = user.flags && user.flags.ancientIdol;
    if (move.category === 'physical') {
      A = useAncientIdol ? user.effectiveStat('def') : user.effectiveStat('atk');
      D = target.effectiveStat('def');
    } else {
      A = useAncientIdol ? user.effectiveStat('spDef') : user.effectiveStat('spAtk');
      D = target.effectiveStat('spDef');
    }

    // Unaware (defender flag): ignore attacker's positive stat stages.
    // Unaware (attacker flag): ignore defender's positive stat stages.
    // Implementation: recompute D/A using base stats * nature only when relevant.
    if (target.flags && target.flags.unaware) {
      // attacker ignores their own boosts — recompute A from raw stats
      A = useAncientIdol
        ? (move.category === 'physical' ? user.stats.def : user.stats.spDef)
        : (move.category === 'physical' ? user.stats.atk : user.stats.spAtk);
    }
    if (user.flags && user.flags.unaware) {
      // defender ignores their own drops — recompute D from raw stats
      D = move.category === 'physical' ? target.stats.def : target.stats.spDef;
    }

    let dmg = Math.floor((Math.floor((2 * level / 5) + 2) * power * Math.floor(A / Math.max(1, D)) / 50) + 2);

    // STAB
    const stab = user.species.types.includes(move.type) ? 1.5 : 1;

    // Type effectiveness — with ability overrides:
    //   scrappy: Normal/Fighting hit Ghost as neutral (=1 not 0)
    //   groundShock: Electric hits Ground as neutral
    //   overwhelm: Dragon hits Fairy as neutral
    //   moltenDown: Fire vs Rock is super-effective (2x neutral, 4x SE if was 1x)
    //   seaweed (defender): Grass takes neutral from Fire instead of 2x
    let eff = getTypeEffectiveness(move.type, target.species.types);
    if (eff === 0 && user.flags) {
      const ghostHit = (move.type === 'normal' || move.type === 'fighting') && target.species.types.includes('ghost');
      const groundHit = move.type === 'electric' && target.species.types.includes('ground');
      const fairyHit = move.type === 'dragon' && target.species.types.includes('fairy');
      if ((user.flags.scrappy && ghostHit)
       || (user.flags.groundShock && groundHit)
       || (user.flags.overwhelm && fairyHit)) {
        eff = 1;
      }
    }
    if (user.flags && user.flags.moltenDown && move.type === 'fire' && target.species.types.includes('rock')) {
      eff *= 2;
    }
    if (target.flags && target.flags.seaweed && move.type === 'fire' && target.species.types.includes('grass')) {
      eff = 1;
    }
    this.lastEffectiveness = eff;

    // Crit (base 1/24, +critRate stages)
    let critStages = move.critRate || 0;

    // Attacker hooks: Super Luck, Sniper, etc. can boost crit stages or multiplier
    const atkSide = (user === this.active('player')) ? 'player' : 'opponent';
    const defSide = atkSide === 'player' ? 'opponent' : 'player';
    const atkCritHook = this.fireAbilityHook(atkSide, 'onCriticalCheck', { user, target, move, defender: false });
    if (atkCritHook && atkCritHook.critStages) critStages += atkCritHook.critStages;

    // Defender hooks: Battle Armor / Shell Armor block crits entirely
    const defCritHook = this.fireAbilityHook(defSide, 'onCriticalCheck', { user, target, move, defender: true });
    let blockCrit = defCritHook && defCritHook.blockCrit;

    const critRates = [1/24, 1/8, 1/2, 1, 1];
    const critChance = critRates[Math.min(critStages, 4)];
    let critMult = (Math.random() < critChance && !blockCrit) ? 1.5 : 1;
    // Attacker abilities can boost crit damage multiplier (Sniper)
    if (critMult > 1 && atkCritHook && atkCritHook.critDamageMult) {
      critMult = atkCritHook.critDamageMult;
    }
    const crit = critMult;
    this.lastCrit = (crit > 1);

    // Random factor 85-100%
    const rand = (85 + Math.floor(Math.random() * 16)) / 100;

    dmg = Math.floor(dmg * stab * eff * crit * rand);

    return Math.max(1, dmg);
  }

  // === Apply effects ===
  applyEffect(sourceSide, effect, ctx) {
    if (effect.type === 'stat') {
      const targetMon = effect.target === 'opponent' ? this.active(sourceSide === 'player' ? 'opponent' : 'player') : ctx.user;
      this.changeStatStage(targetMon, effect.stat, effect.stages, effect.source);
    } else if (effect.type === 'status') {
      const targetMon = effect.target === 'opponent' ? this.active(sourceSide === 'player' ? 'opponent' : 'player') : ctx.user;
      this.applyStatus(targetMon, effect.status);
    } else if (effect.type === 'flinch') {
      const targetMon = this.active(sourceSide === 'player' ? 'opponent' : 'player');
      targetMon.volatileStatus.flinch = true;
    } else if (effect.type === 'heal') {
      ctx.user.heal(effect.amount);
      this.log(`${ctx.user.nickname} regained health!`);
    } else if (effect.type === 'weather') {
      // Weather setter (Drizzle, Drought, etc.). turns defaults to infinite (-1) per ER mechanics.
      const newWeather = effect.weather;
      if (this.weather !== newWeather) {
        this.weather = newWeather;
        this.weatherTurns = effect.turns ?? -1;
        const msg = {
          rain: "It started to rain!",
          sun: "The sunlight turned harsh!",
          sand: "A sandstorm kicked up!",
          snow: "It started to snow!",
          fog: "Eerie fog rolled in!"
        }[newWeather] || `Weather changed to ${newWeather}!`;
        this.log(msg);
        // Notify both sides via onWeatherChange
        this.fireAbilityHook('player', 'onWeatherChange', { weather: newWeather });
        this.fireAbilityHook('opponent', 'onWeatherChange', { weather: newWeather });
      }
    } else if (effect.type === 'terrain') {
      this.terrain = effect.terrain;
      this.terrainTurns = effect.turns ?? 5;
      this.log(`The terrain became ${effect.terrain}!`);
    } else if (effect.type === 'field') {
      // Generic field effect (gravity, trick room, etc)
      this.fieldEffects = this.fieldEffects || {};
      this.fieldEffects[effect.field] = effect.turns || 5;
      this.log(`${effect.field} took effect!`);
    }
  }

  changeStatStage(mon, stat, stages, source) {
    // Fire onStatStageChange hooks first — Fort Knox can override.
    // fireAbilityHook auto-applies hook effects, so we just check the override flag.
    const side = (mon === this.active('player')) ? 'player' : 'opponent';
    const hookCtx = { user: mon, stat, stages, source, battle: this };
    const hookRet = this.fireAbilityHook(side, 'onStatStageChange', hookCtx);
    if (hookRet && hookRet.override) {
      // Override means: skip the original stat change. Effects already applied by fireAbilityHook.
      return;
    }

    const old = mon.statStages[stat] || 0;
    mon.statStages[stat] = Math.max(-6, Math.min(6, old + stages));
    const delta = mon.statStages[stat] - old;
    if (delta === 0) {
      this.log(`${mon.nickname}'s ${stat} can't go any ${stages > 0 ? 'higher' : 'lower'}!`);
    } else {
      const dir = delta > 0 ? 'rose' : 'fell';
      const intensity = Math.abs(delta) >= 3 ? ' drastically' : Math.abs(delta) === 2 ? ' sharply' : '';
      this.log(`${mon.nickname}'s ${stat}${intensity} ${dir}!`);
    }
  }

  applyStatus(mon, status) {
    if (mon.status) return;  // already statused

    // Type-based status immunities (Poison/Steel can't be poisoned, Fire can't burn,
    // Electric can't be paralyzed, Ice can't freeze) — except Corrosion bypasses
    // poison immunity. Corrosion is checked from the attacker, but applyStatus only
    // sees the target. The caller is responsible for setting a transient
    // mon._corrosionAttacker flag if attacker has corrosion. Simpler: store the flag
    // on the attacker and check the active opposite mon's flag.
    const attacker = this.active(mon === this.active('player') ? 'opponent' : 'player');
    const hasCorrosion = attacker && attacker.flags && attacker.flags.corrosion;
    const types = mon.species.types;
    const typeImmune =
      ((status === 'poison' || status === 'badly_poisoned') && (types.includes('poison') || types.includes('steel')) && !hasCorrosion)
      || (status === 'burn' && types.includes('fire'))
      || (status === 'paralysis' && types.includes('electric'))
      || (status === 'freeze' && types.includes('ice'));
    if (typeImmune) {
      this.log(`${mon.nickname} is immune to ${status}!`);
      return;
    }

    // Fire onTryStatus hook — abilities like Insomnia, Limber, Immunity can block
    const side = (mon === this.active('player')) ? 'player' : 'opponent';
    const hookRet = this.fireAbilityHook(side, 'onTryStatus', { user: mon, status, battle: this });
    if (hookRet && hookRet.blocked) {
      const ability = ABILITIES[mon.activeAbility];
      this.log(`${mon.nickname}'s ${ability.name} prevents ${status}!`);
      return;
    }
    mon.status = status;
    this.log(`${mon.nickname} was ${status}!`);
  }

  // === Move-time checks ===
  canMove(mon) {
    if (mon.volatileStatus.flinch) {
      this.log(`${mon.nickname} flinched!`);
      delete mon.volatileStatus.flinch;
      return false;
    }
    if (mon.status === 'paralyzed' && Math.random() < 0.25) {
      this.log(`${mon.nickname} is paralyzed and can't move!`);
      return false;
    }
    if (mon.status === 'sleep') {
      // Early Bird: wake up twice as fast
      const decrement = (mon.flags && mon.flags.earlyBird) ? 2 : 1;
      mon.statusTurns -= decrement;
      if (mon.statusTurns <= 0) {
        mon.status = null;
        this.log(`${mon.nickname} woke up!`);
      } else {
        this.log(`${mon.nickname} is fast asleep.`);
        return false;
      }
    }
    if (mon.status === 'frozen') {
      if (Math.random() < 0.2) {
        mon.status = null;
        this.log(`${mon.nickname} thawed out!`);
      } else {
        this.log(`${mon.nickname} is frozen solid!`);
        return false;
      }
    }
    return true;
  }

  // === End of turn ===
  endOfTurnEffects() {
    if (this.ended) return;
    for (const side of ['player','opponent']) {
      const mon = this.active(side);
      if (mon.isFainted()) continue;
      if (mon.status === 'burn') {
        const dmg = Math.max(1, Math.floor(mon.stats.hp / 16));
        mon.takeDamage(dmg);
        this.log(`${mon.nickname} is hurt by its burn!`);
      } else if (mon.status === 'poison') {
        const dmg = Math.max(1, Math.floor(mon.stats.hp / 8));
        mon.takeDamage(dmg);
        this.log(`${mon.nickname} is hurt by poison!`);
      } else if (mon.status === 'badly_poisoned') {
        // Toxic: scaling damage starting at 1/16, growing each turn
        mon._toxicCounter = (mon._toxicCounter || 0) + 1;
        const dmg = Math.max(1, Math.floor(mon.stats.hp * mon._toxicCounter / 16));
        mon.takeDamage(dmg);
        this.log(`${mon.nickname} is hurt badly by poison!`);
      }
      // Fire onEndOfTurn ability hook (Speed Boost, Rain Dish, Ice Body, Bad Dreams, etc.)
      this.fireAbilityHook(side, 'onEndOfTurn', { weather: this.weather });

      // Tick down per-turn flag counters
      if (mon.flags) {
        if (mon.flags.disabledTurns > 0) {
          mon.flags.disabledTurns--;
          if (mon.flags.disabledTurns === 0) {
            this.log(`${mon.nickname}'s disabled move was unlocked.`);
            mon.flags.disabledMove = null;
          }
        }
        if (mon.flags.trapTurns > 0) {
          mon.flags.trapTurns--;
          if (mon.flags.trapTurns === 0) {
            mon.flags.trapped = false;
          }
        }
        // First-turn flag is consumed after turn 1
        if (mon.flags.firstTurn) mon.flags.firstTurn = false;
        // justSwitchedIn lasts only one turn
        if (mon.flags.justSwitchedIn) mon.flags.justSwitchedIn = false;
      }

      if (mon.isFainted()) {
        this.log(`${mon.nickname} fainted!`);
        this.checkBattleEnd();
      }
    }
    // Forced switch (Wimp Out / Emergency Exit) — at end of turn, swap if flag set
    for (const side of ['player','opponent']) {
      const mon = this.active(side);
      if (mon && mon.flags && mon.flags.forceSwitch) {
        mon.flags.forceSwitch = false;
        // Find a non-fainted alternate; if none, no switch
        const slot = side === 'player' ? this.player : this.opponent;
        const alt = slot.team.findIndex((m, i) => i !== slot.activeIndex && !m.isFainted());
        if (alt >= 0) {
          this.log(`${mon.nickname} fled the field!`);
          this.fireAbilityHook(side, 'onSwitchOut');
          slot.activeIndex = alt;
          this.bindStatModifiers();
          // Mark new mon as just switched in
          const newMon = this.active(side);
          if (newMon) newMon.flags = { ...(newMon.flags || {}), justSwitchedIn: true };
          this.fireAbilityHook(side, 'onSwitchIn');
        }
      }
    }
    // Tick weather
    if (this.weather && this.weatherTurns > 0) {
      this.weatherTurns--;
      if (this.weatherTurns === 0) {
        this.log(`The ${this.weather} stopped.`);
        this.weather = null;
      }
    }
  }

  // === Battle end ===
  checkBattleEnd() {
    const playerAlive = this.player.team.some(m => !m.isFainted());
    const oppAlive = this.opponent.team.some(m => !m.isFainted());
    if (!playerAlive) { this.ended = true; this.onEnd({ result: 'loss' }); return; }
    if (!oppAlive)    { this.ended = true; this.onEnd({ result: 'win'  }); return; }
    // If active fainted but team alive, prompt switch (handled by UI)
  }

  // === Ability hook firing ===
  // ctx.user is ALWAYS the mon whose ability is firing. Callers can pass `attacker`
  // and `defender` (or `target`) for context but must not override `user`.
  fireAbilityHook(side, hookName, ctx = {}) {
    const mon = this.active(side);
    if (!mon || mon.isFainted()) return null;
    const ability = ABILITIES[mon.activeAbility];
    if (!ability || typeof ability[hookName] !== 'function') return null;
    // Build context so that ctx.user is always THIS mon (the ability's owner).
    // Callers' ctx.user is ignored; preserved as ctx.attacker if relevant.
    const opponentSide = side === 'player' ? 'opponent' : 'player';
    const opp = this.active(opponentSide);
    const incomingUser = ctx.user;
    const fullCtx = {
      ...ctx,
      battle: this,
      user: mon,
      target: ctx.target || (incomingUser && incomingUser !== mon ? incomingUser : opp),
      // Preserve attacker if this is a defender-side hook (onTakeDamage, onTakeContact)
      attacker: ctx.attacker || (incomingUser && incomingUser !== mon ? incomingUser : opp),
      defender: ctx.defender !== undefined ? ctx.defender : (incomingUser && incomingUser !== mon)
    };
    try {
      const result = ability[hookName](fullCtx);
      if (result && result.effects) this.applyHookResult(result, side);
      return result || null;
    } catch (e) {
      console.warn(`Ability ${mon.activeAbility} hook ${hookName} threw:`, e);
      return null;
    }
  }

  applyHookResult(result, side) {
    if (!result || !result.effects) return;
    for (const eff of result.effects) {
      this.applyEffect(side, eff, { user: this.active(side) });
    }
  }

  // Helper for building a move context
  makeMoveContext(side, moveId, extra = {}) {
    return {
      user: this.active(side),
      target: this.active(side === 'player' ? 'opponent' : 'player'),
      move: MOVES[moveId],
      battle: this,
      ...extra
    };
  }

  // === Simple AI: pick the move with highest expected damage ===
  aiChoose() {
    const ai = this.active('opponent');
    const target = this.active('player');
    if (!ai || !ai.moves || ai.moves.length === 0) {
      return { type: 'move', moveId: 'tackle' }; // fallback
    }
    let best = ai.moves[0], bestScore = -Infinity;
    for (const moveId of ai.moves) {
      const move = MOVES[moveId];
      if (!move) continue;
      if (ai.movePP[moveId] <= 0) continue;
      let score;
      if (move.category === 'status') {
        score = 30; // some preference for setup/status moves but not preferred
      } else {
        const eff = getTypeEffectiveness(move.type, target.species.types);
        const stab = ai.species.types.includes(move.type) ? 1.5 : 1;
        score = move.power * eff * stab;
      }
      if (score > bestScore) { bestScore = score; best = moveId; }
    }
    return { type: 'move', moveId: best };
  }
}
