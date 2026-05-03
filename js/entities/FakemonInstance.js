// FakemonInstance — a specific Fakemon: this individual, with level, IVs, EVs,
// nature, current HP, status, active ability, learned moves.
//
// The FAKEDEX entry is the "species data" (immutable template).
// A FakemonInstance is mutable per-individual state.

import { getFakemon } from '../data/fakedex.js';
import { MOVES } from '../data/moves.js';
import { defaultActiveAbility } from '../data/abilities.js';

const NATURES = {
  hardy:   { up: null, down: null },
  adamant: { up: 'atk',   down: 'spAtk' },
  modest:  { up: 'spAtk', down: 'atk'   },
  jolly:   { up: 'spe',   down: 'spAtk' },
  timid:   { up: 'spe',   down: 'atk'   },
  bold:    { up: 'def',   down: 'atk'   },
  calm:    { up: 'spDef', down: 'atk'   },
  brave:   { up: 'atk',   down: 'spe'   },
  impish:  { up: 'def',   down: 'spAtk' },
  careful: { up: 'spDef', down: 'spAtk' }
  // Add more later, or use random selection
};

export class FakemonInstance {
  constructor(speciesId, options = {}) {
    const species = getFakemon(speciesId);
    if (!species) throw new Error(`Unknown Fakemon id: ${speciesId}`);
    this.species = species;
    this.speciesId = speciesId;

    this.level = options.level || 5;
    this.nickname = options.nickname || species.name;

    // IVs: 0-31, individual potential
    this.ivs = options.ivs || this.randomIvs();
    // EVs: 0-252 each, max total 510 — earned via battles
    this.evs = options.evs || { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0 };

    this.nature = options.nature || this.randomNature();

    // Active ability: must be in pool. Defaults per species rule.
    const pool = species.abilityPool || [];
    this.activeAbility = options.ability && pool.includes(options.ability)
      ? options.ability
      : (species.defaultAbility || defaultActiveAbility(pool));

    // Moves — pick most recent up-to-4 from learnset at this level
    this.moves = options.moves || this.computeStartingMoves();
    this.movePP = {};
    for (const m of this.moves) this.movePP[m] = MOVES[m] ? MOVES[m].pp : 0;

    // Compute stats from base + IVs + EVs + nature + level
    this.stats = this.computeStats();
    this.currentHP = options.currentHP !== undefined ? options.currentHP : this.stats.hp;

    this.status = null;          // 'burn'|'poison'|'paralyzed'|'sleep'|'frozen'|'badly_poisoned'|null
    this.statusTurns = 0;        // sleep turns, etc.
    this.volatileStatus = {};    // confusion, infatuation, leech_seed, etc.
    this.statStages = { atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0, accuracy: 0, evasion: 0 };
    this.flags = {};             // ability-set flags
    this.exp = options.exp || this.expForLevel(this.level);
    this.friendship = options.friendship || 70;
    this.heldItem = options.heldItem || null;
  }

  // === Stat computation (Gen 3+ formula) ===
  computeStats() {
    const base = this.species.baseStats;
    const ivs = this.ivs;
    const evs = this.evs;
    const lvl = this.level;
    const nat = NATURES[this.nature] || NATURES.hardy;

    // HP formula:
    const hp = Math.floor(((2 * base.hp + ivs.hp + Math.floor(evs.hp / 4)) * lvl) / 100) + lvl + 10;

    const calcStat = (statKey) => {
      let stat = Math.floor(((2 * base[statKey] + ivs[statKey] + Math.floor(evs[statKey] / 4)) * lvl) / 100) + 5;
      if (nat.up   === statKey) stat = Math.floor(stat * 1.1);
      if (nat.down === statKey) stat = Math.floor(stat * 0.9);
      return stat;
    };

    return {
      hp,
      atk:   calcStat('atk'),
      def:   calcStat('def'),
      spAtk: calcStat('spAtk'),
      spDef: calcStat('spDef'),
      spe:   calcStat('spe')
    };
  }

  randomIvs() {
    const r = () => Math.floor(Math.random() * 32);
    return { hp: r(), atk: r(), def: r(), spAtk: r(), spDef: r(), spe: r() };
  }

  randomNature() {
    const keys = Object.keys(NATURES);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  computeStartingMoves() {
    // Pick the most recent up-to-4 moves at or below current level
    const eligible = this.species.learnset
      .filter(e => e.level <= this.level)
      .map(e => e.move);
    return eligible.slice(-4);
  }

  // === Stat stage application (Gen 3+ multipliers) ===
  static stageMultiplier(stage) {
    if (stage >= 0) return (2 + stage) / 2;
    return 2 / (2 - stage);
  }

  effectiveStat(statKey, battle = null) {
    const base = this.stats[statKey];
    const stage = this.statStages[statKey] || 0;
    let val = Math.floor(base * FakemonInstance.stageMultiplier(stage));
    // Status effects on stats
    if (statKey === 'atk' && this.status === 'burn') val = Math.floor(val * 0.5);
    if (statKey === 'spe' && this.status === 'paralyzed') val = Math.floor(val * 0.5);
    // Ability modifiers (Swift Swim, Chlorophyll, Huge Power, Lead Coat, etc.)
    if (battle && this._abilityStatModifierFn) {
      const mult = this._abilityStatModifierFn(statKey, battle);
      if (mult && mult !== 1) val = Math.floor(val * mult);
    }
    return val;
  }

  // === XP & leveling ===
  expForLevel(lvl) {
    const rate = this.species.growthRate;
    if (rate === 'fast')         return Math.floor((4 * lvl ** 3) / 5);
    if (rate === 'medium-fast')  return lvl ** 3;
    if (rate === 'medium-slow')  return Math.floor((6/5) * lvl ** 3 - 15 * lvl ** 2 + 100 * lvl - 140);
    if (rate === 'slow')         return Math.floor((5 * lvl ** 3) / 4);
    return lvl ** 3;
  }

  gainExp(amount) {
    this.exp += amount;
    let leveled = false;
    while (this.level < 100 && this.exp >= this.expForLevel(this.level + 1)) {
      this.level++;
      leveled = true;
      // Recompute stats at new level, preserve HP fraction
      const oldMaxHP = this.stats.hp;
      this.stats = this.computeStats();
      const hpDiff = this.stats.hp - oldMaxHP;
      this.currentHP = Math.min(this.stats.hp, this.currentHP + hpDiff);
    }
    return leveled;
  }

  isFainted() { return this.currentHP <= 0; }

  takeDamage(amount) {
    this.currentHP = Math.max(0, this.currentHP - Math.floor(amount));
    return this.currentHP === 0;
  }

  heal(amount) {
    this.currentHP = Math.min(this.stats.hp, this.currentHP + Math.floor(amount));
  }
}
