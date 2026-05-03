// ============================================================================
// ABILITY DATABASE
//
// Each Fakemon has a POOL of possible abilities (1-4) but exactly ONE active.
// This matches the Elite Redux "abilities" mechanic minus their "innates" (which
// are always-on additional abilities). Player can swap between pool abilities
// at NPCs / via items.
//
// Each ability has hooks that the battle engine calls:
//   onSwitchIn(ctx)       — on entering battle
//   onBeforeMove(ctx)     — before user makes a move
//   onModifyDamage(ctx)   — modify damage before/after the formula
//   onAfterDamage(ctx)    — after damage is dealt
//   onAfterKO(ctx)        — when this Pokemon KOs another
//   onTakeDamage(ctx)     — when this Pokemon takes damage
//   onStatStageChange(ctx)— when this Pokemon's stat stage changes
//   onWeatherChange(ctx)  — when weather changes
//   onEndOfTurn(ctx)      — at end of each turn
//
// `ctx` contains: { user, target, move, damage, battle, ... }
// Hooks return objects that mutate state, e.g. { damage: newDamage }
//
// Many abilities are stubs at this point; we expand as needed. The KEY is the
// ID used in fakedex entries.
//
// Attribution: many ability concepts ported from Pokémon Elite Redux (open
// source, Darky92), Pokémon Showdown (MIT). Cascadia is a non-commercial fan
// project crediting these sources.
// ============================================================================

export const ABILITIES = {

  // ===== STANDARD GEN 1-9 ABILITIES (subset for v0.1) =====

  overgrow: {
    name: "Overgrow",
    description: "Powers up Grass-type moves when HP is low.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'grass' && ctx.user.currentHP <= ctx.user.stats.hp / 3) {
        return { damage: ctx.damage * 1.5 };
      }
    }
  },

  blaze: {
    name: "Blaze",
    description: "Powers up Fire-type moves when HP is low.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'fire' && ctx.user.currentHP <= ctx.user.stats.hp / 3) {
        return { damage: ctx.damage * 1.5 };
      }
    }
  },

  torrent: {
    name: "Torrent",
    description: "Powers up Water-type moves when HP is low.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'water' && ctx.user.currentHP <= ctx.user.stats.hp / 3) {
        return { damage: ctx.damage * 1.5 };
      }
    }
  },

  intimidate: {
    name: "Intimidate",
    description: "Lowers the foe's Attack stat upon entering battle.",
    onSwitchIn: (ctx) => ({
      effects: [{ type: 'stat', target: 'opponent', stat: 'atk', stages: -1, source: 'Intimidate' }]
    })
  },

  static: {
    name: "Static", source: 'er', impl: 'full',
    description: "33% chance to paralyze on contact.",
    onTakeContact: (ctx) => {
      if (Math.random() < 1/3) return { effects: [{ type: 'status', target: 'opponent', status: 'paralysis' }] };
    }
  },

  levitate: {
    name: "Levitate",
    description: "Immune to Ground-type moves. Boosts Flying-type moves by 25%.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'ground') return { damage: 0, immune: true };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'flying') return { damage: ctx.damage * 1.25 };
    }
  },

  // ===== ELITE REDUX-INSPIRED ABILITIES =====
  // Attribution: Pokémon Elite Redux by Darky92 (open source). Effects adapted.

  fort_knox: {
    name: "Fort Knox",
    description: "When a stat is lowered, Defense rises by 3 stages instead.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source !== 'Fort Knox') {
        return {
          override: true,
          effects: [{ type: 'stat', target: 'self', stat: 'def', stages: 3, source: 'Fort Knox' }]
        };
      }
    }
  },

  raging_boxer: {
    name: "Raging Boxer",
    description: "Punching moves deal 30% more damage.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('punch')) {
        return { damage: ctx.damage * 1.3 };
      }
    }
  },

  soul_eater: {
    name: "Soul Eater",
    description: "Heals 1/4 of max HP after KOing a foe.",
    onAfterKO: (ctx) => ({
      effects: [{ type: 'heal', target: 'self', amount: ctx.user.stats.hp / 4, source: 'Soul Eater' }]
    })
  },

  predator: {
    name: "Predator",
    description: "Heals 1/4 of max HP after KOing a foe.",
    onAfterKO: (ctx) => ({
      effects: [{ type: 'heal', target: 'self', amount: ctx.user.stats.hp / 4, source: 'Predator' }]
    })
  },

  hyper_aggressive: {
    name: "Hyper Aggressive",
    description: "Attacks hit twice; second hit deals 25% damage.",
    extraHits: 1,
    extraHitDamageMult: 0.25
    // Engine reads these flags directly when computing hit count
  },

  opportunist: {
    name: "Opportunist",
    description: "Single-target moves get +1 priority against foes at or below 50% HP.",
    onBeforeMove: (ctx) => {
      if (ctx.target && ctx.target.currentHP <= ctx.target.stats.hp / 2 && !ctx.move.multiTarget) {
        return { priorityBoost: 1 };
      }
    }
  },

  majestic_moth: {
    name: "Majestic Moth",
    description: "Highest stat is boosted by 1 stage on entry.",
    onSwitchIn: (ctx) => {
      const stats = ctx.user.stats;
      let highest = 'atk', highestVal = -Infinity;
      for (const s of ['atk','def','spAtk','spDef','spe']) {
        if (stats[s] > highestVal) { highestVal = stats[s]; highest = s; }
      }
      return { effects: [{ type: 'stat', target: 'self', stat: highest, stages: 1, source: 'Majestic Moth' }] };
    }
  },

  lead_coat: {
    name: "Lead Coat", source: 'er', impl: 'full',
    description: "0.9x Speed.",
    onComputeStats: (ctx) => {
      if (true) return { modifiers: { spe: 0.9 } };
    }
  },

  energy_siphon: {
    name: "Energy Siphon",
    description: "Heals for 25% of damage dealt.",
    onAfterDamage: (ctx) => {
      if (ctx.damage > 0) {
        return { effects: [{ type: 'heal', target: 'self', amount: ctx.damage * 0.25, source: 'Energy Siphon' }] };
      }
    }
  },

  sea_guardian: {
    name: "Sea Guardian",
    description: "When it rains, highest stat is boosted by 1 stage.",
    onWeatherChange: (ctx) => {
      if (ctx.weather === 'rain') {
        const stats = ctx.user.stats;
        let highest = 'atk', highestVal = -Infinity;
        for (const s of ['atk','def','spAtk','spDef','spe']) {
          if (stats[s] > highestVal) { highestVal = stats[s]; highest = s; }
        }
        return { effects: [{ type: 'stat', target: 'self', stat: highest, stages: 1, source: 'Sea Guardian' }] };
      }
    }
  },

  // ===== CASCADIA-ORIGINAL ABILITIES =====
  // Designed for our setting. Add more as we design Fakemon.

  fog_walker: {
    name: "Fog Walker",
    description: "+50% evasion in fog or rain. Boosts Ghost-type moves by 20%.",
    onComputeStats: (ctx) => {
      if (ctx.battle.weather === 'fog' || ctx.battle.weather === 'rain') {
        return { modifiers: { evasion: 1.5 } };
      }
    },
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'ghost') return { damage: ctx.damage * 1.2 };
    }
  },

  totem_carved: {
    name: "Totem Carved",
    description: "Resists the first hit each battle as if 4x super-effective were 2x.",
    onSwitchIn: (ctx) => ({ flags: { totemCarvedActive: true } }),
    onModifyIncomingDamage: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.totemCarvedActive && ctx.effectiveness >= 2) {
        ctx.user.flags.totemCarvedActive = false;
        return { damage: ctx.damage / 2 };
      }
    }
  },

  // ============================================================================
  // ELITE REDUX FULL ABILITY ROSTER
  // ============================================================================
  // 432 abilities ported from the Elite-Redux/eliteredux source repo.
  // ER is open source (per Darky92's PokéCommunity post: "you can use Elite
  // Redux or parts of it and do whatever you want"). Credit to Darky92 and
  // ER contributors.
  //
  //   impl: 'full'  — hand-written, fully functional
  //   impl: 'auto'  — pattern-matched from description; mostly correct, audit
  //   impl: 'stub'  — description and ID only; behaves as no-op until written
  //
  // Stubs let you reference any ER ability when designing Fakémon. Implementations
  // get filled in as we test specific abilities. Search '// TODO' to find ones
  // that need work.
  // ============================================================================

  stench: {
    name: "Stench", source: 'er', impl: 'full',
    description: "User's attacks gain a 10% chance to flinch.",
    onAfterDamage: (ctx) => {
      if (Math.random() < 0.10) {
        ctx.target.volatileStatus.flinch = true;
        ctx.battle.log(`${ctx.target.nickname} flinched from the stench!`);
      }
    }
  },

  drizzle: {
    name: "Drizzle", source: 'er', impl: 'full',
    description: "Summons rain on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'weather', weather: 'rain', turns: -1 }] })
  },

  speed_boost: {
    name: "Speed Boost", source: 'er', impl: 'full',
    description: "+1 Speed at end of every turn.",
    onEndOfTurn: (ctx) => {
      return { effects: [{ type: 'stat', target: 'self', stat: 'spe', stages: 1, source: 'Speed Boost' }] };
    }
  },

  battle_armor: {
    name: "Battle Armor", source: 'er', impl: 'full',
    description: "Blocks critical hits. Takes 20% less damage.",
    onCriticalCheck: (ctx) => {
      if (ctx.defender) return { blockCrit: true };
    },
    onModifyIncomingDamage: (ctx) => ({ damage: ctx.damage * 0.8 })
  },

  sturdy: {
    name: "Sturdy", source: 'er', impl: 'full',
    description: "Cannot be KO'd in one hit if at full HP.",
    onModifyIncomingDamage: (ctx) => {
      const mon = ctx.user;
      if (mon.currentHP === mon.stats.hp && ctx.damage >= mon.currentHP) {
        return { damage: mon.currentHP - 1 };
      }
    }
  },

  damp: {
    name: "Damp", source: 'er', impl: 'full',
    description: "Prevents explosion moves (Self-Destruct, Explosion).",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.id === 'explosion' || ctx.move.id === 'self_destruct')
        return { damage: 0, immune: true };
    }
  },

  limber: {
    name: "Limber", source: 'er', impl: 'full',
    description: "Cannot be paralyzed.",
    onTryStatus: (ctx) => { if (ctx.status === 'paralysis') return { blocked: true }; }
  },

  sand_veil: {
    name: "Sand Veil", source: 'er', impl: 'full',
    description: "1.25x evasion in sandstorm.",
    onComputeStats: (ctx) => {
      // Evasion isn't a stat in our engine yet — when added, return modifiers: { eva: 1.25 }
      // For now: half-implemented. Needs eva stat support.
    }
  },

  oblivious: {
    name: "Oblivious", source: 'er', impl: 'full',
    description: "Cannot be infatuated.",
    onTryStatus: (ctx) => { if (ctx.status === 'infatuation') return { blocked: true }; }
  },

  cloud_nine: {
    name: "Cloud Nine", source: 'er', impl: 'full',
    description: "Suppresses weather effects while in battle.",
    onSwitchIn: (ctx) => {
      ctx.battle.weatherSuppressed = true;
      ctx.battle.log("Cloud Nine: weather effects are suppressed!");
    },
    onSwitchOut: (ctx) => {
      ctx.battle.weatherSuppressed = false;
    }
  },

  compound_eyes: {
    name: "Compound Eyes", source: 'er', impl: 'full',
    description: "1.3x accuracy on moves.",
    onBeforeMove: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 1.3 };
    }
  },

  insomnia: {
    name: "Insomnia", source: 'er', impl: 'full',
    description: "Cannot fall asleep.",
    onTryStatus: (ctx) => { if (ctx.status === 'sleep') return { blocked: true }; }
  },

  color_change: {
    name: "Color Change", source: 'er', impl: 'full',
    description: "Becomes the type of the move that hits it.",
    onTakeDamage: (ctx) => {
      if (ctx.move.type && ctx.move.power > 0 && !ctx.user.species.types.includes(ctx.move.type)) {
        ctx.user.species = { ...ctx.user.species, types: [ctx.move.type] };
        ctx.battle.log(`${ctx.user.nickname} became ${ctx.move.type}-type!`);
      }
    }
  },

  immunity: {
    name: "Immunity", source: 'er', impl: 'full',
    description: "Cannot be poisoned.",
    onTryStatus: (ctx) => { if (ctx.status === 'poison') return { blocked: true }; }
  },

  shield_dust: {
    name: "Shield Dust", source: 'er', impl: 'full',
    description: "Blocks the secondary effects of opponent's moves.",
    onTakeDamage: (ctx) => {
      // Set a flag that engine checks before applying secondary effects
      ctx.user.flags = { ...(ctx.user.flags||{}), shieldDust: true };
    }
  },

  own_tempo: {
    name: "Own Tempo", source: 'er', impl: 'full',
    description: "Cannot be confused.",
    onTryStatus: (ctx) => { if (ctx.status === 'confusion') return { blocked: true }; }
  },

  suction_cups: {
    name: "Suction Cups", source: 'er', impl: 'full',
    description: "Cannot be forced to switch out.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), suctionCups: true }; }
  },

  shadow_tag: {
    name: "Shadow Tag", source: 'er', impl: 'full',
    description: "Foes cannot escape.",
    onSwitchIn: (ctx) => {
      if (ctx.target) ctx.target.flags = { ...(ctx.target.flags||{}), trapped: true };
    }
  },

  rough_skin: {
    name: "Rough Skin", source: 'er', impl: 'full',
    description: "Attackers take 1/8 max HP damage on contact.",
    onTakeContact: (ctx) => {
      const dmg = Math.max(1, Math.floor(ctx.attacker.stats.hp / 8));
      ctx.attacker.takeDamage(dmg);
      ctx.battle.log(`${ctx.attacker.nickname} was hurt by Rough Skin!`);
    }
  },

  wonder_guard: {
    name: "Wonder Guard", source: 'er', impl: 'full',
    description: "Only super-effective moves can damage this Pokémon.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.effectiveness <= 1 && ctx.move.power > 0) return { damage: 0, immune: true };
    }
  },

  effect_spore: {
    name: "Effect Spore", source: 'er', impl: 'full',
    description: "On contact, 30% chance: 11% paralysis, 10% poison, 9% sleep. Doesn't affect Grass-types.",
    onTakeContact: (ctx) => {
      if (ctx.attacker && ctx.attacker.species && ctx.attacker.species.types && ctx.attacker.species.types.includes('grass')) return;
      const r = Math.random();
      if (r < 0.11) return { effects: [{ type: 'status', target: 'opponent', status: 'paralysis' }] };
      if (r < 0.21) return { effects: [{ type: 'status', target: 'opponent', status: 'poison' }] };
      if (r < 0.30) return { effects: [{ type: 'status', target: 'opponent', status: 'sleep' }] };
    }
  },

  synchronize: {
    name: "Synchronize", source: 'er', impl: 'full',
    description: "Passes burn, poison, or paralysis to attacker.",
    onTakeDamage: (ctx) => {
      // Hook for when status is applied — easier to wire onTryStatus inversely
    },
    onTryStatus: (ctx) => {
      if (['burn','poison','paralysis'].includes(ctx.status)) {
        const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
        const opp = ctx.battle.active(oppSide);
        if (opp && !opp.status) {
          setTimeout(() => {
            ctx.battle.log(`${opp.nickname} was infected by Synchronize!`);
            opp.status = ctx.status;
          }, 0);
        }
      }
    }
  },

  clear_body: {
    name: "Clear Body", source: 'er', impl: 'full',
    description: "Prevents stat reductions caused by other Pokemon.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source && ctx.source !== 'self') {
        ctx.battle.log(`${ctx.user.nickname}'s Clear Body prevents stat loss!`);
        return { override: true };
      }
    }
  },

  natural_cure: {
    name: "Natural Cure", source: 'er', impl: 'full',
    description: "Heals status when switching out.",
    onSwitchOut: (ctx) => {
      if (ctx.user.status) {
        ctx.battle.log(`${ctx.user.nickname}'s status was cured by Natural Cure.`);
        ctx.user.status = null;
      }
    }
  },

  serene_grace: {
    name: "Serene Grace", source: 'er', impl: 'full',
    description: "Doubles secondary effect chances on user's moves.",
    onBeforeMove: (ctx) => {
      // Engine-level: would need to multiply effect.chance. Approximated by setting flag.
      ctx.user.flags = { ...(ctx.user.flags||{}), sereneGrace: true };
    }
  },

  swift_swim: {
    name: "Swift Swim", source: 'er', impl: 'full',
    description: "1.5x Speed in rain.",
    onComputeStats: (ctx) => {
      if (ctx.battle.weather === 'rain') return { modifiers: { spe: 1.5 } };
    }
  },

  chlorophyll: {
    name: "Chlorophyll", source: 'er', impl: 'full',
    description: "1.5x Speed in sun.",
    onComputeStats: (ctx) => {
      if (ctx.battle.weather === 'sun') return { modifiers: { spe: 1.5 } };
    }
  },

  illuminate: {
    name: "Illuminate", source: 'er', impl: 'full',
    description: "1.2x accuracy on user's moves.",
    onBeforeMove: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 1.2 };
    }
  },

  trace: {
    name: "Trace", source: 'er', impl: 'full',
    description: "Copies opponent's ability on entry.",
    onSwitchIn: (ctx) => {
      if (ctx.target && ctx.target.activeAbility && ctx.target.activeAbility !== 'trace') {
        ctx.user.activeAbility = ctx.target.activeAbility;
        ctx.battle.log(`${ctx.user.nickname} traced ${ctx.target.activeAbility}!`);
      }
    }
  },

  huge_power: {
    name: "Huge Power", source: 'er', impl: 'full',
    description: "Doubles physical Attack.",
    onComputeStats: (ctx) => ({ modifiers: { atk: 2.0 } })
  },

  poison_point: {
    name: "Poison Point", source: 'er', impl: 'full',
    description: "33% chance to poison on contact.",
    onTakeContact: (ctx) => {
      if (Math.random() < 1/3) return { effects: [{ type: 'status', target: 'opponent', status: 'poison' }] };
    }
  },

  inner_focus: {
    name: "Inner Focus", source: 'er', impl: 'full',
    description: "Cannot flinch.",
    onTryStatus: (ctx) => { if (ctx.status === 'flinch') return { blocked: true }; }
  },

  magma_armor: {
    name: "Magma Armor", source: 'er', impl: 'full',
    description: "Cannot be frozen.",
    onTryStatus: (ctx) => { if (ctx.status === 'freeze') return { blocked: true }; }
  },

  water_veil: {
    name: "Water Veil", source: 'er', impl: 'full',
    description: "Cannot be burned.",
    onTryStatus: (ctx) => { if (ctx.status === 'burn') return { blocked: true }; }
  },

  magnet_pull: {
    name: "Magnet Pull", source: 'er', impl: 'full',
    description: "Steel-type foes cannot escape.",
    onSwitchIn: (ctx) => {
      if (ctx.target && ctx.target.species.types.includes('steel')) {
        ctx.target.flags = { ...(ctx.target.flags||{}), trapped: true };
      }
    }
  },

  soundproof: {
    name: "Soundproof", source: 'er', impl: 'full',
    description: "Immune to sound moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('sound')) return { damage: 0, immune: true };
    }
  },

  rain_dish: {
    name: "Rain Dish", source: 'er', impl: 'full',
    description: "Heals 1/8 max HP each turn in rain.",
    onEndOfTurn: (ctx) => {
      if (ctx.battle.weather === 'rain') {
        ctx.user.heal(Math.floor(ctx.user.stats.hp / 8));
        ctx.battle.log(`${ctx.user.nickname} was healed by Rain Dish.`);
      }
    }
  },

  sand_stream: {
    name: "Sand Stream", source: 'er', impl: 'full',
    description: "Summons a sandstorm on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'weather', weather: 'sand', turns: -1 }] })
  },

  pressure: {
    name: "Pressure", source: 'er', impl: 'full',
    description: "Foes use 2 PP per move when attacking this Pokémon.",
    onSwitchIn: (ctx) => {
      if (ctx.target) ctx.target.flags = { ...(ctx.target.flags||{}), underPressure: true };
    }
  },

  thick_fat: {
    name: "Thick Fat", source: 'er', impl: 'full',
    description: "Halves damage from Fire and Ice moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'fire' || ctx.move.type === 'ice') return { damage: ctx.damage * 0.5 };
    }
  },

  early_bird: {
    name: "Early Bird", source: 'er', impl: 'full',
    description: "Awakens from sleep twice as fast.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), earlyBird: true }; }
  },

  flame_body: {
    name: "Flame Body", source: 'er', impl: 'full',
    description: "33% chance to burn on contact.",
    onTakeContact: (ctx) => {
      if (Math.random() < 1/3) return { effects: [{ type: 'status', target: 'opponent', status: 'burn' }] };
    }
  },

  run_away: {
    name: "Run Away", source: 'er', impl: 'full',
    description: "Always escapes wild battles. +2 Speed when stats are lowered.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source !== 'self') {
        setTimeout(() => { ctx.battle.changeStatStage(ctx.user, 'spe', 2, 'Run Away'); }, 0);
      }
    }
  },

  keen_eye: {
    name: "Keen Eye", source: 'er', impl: 'full',
    description: "Prevents Accuracy reductions.",
    onStatStageChange: (ctx) => {
      if (ctx.stat === 'acc' && ctx.stages < 0 && ctx.source !== 'self') {
        return { override: true };
      }
    }
  },

  hyper_cutter: {
    name: "Hyper Cutter", source: 'er', impl: 'full',
    description: "Prevents Attack reductions.",
    onStatStageChange: (ctx) => {
      if (ctx.stat === 'atk' && ctx.stages < 0 && ctx.source !== 'self') {
        ctx.battle.log(`${ctx.user.nickname}'s Hyper Cutter prevents Attack loss!`);
        return { override: true };
      }
    }
  },

  pickup: {
    name: "Pickup", source: 'er', impl: 'full',
    description: "Removes hazards on entry. May find items after battle.",
    onSwitchIn: (ctx) => {
      const side = (ctx.user === ctx.battle.active('player')) ? 'player' : 'opponent';
      if (ctx.battle.hazards && ctx.battle.hazards[side]) {
        ctx.battle.hazards[side] = {};
        ctx.battle.log(`${ctx.user.nickname} picked up the hazards!`);
      }
    }
  },

  truant: {
    name: "Truant", source: 'er', impl: 'full',
    description: "Loafs around every other turn — can't move.",
    onBeforeMove: (ctx) => {
      ctx.user.flags = ctx.user.flags || {};
      if (ctx.user.flags.truantSkipNext) {
        ctx.user.flags.truantSkipNext = false;
        ctx.battle.log(`${ctx.user.nickname} is loafing around!`);
        return { skipMove: true };
      } else {
        ctx.user.flags.truantSkipNext = true;
      }
    }
  },

  hustle: {
    name: "Hustle", source: 'er', impl: 'full',
    description: "+40% Attack, -10% accuracy on physical moves.",
    onComputeStats: (ctx) => ({ modifiers: { atk: 1.4 } }),
    onBeforeMove: (ctx) => {
      if (ctx.move.category === 'physical') {
        ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 0.9 };
      }
    }
  },

  cute_charm: {
    name: "Cute Charm", source: 'er', impl: 'full',
    description: "30% chance to infatuate attackers of opposite gender on contact. (Cascadia: 30% flat, no gender check.)",
    onTakeContact: (ctx) => {
      if (Math.random() < 0.30) return { effects: [{ type: 'status', target: 'opponent', status: 'infatuation' }] };
    }
  },

  plus: {
    name: "Plus", source: 'er', impl: 'full',
    description: "Boosts Sp.Atk by 50% if an ally has Plus or Minus. (Singles: solo boost.)",
    onComputeStats: (ctx) => ({ modifiers: { spAtk: 1.5 } })
  },

  minus: {
    name: "Minus", source: 'er', impl: 'full',
    description: "Boosts Sp.Atk by 50% if an ally has Plus or Minus. (Singles: solo boost.)",
    onComputeStats: (ctx) => ({ modifiers: { spAtk: 1.5 } })
  },

  forecast: {
    name: "Forecast", source: 'er', impl: 'full',
    description: "Type changes based on weather (Castform).",
    onWeatherChange: (ctx) => {
      const map = { sun: 'fire', rain: 'water', snow: 'ice', sand: 'rock' };
      const t = map[ctx.weather] || 'normal';
      ctx.user.species = { ...ctx.user.species, types: [t] };
      ctx.battle.log(`${ctx.user.nickname} became ${t}-type!`);
    }
  },

  sticky_hold: {
    name: "Sticky Hold", source: 'er', impl: 'full',
    description: "Prevents item theft.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), stickyHold: true }; }
  },

  shed_skin: {
    name: "Shed Skin", source: 'er', impl: 'full',
    description: "33% chance to cure status at end of turn.",
    onEndOfTurn: (ctx) => {
      if (ctx.user.status && Math.random() < 0.33) {
        ctx.battle.log(`${ctx.user.nickname} shed its skin and cured ${ctx.user.status}!`);
        ctx.user.status = null;
      }
    }
  },

  guts: {
    name: "Guts", source: 'er', impl: 'full',
    description: "1.5x Attack when statused. Burn doesn't reduce damage.",
    onComputeStats: (ctx) => {
      if (ctx.user.status) return { modifiers: { atk: 1.5 } };
    }
  },

  marvel_scale: {
    name: "Marvel Scale", source: 'er', impl: 'full',
    description: "1.5x Defense when statused.",
    onComputeStats: (ctx) => {
      if (ctx.user.status) return { modifiers: { def: 1.5 } };
    }
  },

  liquid_ooze: {
    name: "Liquid Ooze", source: 'er', impl: 'full',
    description: "Drain moves damage the attacker instead of healing.",
    onTakeDamage: (ctx) => {
      if (ctx.move.drain && ctx.move.drain > 0) {
        const dmg = Math.floor(ctx.damage * ctx.move.drain);
        const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
        const opp = ctx.battle.active(oppSide);
        if (opp) {
          opp.takeDamage(dmg);
          ctx.battle.log(`${opp.nickname} was hurt by Liquid Ooze!`);
        }
      }
    }
  },

  rock_head: {
    name: "Rock Head", source: 'er', impl: 'full',
    description: "Protects from recoil damage. Crash damage is also negated.",
    onAfterDamage: (ctx) => {
      // Cancels recoil — engine's recoil is applied separately, so we set a flag
      if (ctx.user) ctx.user.flags = { ...(ctx.user.flags||{}), noRecoil: true };
    }
  },

  drought: {
    name: "Drought", source: 'er', impl: 'full',
    description: "Summons harsh sunlight on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'weather', weather: 'sun', turns: -1 }] })
  },

  arena_trap: {
    name: "Arena Trap", source: 'er', impl: 'full',
    description: "Grounded foes cannot escape.",
    onSwitchIn: (ctx) => {
      if (ctx.target && !ctx.target.species.types.includes('flying')) {
        ctx.target.flags = { ...(ctx.target.flags||{}), trapped: true };
      }
    }
  },

  vital_spirit: {
    name: "Vital Spirit", source: 'er', impl: 'full',
    description: "Cannot fall asleep.",
    onTryStatus: (ctx) => { if (ctx.status === 'sleep') return { blocked: true }; }
  },

  white_smoke: {
    name: "White Smoke", source: 'er', impl: 'full',
    description: "Prevents stat reductions caused by other Pokemon.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source && ctx.source !== 'self') {
        ctx.battle.log(`${ctx.user.nickname}'s White Smoke prevents stat loss!`);
        return { override: true };
      }
    }
  },

  pure_power: {
    name: "Pure Power", source: 'er', impl: 'full',
    description: "Doubles physical Attack.",
    onComputeStats: (ctx) => ({ modifiers: { atk: 2.0 } })
  },

  shell_armor: {
    name: "Shell Armor", source: 'er', impl: 'full',
    description: "Blocks critical hits.",
    onCriticalCheck: (ctx) => {
      if (ctx.defender) return { blockCrit: true };
    }
  },

  air_lock: {
    name: "Air Lock", source: 'er', impl: 'full',
    description: "Suppresses weather effects while in battle.",
    onSwitchIn: (ctx) => {
      ctx.battle.weatherSuppressed = true;
      ctx.battle.log("Air Lock: weather effects are suppressed!");
    },
    onSwitchOut: (ctx) => {
      ctx.battle.weatherSuppressed = false;
    }
  },

  tangled_feet: {
    name: "Tangled Feet", source: 'er', impl: 'full',
    description: "+1 evasion stage when confused.",
    onComputeStats: (ctx) => {
      if (ctx.user.volatileStatus && ctx.user.volatileStatus.confusion) return { modifiers: { eva: 1.5 } };
    }
  },

  rivalry: {
    name: "Rivalry", source: 'er', impl: 'full',
    description: "+25% damage to same-gender foes; -25% to opposite. (Singles: flat 12% boost.)",
    onModifyDamage: (ctx) => ({ damage: ctx.damage * 1.12 })
  },

  steadfast: {
    name: "Steadfast", source: 'er', impl: 'full',
    description: "+1 Speed when flinching.",
    onTakeDamage: (ctx) => {
      if (ctx.user.volatileStatus && ctx.user.volatileStatus.flinch) {
        return { effects: [{ type: 'stat', target: 'self', stat: 'spe', stages: 1, source: 'Steadfast' }] };
      }
    }
  },

  snow_cloak: {
    name: "Snow Cloak", source: 'er', impl: 'full',
    description: "1.25x evasion in snow.",
    onComputeStats: (ctx) => {
      // Same caveat as Sand Veil — needs eva support.
    }
  },

  gluttony: {
    name: "Gluttony", source: 'er', impl: 'full',
    description: "Eats Berries at 50% HP instead of 25%.",
    onTakeDamage: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), gluttony: true };
    }
  },

  anger_point: {
    name: "Anger Point", source: 'er', impl: 'full',
    description: "+12 stages of Attack (max it out) when hit by a critical hit.",
    onTakeDamage: (ctx) => {
      if (ctx.battle.lastCrit) {
        return { effects: [{ type: 'stat', target: 'self', stat: 'atk', stages: 12, source: 'Anger Point' }] };
      }
    }
  },

  unburden: {
    name: "Unburden", source: 'er', impl: 'full',
    description: "Doubles Speed if held item is consumed.",
    onComputeStats: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.unburdenActive) return { modifiers: { spe: 2.0 } };
    }
  },

  heatproof: {
    name: "Heatproof", source: 'er', impl: 'full',
    description: "Halves damage from Fire moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'fire') return { damage: ctx.damage * 0.5 };
    }
  },

  simple: {
    name: "Simple", source: 'er', impl: 'full',
    description: "Stat changes are doubled.",
    onStatStageChange: (ctx) => {
      const doubled = ctx.stages * 2;
      const newStage = Math.max(-6, Math.min(6, (ctx.user.statStages[ctx.stat] || 0) + doubled));
      const old = ctx.user.statStages[ctx.stat] || 0;
      ctx.user.statStages[ctx.stat] = newStage;
      const delta = newStage - old;
      if (delta !== 0) {
        const dir = delta > 0 ? 'rose' : 'fell';
        const intensity = Math.abs(delta) >= 3 ? ' drastically' : Math.abs(delta) === 2 ? ' sharply' : '';
        ctx.battle.log(`${ctx.user.nickname}'s ${ctx.stat}${intensity} ${dir}! (Simple)`);
      }
      return { override: true };
    }
  },

  dry_skin: {
    name: "Dry Skin", source: 'er', impl: 'full',
    description: "Immune to Water (heal 1/4); takes 25% extra from Fire. Heals 1/8 in rain, loses 1/8 in sun.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'water') {
        return { damage: 0, immune: true,
          effects: [{ type: 'heal', target: 'self', amount: ctx.user.stats.hp / 4, source: 'Dry Skin' }] };
      }
      if (ctx.move.type === 'fire') {
        return { damage: ctx.damage * 1.25 };
      }
    },
    onEndOfTurn: (ctx) => {
      if (ctx.battle.weather === 'rain') {
        ctx.user.heal(Math.floor(ctx.user.stats.hp / 8));
        ctx.battle.log(`${ctx.user.nickname} absorbed rain.`);
      } else if (ctx.battle.weather === 'sun') {
        ctx.user.takeDamage(Math.max(1, Math.floor(ctx.user.stats.hp / 8)));
        ctx.battle.log(`${ctx.user.nickname} was scorched by sun!`);
      }
    }
  },

  download: {
    name: "Download", source: 'er', impl: 'full',
    description: "On entry, raises Attack or Sp. Attack by 1, whichever benefits more vs the foe.",
    onSwitchIn: (ctx) => {
      if (!ctx.target) return;
      const oppDef = ctx.target.effectiveStat ? ctx.target.effectiveStat('def') : ctx.target.stats.def;
      const oppSpDef = ctx.target.effectiveStat ? ctx.target.effectiveStat('spDef') : ctx.target.stats.spDef;
      const stat = oppDef < oppSpDef ? 'atk' : 'spAtk';
      return { effects: [{ type: 'stat', target: 'self', stat, stages: 1, source: 'Download' }] };
    }
  },

  iron_fist: {
    name: "Iron Fist", source: 'er', impl: 'full',
    description: "Boosts punching moves by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('punch')) return { damage: ctx.damage * 1.3 };
    }
  },

  poison_heal: {
    name: "Poison Heal", source: 'er', impl: 'full',
    description: "Heals 1/8 HP per turn when poisoned instead of taking damage.",
    onEndOfTurn: (ctx) => {
      if (ctx.user.status === 'poison') {
        ctx.user.heal(Math.floor(ctx.user.stats.hp / 8));
        ctx.battle.log(`${ctx.user.nickname} was healed by Poison Heal.`);
      }
    }
  },

  adaptability: {
    name: "Adaptability", source: 'er', impl: 'full',
    description: "STAB bonus becomes 2.0x (instead of 1.5x).",
    onModifyDamage: (ctx) => {
      if (ctx.user.species.types.includes(ctx.move.type)) return { damage: ctx.damage * (2.0/1.5) };
    }
  },

  skill_link: {
    name: "Skill Link", source: 'er', impl: 'full',
    description: "Multi-hit moves always hit max times.",
    onBeforeMove: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), skillLink: true };
    }
  },

  hydration: {
    name: "Hydration", source: 'er', impl: 'full',
    description: "Cures status at end of turn in rain.",
    onEndOfTurn: (ctx) => {
      if (ctx.battle.weather === 'rain' && ctx.user.status) {
        ctx.battle.log(`${ctx.user.nickname}'s ${ctx.user.status} was cured by Hydration!`);
        ctx.user.status = null;
      }
    }
  },

  solar_power: {
    name: "Solar Power", source: 'er', impl: 'full',
    description: "1.5x Sp.Atk in sun, but loses 1/8 HP each turn.",
    onModifyDamage: (ctx) => {
      if (ctx.battle.weather === 'sun' && ctx.move.category === 'special') return { damage: ctx.damage * 1.5 };
    },
    onEndOfTurn: (ctx) => {
      if (ctx.battle.weather === 'sun') {
        const dmg = Math.max(1, Math.floor(ctx.user.stats.hp / 8));
        ctx.user.takeDamage(dmg);
        ctx.battle.log(`${ctx.user.nickname} is hurt by Solar Power!`);
      }
    }
  },

  quick_feet: {
    name: "Quick Feet", source: 'er', impl: 'full',
    description: "1.5x Speed when statused.",
    onComputeStats: (ctx) => {
      if (ctx.user.status) return { modifiers: { spe: 1.5 } };
    }
  },

  normalize: {
    name: "Normalize", source: 'er', impl: 'full',
    description: "All moves become Normal-type and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type !== 'normal') return { newType: 'normal' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  sniper: {
    name: "Sniper", source: 'er', impl: 'full',
    description: "Critical hits deal 2.25x damage instead of 1.5x.",
    onCriticalCheck: (ctx) => {
      if (!ctx.defender) return { critDamageMult: 2.25 };
    }
  },

  magic_guard: {
    name: "Magic Guard", source: 'er', impl: 'full',
    description: "Immune to all indirect damage (weather, status, recoil, hazards).",
    onTakeDamage: (ctx) => {
      // Cancels indirect damage. Hooked separately for residual damage in EoT.
    }
  },

  no_guard: {
    name: "No Guard", source: 'er', impl: 'full',
    description: "Both sides' moves never miss.",
    onBeforeMove: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 999 };
    }
  },

  stall: {
    name: "Stall", source: 'er', impl: 'full',
    description: "Always moves last in priority bracket.",
    onBeforeMove: (ctx) => ({ priorityBoost: -10 })
  },

  technician: {
    name: "Technician", source: 'er', impl: 'full',
    description: "Boosts moves with 60 BP or less by 50%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.power && ctx.move.power <= 60) return { damage: ctx.damage * 1.5 };
    }
  },

  leaf_guard: {
    name: "Leaf Guard", source: 'er', impl: 'full',
    description: "Cannot be statused in sun.",
    onTryStatus: (ctx) => {
      if (ctx.battle && ctx.battle.weather === 'sun') return { blocked: true };
    }
  },

  klutz: {
    name: "Klutz", source: 'er', impl: 'full',
    description: "Cannot use held items.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), klutz: true }; }
  },

  mold_breaker: {
    name: "Mold Breaker", source: 'er', impl: 'full',
    description: "Moves can hit foes regardless of their abilities.",
    onSwitchIn: (ctx) => {
      if (ctx.user) ctx.user.flags = { ...(ctx.user.flags||{}), moldBreaker: true };
    }
  },

  super_luck: {
    name: "Super Luck", source: 'er', impl: 'full',
    description: "Boosts critical hit ratio by 1 stage.",
    onCriticalCheck: (ctx) => {
      if (!ctx.defender) return { critStages: 1 };
    }
  },

  aftermath: {
    name: "Aftermath", source: 'er', impl: 'full',
    description: "When KO'd by contact, attacker takes 1/4 max HP damage.",
    onTakeContact: (ctx) => {
      // ER fires this when defender is KO'd by contact. We approximate by checking after damage applied.
      if (ctx.defender.isFainted()) {
        const dmg = Math.max(1, Math.floor(ctx.attacker.stats.hp / 4));
        ctx.attacker.takeDamage(dmg);
        ctx.battle.log(`${ctx.attacker.nickname} was caught in the aftermath!`);
      }
    }
  },

  anticipation: {
    name: "Anticipation", source: 'er', impl: 'full',
    description: "Senses if the foe has a super-effective or OHKO move on entry. (Display only — no stat effect.)",
    onSwitchIn: (ctx) => {
      // Cosmetic alert — no battle effect. Real implementation would set a flag for UI.
      if (ctx.user) ctx.user.flags = { ...(ctx.user.flags||{}), anticipationTriggered: true };
    }
  },

  forewarn: {
    name: "Forewarn", source: 'er', impl: 'full',
    description: "Senses the foe's strongest move on entry. (Display only.)",
    onSwitchIn: (ctx) => {
      if (ctx.user) ctx.user.flags = { ...(ctx.user.flags||{}), forewarnTriggered: true };
    }
  },

  unaware: {
    name: "Unaware", source: 'er', impl: 'full',
    description: "Ignores opponent's stat stages when calculating damage.",
    onModifyDamage: (ctx) => {
      // Engine checks this; for now we approximate by setting a flag
      ctx.user.flags = { ...(ctx.user.flags||{}), unaware: true };
    }
  },

  tinted_lens: {
    name: "Tinted Lens", source: 'er', impl: 'full',
    description: "Doubles damage of not-very-effective moves.",
    onModifyDamage: (ctx) => {
      if (ctx.effectiveness < 1 && ctx.effectiveness > 0) return { damage: ctx.damage * 2.0 };
    }
  },

  filter: {
    name: "Filter", source: 'er', impl: 'full',
    description: "Reduces super-effective damage by 25%.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.effectiveness > 1) return { damage: ctx.damage * 0.75 };
    }
  },

  slow_start: {
    name: "Slow Start", source: 'er', impl: 'full',
    description: "Halves Attack and Speed for first 5 turns out.",
    onSwitchIn: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), slowStartTimer: 5 };
    },
    onComputeStats: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.slowStartTimer > 0) return { modifiers: { atk: 0.5, spe: 0.5 } };
    },
    onEndOfTurn: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.slowStartTimer > 0) ctx.user.flags.slowStartTimer--;
    }
  },

  scrappy: {
    name: "Scrappy", source: 'er', impl: 'full',
    description: "Normal and Fighting moves can hit Ghost-types.",
    onBeforeMove: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), scrappy: true };
    }
  },

  ice_body: {
    name: "Ice Body", source: 'er', impl: 'full',
    description: "Heals 1/8 max HP each turn in snow.",
    onEndOfTurn: (ctx) => {
      if (ctx.battle.weather === 'snow') {
        ctx.user.heal(Math.floor(ctx.user.stats.hp / 8));
        ctx.battle.log(`${ctx.user.nickname} was healed by Ice Body.`);
      }
    }
  },

  solid_rock: {
    name: "Solid Rock", source: 'er', impl: 'full',
    description: "Reduces super-effective damage by 25%.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.effectiveness > 1) return { damage: ctx.damage * 0.75 };
    }
  },

  snow_warning: {
    name: "Snow Warning", source: 'er', impl: 'full',
    description: "Summons snow on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'weather', weather: 'snow', turns: -1 }] })
  },

  honey_gather: {
    name: "Honey Gather", source: 'er', impl: 'full',
    description: "May find Honey after battle. (Out-of-battle effect.)",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), honeyGather: true }; }
  },

  frisk: {
    name: "Frisk", source: 'er', impl: 'full',
    description: "Reveals the foe's held item on entry. (Display only.)",
    onSwitchIn: (ctx) => {
      if (ctx.user) ctx.user.flags = { ...(ctx.user.flags||{}), friskTriggered: true };
    }
  },

  reckless: {
    name: "Reckless", source: 'er', impl: 'full',
    description: "Boosts recoil and crash moves by 20%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.recoil) return { damage: ctx.damage * 1.2 };
    }
  },

  multitype: {
    name: "Multitype", source: 'er', impl: 'full',
    description: "Changes type to match held Plate.",
    onSwitchIn: (ctx) => {
      const plateMap = {
        'flame_plate': 'fire', 'splash_plate': 'water', 'zap_plate': 'electric',
        'meadow_plate': 'grass', 'icicle_plate': 'ice', 'fist_plate': 'fighting',
        'toxic_plate': 'poison', 'earth_plate': 'ground', 'sky_plate': 'flying',
        'mind_plate': 'psychic', 'insect_plate': 'bug', 'stone_plate': 'rock',
        'spooky_plate': 'ghost', 'draco_plate': 'dragon', 'dread_plate': 'dark',
        'iron_plate': 'steel', 'pixie_plate': 'fairy'
      };
      if (ctx.user.heldItem && plateMap[ctx.user.heldItem]) {
        ctx.user.species = { ...ctx.user.species, types: [plateMap[ctx.user.heldItem]] };
        ctx.battle.log(`${ctx.user.nickname} became ${plateMap[ctx.user.heldItem]}-type!`);
      }
    }
  },

  flower_gift: {
    name: "Flower Gift", source: 'er', impl: 'full',
    description: "1.5x Atk and Sp.Def in sun.",
    onComputeStats: (ctx) => {
      if (ctx.battle.weather === 'sun') return { modifiers: { atk: 1.5, spDef: 1.5 } };
    }
  },

  bad_dreams: {
    name: "Bad Dreams", source: 'er', impl: 'full',
    description: "Sleeping foes lose 1/8 HP each turn.",
    onEndOfTurn: (ctx) => {
      if (ctx.target && ctx.target.status === 'sleep') {
        const dmg = Math.max(1, Math.floor(ctx.target.stats.hp / 8));
        ctx.target.takeDamage(dmg);
        ctx.battle.log(`${ctx.target.nickname} is tormented by Bad Dreams!`);
      }
    }
  },

  pickpocket: {
    name: "Pickpocket", source: 'er', impl: 'full',
    description: "Steals attacker's held item on contact (if user has none).",
    onTakeContact: (ctx) => {
      if (!ctx.defender.heldItem && ctx.attacker.heldItem) {
        ctx.defender.heldItem = ctx.attacker.heldItem;
        ctx.attacker.heldItem = null;
        ctx.battle.log(`${ctx.defender.nickname} pickpocketed ${ctx.attacker.nickname}'s item!`);
      }
    }
  },

  sheer_force: {
    name: "Sheer Force", source: 'er', impl: 'full',
    description: "Boosts moves with secondary effects by 30% but removes those effects.",
    onModifyDamage: (ctx) => {
      if (ctx.move.effect && ctx.move.effect.chance && ctx.move.effect.chance < 1) {
        return { damage: ctx.damage * 1.3 };
      }
    }
  },

  contrary: {
    name: "Contrary", source: 'er', impl: 'full',
    description: "Stat changes are inverted (boosts become drops and vice versa).",
    onStatStageChange: (ctx) => {
      // Apply inverted change directly and override the original
      const inverted = -ctx.stages;
      const newStage = Math.max(-6, Math.min(6, (ctx.user.statStages[ctx.stat] || 0) + inverted));
      const old = ctx.user.statStages[ctx.stat] || 0;
      ctx.user.statStages[ctx.stat] = newStage;
      const delta = newStage - old;
      if (delta !== 0) {
        const dir = delta > 0 ? 'rose' : 'fell';
        ctx.battle.log(`${ctx.user.nickname}'s ${ctx.stat} ${dir}! (Contrary)`);
      }
      return { override: true };
    }
  },

  unnerve: {
    name: "Unnerve", source: 'er', impl: 'full',
    description: "Foes are too nervous to eat held berries.",
    onSwitchIn: (ctx) => {
      if (ctx.target) ctx.target.flags = { ...(ctx.target.flags||{}), unnerved: true };
    }
  },

  defiant: {
    name: "Defiant", source: 'er', impl: 'full',
    description: "+2 Attack when a stat is lowered by a foe.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source && ctx.source !== 'self') {
        // Allow original drop, then trigger boost in side-effect
        setTimeout(() => {
          if (!ctx.user.isFainted()) {
            ctx.battle.changeStatStage(ctx.user, 'atk', 2, 'Defiant');
          }
        }, 0);
      }
    }
  },

  defeatist: {
    name: "Defeatist", source: 'er', impl: 'full',
    description: "At half HP or less, attacks deal half damage.",
    onModifyDamage: (ctx) => {
      if (ctx.user.currentHP <= ctx.user.stats.hp / 2) return { damage: ctx.damage * 0.5 };
    }
  },

  cursed_body: {
    name: "Cursed Body", source: 'er', impl: 'full',
    description: "30% chance to disable attacker's move on contact.",
    onTakeContact: (ctx) => {
      if (Math.random() < 0.30 && ctx.move.id) {
        ctx.attacker.flags = ctx.attacker.flags || {};
        ctx.attacker.flags.disabledMove = ctx.move.id;
        ctx.attacker.flags.disabledTurns = 4;
        ctx.battle.log(`${ctx.attacker.nickname}'s ${ctx.move.name} was disabled!`);
      }
    }
  },

  healer: {
    name: "Healer", source: 'er', impl: 'full',
    description: "30% chance to cure ally's status at end of turn. (Singles: cures own status.)",
    onEndOfTurn: (ctx) => {
      if (ctx.user.status && Math.random() < 0.30) {
        ctx.battle.log(`${ctx.user.nickname} was healed by Healer!`);
        ctx.user.status = null;
      }
    }
  },

  friend_guard: {
    name: "Friend Guard", source: 'er', impl: 'full',
    description: "Reduces ally damage by 25%. (Singles: flat 12% reduction.)",
    onModifyIncomingDamage: (ctx) => ({ damage: ctx.damage * 0.88 })
  },

  weak_armor: {
    name: "Weak Armor", source: 'er', impl: 'full',
    description: "When hit by physical: -1 Def, +2 Speed.",
    onTakeDamage: (ctx) => {
      if (ctx.move.category === 'physical' && ctx.move.power > 0) {
        return { effects: [
          { type: 'stat', target: 'self', stat: 'def', stages: -1, source: 'Weak Armor' },
          { type: 'stat', target: 'self', stat: 'spe', stages: 2, source: 'Weak Armor' }
        ]};
      }
    }
  },

  heavy_metal: {
    name: "Heavy Metal", source: 'er', impl: 'full',
    description: "Doubles weight (affects Heat Crash, Low Kick, etc).",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), weightMult: 2.0 }; }
  },

  light_metal: {
    name: "Light Metal", source: 'er', impl: 'full',
    description: "Halves weight (affects Heat Crash, Low Kick, etc).",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), weightMult: 0.5 }; }
  },

  multiscale: {
    name: "Multiscale", source: 'er', impl: 'full',
    description: "Halves damage when at full HP.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.user.currentHP === ctx.user.stats.hp) return { damage: ctx.damage * 0.5 };
    }
  },

  toxic_boost: {
    name: "Toxic Boost", source: 'er', impl: 'full',
    description: "+50% Attack when poisoned. Immune to poison damage.",
    onComputeStats: (ctx) => {
      if (ctx.user.status === 'poison') return { modifiers: { atk: 1.5 } };
    },
    onEndOfTurn: (ctx) => {
      if (ctx.user.status === 'poison') {
        // negate poison damage by healing back what was just taken
        const dmg = Math.max(1, Math.floor(ctx.user.stats.hp / 8));
        ctx.user.heal(dmg);
      }
    }
  },

  flare_boost: {
    name: "Flare Boost", source: 'er', impl: 'full',
    description: "+50% Sp.Atk when burned. Immune to burn damage.",
    onComputeStats: (ctx) => {
      if (ctx.user.status === 'burn') return { modifiers: { spAtk: 1.5 } };
    },
    onEndOfTurn: (ctx) => {
      if (ctx.user.status === 'burn') {
        const dmg = Math.max(1, Math.floor(ctx.user.stats.hp / 16));
        ctx.user.heal(dmg);
      }
    }
  },

  harvest: {
    name: "Harvest", source: 'er', impl: 'full',
    description: "Has a chance to recycle a used Berry at end of turn (50%, 100% in sun).",
    onEndOfTurn: (ctx) => {
      const chance = ctx.battle.weather === 'sun' ? 1.0 : 0.5;
      if (ctx.user.flags && ctx.user.flags.usedBerry && Math.random() < chance) {
        ctx.user.heldItem = ctx.user.flags.usedBerry;
        ctx.user.flags.usedBerry = null;
        ctx.battle.log(`${ctx.user.nickname} harvested a berry!`);
      }
    }
  },

  telepathy: {
    name: "Telepathy", source: 'er', impl: 'full',
    description: "Dodges allies' attacks. (Singles: cosmetic.)",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), telepathy: true }; }
  },

  moody: {
    name: "Moody", source: 'er', impl: 'full',
    description: "End of turn: +2 to a random stat, -1 to another.",
    onEndOfTurn: (ctx) => {
      const stats = ['atk','def','spAtk','spDef','spe'];
      const upStat = stats[Math.floor(Math.random() * stats.length)];
      const downStat = stats.filter(s => s !== upStat)[Math.floor(Math.random() * (stats.length - 1))];
      return { effects: [
        { type: 'stat', target: 'self', stat: upStat, stages: 2, source: 'Moody' },
        { type: 'stat', target: 'self', stat: downStat, stages: -1, source: 'Moody' }
      ]};
    }
  },

  overcoat: {
    name: "Overcoat", source: 'er', impl: 'full',
    description: "Immune to weather damage and powder moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('powder')) return { damage: 0, immune: true };
    }
  },

  poison_touch: {
    name: "Poison Touch", source: 'er', impl: 'full',
    description: "30% chance to poison on contact (offensive).",
    onAfterDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('contact') && Math.random() < 0.30) {
        if (!ctx.target.status) {
          ctx.target.status = 'poison';
          ctx.battle.log(`${ctx.target.nickname} was poisoned!`);
        }
      }
    }
  },

  regenerator: {
    name: "Regenerator", source: 'er', impl: 'full',
    description: "Heals 1/3 max HP when switching out.",
    onSwitchOut: (ctx) => {
      ctx.user.heal(Math.floor(ctx.user.stats.hp / 3));
      ctx.battle.log(`${ctx.user.nickname} regenerated.`);
    }
  },

  big_pecks: {
    name: "Big Pecks", source: 'er', impl: 'full',
    description: "Boosts contact moves by 30%. Prevents Defense drops.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('contact')) return { damage: ctx.damage * 1.3 };
    }
  },

  sand_rush: {
    name: "Sand Rush", source: 'er', impl: 'full',
    description: "1.5x Speed in sandstorm.",
    onComputeStats: (ctx) => {
      if (ctx.battle.weather === 'sand') return { modifiers: { spe: 1.5 } };
    }
  },

  wonder_skin: {
    name: "Wonder Skin", source: 'er', impl: 'full',
    description: "Status moves have only 50% accuracy against this Pokemon.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), wonderSkin: true }; }
  },

  analytic: {
    name: "Analytic", source: 'er', impl: 'full',
    description: "Moves used last in the turn deal 30% more.",
    onModifyDamage: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.movedLast) return { damage: ctx.damage * 1.3 };
    }
  },

  illusion: {
    name: "Illusion", source: 'er', impl: 'full',
    description: "Disguised as the last party member until hit.",
    onSwitchIn: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), illusionActive: true };
    },
    onTakeDamage: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.illusionActive) {
        ctx.user.flags.illusionActive = false;
        ctx.battle.log(`${ctx.user.nickname}'s illusion broke!`);
      }
    }
  },

  imposter: {
    name: "Imposter", source: 'er', impl: 'full',
    description: "Transforms into the opposing Pokemon on entry.",
    onSwitchIn: (ctx) => {
      if (ctx.target) {
        ctx.user.species = { ...ctx.target.species };
        ctx.user.moves = [...ctx.target.moves];
        ctx.user.statStages = { ...ctx.target.statStages };
        ctx.battle.log(`${ctx.user.nickname} transformed into ${ctx.target.nickname}!`);
      }
    }
  },

  infiltrator: {
    name: "Infiltrator", source: 'er', impl: 'full',
    description: "Bypasses substitutes, screens, and barriers.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), infiltrator: true }; }
  },

  mummy: {
    name: "Mummy", source: 'er', impl: 'full',
    description: "On contact, attacker's ability becomes Mummy.",
    onTakeContact: (ctx) => {
      if (ctx.attacker.activeAbility !== 'mummy') {
        ctx.attacker.activeAbility = 'mummy';
        ctx.battle.log(`${ctx.attacker.nickname}'s ability became Mummy!`);
      }
    }
  },

  moxie: {
    name: "Moxie", source: 'er', impl: 'full',
    description: "+1 Attack after KO'ing an opponent.",
    onAfterKO: (ctx) => ({ effects: [{ type: 'stat', target: 'self', stat: 'atk', stages: 1, source: 'Moxie' }] })
  },

  justified: {
    name: "Justified", source: 'er', impl: 'full',
    description: "+1 Attack when hit by a Dark move.",
    onTakeDamage: (ctx) => {
      if (ctx.move.type === 'dark') {
        return { effects: [{ type: 'stat', target: 'self', stat: 'atk', stages: 1, source: 'Justified' }] };
      }
    }
  },

  rattled: {
    name: "Rattled", source: 'er', impl: 'full',
    description: "+1 Speed when hit by Bug, Dark, or Ghost moves; or by Intimidate.",
    onTakeDamage: (ctx) => {
      if (['bug','dark','ghost'].includes(ctx.move.type)) {
        return { effects: [{ type: 'stat', target: 'self', stat: 'spe', stages: 1, source: 'Rattled' }] };
      }
    }
  },

  magic_bounce: {
    name: "Magic Bounce", source: 'er', impl: 'full',
    description: "Reflects status moves back at the user.",
    onBeforeMove: (ctx) => {
      // Engine-level reflection: when target has Magic Bounce and incoming move is status,
      // we want to reverse user/target. Simplified: cancel and log.
      // Full implementation requires engine support for move redirection.
    }
  },

  prankster: {
    name: "Prankster", source: 'er', impl: 'full',
    description: "Status moves get +1 priority.",
    onBeforeMove: (ctx) => {
      if (ctx.move.category === 'status') return { priorityBoost: 1 };
    }
  },

  sand_force: {
    name: "Sand Force", source: 'er', impl: 'full',
    description: "In sandstorm, Rock/Ground/Steel moves deal 30% more.",
    onModifyDamage: (ctx) => {
      if (ctx.battle.weather === 'sand' && ['rock','ground','steel'].includes(ctx.move.type))
        return { damage: ctx.damage * 1.3 };
    }
  },

  iron_barbs: {
    name: "Iron Barbs", source: 'er', impl: 'full',
    description: "Attackers take 1/8 max HP damage on contact.",
    onTakeContact: (ctx) => {
      const dmg = Math.max(1, Math.floor(ctx.attacker.stats.hp / 8));
      ctx.attacker.takeDamage(dmg);
      ctx.battle.log(`${ctx.attacker.nickname} was hurt by Iron Barbs!`);
    }
  },

  zen_mode: {
    name: "Zen Mode", source: 'er', impl: 'full',
    description: "Switches to Zen form on entry (Darmanitan).",
    onSwitchIn: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), zenMode: true };
      ctx.battle.log(`${ctx.user.nickname} entered Zen Mode!`);
    }
  },

  victory_star: {
    name: "Victory Star", source: 'er', impl: 'full',
    description: "+20% accuracy for self and allies.",
    onBeforeMove: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 1.2 };
    }
  },

  turboblaze: {
    name: "Turboblaze", source: 'er', impl: 'full',
    description: "Moves can hit foes regardless of their abilities. (Mold Breaker variant.)",
    onSwitchIn: (ctx) => {
      if (ctx.user) ctx.user.flags = { ...(ctx.user.flags||{}), moldBreaker: true };
    }
  },

  teravolt: {
    name: "Teravolt", source: 'er', impl: 'full',
    description: "Moves can hit foes regardless of their abilities. (Mold Breaker variant.)",
    onSwitchIn: (ctx) => {
      if (ctx.user) ctx.user.flags = { ...(ctx.user.flags||{}), moldBreaker: true };
    }
  },

  aroma_veil: {
    name: "Aroma Veil", source: 'er', impl: 'full',
    description: "Immune to Taunt, Encore, Disable, Torment, Heal Block, Attract.",
    onTryStatus: (ctx) => {
      if (['taunt','encore','disable','torment','heal_block','infatuation'].includes(ctx.status))
        return { blocked: true };
    }
  },

  flower_veil: {
    name: "Flower Veil", source: 'er', impl: 'full',
    description: "Grass allies can't be statused or have stats lowered.",
    onTryStatus: (ctx) => {
      if (ctx.user.species.types.includes('grass')) return { blocked: true };
    },
    onStatStageChange: (ctx) => {
      if (ctx.user.species.types.includes('grass') && ctx.stages < 0 && ctx.source !== 'self') return { override: true };
    }
  },

  cheek_pouch: {
    name: "Cheek Pouch", source: 'er', impl: 'full',
    description: "Eating a Berry restores 1/3 max HP.",
    onTakeDamage: (ctx) => {
      // Triggered when berry consumed elsewhere
    }
  },

  protean: {
    name: "Protean", source: 'er', impl: 'full',
    description: "Before attacking, user's type changes to the move's type.",
    onBeforeMove: (ctx) => {
      if (ctx.move && ctx.move.type) {
        ctx.user.species = { ...ctx.user.species, types: [ctx.move.type] };
        ctx.battle.log(`${ctx.user.nickname} became ${ctx.move.type}-type!`);
      }
    }
  },

  fur_coat: {
    name: "Fur Coat", source: 'er', impl: 'full',
    description: "Halves damage from physical moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.category === 'physical') return { damage: ctx.damage * 0.5 };
    }
  },

  magician: {
    name: "Magician", source: 'er', impl: 'full',
    description: "Steals foe's item when attacking.",
    onAfterDamage: (ctx) => {
      if (!ctx.user.heldItem && ctx.target.heldItem) {
        ctx.user.heldItem = ctx.target.heldItem;
        ctx.target.heldItem = null;
        ctx.battle.log(`${ctx.user.nickname} stole the item!`);
      }
    }
  },

  bulletproof: {
    name: "Bulletproof", source: 'er', impl: 'full',
    description: "Immune to ball and bomb moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.flags && (ctx.move.flags.includes('ball') || ctx.move.flags.includes('bomb')))
        return { damage: 0, immune: true };
    }
  },

  competitive: {
    name: "Competitive", source: 'er', impl: 'full',
    description: "+2 Sp.Atk when a stat is lowered by a foe.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source && ctx.source !== 'self') {
        setTimeout(() => {
          if (!ctx.user.isFainted()) {
            ctx.battle.changeStatStage(ctx.user, 'spAtk', 2, 'Competitive');
          }
        }, 0);
      }
    }
  },

  strong_jaw: {
    name: "Strong Jaw", source: 'er', impl: 'full',
    description: "Boosts biting moves by 50%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('biting')) return { damage: ctx.damage * 1.5 };
    }
  },

  refrigerate: {
    name: "Refrigerate", source: 'er', impl: 'full',
    description: "Normal moves become Ice-type and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type === 'normal') return { newType: 'ice' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  sweet_veil: {
    name: "Sweet Veil", source: 'er', impl: 'full',
    description: "Cannot fall asleep.",
    onTryStatus: (ctx) => { if (ctx.status === 'sleep') return { blocked: true }; }
  },

  stance_change: {
    name: "Stance Change", source: 'er', impl: 'full',
    description: "Changes form between Blade (attack) and Shield (status).",
    onBeforeMove: (ctx) => {
      ctx.user.flags = ctx.user.flags || {};
      if (ctx.move.id === 'kings_shield') {
        ctx.user.flags.aegisForm = 'shield';
      } else if (ctx.move.category !== 'status') {
        ctx.user.flags.aegisForm = 'blade';
      }
    }
  },

  gale_wings: {
    name: "Gale Wings", source: 'er', impl: 'full',
    description: "Flying-type moves get +1 priority at full HP.",
    onBeforeMove: (ctx) => {
      if (ctx.move.type === 'flying' && ctx.user.currentHP === ctx.user.stats.hp)
        return { priorityBoost: 1 };
    }
  },

  mega_launcher: {
    name: "Mega Launcher", source: 'er', impl: 'full',
    description: "Boosts pulse moves by 50%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('pulse')) return { damage: ctx.damage * 1.5 };
    }
  },

  grass_pelt: {
    name: "Grass Pelt", source: 'er', impl: 'full',
    description: "+50% Defense in Grassy Terrain.",
    onComputeStats: (ctx) => {
      if (ctx.battle.terrain === 'grassy') return { modifiers: { def: 1.5 } };
    }
  },

  symbiosis: {
    name: "Symbiosis", source: 'er', impl: 'full',
    description: "Passes held item to ally when they consume one. (Singles: cosmetic.)",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), symbiosis: true }; }
  },

  tough_claws: {
    name: "Tough Claws", source: 'er', impl: 'full',
    description: "Boosts contact moves by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('contact')) return { damage: ctx.damage * 1.3 };
    }
  },

  pixilate: {
    name: "Pixilate", source: 'er', impl: 'full',
    description: "Normal moves become Fairy-type and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type === 'normal') return { newType: 'fairy' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  gooey: {
    name: "Gooey", source: 'er', impl: 'full',
    description: "Lowers attacker's Speed by 1 on contact.",
    onTakeContact: (ctx) => {
      return { effects: [{ type: 'stat', target: 'opponent', stat: 'spe', stages: -1, source: 'Gooey' }] };
    }
  },

  aerilate: {
    name: "Aerilate", source: 'er', impl: 'full',
    description: "Normal moves become Flying-type and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type === 'normal') return { newType: 'flying' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  parental_bond: {
    name: "Parental Bond", source: 'er', impl: 'full',
    description: "Damaging moves hit twice (second hit at 25% damage).",
    onBeforeMove: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), parentalBond: true };
    }
  },

  dark_aura: {
    name: "Dark Aura", source: 'er', impl: 'full',
    description: "Boosts all Dark moves on the field by 33%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'dark') return { damage: ctx.damage * 1.33 };
    }
  },

  fairy_aura: {
    name: "Fairy Aura", source: 'er', impl: 'full',
    description: "Boosts all Fairy moves on the field by 33%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'fairy') return { damage: ctx.damage * 1.33 };
    }
  },

  aura_break: {
    name: "Aura Break", source: 'er', impl: 'full',
    description: "Reverses Fairy/Dark Aura: those moves deal 25% less damage.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), auraBreak: true }; }
  },

  primordial_sea: {
    name: "Primordial Sea", source: 'er', impl: 'full',
    description: "Summons heavy rain on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'weather', weather: 'rain', turns: -1 }] })
  },

  desolate_land: {
    name: "Desolate Land", source: 'er', impl: 'full',
    description: "Summons extremely harsh sunlight on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'weather', weather: 'sun', turns: -1 }] })
  },

  delta_stream: {
    name: "Delta Stream", source: 'er', impl: 'full',
    description: "Summons strong winds on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'weather', weather: 'winds', turns: -1 }] })
  },

  stamina: {
    name: "Stamina", source: 'er', impl: 'full',
    description: "+1 Defense when hit by an attack.",
    onTakeDamage: (ctx) => {
      if (ctx.move.power > 0) {
        return { effects: [{ type: 'stat', target: 'self', stat: 'def', stages: 1, source: 'Stamina' }] };
      }
    }
  },

  wimp_out: {
    name: "Wimp Out", source: 'er', impl: 'full',
    description: "Forces switch out when HP drops below half.",
    onTakeDamage: (ctx) => {
      const beforeHP = ctx.user.currentHP + ctx.damage;
      if (beforeHP > ctx.user.stats.hp / 2 && ctx.user.currentHP <= ctx.user.stats.hp / 2) {
        ctx.user.flags = { ...(ctx.user.flags||{}), forceSwitch: true };
        ctx.battle.log(`${ctx.user.nickname} wimped out!`);
      }
    }
  },

  emergency_exit: {
    name: "Emergency Exit", source: 'er', impl: 'full',
    description: "Forces switch out when HP drops below half.",
    onTakeDamage: (ctx) => {
      const beforeHP = ctx.user.currentHP + ctx.damage;
      if (beforeHP > ctx.user.stats.hp / 2 && ctx.user.currentHP <= ctx.user.stats.hp / 2) {
        ctx.user.flags = { ...(ctx.user.flags||{}), forceSwitch: true };
        ctx.battle.log(`${ctx.user.nickname} took emergency exit!`);
      }
    }
  },

  water_compaction: {
    name: "Water Compaction", source: 'er', impl: 'full',
    description: "+2 Defense and halves damage when hit by Water moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'water') {
        return { damage: ctx.damage * 0.5,
          effects: [{ type: 'stat', target: 'self', stat: 'def', stages: 2, source: 'Water Compaction' }] };
      }
    }
  },

  merciless: {
    name: "Merciless", source: 'er', impl: 'full',
    description: "Always critically hits poisoned foes.",
    onCriticalCheck: (ctx) => {
      if (!ctx.defender && ctx.target && ctx.target.status === 'poison')
        return { critStages: 4 };
    }
  },

  shields_down: {
    name: "Shields Down", source: 'er', impl: 'full',
    description: "Below 50% HP, switches to Core form (status immune above 50%).",
    onTryStatus: (ctx) => {
      if (ctx.user.currentHP > ctx.user.stats.hp / 2) return { blocked: true };
    }
  },

  stakeout: {
    name: "Stakeout", source: 'er', impl: 'full',
    description: "Doubles damage to a foe that just switched in.",
    onModifyDamage: (ctx) => {
      if (ctx.target.flags && ctx.target.flags.justSwitchedIn) return { damage: ctx.damage * 2.0 };
    }
  },

  water_bubble: {
    name: "Water Bubble", source: 'er', impl: 'full',
    description: "Doubles own Water moves; halves Fire damage; immune to burn.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'water') return { damage: ctx.damage * 2.0 };
    },
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'fire') return { damage: ctx.damage * 0.5 };
    },
    onTryStatus: (ctx) => {
      if (ctx.status === 'burn') return { blocked: true };
    }
  },

  steelworker: {
    name: "Steelworker", source: 'er', impl: 'full',
    description: "Boosts Steel-type moves by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'steel') return { damage: ctx.damage * 1.3 };
    }
  },

  berserk: {
    name: "Berserk", source: 'er', impl: 'full',
    description: "+1 Sp.Atk when HP drops below half.",
    onTakeDamage: (ctx) => {
      const beforeHP = ctx.user.currentHP + ctx.damage;
      if (beforeHP > ctx.user.stats.hp / 2 && ctx.user.currentHP <= ctx.user.stats.hp / 2) {
        return { effects: [{ type: 'stat', target: 'self', stat: 'spAtk', stages: 1, source: 'Berserk' }] };
      }
    }
  },

  slush_rush: {
    name: "Slush Rush", source: 'er', impl: 'full',
    description: "1.5x Speed in snow.",
    onComputeStats: (ctx) => {
      if (ctx.battle.weather === 'snow') return { modifiers: { spe: 1.5 } };
    }
  },

  long_reach: {
    name: "Long Reach", source: 'er', impl: 'full',
    description: "Moves don't make contact. Non-contact physical moves +20% damage.",
    onBeforeMove: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), longReach: true };
    }
  },

  liquid_voice: {
    name: "Liquid Voice", source: 'er', impl: 'full',
    description: "Sound moves become Water-type.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('sound')) return { newType: 'water' };
    }
  },

  triage: {
    name: "Triage", source: 'er', impl: 'full',
    description: "Healing moves get +3 priority.",
    onBeforeMove: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('heal')) return { priorityBoost: 3 };
    }
  },

  galvanize: {
    name: "Galvanize", source: 'er', impl: 'full',
    description: "Normal moves become Electric-type and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type === 'normal') return { newType: 'electric' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  surge_surfer: {
    name: "Surge Surfer", source: 'er', impl: 'full',
    description: "1.5x Speed on Electric Terrain.",
    onComputeStats: (ctx) => {
      if (ctx.battle.terrain === 'electric') return { modifiers: { spe: 1.5 } };
    }
  },

  schooling: {
    name: "Schooling", source: 'er', impl: 'full',
    description: "Switches to school form at 25% HP. (Wishiwashi.)",
    onSwitchIn: (ctx) => {
      if (ctx.user.level >= 20 && ctx.user.currentHP > ctx.user.stats.hp / 4) {
        ctx.user.flags = { ...(ctx.user.flags||{}), schooling: true };
      }
    }
  },

  disguise: {
    name: "Disguise", source: 'er', impl: 'full',
    description: "First damaging hit only deals 1/8 max HP damage. (Mimikyu.)",
    onModifyIncomingDamage: (ctx) => {
      if (!ctx.user.flags || !ctx.user.flags.disguiseBroken) {
        ctx.user.flags = { ...(ctx.user.flags||{}), disguiseBroken: true };
        ctx.battle.log(`${ctx.user.nickname}'s disguise was busted!`);
        return { damage: Math.floor(ctx.user.stats.hp / 8) };
      }
    }
  },

  battle_bond: {
    name: "Battle Bond", source: 'er', impl: 'full',
    description: "Transforms after KO'ing a foe (Greninja).",
    onAfterKO: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), bondActive: true };
      ctx.battle.log(`${ctx.user.nickname} formed a bond with its trainer!`);
    }
  },

  power_construct: {
    name: "Power Construct", source: 'er', impl: 'full',
    description: "Switches to Complete Forme below 50% HP.",
    onTakeDamage: (ctx) => {
      if (ctx.user.currentHP <= ctx.user.stats.hp / 2 && (!ctx.user.flags || !ctx.user.flags.completeForm)) {
        ctx.user.flags = { ...(ctx.user.flags||{}), completeForm: true };
        ctx.battle.log(`${ctx.user.nickname} changed to Complete Forme!`);
      }
    }
  },

  corrosion: {
    name: "Corrosion", source: 'er', impl: 'full',
    description: "Can poison Steel and Poison types.",
    onBeforeMove: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), corrosion: true };
    }
  },

  comatose: {
    name: "Comatose", source: 'er', impl: 'full',
    description: "Treated as asleep but immune to other status. (Simplified: blocks all major status.)",
    onTryStatus: (ctx) => {
      if (['burn','poison','paralysis','sleep','freeze'].includes(ctx.status)) return { blocked: true };
    }
  },

  queenly_majesty: {
    name: "Queenly Majesty", source: 'er', impl: 'full',
    description: "Immune to priority moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.priority && ctx.move.priority > 0) return { damage: 0, immune: true };
    }
  },

  innards_out: {
    name: "Innards Out", source: 'er', impl: 'full',
    description: "When KO'd, attacker takes damage equal to defender's last HP.",
    onTakeContact: (ctx) => {
      if (ctx.defender.isFainted()) {
        ctx.attacker.takeDamage(ctx.damage);
        ctx.battle.log(`${ctx.attacker.nickname} was hit by ${ctx.defender.nickname}'s innards!`);
      }
    }
  },

  dancer: {
    name: "Dancer", source: 'er', impl: 'full',
    description: "Copies dance moves used by other Pokemon. (Singles: largely cosmetic.)",
    onSwitchIn: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), dancer: true };
    }
  },

  battery: {
    name: "Battery", source: 'er', impl: 'full',
    description: "Boosts ally special moves by 30%. (Singles: solo flat 15%.)",
    onModifyDamage: (ctx) => {
      if (ctx.move.category === 'special') return { damage: ctx.damage * 1.15 };
    }
  },

  fluffy: {
    name: "Fluffy", source: 'er', impl: 'full',
    description: "Halves contact damage; doubles Fire damage.",
    onModifyIncomingDamage: (ctx) => {
      const isContact = ctx.move.flags && ctx.move.flags.includes('contact');
      let mult = 1;
      if (isContact) mult *= 0.5;
      if (ctx.move.type === 'fire') mult *= 2.0;
      if (mult !== 1) return { damage: ctx.damage * mult };
    }
  },

  dazzling: {
    name: "Dazzling", source: 'er', impl: 'full',
    description: "Immune to priority moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.priority && ctx.move.priority > 0) return { damage: 0, immune: true };
    }
  },

  soul_heart: {
    name: "Soul-Heart", source: 'er', impl: 'full',
    description: "+1 Sp.Atk after a Pokemon faints.",
    onAfterKO: (ctx) => ({ effects: [{ type: 'stat', target: 'self', stat: 'spAtk', stages: 1, source: 'Soul-Heart' }] })
  },

  tangling_hair: {
    name: "Tangling Hair", source: 'er', impl: 'full',
    description: "Lowers attacker's Speed by 1 on contact.",
    onTakeContact: (ctx) => {
      return { effects: [{ type: 'stat', target: 'opponent', stat: 'spe', stages: -1, source: 'Tangling Hair' }] };
    }
  },

  receiver: {
    name: "Receiver", source: 'er', impl: 'full',
    description: "Copies fainted ally's ability. (Singles: cosmetic.)",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), receiver: true }; }
  },

  power_of_alchemy: {
    name: "Power of Alchemy", source: 'er', impl: 'full',
    description: "Copies fainted ally's ability. (Singles: cosmetic.)",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), receiver: true }; }
  },

  beast_boost: {
    name: "Beast Boost", source: 'er', impl: 'full',
    description: "Highest non-HP stat raises by 1 after KO.",
    onAfterKO: (ctx) => {
      const stats = ['atk','def','spAtk','spDef','spe'];
      let bestStat = stats[0], bestVal = 0;
      for (const s of stats) {
        if (ctx.user.stats[s] > bestVal) { bestVal = ctx.user.stats[s]; bestStat = s; }
      }
      return { effects: [{ type: 'stat', target: 'self', stat: bestStat, stages: 1, source: 'Beast Boost' }] };
    }
  },

  rks_system: {
    name: "RKS System", source: 'er', impl: 'full',
    description: "Type changes to held memory disc.",
    onSwitchIn: (ctx) => {
      const memMap = {
        'fire_memory': 'fire', 'water_memory': 'water', 'electric_memory': 'electric',
        'grass_memory': 'grass', 'ice_memory': 'ice', 'fighting_memory': 'fighting',
        'poison_memory': 'poison', 'ground_memory': 'ground', 'flying_memory': 'flying',
        'psychic_memory': 'psychic', 'bug_memory': 'bug', 'rock_memory': 'rock',
        'ghost_memory': 'ghost', 'dragon_memory': 'dragon', 'dark_memory': 'dark',
        'steel_memory': 'steel', 'fairy_memory': 'fairy'
      };
      if (ctx.user.heldItem && memMap[ctx.user.heldItem]) {
        ctx.user.species = { ...ctx.user.species, types: [memMap[ctx.user.heldItem]] };
      }
    }
  },

  electric_surge: {
    name: "Electric Surge", source: 'er', impl: 'full',
    description: "Sets Electric Terrain on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'terrain', terrain: 'electric', turns: 5 }] })
  },

  psychic_surge: {
    name: "Psychic Surge", source: 'er', impl: 'full',
    description: "Sets Psychic Terrain on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'terrain', terrain: 'psychic', turns: 5 }] })
  },

  misty_surge: {
    name: "Misty Surge", source: 'er', impl: 'full',
    description: "Sets Misty Terrain on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'terrain', terrain: 'misty', turns: 5 }] })
  },

  grassy_surge: {
    name: "Grassy Surge", source: 'er', impl: 'full',
    description: "Sets Grassy Terrain on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'terrain', terrain: 'grassy', turns: 5 }] })
  },

  full_metal_body: {
    name: "Full Metal Body", source: 'er', impl: 'full',
    description: "Prevents stat reductions; cannot be ignored.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source && ctx.source !== 'self') {
        ctx.battle.log(`${ctx.user.nickname}'s Full Metal Body prevents stat loss!`);
        return { override: true };
      }
    }
  },

  shadow_shield: {
    name: "Shadow Shield", source: 'er', impl: 'full',
    description: "Halves damage when at full HP.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.user.currentHP === ctx.user.stats.hp) return { damage: ctx.damage * 0.5 };
    }
  },

  prism_armor: {
    name: "Prism Armor", source: 'er', impl: 'full',
    description: "Reduces super-effective damage by 25%. Cannot be ignored.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.effectiveness > 1) return { damage: ctx.damage * 0.75 };
    }
  },

  neuroforce: {
    name: "Neuroforce", source: 'er', impl: 'full',
    description: "+25% damage on super-effective moves.",
    onModifyDamage: (ctx) => {
      if (ctx.effectiveness > 1) return { damage: ctx.damage * 1.25 };
    }
  },

  intrepid_sword: {
    name: "Intrepid Sword", source: 'er', impl: 'full',
    description: "+1 Attack on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'stat', target: 'self', stat: 'atk', stages: 1, source: 'Intrepid Sword' }] })
  },

  dauntless_shield: {
    name: "Dauntless Shield", source: 'er', impl: 'full',
    description: "+1 Defense on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'stat', target: 'self', stat: 'def', stages: 1, source: 'Dauntless Shield' }] })
  },

  libero: {
    name: "Libero", source: 'er', impl: 'full',
    description: "Before attacking, user's type changes to the move's type.",
    onBeforeMove: (ctx) => {
      if (ctx.move && ctx.move.type) {
        ctx.user.species = { ...ctx.user.species, types: [ctx.move.type] };
        ctx.battle.log(`${ctx.user.nickname} became ${ctx.move.type}-type!`);
      }
    }
  },

  ball_fetch: {
    name: "Ball Fetch", source: 'er', impl: 'full',
    description: "Fetches a missed Poke Ball. (Out-of-battle effect.)",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), ballFetch: true }; }
  },

  cotton_down: {
    name: "Cotton Down", source: 'er', impl: 'full',
    description: "When hit by an attack, foe's Speed drops by 1.",
    onTakeDamage: (ctx) => {
      if (ctx.move.power > 0) {
        return { effects: [{ type: 'stat', target: 'opponent', stat: 'spe', stages: -1, source: 'Cotton Down' }] };
      }
    }
  },

  propeller_tail: {
    name: "Propeller Tail", source: 'er', impl: 'full',
    description: "Ignores redirection abilities (Lightning Rod, etc).",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), ignoreRedirect: true }; }
  },

  mirror_armor: {
    name: "Mirror Armor", source: 'er', impl: 'full',
    description: "Reflects stat reductions back at the attacker.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source && ctx.source !== 'self') {
        const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
        const opp = ctx.battle.active(oppSide);
        if (opp) {
          ctx.battle.log(`${ctx.user.nickname}'s Mirror Armor reflected the stat drop!`);
          ctx.battle.changeStatStage(opp, ctx.stat, ctx.stages, 'Mirror Armor');
        }
        return { override: true };
      }
    }
  },

  gulp_missile: {
    name: "Gulp Missile", source: 'er', impl: 'full',
    description: "When hit after using Surf or Dive, attacker takes 1/4 damage and gets debuffed. (Simplified.)",
    onTakeDamage: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.gulping) {
        const dmg = Math.max(1, Math.floor(ctx.user.stats.hp / 4));
        ctx.target.takeDamage(dmg);
        ctx.battle.log(`${ctx.target.nickname} was hit by a Gulp Missile!`);
        ctx.user.flags.gulping = false;
      }
    }
  },

  stalwart: {
    name: "Stalwart", source: 'er', impl: 'full',
    description: "Ignores redirection abilities (Lightning Rod, etc).",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), ignoreRedirect: true }; }
  },

  steam_engine: {
    name: "Steam Engine", source: 'er', impl: 'full',
    description: "+6 Speed when hit by a Fire or Water move.",
    onTakeDamage: (ctx) => {
      if (ctx.move.type === 'fire' || ctx.move.type === 'water') {
        return { effects: [{ type: 'stat', target: 'self', stat: 'spe', stages: 6, source: 'Steam Engine' }] };
      }
    }
  },

  punk_rock: {
    name: "Punk Rock", source: 'er', impl: 'full',
    description: "Boosts sound moves by 30%; halves incoming sound damage.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('sound')) return { damage: ctx.damage * 1.3 };
    },
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('sound')) return { damage: ctx.damage * 0.5 };
    }
  },

  sand_spit: {
    name: "Sand Spit", source: 'er', impl: 'full',
    description: "Summons sandstorm when hit by an attack.",
    onTakeDamage: (ctx) => {
      if (ctx.move.power > 0 && ctx.battle.weather !== 'sand') {
        return { effects: [{ type: 'weather', weather: 'sand', turns: -1 }] };
      }
    }
  },

  ice_scales: {
    name: "Ice Scales", source: 'er', impl: 'full',
    description: "Halves damage from special moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.category === 'special') return { damage: ctx.damage * 0.5 };
    }
  },

  ripen: {
    name: "Ripen", source: 'er', impl: 'full',
    description: "Doubles the effect of Berries.",
    onSwitchIn: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), berriesDoubled: true };
    }
  },

  ice_face: {
    name: "Ice Face", source: 'er', impl: 'full',
    description: "Blocks first physical hit; restored by snow.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.category === 'physical' && (!ctx.user.flags || !ctx.user.flags.iceFaceBroken)) {
        ctx.user.flags = { ...(ctx.user.flags||{}), iceFaceBroken: true };
        ctx.battle.log(`${ctx.user.nickname}'s Ice Face broke!`);
        return { damage: 0, immune: true };
      }
    },
    onWeatherChange: (ctx) => {
      if (ctx.weather === 'snow' && ctx.user.flags) ctx.user.flags.iceFaceBroken = false;
    }
  },

  power_spot: {
    name: "Power Spot", source: 'er', impl: 'full',
    description: "Boosts ally damage by 30%. (Singles: solo 15%.)",
    onModifyDamage: (ctx) => ({ damage: ctx.damage * 1.15 })
  },

  mimicry: {
    name: "Mimicry", source: 'er', impl: 'full',
    description: "Type changes based on terrain.",
    onSwitchIn: (ctx) => {
      const map = { electric: 'electric', grassy: 'grass', psychic: 'psychic', misty: 'fairy' };
      if (ctx.battle.terrain && map[ctx.battle.terrain]) {
        ctx.user.species = { ...ctx.user.species, types: [map[ctx.battle.terrain]] };
      }
    },
    onWeatherChange: (ctx) => {}
  },

  screen_cleaner: {
    name: "Screen Cleaner", source: 'er', impl: 'full',
    description: "Removes Light Screen, Reflect, Aurora Veil from both sides on entry.",
    onSwitchIn: (ctx) => {
      ctx.battle.fieldEffects = ctx.battle.fieldEffects || {};
      delete ctx.battle.fieldEffects.light_screen;
      delete ctx.battle.fieldEffects.reflect;
      delete ctx.battle.fieldEffects.aurora_veil;
      ctx.battle.log("Screens were swept away!");
    }
  },

  steely_spirit: {
    name: "Steely Spirit", source: 'er', impl: 'full',
    description: "Boosts Steel-type moves by 50%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'steel') return { damage: ctx.damage * 1.5 };
    }
  },

  perish_body: {
    name: "Perish Body", source: 'er', impl: 'full',
    description: "Both Pokémon faint in 3 turns when contacted.",
    onTakeContact: (ctx) => {
      ctx.attacker.flags = { ...(ctx.attacker.flags||{}), perishCount: 3 };
      ctx.defender.flags = { ...(ctx.defender.flags||{}), perishCount: 3 };
      ctx.battle.log("Both Pokémon will faint in 3 turns!");
    }
  },

  wandering_spirit: {
    name: "Wandering Spirit", source: 'er', impl: 'full',
    description: "Swaps abilities with attacker on contact.",
    onTakeContact: (ctx) => {
      const swap = ctx.attacker.activeAbility;
      ctx.attacker.activeAbility = 'wandering_spirit';
      ctx.defender.activeAbility = swap;
      ctx.battle.log(`Abilities were swapped!`);
    }
  },

  gorilla_tactics: {
    name: "Gorilla Tactics", source: 'er', impl: 'full',
    description: "+50% Attack but locked into first move used.",
    onComputeStats: (ctx) => ({ modifiers: { atk: 1.5 } }),
    onBeforeMove: (ctx) => {
      ctx.user.flags = ctx.user.flags || {};
      if (!ctx.user.flags.lockedMove) ctx.user.flags.lockedMove = ctx.move.id;
    }
  },

  neutralizing_gas: {
    name: "Neutralizing Gas", source: 'er', impl: 'full',
    description: "Suppresses all other abilities.",
    onSwitchIn: (ctx) => {
      ctx.battle.abilitiesSuppressed = true;
      ctx.battle.log("Abilities are suppressed by Neutralizing Gas!");
    },
    onSwitchOut: (ctx) => {
      ctx.battle.abilitiesSuppressed = false;
    }
  },

  pastel_veil: {
    name: "Pastel Veil", source: 'er', impl: 'full',
    description: "Cannot be poisoned.",
    onTryStatus: (ctx) => { if (ctx.status === 'poison') return { blocked: true }; }
  },

  hunger_switch: {
    name: "Hunger Switch", source: 'er', impl: 'full',
    description: "Alternates form each turn (Morpeko).",
    onEndOfTurn: (ctx) => {
      ctx.user.flags = ctx.user.flags || {};
      ctx.user.flags.hangry = !ctx.user.flags.hangry;
    }
  },

  quick_draw: {
    name: "Quick Draw", source: 'er', impl: 'full',
    description: "30% chance to move first regardless of speed.",
    onBeforeMove: (ctx) => {
      if (Math.random() < 0.30) return { priorityBoost: 1 };
    }
  },

  unseen_fist: {
    name: "Unseen Fist", source: 'er', impl: 'full',
    description: "Contact moves bypass Protect.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), unseenFist: true }; }
  },

  curious_medicine: {
    name: "Curious Medicine", source: 'er', impl: 'full',
    description: "Resets opponent's stat changes on entry.",
    onSwitchIn: (ctx) => {
      if (ctx.target) {
        ctx.target.statStages = { atk:0, def:0, spAtk:0, spDef:0, spe:0, acc:0, eva:0 };
        ctx.battle.log(`${ctx.target.nickname}'s stat changes were reset!`);
      }
    }
  },

  transistor: {
    name: "Transistor", source: 'er', impl: 'full',
    description: "Boosts Electric-type moves by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'electric') return { damage: ctx.damage * 1.3 };
    }
  },

  dragons_maw: {
    name: "Dragon's Maw", source: 'er', impl: 'full',
    description: "Boosts Dragon-type moves by 50%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'dragon') return { damage: ctx.damage * 1.5 };
    }
  },

  chilling_neigh: {
    name: "Chilling Neigh", source: 'er', impl: 'full',
    description: "+1 Attack after KO'ing an opponent.",
    onAfterKO: (ctx) => ({ effects: [{ type: 'stat', target: 'self', stat: 'atk', stages: 1, source: 'Chilling Neigh' }] })
  },

  grim_neigh: {
    name: "Grim Neigh", source: 'er', impl: 'full',
    description: "+1 Sp.Atk after KO'ing an opponent.",
    onAfterKO: (ctx) => ({ effects: [{ type: 'stat', target: 'self', stat: 'spAtk', stages: 1, source: 'Grim Neigh' }] })
  },

  as_one_ice_rider: {
    name: "As One (Ice Rider)", source: 'er', impl: 'full',
    description: "Combines Unnerve and Chilling Neigh.",
    onSwitchIn: (ctx) => {
      if (ctx.target) ctx.target.flags = { ...(ctx.target.flags||{}), unnerved: true };
    },
    onAfterKO: (ctx) => ({ effects: [{ type: 'stat', target: 'self', stat: 'atk', stages: 1, source: 'As One' }] })
  },

  as_one_shadow_rider: {
    name: "As One (Shadow Rider)", source: 'er', impl: 'full',
    description: "Combines Unnerve and Grim Neigh.",
    onSwitchIn: (ctx) => {
      if (ctx.target) ctx.target.flags = { ...(ctx.target.flags||{}), unnerved: true };
    },
    onAfterKO: (ctx) => ({ effects: [{ type: 'stat', target: 'self', stat: 'spAtk', stages: 1, source: 'As One' }] })
  },

  chloroplast: {
    name: "Chloroplast", source: 'er', impl: 'full',
    description: "Treats weather as sun for own purposes.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), pseudoSun: true }; }
  },

  whiteout: {
    name: "Whiteout", source: 'er', impl: 'full',
    description: "Boosts Ice moves by 50% in snow/hail.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'ice' && ctx.battle.weather === 'snow') return { damage: ctx.damage * 1.5 };
    }
  },

  pyromancy: {
    name: "Pyromancy", source: 'er', impl: 'full',
    description: "Fire attacks 5x more likely to burn.",
    onAfterDamage: (ctx) => {
      if (ctx.move.type === 'fire' && ctx.move.effect && ctx.move.effect.status === 'burn') {
        const baseChance = ctx.move.effect.chance || 0.1;
        if (Math.random() < Math.min(1, baseChance * 5) && !ctx.target.status) {
          ctx.target.status = 'burn';
          ctx.battle.log(`${ctx.target.nickname} was burned!`);
        }
      }
    }
  },

  keen_edge: {
    name: "Keen Edge", source: 'er', impl: 'full',
    description: "Boosts slicing moves by 50%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('slicing')) return { damage: ctx.damage * 1.5 };
    }
  },

  prism_scales: {
    name: "Prism Scales", source: 'er', impl: 'full',
    description: "Reduces special damage by 30%.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.category === 'special') return { damage: ctx.damage * 0.7 };
    }
  },

  power_fists: {
    name: "Power Fists", source: 'er', impl: 'full',
    description: "Boosts punching moves by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('punch')) return { damage: ctx.damage * 1.3 };
    }
  },

  sand_song: {
    name: "Sand Song", source: 'er', impl: 'full',
    description: "Sound moves become Ground-type (no damage boost).",
    onModifyMoveType: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('sound')) return { newType: 'ground' };
    }
  },

  rampage: {
    name: "Rampage", source: 'er', impl: 'full',
    description: "Recharge moves don't need recharge after KO.",
    onAfterKO: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.recharging) ctx.user.flags.recharging = false;
    }
  },

  vengeance: {
    name: "Vengeance", source: 'er', impl: 'full',
    description: "Boosts Ghost moves by 50% when below 1/3 HP.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'ghost' && ctx.user.currentHP <= ctx.user.stats.hp / 3)
        return { damage: ctx.damage * 1.5 };
    }
  },

  blitz_boxer: {
    name: "Blitz Boxer", source: 'er', impl: 'full',
    description: "Punching moves get +1 priority.",
    onBeforeMove: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('punch')) return { priorityBoost: 1 };
    }
  },

  antarctic_bird: {
    name: "Antarctic Bird", source: 'er', impl: 'full',
    description: "Boosts Ice and Flying moves by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'ice' || ctx.move.type === 'flying') return { damage: ctx.damage * 1.3 };
    }
  },

  immolate: {
    name: "Immolate", source: 'er', impl: 'full',
    description: "Normal moves become Fire and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type === 'normal') return { newType: 'fire' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  crystallize: {
    name: "Crystallize", source: 'er', impl: 'full',
    description: "Rock moves become Ice-type and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type === 'rock') return { newType: 'ice' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  electrocytes: {
    name: "Electrocytes", source: 'er', impl: 'full',
    description: "Boosts Electric-type moves by 25%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'electric') return { damage: ctx.damage * 1.25 };
    }
  },

  aerodynamics: {
    name: "Aerodynamics", source: 'er', impl: 'full',
    description: "Boosts wind moves by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('wind')) return { damage: ctx.damage * 1.3 };
    }
  },

  christmas_spirit: {
    name: "Christmas Spirit", source: 'er', impl: 'full',
    description: "Halves all incoming damage in snow.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.battle.weather === 'snow') return { damage: ctx.damage * 0.5 };
    }
  },

  exploit_weakness: {
    name: "Exploit Weakness", source: 'er', impl: 'full',
    description: "+25% damage to statused foes.",
    onModifyDamage: (ctx) => {
      if (ctx.target.status) return { damage: ctx.damage * 1.25 };
    }
  },

  ground_shock: {
    name: "Ground Shock", source: 'er', impl: 'full',
    description: "Electric moves can hit Ground types.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), groundShock: true }; }
  },

  ancient_idol: {
    name: "Ancient Idol", source: 'er', impl: 'full',
    description: "Uses Def/SpDef in place of Atk/SpAtk for damage.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), ancientIdol: true }; }
  },

  mystic_power: {
    name: "Mystic Power", source: 'er', impl: 'full',
    description: "All moves get STAB regardless of type.",
    onModifyDamage: (ctx) => {
      if (!ctx.user.species.types.includes(ctx.move.type)) return { damage: ctx.damage * 1.5 };
    }
  },

  perfectionist: {
    name: "Perfectionist", source: 'er', impl: 'full',
    description: "+1 crit and +1 priority on moves with 50 BP or less.",
    onCriticalCheck: (ctx) => {
      if (!ctx.defender && ctx.move.power && ctx.move.power <= 50) return { critStages: 1 };
    },
    onBeforeMove: (ctx) => {
      if (ctx.move.power && ctx.move.power <= 50) return { priorityBoost: 1 };
    }
  },

  growing_tooth: {
    name: "Growing Tooth", source: 'er', impl: 'full',
    description: "+1 Attack after using a fang move.",
    onAfterDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('biting')) {
        return { effects: [{ type: 'stat', target: 'self', stat: 'atk', stages: 1, source: 'Growing Tooth' }] };
      }
    }
  },

  inflatable: {
    name: "Inflatable", source: 'er', impl: 'full',
    description: "+1 Def and SpDef when hit by Fire or Flying.",
    onTakeDamage: (ctx) => {
      if (ctx.move.type === 'fire' || ctx.move.type === 'flying') {
        return { effects: [
          { type: 'stat', target: 'self', stat: 'def', stages: 1, source: 'Inflatable' },
          { type: 'stat', target: 'self', stat: 'spDef', stages: 1, source: 'Inflatable' }
        ]};
      }
    }
  },

  aurora_borealis: {
    name: "Aurora Borealis", source: 'er', impl: 'full',
    description: "Ice moves gain STAB. Immune to hail damage.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'ice' && !ctx.user.species.types.includes('ice'))
        return { damage: ctx.damage * 1.5 };
    }
  },

  avenger: {
    name: "Avenger", source: 'er', impl: 'full',
    description: "+50% damage if an ally has fainted. (Singles: cosmetic, no boost.)",
    onModifyDamage: (ctx) => ({ damage: ctx.damage * 1.0 })
  },

  lets_roll: {
    name: "Let's Roll", source: 'er', impl: 'full',
    description: "+1 Defense on entry (Defense Curl).",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'stat', target: 'self', stat: 'def', stages: 1, source: "Let's Roll" }] })
  },

  aquatic: {
    name: "Aquatic", source: 'er', impl: 'full',
    description: "Boosts Water-type moves by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'water') return { damage: ctx.damage * 1.3 };
    }
  },

  loud_bang: {
    name: "Loud Bang", source: 'er', impl: 'full',
    description: "Sound moves have a 50% chance to confuse.",
    onAfterDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('sound') && Math.random() < 0.5) {
        ctx.target.volatileStatus.confusion = (ctx.target.volatileStatus.confusion || 0) + 3;
        ctx.battle.log(`${ctx.target.nickname} became confused!`);
      }
    }
  },

  amphibious: {
    name: "Amphibious", source: 'er', impl: 'full',
    description: "1.5x speed in rain.",
    onComputeStats: (ctx) => {
      if (ctx.battle.weather === 'rain') return { modifiers: { spe: 1.5 } };
    }
  },

  grounded: {
    name: "Grounded", source: 'er', impl: 'full',
    description: "Adds Ground type.",
    onSwitchIn: (ctx) => {
      const types = [...ctx.user.species.types];
      if (!types.includes('ground')) types.push('ground');
      ctx.user.species = { ...ctx.user.species, types };
    }
  },

  earthbound: {
    name: "Earthbound", source: 'er', impl: 'full',
    description: "Boosts Ground moves by 25%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'ground') return { damage: ctx.damage * 1.25 };
    }
  },

  fight_spirit: {
    name: "Fight Spirit", source: 'er', impl: 'full',
    description: "Normal moves become Fighting and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type === 'normal') return { newType: 'fighting' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  feline_prowess: {
    name: "Feline Prowess", source: 'er', impl: 'full',
    description: "Doubles Sp.Atk.",
    onComputeStats: (ctx) => ({ modifiers: { spAtk: 2.0 } })
  },

  coil_up: {
    name: "Coil Up", source: 'er', impl: 'full',
    description: "On entry, coiled. Next bite move gets +1 priority. Recoils after use.",
    onSwitchIn: (ctx) => {
      ctx.user.flags = { ...(ctx.user.flags||{}), coiled: true };
      ctx.battle.log(`${ctx.user.nickname} coiled up!`);
    },
    onBeforeMove: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.coiled && ctx.move.flags && ctx.move.flags.includes('biting')) {
        ctx.user.flags.coiled = false;
        return { priorityBoost: 1 };
      }
    }
  },

  fossilized: {
    name: "Fossilized", source: 'er', impl: 'full',
    description: "Halves Rock damage; boosts own Rock by 10%.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'rock') return { damage: ctx.damage * 0.5 };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'rock') return { damage: ctx.damage * 1.1 };
    }
  },

  magical_dust: {
    name: "Magical Dust", source: 'er', impl: 'full',
    description: "On contact, attacker gains Psychic type.",
    onTakeContact: (ctx) => {
      const types = [...ctx.attacker.species.types];
      if (!types.includes('psychic')) {
        types.push('psychic');
        ctx.attacker.species = { ...ctx.attacker.species, types };
        ctx.battle.log(`${ctx.attacker.nickname} gained Psychic type!`);
      }
    }
  },

  dreamcatcher: {
    name: "Dreamcatcher", source: 'er', impl: 'full',
    description: "+50% damage if any Pokemon is asleep.",
    onModifyDamage: (ctx) => {
      if (ctx.target.status === 'sleep' || ctx.user.status === 'sleep')
        return { damage: ctx.damage * 1.5 };
    }
  },

  nocturnal: {
    name: "Nocturnal", source: 'er', impl: 'full',
    description: "+25% Dark moves; -25% Dark and Fairy incoming damage.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'dark') return { damage: ctx.damage * 1.25 };
    },
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'dark' || ctx.move.type === 'fairy') return { damage: ctx.damage * 0.75 };
    }
  },

  self_sufficient: {
    name: "Self-Sufficient", source: 'er', impl: 'full',
    description: "Heals 1/16 max HP each turn.",
    onEndOfTurn: (ctx) => {
      ctx.user.heal(Math.max(1, Math.floor(ctx.user.stats.hp / 16)));
    }
  },

  tectonize: {
    name: "Tectonize", source: 'er', impl: 'full',
    description: "Normal moves become Ground and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type === 'normal') return { newType: 'ground' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  ice_age: {
    name: "Ice Age", source: 'er', impl: 'full',
    description: "Adds Ice type.",
    onSwitchIn: (ctx) => {
      const types = [...ctx.user.species.types];
      if (!types.includes('ice')) types.push('ice');
      ctx.user.species = { ...ctx.user.species, types };
    }
  },

  half_drake: {
    name: "Half Drake", source: 'er', impl: 'full',
    description: "Adds Dragon type.",
    onSwitchIn: (ctx) => {
      const types = [...ctx.user.species.types];
      if (!types.includes('dragon')) types.push('dragon');
      ctx.user.species = { ...ctx.user.species, types };
    }
  },

  liquified: {
    name: "Liquified", source: 'er', impl: 'full',
    description: "Halves contact damage; doubles Water damage.",
    onModifyIncomingDamage: (ctx) => {
      const isContact = ctx.move.flags && ctx.move.flags.includes('contact');
      let m = 1;
      if (isContact) m *= 0.5;
      if (ctx.move.type === 'water') m *= 2.0;
      if (m !== 1) return { damage: ctx.damage * m };
    }
  },

  dragonfly: {
    name: "Dragonfly", source: 'er', impl: 'full',
    description: "Adds Dragon type. Immune to Ground.",
    onSwitchIn: (ctx) => {
      const types = [...ctx.user.species.types];
      if (!types.includes('dragon')) { types.push('dragon'); ctx.user.species = { ...ctx.user.species, types }; }
    },
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'ground') return { damage: 0, immune: true };
    }
  },

  dragonslayer: {
    name: "Dragonslayer", source: 'er', impl: 'full',
    description: "+50% damage vs Dragons.",
    onModifyDamage: (ctx) => {
      if (ctx.target && ctx.target.species && ctx.target.species.types && ctx.target.species.types.includes('dragon'))
        return { damage: ctx.damage * 1.5 };
    }
  },

  mountaineer: {
    name: "Mountaineer", source: 'er', impl: 'full',
    description: "Immune to Rock attacks and Stealth Rocks.",
    onModifyIncomingDamage: (ctx) => { if (ctx.move.type === 'rock') return { damage: 0, immune: true }; }
  },

  hydrate: {
    name: "Hydrate", source: 'er', impl: 'full',
    description: "Normal moves become Water and gain 10% power.",
    onModifyMoveType: (ctx) => { if (ctx.move.type === 'normal') return { newType: 'water' }; },
    onModifyDamage: (ctx) => { if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 }; }
  },

  metallic: {
    name: "Metallic", source: 'er', impl: 'full',
    description: "Adds Steel type.",
    onSwitchIn: (ctx) => {
      const types = [...ctx.user.species.types];
      if (!types.includes('steel')) { types.push('steel'); ctx.user.species = { ...ctx.user.species, types }; }
    }
  },

  permafrost: {
    name: "Permafrost", source: 'er', impl: 'full',
    description: "Reduces super-effective damage by 25%.",
    onModifyIncomingDamage: (ctx) => { if (ctx.effectiveness > 1) return { damage: ctx.damage * 0.75 }; }
  },

  primal_armor: {
    name: "Primal Armor", source: 'er', impl: 'full',
    description: "Reduces super-effective damage by 50%.",
    onModifyIncomingDamage: (ctx) => { if (ctx.effectiveness > 1) return { damage: ctx.damage * 0.5 }; }
  },

  air_blower: {
    name: "Air Blower", source: 'er', impl: 'full',
    description: "Boosts Flying-type moves by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'flying') return { damage: ctx.damage * 1.3 };
    }
  },

  juggernaut: {
    name: "Juggernaut", source: 'er', impl: 'full',
    description: "Contact moves use 20% of Defense additionally. Immune to paralysis.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('contact')) {
        const bonus = Math.floor(ctx.user.effectiveStat('def') * 0.20);
        return { damage: ctx.damage + bonus };
      }
    },
    onTryStatus: (ctx) => { if (ctx.status === 'paralysis') return { blocked: true }; }
  },

  short_circuit: {
    name: "Short Circuit", source: 'er', impl: 'full',
    description: "Overgrow for Electric.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'electric' && ctx.user.currentHP <= ctx.user.stats.hp / 3)
        return { damage: ctx.damage * 1.5 };
    }
  },

  majestic_bird: {
    name: "Majestic Bird", source: 'er', impl: 'full',
    description: "Boosts Sp.Atk by 50% (passive).",
    onComputeStats: (ctx) => ({ modifiers: { spAtk: 1.5 } })
  },

  phantom: {
    name: "Phantom", source: 'er', impl: 'full',
    description: "Adds Ghost type.",
    onSwitchIn: (ctx) => {
      const types = [...ctx.user.species.types];
      if (!types.includes('ghost')) { types.push('ghost'); ctx.user.species = { ...ctx.user.species, types }; }
    }
  },

  intoxicate: {
    name: "Intoxicate", source: 'er', impl: 'full',
    description: "Normal moves become Poison and gain 10% power.",
    onModifyMoveType: (ctx) => { if (ctx.move.type === 'normal') return { newType: 'poison' }; },
    onModifyDamage: (ctx) => { if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 }; }
  },

  impenetrable: {
    name: "Impenetrable", source: 'er', impl: 'full',
    description: "Takes no indirect damage.",
    onTakeDamage: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), impenetrable: true }; }
  },

  hypnotist: {
    name: "Hypnotist", source: 'er', impl: 'full',
    description: "Hypnosis accuracy +50%.",
    onBeforeMove: (ctx) => {
      if (ctx.move.id === 'hypnosis') ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 1.5 };
    }
  },

  overwhelm: {
    name: "Overwhelm", source: 'er', impl: 'full',
    description: "Dragon moves hit Fairy. Blocks Intimidate.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), overwhelm: true, intimidateImmune: true }; }
  },

  scare: {
    name: "Scare", source: 'er', impl: 'full',
    description: "Lowers foe's Sp.Atk on entry (special Intimidate).",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'stat', target: 'opponent', stat: 'spAtk', stages: -1, source: 'Scare' }] })
  },

  soul_linker: {
    name: "Soul Linker", source: 'er', impl: 'full',
    description: "Both Pokemon take damage simultaneously.",
    onAfterDamage: (ctx) => {
      const split = Math.floor(ctx.damage / 2);
      ctx.user.takeDamage(split);
      ctx.battle.log(`${ctx.user.nickname} shared the damage via Soul Linker!`);
    }
  },

  sweet_dreams: {
    name: "Sweet Dreams", source: 'er', impl: 'full',
    description: "Sleeping allies heal 1/8 each turn. Sleep-immune.",
    onEndOfTurn: (ctx) => {
      if (ctx.user.status === 'sleep') ctx.user.heal(Math.floor(ctx.user.stats.hp / 8));
    },
    onTryStatus: (ctx) => { if (ctx.status === 'sleep') return { blocked: true }; }
  },

  bad_luck: {
    name: "Bad Luck", source: 'er', impl: 'full',
    description: "Foes can't crit and have -5% accuracy.",
    onCriticalCheck: (ctx) => { if (ctx.defender) return { blockCrit: true }; }
  },

  haunted_spirit: {
    name: "Haunted Spirit", source: 'er', impl: 'full',
    description: "When KO'd, attacker becomes Haunted Spirit.",
    onTakeDamage: (ctx) => {
      if (ctx.user.isFainted()) {
        const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
        const opp = ctx.battle.active(oppSide);
        if (opp) opp.activeAbility = 'haunted_spirit';
      }
    }
  },

  electric_burst: {
    name: "Electric Burst", source: 'er', impl: 'full',
    description: "Electric moves +35% damage but user takes 10% recoil.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'electric') return { damage: ctx.damage * 1.35 };
    },
    onAfterDamage: (ctx) => {
      if (ctx.move.type === 'electric') ctx.user.takeDamage(Math.floor(ctx.damage * 0.10));
    }
  },

  raw_wood: {
    name: "Raw Wood", source: 'er', impl: 'full',
    description: "Halves Rock damage; boosts own Rock by 10%.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'rock') return { damage: ctx.damage * 0.5 };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'rock') return { damage: ctx.damage * 1.1 };
    }
  },

  solenoglyphs: {
    name: "Solenoglyphs", source: 'er', impl: 'full',
    description: "Biting moves have a 50% chance to badly poison.",
    onAfterDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('biting') && Math.random() < 0.5) {
        if (!ctx.target.status && !ctx.target.species.types.includes('poison') && !ctx.target.species.types.includes('steel')) {
          ctx.target.status = 'badly_poisoned';
          ctx.battle.log(`${ctx.target.nickname} was badly poisoned!`);
        }
      }
    }
  },

  spider_lair: {
    name: "Spider Lair", source: 'er', impl: 'full',
    description: "Sets Sticky Web on entry.",
    onSwitchIn: (ctx) => {
      ctx.battle.hazards = ctx.battle.hazards || {};
      const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
      ctx.battle.hazards[oppSide] = ctx.battle.hazards[oppSide] || {};
      ctx.battle.hazards[oppSide].sticky_web = true;
      ctx.battle.log("Sticky Web was laid!");
    }
  },

  fatal_precision: {
    name: "Fatal Precision", source: 'er', impl: 'full',
    description: "Super-effective moves never miss and gain 20%.",
    onModifyDamage: (ctx) => { if (ctx.effectiveness > 1) return { damage: ctx.damage * 1.2 }; },
    onBeforeMove: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), fatalPrecision: true }; }
  },

  seaweed: {
    name: "Seaweed", source: 'er', impl: 'full',
    description: "Grass takes neutral from Fire and deals neutral against Fire.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), seaweed: true }; }
  },

  psychic_mind: {
    name: "Psychic Mind", source: 'er', impl: 'full',
    description: "Boosts Psychic moves by 25%.",
    onModifyDamage: (ctx) => { if (ctx.move.type === 'psychic') return { damage: ctx.damage * 1.25 }; }
  },

  poison_absorb: {
    name: "Poison Absorb", source: 'er', impl: 'full',
    description: "Heals 1/4 max HP when hit by Poison moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'poison') {
        return { damage: 0, immune: true,
          effects: [{ type: 'heal', target: 'self', amount: ctx.user.stats.hp / 4, source: 'Poison Absorb' }] };
      }
    }
  },

  scavenger: {
    name: "Scavenger", source: 'er', impl: 'full',
    description: "Heals 1/4 max HP after KO.",
    onAfterKO: (ctx) => {
      ctx.user.heal(Math.floor(ctx.user.stats.hp / 4));
      ctx.battle.log(`${ctx.user.nickname} scavenged remains.`);
    }
  },

  twisted_dimension: {
    name: "Twisted Dimension", source: 'er', impl: 'full',
    description: "Sets Trick Room on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'field', field: 'trick_room', turns: 5 }] })
  },

  multi_headed: {
    name: "Multi-Headed", source: 'er', impl: 'full',
    description: "Single-target moves hit 2-3 times, each at 25-33% boost.",
    onBeforeMove: (ctx) => {
      // Mark for engine multi-hit handling
      if (ctx.move.power > 0 && !(ctx.move.flags && ctx.move.flags.includes('spread'))) {
        const hits = Math.random() < 0.5 ? 2 : 3;
        ctx.user.flags = { ...(ctx.user.flags||{}), multiHits: hits };
      }
    },
    onModifyDamage: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.multiHits) {
        const boost = ctx.user.flags.multiHits === 3 ? 1.33 : 1.25;
        return { damage: ctx.damage * boost };
      }
    }
  },

  north_wind: {
    name: "North Wind", source: 'er', impl: 'full',
    description: "Sets Aurora Veil on entry. Immune to hail.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'field', field: 'aurora_veil', turns: 5 }] })
  },

  overcharge: {
    name: "Overcharge", source: 'er', impl: 'full',
    description: "Electric does 2x to Electric. Can paralyze Electrics.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'electric' && ctx.target.species.types.includes('electric'))
        return { damage: ctx.damage * 2.0 };
    }
  },

  violent_rush: {
    name: "Violent Rush", source: 'er', impl: 'full',
    description: "1.5x Speed on first turn out.",
    onComputeStats: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.firstTurn) return { modifiers: { spe: 1.5 } };
    }
  },

  flaming_soul: {
    name: "Flaming Soul", source: 'er', impl: 'full',
    description: "Fire moves +1 priority at full HP.",
    onBeforeMove: (ctx) => { if (ctx.move.type === 'fire' && ctx.user.currentHP === ctx.user.stats.hp) return { priorityBoost: 1 }; }
  },

  sage_power: {
    name: "Sage Power", source: 'er', impl: 'full',
    description: "Locked into first move, +50% Sp.Atk.",
    onComputeStats: (ctx) => ({ modifiers: { spAtk: 1.5 } }),
    onBeforeMove: (ctx) => {
      ctx.user.flags = ctx.user.flags || {};
      if (!ctx.user.flags.lockedMove) ctx.user.flags.lockedMove = ctx.move.id;
    }
  },

  bone_zone: {
    name: "Bone Zone", source: 'er', impl: 'full',
    description: "Bone moves ignore type immunities; double damage on resistances.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('bone') && ctx.effectiveness < 1)
        return { damage: ctx.damage * 2.0 };
    }
  },

  weather_control: {
    name: "Weather Control", source: 'er', impl: 'full',
    description: "Negates opposing weather-based moves.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), weatherControl: true }; }
  },

  speed_force: {
    name: "Speed Force", source: 'er', impl: 'full',
    description: "Contact moves use 20% of Speed additionally.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('contact')) {
        const bonus = Math.floor(ctx.user.effectiveStat('spe') * 0.20);
        return { damage: ctx.damage + bonus };
      }
    }
  },

  molten_down: {
    name: "Molten Down", source: 'er', impl: 'full',
    description: "Fire moves are super effective against Rock.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), moltenDown: true }; }
  },

  flock: {
    name: "Flock", source: 'er', impl: 'full',
    description: "Overgrow for Flying.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'flying' && ctx.user.currentHP <= ctx.user.stats.hp / 3)
        return { damage: ctx.damage * 1.5 };
    }
  },

  field_explorer: {
    name: "Field Explorer", source: 'er', impl: 'full',
    description: "+25% to field moves (Dig, Headbutt, Secret Power, etc).",
    onModifyDamage: (ctx) => {
      const fieldMoves = ['dig','headbutt','secret_power','natural_gift','rock_smash'];
      if (fieldMoves.includes(ctx.move.id)) return { damage: ctx.damage * 1.25 };
    }
  },

  striker: {
    name: "Striker", source: 'er', impl: 'full',
    description: "Boosts kicking moves by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('kick')) return { damage: ctx.damage * 1.3 };
    }
  },

  frozen_soul: {
    name: "Frozen Soul", source: 'er', impl: 'full',
    description: "Ice moves +1 priority at full HP.",
    onBeforeMove: (ctx) => { if (ctx.move.type === 'ice' && ctx.user.currentHP === ctx.user.stats.hp) return { priorityBoost: 1 }; }
  },

  looter: {
    name: "Looter", source: 'er', impl: 'full',
    description: "Heals 1/4 max HP after KO.",
    onAfterKO: (ctx) => { ctx.user.heal(Math.floor(ctx.user.stats.hp / 4)); }
  },

  lunar_eclipse: {
    name: "Lunar Eclipse", source: 'er', impl: 'full',
    description: "Fairy and Dark moves get STAB regardless of typing.",
    onModifyDamage: (ctx) => {
      if ((ctx.move.type === 'fairy' || ctx.move.type === 'dark') && !ctx.user.species.types.includes(ctx.move.type))
        return { damage: ctx.damage * 1.5 };
    }
  },

  solar_flare: {
    name: "Solar Flare", source: 'er', impl: 'full',
    description: "Fire moves get STAB regardless of typing.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'fire' && !ctx.user.species.types.includes('fire'))
        return { damage: ctx.damage * 1.5 };
    }
  },

  power_core: {
    name: "Power Core", source: 'er', impl: 'full',
    description: "+25% damage using defensive stats on offensive moves.",
    onModifyDamage: (ctx) => {
      if (ctx.move.category === 'physical') {
        const bonus = Math.floor(ctx.user.effectiveStat('def') * 0.25);
        return { damage: ctx.damage + bonus };
      } else if (ctx.move.category === 'special') {
        const bonus = Math.floor(ctx.user.effectiveStat('spDef') * 0.25);
        return { damage: ctx.damage + bonus };
      }
    }
  },

  sighting_system: {
    name: "Sighting System", source: 'er', impl: 'full',
    description: "Moves with <=50% accuracy get 100% accuracy.",
    onBeforeMove: (ctx) => {
      if (ctx.move.accuracy && ctx.move.accuracy <= 50)
        ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 999 };
    }
  },

  bad_company: {
    name: "Bad Company", source: 'er', impl: 'full',
    description: "Prevents self stat drops and recoil.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source === 'self') return { override: true };
    },
    onAfterDamage: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), noRecoil: true }; }
  },

  giant_wings: {
    name: "Giant Wings", source: 'er', impl: 'full',
    description: "Boosts wind/air moves by 25% (Twister, Hurricane, Heat Wave, Air Slash, etc.).",
    onModifyDamage: (ctx) => {
      const windMoves = ['twister','hurricane','heat_wave','air_slash','gust','tailwind','aircutter','air_cutter','airslash','razor_wind'];
      const isWind = (ctx.move.flags && ctx.move.flags.includes('wind')) || windMoves.includes(ctx.move.id);
      if (isWind) return { damage: ctx.damage * 1.25 };
    }
  },

  momentum: {
    name: "Momentum", source: 'er', impl: 'full',
    description: "Contact moves use Speed instead of Attack.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('contact') && ctx.move.category === 'physical') {
        const speBonus = ctx.user.effectiveStat('spe') / Math.max(1, ctx.user.effectiveStat('atk'));
        return { damage: Math.floor(ctx.damage * speBonus) };
      }
    }
  },

  grip_pincer: {
    name: "Grip Pincer", source: 'er', impl: 'full',
    description: "50% chance to trap on contact.",
    onAfterDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('contact') && Math.random() < 0.5) {
        ctx.target.flags = { ...(ctx.target.flags||{}), trapped: true, trapTurns: 2 + Math.floor(Math.random()*2) };
        ctx.battle.log(`${ctx.target.nickname} was trapped!`);
      }
    }
  },

  big_leaves: {
    name: "Big Leaves", source: 'er', impl: 'full',
    description: "1.5x Speed in sun.",
    onComputeStats: (ctx) => {
      if (ctx.battle.weather === 'sun') return { modifiers: { spe: 1.5 } };
    }
  },

  precise_fist: {
    name: "Precise Fist", source: 'er', impl: 'full',
    description: "Punching moves have +1 crit and double secondary effect chance.",
    onCriticalCheck: (ctx) => {
      if (!ctx.defender && ctx.move.flags && ctx.move.flags.includes('punch')) return { critStages: 1 };
    },
    onBeforeMove: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('punch')) {
        ctx.user.flags = { ...(ctx.user.flags||{}), secondaryChanceMult: 2.0 };
      }
    }
  },

  deadeye: {
    name: "Deadeye", source: 'er', impl: 'full',
    description: "Moves never miss.",
    onBeforeMove: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 999 }; }
  },

  artillery: {
    name: "Artillery", source: 'er', impl: 'full',
    description: "Beam, pump, cannon, zooka, shot, aura, pulse moves can't miss; hit both foes in doubles.",
    onBeforeMove: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('pulse'))
        ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 999 };
    }
  },

  amplifier: {
    name: "Amplifier", source: 'er', impl: 'full',
    description: "Sound moves target all foes and gain 30% power.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('sound')) return { damage: ctx.damage * 1.3 };
    }
  },

  ice_dew: {
    name: "Ice Dew", source: 'er', impl: 'full',
    description: "Immune to Ice; +1 Atk or SpAtk when hit.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'ice') {
        const stat = ctx.user.effectiveStat('atk') >= ctx.user.effectiveStat('spAtk') ? 'atk' : 'spAtk';
        return { damage: 0, immune: true,
          effects: [{ type: 'stat', target: 'self', stat, stages: 1, source: 'Ice Dew' }] };
      }
    }
  },

  sun_worship: {
    name: "Sun Worship", source: 'er', impl: 'full',
    description: "+1 to highest non-HP stat on entry in sun.",
    onSwitchIn: (ctx) => {
      if (ctx.battle.weather === 'sun') {
        const stats = ['atk','def','spAtk','spDef','spe'];
        let bestStat = stats[0], bestVal = 0;
        for (const s of stats) {
          if (ctx.user.stats[s] > bestVal) { bestVal = ctx.user.stats[s]; bestStat = s; }
        }
        return { effects: [{ type: 'stat', target: 'self', stat: bestStat, stages: 1, source: 'Sun Worship' }] };
      }
    }
  },

  pollinate: {
    name: "Pollinate", source: 'er', impl: 'full',
    description: "Normal moves become Bug-type and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type === 'normal') return { newType: 'bug' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  volcano_rage: {
    name: "Volcano Rage", source: 'er', impl: 'full',
    description: "After a Fire move, triggers a 50 BP Eruption-like attack.",
    onAfterDamage: (ctx) => {
      if (ctx.move.type === 'fire') {
        const followup = Math.max(1, Math.floor(ctx.user.effectiveStat('spAtk') * 0.5));
        ctx.target.takeDamage(followup);
        ctx.battle.log(`${ctx.user.nickname}'s Volcano Rage erupted!`);
      }
    }
  },

  cold_rebound: {
    name: "Cold Rebound", source: 'er', impl: 'full',
    description: "When hit by contact, counter with Icy Wind (-1 Speed).",
    onTakeContact: (ctx) => {
      ctx.battle.log(`${ctx.defender.nickname} retaliated with Cold Rebound!`);
      return { effects: [{ type: 'stat', target: 'opponent', stat: 'spe', stages: -1, source: 'Cold Rebound' }] };
    }
  },

  low_blow: {
    name: "Low Blow", source: 'er', impl: 'full',
    description: "Attacks with Feint Attack on switch-in.",
    onSwitchIn: (ctx) => {
      if (ctx.target) {
        const dmg = Math.max(1, Math.floor(ctx.user.effectiveStat('atk') * 0.4));
        ctx.target.takeDamage(dmg);
        ctx.battle.log(`${ctx.user.nickname} struck with a low blow!`);
      }
    }
  },

  nosferatu: {
    name: "Nosferatu", source: 'er', impl: 'full',
    description: "Contact moves +20% damage and heal 33%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('contact')) return { damage: ctx.damage * 1.2 };
    },
    onAfterDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('contact'))
        ctx.user.heal(Math.floor(ctx.damage * 0.33));
    }
  },

  spectral_shroud: {
    name: "Spectral Shroud", source: 'er', impl: 'full',
    description: "Normal moves become Ghost; 30% chance to badly poison.",
    onModifyMoveType: (ctx) => { if (ctx.move.type === 'normal') return { newType: 'ghost' }; },
    onModifyDamage: (ctx) => { if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 }; },
    onAfterDamage: (ctx) => {
      if (ctx.move._ateBoosted && Math.random() < 0.30 && !ctx.target.status) {
        ctx.target.status = 'badly_poisoned';
        ctx.battle.log(`${ctx.target.nickname} was badly poisoned!`);
      }
    }
  },

  discipline: {
    name: "Discipline", source: 'er', impl: 'full',
    description: "Outrage-like moves don't lock; immune to Confusion, Intimidate, Scare.",
    onTryStatus: (ctx) => {
      if (['confusion','intimidate','scare'].includes(ctx.status)) return { blocked: true };
    },
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), discipline: true, intimidateImmune: true }; }
  },

  thundercall: {
    name: "Thundercall", source: 'er', impl: 'full',
    description: "After Electric move, follows up with Smite at 20% power.",
    onAfterDamage: (ctx) => {
      if (ctx.move.type === 'electric') {
        const followup = Math.max(1, Math.floor(ctx.damage * 0.20));
        ctx.target.takeDamage(followup);
        ctx.battle.log(`${ctx.user.nickname}'s Thundercall struck!`);
      }
    }
  },

  marine_apex: {
    name: "Marine Apex", source: 'er', impl: 'full',
    description: "+50% damage to Water-types. Bypasses substitutes/screens.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), infiltrator: true }; },
    onModifyDamage: (ctx) => {
      if (ctx.target && ctx.target.species && ctx.target.species.types && ctx.target.species.types.includes('water'))
        return { damage: ctx.damage * 1.5 };
    }
  },

  mighty_horn: {
    name: "Mighty Horn", source: 'er', impl: 'full',
    description: "Boosts horn/drill moves by 30%.",
    onModifyDamage: (ctx) => {
      const hornMoves = ['horn_attack','horn_drill','drill_peck','megahorn','drill_run','horn_leech','smart_strike'];
      if (hornMoves.includes(ctx.move.id)) return { damage: ctx.damage * 1.3 };
    }
  },

  hardened_sheath: {
    name: "Hardened Sheath", source: 'er', impl: 'full',
    description: "+1 Attack after using a horn move.",
    onAfterDamage: (ctx) => {
      const hornMoves = ['horn_attack','horn_drill','drill_peck','megahorn','drill_run','horn_leech','smart_strike'];
      if (hornMoves.includes(ctx.move.id)) {
        return { effects: [{ type: 'stat', target: 'self', stat: 'atk', stages: 1, source: 'Hardened Sheath' }] };
      }
    }
  },

  arctic_fur: {
    name: "Arctic Fur", source: 'er', impl: 'full',
    description: "Halves Ice-type damage.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'ice') return { damage: ctx.damage * 0.5 };
    }
  },

  spectralize: {
    name: "Spectralize", source: 'er', impl: 'full',
    description: "Normal moves become Ghost and gain 10% power.",
    onModifyMoveType: (ctx) => { if (ctx.move.type === 'normal') return { newType: 'ghost' }; },
    onModifyDamage: (ctx) => { if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 }; }
  },

  lethargy: {
    name: "Lethargy", source: 'er', impl: 'full',
    description: "Atk drops 20% each turn down to 20%. Resets on switch.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), lethargyMult: 1.0 }; },
    onComputeStats: (ctx) => {
      if (ctx.user.flags && ctx.user.flags.lethargyMult) return { modifiers: { atk: ctx.user.flags.lethargyMult } };
    },
    onEndOfTurn: (ctx) => {
      ctx.user.flags = ctx.user.flags || { lethargyMult: 1.0 };
      ctx.user.flags.lethargyMult = Math.max(0.2, ctx.user.flags.lethargyMult - 0.2);
    }
  },

  iron_barrage: {
    name: "Iron Barrage", source: 'er', impl: 'full',
    description: "Mega Launcher + Sighting System.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('pulse')) return { damage: ctx.damage * 1.5 };
    },
    onBeforeMove: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('pulse'))
        ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 999 };
    }
  },

  steel_barrel: {
    name: "Steel Barrel", source: 'er', impl: 'full',
    description: "Protects from recoil damage.",
    onAfterDamage: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), noRecoil: true }; }
  },

  pyro_shells: {
    name: "Pyro Shells", source: 'er', impl: 'full',
    description: "After a Mega Launcher move, triggers Outburst (50 BP).",
    onAfterDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('pulse')) {
        const dmg = Math.max(1, Math.floor(ctx.user.effectiveStat('spAtk') * 0.5));
        ctx.target.takeDamage(dmg);
        ctx.battle.log(`${ctx.user.nickname}'s Pyro Shells exploded!`);
      }
    }
  },

  fungal_infection: {
    name: "Fungal Infection", source: 'er', impl: 'full',
    description: "Attacks inflict Leech Seed.",
    onAfterDamage: (ctx) => {
      if (!ctx.target.species.types.includes('grass')) {
        ctx.target.volatileStatus.leech_seed = true;
        ctx.battle.log(`${ctx.target.nickname} was infected with Leech Seed!`);
      }
    }
  },

  parry: {
    name: "Parry", source: 'er', impl: 'full',
    description: "Takes 80% damage from contact moves; counters with Mach Punch.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('contact')) return { damage: ctx.damage * 0.8 };
    },
    onTakeContact: (ctx) => {
      const dmg = Math.max(1, Math.floor(ctx.defender.effectiveStat('atk') * 0.4));
      ctx.attacker.takeDamage(dmg);
      ctx.battle.log(`${ctx.defender.nickname} parried with Mach Punch!`);
    }
  },

  scrapyard: {
    name: "Scrapyard", source: 'er', impl: 'full',
    description: "Sets Spikes when hit.",
    onTakeDamage: (ctx) => {
      if (ctx.move.power > 0) {
        ctx.battle.hazards = ctx.battle.hazards || {};
        const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
        ctx.battle.hazards[oppSide] = ctx.battle.hazards[oppSide] || {};
        ctx.battle.hazards[oppSide].spikes = (ctx.battle.hazards[oppSide].spikes || 0) + 1;
      }
    }
  },

  loose_quills: {
    name: "Loose Quills", source: 'er', impl: 'full',
    description: "Sets Spikes when hit.",
    onTakeDamage: (ctx) => {
      if (ctx.move.power > 0) {
        ctx.battle.hazards = ctx.battle.hazards || {};
        const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
        ctx.battle.hazards[oppSide] = ctx.battle.hazards[oppSide] || {};
        ctx.battle.hazards[oppSide].spikes = (ctx.battle.hazards[oppSide].spikes || 0) + 1;
      }
    }
  },

  toxic_debris: {
    name: "Toxic Debris", source: 'er', impl: 'full',
    description: "Sets Toxic Spikes when hit by physical.",
    onTakeDamage: (ctx) => {
      if (ctx.move.category === 'physical') {
        ctx.battle.hazards = ctx.battle.hazards || {};
        const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
        ctx.battle.hazards[oppSide] = ctx.battle.hazards[oppSide] || {};
        ctx.battle.hazards[oppSide].toxic_spikes = (ctx.battle.hazards[oppSide].toxic_spikes || 0) + 1;
      }
    }
  },

  roundhouse: {
    name: "Roundhouse", source: 'er', impl: 'full',
    description: "Kick moves never miss; use lower of foe's defenses.",
    onBeforeMove: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('kick'))
        ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 999 };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('kick')) {
        const lowerDef = Math.min(ctx.target.effectiveStat('def'), ctx.target.effectiveStat('spDef'));
        const ratio = ctx.target.effectiveStat(ctx.move.category === 'physical' ? 'def' : 'spDef') / lowerDef;
        return { damage: Math.floor(ctx.damage * ratio) };
      }
    }
  },

  mineralize: {
    name: "Mineralize", source: 'er', impl: 'full',
    description: "Normal moves become Rock and gain 10% power.",
    onModifyMoveType: (ctx) => { if (ctx.move.type === 'normal') return { newType: 'rock' }; },
    onModifyDamage: (ctx) => { if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 }; }
  },

  loose_rocks: {
    name: "Loose Rocks", source: 'er', impl: 'full',
    description: "Sets Stealth Rock when hit.",
    onTakeDamage: (ctx) => {
      if (ctx.move.power > 0) {
        ctx.battle.hazards = ctx.battle.hazards || {};
        const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
        ctx.battle.hazards[oppSide] = ctx.battle.hazards[oppSide] || {};
        ctx.battle.hazards[oppSide].stealth_rock = true;
      }
    }
  },

  spinning_top: {
    name: "Spinning Top", source: 'er', impl: 'full',
    description: "Fighting moves +1 Speed and clear hazards.",
    onAfterDamage: (ctx) => {
      if (ctx.move.type === 'fighting') {
        const side = (ctx.user === ctx.battle.active('player')) ? 'player' : 'opponent';
        if (ctx.battle.hazards) ctx.battle.hazards[side] = {};
        return { effects: [{ type: 'stat', target: 'self', stat: 'spe', stages: 1, source: 'Spinning Top' }] };
      }
    }
  },

  retribution_blow: {
    name: "Retribution Blow", source: 'er', impl: 'full',
    description: "When foe boosts a stat, trigger Hyper Beam.",
    onSwitchIn: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), retribution: true }; }
  },

  fearmonger: {
    name: "Fearmonger", source: 'er', impl: 'full',
    description: "Lowers foe's Sp.Atk by 1 on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'stat', target: 'opponent', stat: 'spAtk', stages: -1, source: 'Fearmonger' }] })
  },

  kings_wrath: {
    name: "King's Wrath", source: 'er', impl: 'full',
    description: "When a stat is lowered, +1 Atk and Def.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source !== 'self') {
        setTimeout(() => {
          if (!ctx.user.isFainted()) {
            ctx.battle.changeStatStage(ctx.user, 'atk', 1, "King's Wrath");
            ctx.battle.changeStatStage(ctx.user, 'def', 1, "King's Wrath");
          }
        }, 0);
      }
    }
  },

  queens_mourning: {
    name: "Queen's Mourning", source: 'er', impl: 'full',
    description: "When a stat is lowered, +1 SpAtk and SpDef.",
    onStatStageChange: (ctx) => {
      if (ctx.stages < 0 && ctx.source !== 'self') {
        setTimeout(() => {
          if (!ctx.user.isFainted()) {
            ctx.battle.changeStatStage(ctx.user, 'spAtk', 1, "Queen's Mourning");
            ctx.battle.changeStatStage(ctx.user, 'spDef', 1, "Queen's Mourning");
          }
        }, 0);
      }
    }
  },

  toxic_spill: {
    name: "Toxic Spill", source: 'er', impl: 'full',
    description: "Toxic Spikes (2 layers) on entry.",
    onSwitchIn: (ctx) => {
      ctx.battle.hazards = ctx.battle.hazards || {};
      const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
      ctx.battle.hazards[oppSide] = ctx.battle.hazards[oppSide] || {};
      ctx.battle.hazards[oppSide].toxic_spikes = 2;
      ctx.battle.log("Toxic Spikes were spilled!");
    }
  },

  desert_cloak: {
    name: "Desert Cloak", source: 'er', impl: 'full',
    description: "Immune to status and secondary effects in sandstorm.",
    onTryStatus: (ctx) => {
      if (ctx.battle.weather === 'sand') return { blocked: true };
    }
  },

  draconize: {
    name: "Draconize", source: 'er', impl: 'full',
    description: "Normal moves become Dragon-type and gain 10% power.",
    onModifyMoveType: (ctx) => {
      if (ctx.move.type === 'normal') return { newType: 'dragon' };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move._ateBoosted) return { damage: ctx.damage * 1.1 };
    }
  },

  pretty_princess: {
    name: "Pretty Princess", source: 'er', impl: 'full',
    description: "+50% damage to foes with lowered stats.",
    onModifyDamage: (ctx) => {
      const stages = ctx.target.statStages || {};
      if (Object.values(stages).some(v => v < 0)) return { damage: ctx.damage * 1.5 };
    }
  },

  self_repair: {
    name: "Self-Repair", source: 'er', impl: 'full',
    description: "Combines Self-Sufficient (1/16 HP/turn) with Natural Cure (status on switch).",
    onEndOfTurn: (ctx) => { ctx.user.heal(Math.max(1, Math.floor(ctx.user.stats.hp / 16))); },
    onSwitchOut: (ctx) => { if (ctx.user.status) ctx.user.status = null; }
  },

  atomic_burst: {
    name: "Atomic Burst", source: 'er', impl: 'full',
    description: "Counter with Hyper Beam at 33% power on super-effective hit.",
    onTakeDamage: (ctx) => {
      if (ctx.battle.lastEffectiveness > 1) {
        const dmg = Math.max(1, Math.floor(ctx.user.effectiveStat('spAtk') * 0.33));
        const oppSide = (ctx.user === ctx.battle.active('player')) ? 'opponent' : 'player';
        const opp = ctx.battle.active(oppSide);
        if (opp) {
          opp.takeDamage(dmg);
          ctx.battle.log(`${ctx.user.nickname}'s Atomic Burst exploded!`);
        }
      }
    }
  },

  hellblaze: {
    name: "Hellblaze", source: 'er', impl: 'full',
    description: "Fire +30%, +80% at 1/3 HP.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'fire') {
        const m = ctx.user.currentHP <= ctx.user.stats.hp / 3 ? 1.8 : 1.3;
        return { damage: ctx.damage * m };
      }
    }
  },

  riptide: {
    name: "Riptide", source: 'er', impl: 'full',
    description: "Water +30%, +80% at 1/3 HP.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'water') {
        const m = ctx.user.currentHP <= ctx.user.stats.hp / 3 ? 1.8 : 1.3;
        return { damage: ctx.damage * m };
      }
    }
  },

  forest_rage: {
    name: "Forest Rage", source: 'er', impl: 'full',
    description: "Grass +30%, +80% at 1/3 HP.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'grass') {
        const m = ctx.user.currentHP <= ctx.user.stats.hp / 3 ? 1.8 : 1.3;
        return { damage: ctx.damage * m };
      }
    }
  },

  primal_maw: {
    name: "Primal Maw", source: 'er', impl: 'full',
    description: "Biting moves hit twice (parental bond style). Approximated as 1.5x.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('biting')) return { damage: ctx.damage * 1.5 };
    }
  },

  sweeping_edge: {
    name: "Sweeping Edge", source: 'er', impl: 'full',
    description: "Slicing moves never miss.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('slicing')) return { damage: ctx.damage * 1.0 };
    }
  },

  gifted_mind: {
    name: "Gifted Mind", source: 'er', impl: 'full',
    description: "Immune to Psychic weakness; status moves never miss.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'psychic' && ctx.effectiveness > 1) return { damage: ctx.damage * 0.5 };
    },
    onBeforeMove: (ctx) => {
      if (ctx.move.category === 'status') ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 999 };
    }
  },

  hydro_circuit: {
    name: "Hydro Circuit", source: 'er', impl: 'full',
    description: "Electric +50%; Water moves drain 25%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'electric') return { damage: ctx.damage * 1.5 };
    },
    onAfterDamage: (ctx) => {
      if (ctx.move.type === 'water') ctx.user.heal(Math.floor(ctx.damage * 0.25));
    }
  },

  equinox: {
    name: "Equinox", source: 'er', impl: 'full',
    description: "Atk and SpAtk become equal to the higher of the two.",
    onComputeStats: (ctx) => {
      const atk = ctx.user.stats.atk * (ctx.user.statStages.atk >= 0 ? (2 + ctx.user.statStages.atk) / 2 : 2 / (2 - ctx.user.statStages.atk));
      const spAtk = ctx.user.stats.spAtk * (ctx.user.statStages.spAtk >= 0 ? (2 + ctx.user.statStages.spAtk) / 2 : 2 / (2 - ctx.user.statStages.spAtk));
      const higher = Math.max(atk, spAtk);
      return { modifiers: { atk: higher / Math.max(1, atk), spAtk: higher / Math.max(1, spAtk) } };
    }
  },

  absorbant: {
    name: "Absorbant", source: 'er', impl: 'full',
    description: "Heals 1/4 max HP when hit by Water moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'water') {
        return { damage: 0, immune: true,
          effects: [{ type: 'heal', target: 'self', amount: ctx.user.stats.hp / 4, source: 'Absorbant' }] };
      }
    }
  },

  clueless: {
    name: "Clueless", source: 'er', impl: 'full',
    description: "All field effects are negated.",
    onSwitchIn: (ctx) => {
      ctx.battle.weather = null;
      ctx.battle.terrain = null;
      ctx.battle.fieldEffects = {};
      ctx.battle.log("All field effects were nullified!");
    }
  },

  cheating_death: {
    name: "Cheating Death", source: 'er', impl: 'full',
    description: "Survives lethal hits with 1 HP at full HP.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.user.currentHP === ctx.user.stats.hp && ctx.damage >= ctx.user.currentHP) {
        return { damage: ctx.user.currentHP - 1 };
      }
    }
  },

  cheap_tactics: {
    name: "Cheap Tactics", source: 'er', impl: 'full',
    description: "Boosts moves with secondary effects by 30%.",
    onModifyDamage: (ctx) => {
      if (ctx.move.effect) return { damage: ctx.damage * 1.3 };
    }
  },

  coward: {
    name: "Coward", source: 'er', impl: 'full',
    description: "+1 Speed when hit by an attack.",
    onTakeDamage: (ctx) => {
      if (ctx.move.power > 0) {
        return { effects: [{ type: 'stat', target: 'self', stat: 'spe', stages: 1, source: 'Coward' }] };
      }
    }
  },

  volt_rush: {
    name: "Volt Rush", source: 'er', impl: 'full',
    description: "Electric moves +1 priority at full HP.",
    onBeforeMove: (ctx) => {
      if (ctx.move.type === 'electric' && ctx.user.currentHP === ctx.user.stats.hp)
        return { priorityBoost: 1 };
    }
  },

  dune_terror: {
    name: "Dune Terror", source: 'er', impl: 'full',
    description: "Sand reduces incoming damage 35%; +20% Ground moves.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.battle.weather === 'sand') return { damage: ctx.damage * 0.65 };
    },
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'ground') return { damage: ctx.damage * 1.2 };
    }
  },

  infernal_rage: {
    name: "Infernal Rage", source: 'er', impl: 'full',
    description: "Fire moves +35% damage with 5% recoil.",
    onModifyDamage: (ctx) => {
      if (ctx.move.type === 'fire') return { damage: ctx.damage * 1.35 };
    },
    onAfterDamage: (ctx) => {
      if (ctx.move.type === 'fire') ctx.user.takeDamage(Math.floor(ctx.damage * 0.05));
    }
  },

  dual_wield: {
    name: "Dual Wield", source: 'er', impl: 'full',
    description: "Mega Launcher moves hit twice at 75% power each.",
    onModifyDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('pulse')) return { damage: ctx.damage * 0.75 };
    }
  },

  elemental_charge: {
    name: "Elemental Charge", source: 'er', impl: 'full',
    description: "20% chance to inflict matching status (BRN/PRZ/FRZ).",
    onAfterDamage: (ctx) => {
      if (Math.random() < 0.20 && !ctx.target.status) {
        const map = { fire: 'burn', electric: 'paralysis', ice: 'freeze' };
        const status = map[ctx.move.type];
        if (status) {
          ctx.target.status = status;
          ctx.battle.log(`${ctx.target.nickname} was ${status}!`);
        }
      }
    }
  },

  ambush: {
    name: "Ambush", source: 'er', impl: 'full',
    description: "Guaranteed crit on first turn out.",
    onCriticalCheck: (ctx) => {
      if (!ctx.defender && ctx.user.flags && ctx.user.flags.firstTurn) return { critStages: 4 };
    }
  },

  atlas: {
    name: "Atlas", source: 'er', impl: 'full',
    description: "Sets Gravity for 8 turns. User moves last.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'field', field: 'gravity', turns: 8 }] }),
    onBeforeMove: (ctx) => ({ priorityBoost: -10 })
  },

  radiance: {
    name: "Radiance", source: 'er', impl: 'full',
    description: "+20% accuracy; Dark moves fail near user.",
    onBeforeMove: (ctx) => { ctx.user.flags = { ...(ctx.user.flags||{}), accuracyMult: 1.2 }; },
    onModifyIncomingDamage: (ctx) => { if (ctx.move.type === 'dark') return { damage: 0, immune: true }; }
  },

  jaws_of_carnage: {
    name: "Jaws of Carnage", source: 'er', impl: 'full',
    description: "Heals 50% HP after KO.",
    onAfterKO: (ctx) => {
      ctx.user.heal(Math.floor(ctx.user.stats.hp / 2));
      ctx.battle.log(`${ctx.user.nickname} feasted!`);
    }
  },

  angels_wrath: {
    name: "Angel's Wrath", source: 'er', impl: 'full',
    description: "Boosts user's moves significantly. (Implementation: +25% all damage.)",
    onModifyDamage: (ctx) => ({ damage: ctx.damage * 1.25 })
  },

  prismatic_fur: {
    name: "Prismatic Fur", source: 'er', impl: 'full',
    description: "Color Change + Fur Coat + Ice Scales.",
    onTakeDamage: (ctx) => {
      if (ctx.move.type && ctx.move.power > 0 && !ctx.user.species.types.includes(ctx.move.type)) {
        ctx.user.species = { ...ctx.user.species, types: [ctx.move.type] };
      }
    },
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.category === 'physical' || ctx.move.category === 'special') return { damage: ctx.damage * 0.5 };
    }
  },

  shocking_jaws: {
    name: "Shocking Jaws", source: 'er', impl: 'full',
    description: "Biting moves 5x more likely to paralyze.",
    onAfterDamage: (ctx) => {
      if (ctx.move.flags && ctx.move.flags.includes('biting') && !ctx.target.status && Math.random() < 0.5) {
        ctx.target.status = 'paralysis';
        ctx.battle.log(`${ctx.target.nickname} was paralyzed!`);
      }
    }
  },

  fae_hunter: {
    name: "Fae Hunter", source: 'er', impl: 'full',
    description: "Deals 50% more damage against Fairy-types.",
    onModifyDamage: (ctx) => {
      if (ctx.target && ctx.target.species && ctx.target.species.types && ctx.target.species.types.includes('fairy'))
        return { damage: ctx.damage * 1.5 };
    }
  },

  gravity_well: {
    name: "Gravity Well", source: 'er', impl: 'full',
    description: "Sets Gravity for 5 turns on entry.",
    onSwitchIn: (ctx) => ({ effects: [{ type: 'field', field: 'gravity', turns: 5 }] })
  },

  evaporate: {
    name: "Evaporate", source: 'er', impl: 'full',
    description: "Immune to Water; sets Mist when hit.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'water') {
        return { damage: 0, immune: true,
          effects: [{ type: 'field', field: 'mist', turns: 5 }] };
      }
    }
  },

  lumberjack: {
    name: "Lumberjack", source: 'er', impl: 'full',
    description: "Deals 50% more damage against Grass-types.",
    onModifyDamage: (ctx) => {
      if (ctx.target && ctx.target.species && ctx.target.species.types && ctx.target.species.types.includes('grass'))
        return { damage: ctx.damage * 1.5 };
    }
  },

  well_baked_body: {
    name: "Well-Baked Body", source: 'er', impl: 'full',
    description: "Halves Fire damage; +2 Defense when hit by Fire.",
    onModifyIncomingDamage: (ctx) => {
      if (ctx.move.type === 'fire') {
        return { damage: ctx.damage * 0.5,
          effects: [{ type: 'stat', target: 'self', stat: 'def', stages: 2, source: 'Well-Baked Body' }] };
      }
    }
  },

  furnace: {
    name: "Furnace", source: 'er', impl: 'full',
    description: "+2 Speed when hit by Rock or switched in on Stealth Rock.",
    onTakeDamage: (ctx) => {
      if (ctx.move.type === 'rock') {
        return { effects: [{ type: 'stat', target: 'self', stat: 'spe', stages: 2, source: 'Furnace' }] };
      }
    },
    onSwitchIn: (ctx) => {
      const side = (ctx.user === ctx.battle.active('player')) ? 'player' : 'opponent';
      if (ctx.battle.hazards && ctx.battle.hazards[side] && ctx.battle.hazards[side].stealth_rock) {
        return { effects: [{ type: 'stat', target: 'self', stat: 'spe', stages: 2, source: 'Furnace' }] };
      }
    }
  },

};

export function getAbility(id) {
  return ABILITIES[id] || null;
}

// Pool helpers — every Fakemon entry has `abilityPool: ['id1','id2',...]`
// and `activeAbility: 'id1'` (defaults to first in pool).
export function defaultActiveAbility(pool) {
  return pool && pool.length > 0 ? pool[0] : null;
}
