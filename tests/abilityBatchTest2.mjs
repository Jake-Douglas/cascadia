// Spot-check tests for batches 10-18 (the latest ~250 abilities).
// Uses the actual engine API: fireAbilityHook(side, hookName, ctx).

import { BattleEngine } from '../js/systems/battleEngine.js';
import { FakemonInstance } from '../js/entities/FakemonInstance.js';
import { ABILITIES } from '../js/data/abilities.js';
import { MOVES } from '../js/data/moves.js';

let pass = 0, fail = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  PASS  ${label}`); pass++; }
  else    { console.log(`  FAIL  ${label}  ${detail}`); fail++; }
}

function makeMon(ability, opts = {}) {
  const mon = new FakemonInstance(1, { level: 50, ...opts });
  mon.activeAbility = ability;
  mon.species = { ...mon.species, abilityPool: [ability], defaultAbility: ability };
  return mon;
}

function newBattle(p1Ability, p2Ability) {
  const p1 = makeMon(p1Ability, { nickname: 'P1' });
  const p2 = makeMon(p2Ability, { nickname: 'P2' });
  const battle = new BattleEngine({
    player: { team: [p1], activeIndex: 0 },
    opponent: { team: [p2], activeIndex: 0, isWild: true },
    onLog: () => {}
  });
  return { battle, p1, p2 };
}

function fire(battle, side, hook, extra = {}) {
  const mon = battle.active(side);
  const opp = battle.active(side === 'player' ? 'opponent' : 'player');
  const ctx = { user: mon, target: opp, battle, ...extra };
  return battle.fireAbilityHook(side, hook, ctx);
}

console.log("=== BATCH 10 — Stat Protection ===");
{
  const { battle, p1 } = newBattle('clear_body', 'overgrow');
  battle.changeStatStage(p1, 'atk', -1, 'enemy');
  check("Clear Body blocks foe-induced atk drop", p1.statStages.atk === 0, `stage=${p1.statStages.atk}`);
}
{
  const { battle, p1 } = newBattle('contrary', 'overgrow');
  battle.changeStatStage(p1, 'atk', 1, 'enemy');
  check("Contrary inverts +1 atk to -1", p1.statStages.atk === -1, `stage=${p1.statStages.atk}`);
}
{
  const { battle, p1 } = newBattle('simple', 'overgrow');
  battle.changeStatStage(p1, 'atk', 1, 'self');
  check("Simple doubles +1 to +2", p1.statStages.atk === 2);
}
{
  const { battle, p1, p2 } = newBattle('mirror_armor', 'overgrow');
  battle.changeStatStage(p1, 'atk', -1, 'enemy');
  check("Mirror Armor: drop didn't land on me", p1.statStages.atk === 0);
  check("Mirror Armor: drop reflected to attacker", p2.statStages.atk === -1, `attacker=${p2.statStages.atk}`);
}
{
  const { battle, p1 } = newBattle('hyper_cutter', 'overgrow');
  battle.changeStatStage(p1, 'atk', -1, 'enemy');
  check("Hyper Cutter blocks atk drop", p1.statStages.atk === 0);
  battle.changeStatStage(p1, 'def', -1, 'enemy');
  check("Hyper Cutter doesn't block def drop", p1.statStages.def === -1);
}

console.log("=== BATCH 11 — Standard Utility ===");
{
  const { battle } = newBattle('cloud_nine', 'overgrow');
  battle.weather = 'sun';
  fire(battle, 'player', 'onSwitchIn');
  check("Cloud Nine sets weatherSuppressed", battle.weatherSuppressed === true);
}
{
  const { battle, p1 } = newBattle('illuminate', 'overgrow');
  p1.flags = {};
  fire(battle, 'player', 'onBeforeMove', { move: MOVES.tackle });
  check("Illuminate sets accuracyMult to 1.2", p1.flags.accuracyMult === 1.2);
}
{
  const { battle } = newBattle('technician', 'overgrow');
  const r = fire(battle, 'player', 'onModifyDamage', { move: { ...MOVES.tackle, power: 40 }, damage: 100, effectiveness: 1 });
  check("Technician boosts 40BP move 1.5x", r && r.damage === 150, `got ${r?.damage}`);
}
{
  const { battle } = newBattle('tinted_lens', 'overgrow');
  const r = fire(battle, 'player', 'onModifyDamage', { move: MOVES.tackle, damage: 100, effectiveness: 0.5 });
  check("Tinted Lens doubles NVE", r && r.damage === 200);
}
{
  const { battle } = newBattle('moxie', 'overgrow');
  const r = fire(battle, 'player', 'onAfterKO');
  check("Moxie gives +1 atk effect on KO", r && r.effects && r.effects.some(e => e.stat === 'atk' && e.stages === 1));
}
{
  const { battle, p1 } = newBattle('beast_boost', 'overgrow');
  p1.stats = { ...p1.stats, atk: 200, def: 50, spAtk: 80, spDef: 80, spe: 80 };
  const r = fire(battle, 'player', 'onAfterKO');
  check("Beast Boost picks highest stat (atk)", r && r.effects[0].stat === 'atk');
}

console.log("=== BATCH 12 — Priority + ER originals ===");
{
  const { battle } = newBattle('gale_wings', 'overgrow');
  const r = fire(battle, 'player', 'onBeforeMove', { move: { ...MOVES.tackle, type: 'flying' } });
  check("Gale Wings +1 priority for flying at full HP", r && r.priorityBoost === 1);
}
{
  const { battle, p1 } = newBattle('gale_wings', 'overgrow');
  p1.takeDamage(10);
  const r = fire(battle, 'player', 'onBeforeMove', { move: { ...MOVES.tackle, type: 'flying' } });
  check("Gale Wings does NOT boost when not at full HP", !r || !r.priorityBoost);
}
{
  const { battle } = newBattle('prankster', 'overgrow');
  const r = fire(battle, 'player', 'onBeforeMove', { move: { category: 'status', type: 'normal', flags: [] } });
  check("Prankster +1 priority for status moves", r && r.priorityBoost === 1);
}
{
  const { battle } = newBattle('electrocytes', 'overgrow');
  const r = fire(battle, 'player', 'onModifyDamage', { move: { type: 'electric' }, damage: 100, effectiveness: 1 });
  check("Electrocytes 1.25x electric", r && r.damage === 125);
}
{
  const { battle } = newBattle('crystallize', 'overgrow');
  const r = fire(battle, 'player', 'onModifyMoveType', { move: { type: 'rock' } });
  check("Crystallize: rock -> ice", r && r.newType === 'ice');
}
{
  const { battle } = newBattle('arctic_fur', 'overgrow');
  const r = fire(battle, 'player', 'onModifyIncomingDamage', { move: { type: 'ice' }, damage: 100, effectiveness: 1 });
  check("Arctic Fur halves Ice damage", r && r.damage === 50);
}

console.log("=== BATCH 13 — Standard Abilities ===");
{
  const { battle } = newBattle('hustle', 'overgrow');
  const r = fire(battle, 'player', 'onComputeStats');
  check("Hustle 1.4x atk", r && r.modifiers && r.modifiers.atk === 1.4);
}
{
  const { battle, p1 } = newBattle('poison_heal', 'overgrow');
  p1.status = 'poison';
  p1.takeDamage(50);
  const before = p1.currentHP;
  fire(battle, 'player', 'onEndOfTurn');
  check("Poison Heal heals on end of turn", p1.currentHP > before, `${before} -> ${p1.currentHP}`);
}
{
  const { battle, p1 } = newBattle('toxic_boost', 'overgrow');
  p1.status = 'poison';
  const r = fire(battle, 'player', 'onComputeStats');
  check("Toxic Boost 1.5x atk when poisoned", r && r.modifiers && r.modifiers.atk === 1.5);
}
{
  const { battle } = newBattle('fairy_aura', 'overgrow');
  const r = fire(battle, 'player', 'onModifyDamage', { move: { type: 'fairy' }, damage: 100, effectiveness: 1 });
  check("Fairy Aura 1.33x fairy", r && Math.abs(r.damage - 133) < 1);
}

console.log("=== BATCH 14 — Form changes & Utility ===");
{
  const { battle } = newBattle('intrepid_sword', 'overgrow');
  const r = fire(battle, 'player', 'onSwitchIn');
  check("Intrepid Sword +1 atk on entry", r && r.effects && r.effects[0].stat === 'atk');
}
{
  const { battle } = newBattle('dauntless_shield', 'overgrow');
  const r = fire(battle, 'player', 'onSwitchIn');
  check("Dauntless Shield +1 def on entry", r && r.effects && r.effects[0].stat === 'def');
}
{
  const { battle } = newBattle('gorilla_tactics', 'overgrow');
  const r = fire(battle, 'player', 'onComputeStats');
  check("Gorilla Tactics 1.5x atk", r && r.modifiers && r.modifiers.atk === 1.5);
}
{
  const { battle } = newBattle('neuroforce', 'overgrow');
  const r = fire(battle, 'player', 'onModifyDamage', { move: MOVES.tackle, damage: 100, effectiveness: 2.0 });
  check("Neuroforce 1.25x SE damage", r && r.damage === 125);
}
{
  const { battle, p1 } = newBattle('infiltrator', 'overgrow');
  fire(battle, 'player', 'onSwitchIn');
  check("Infiltrator sets flag", p1.flags && p1.flags.infiltrator === true);
}
{
  const { battle } = newBattle('disguise', 'overgrow');
  const r = fire(battle, 'player', 'onModifyIncomingDamage', { move: MOVES.tackle, damage: 100, effectiveness: 1 });
  check("Disguise blocks first hit (small chip)", r && r.damage < 100);
}

console.log("=== BATCH 15 — ER Originals ===");
{
  const { battle, p1 } = newBattle('self_sufficient', 'overgrow');
  p1.takeDamage(50);
  const before = p1.currentHP;
  fire(battle, 'player', 'onEndOfTurn');
  check("Self-Sufficient heals 1/16", p1.currentHP > before);
}
{
  const { battle } = newBattle('feline_prowess', 'overgrow');
  const r = fire(battle, 'player', 'onComputeStats');
  check("Feline Prowess 2x spAtk", r && r.modifiers && r.modifiers.spAtk === 2.0);
}
{
  const { battle, p1 } = newBattle('half_drake', 'overgrow');
  fire(battle, 'player', 'onSwitchIn');
  check("Half Drake adds dragon type", p1.species.types.includes('dragon'));
}
{
  const { battle } = newBattle('fight_spirit', 'overgrow');
  const r = fire(battle, 'player', 'onModifyMoveType', { move: { type: 'normal' } });
  check("Fight Spirit: normal -> fighting", r && r.newType === 'fighting');
}
{
  const { battle } = newBattle('overgrow', 'lethargy');
  const r1 = fire(battle, 'opponent', 'onComputeStats');
  check("Lethargy starts at 1.0x atk", r1 && r1.modifiers && r1.modifiers.atk === 1.0);
  fire(battle, 'opponent', 'onEndOfTurn');
  const r2 = fire(battle, 'opponent', 'onComputeStats');
  check("Lethargy decreases atk over time", r2 && r2.modifiers && r2.modifiers.atk < 1.0, `got ${r2?.modifiers?.atk}`);
}

console.log("=== BATCH 16 — Mass ER Originals ===");
{
  const { battle, p2 } = newBattle('dragonslayer', 'overgrow');
  p2.species.types = ['dragon'];
  const r = fire(battle, 'player', 'onModifyDamage', { move: MOVES.tackle, damage: 100, effectiveness: 1 });
  check("Dragonslayer 1.5x vs dragon", r && r.damage === 150);
}
{
  const { battle } = newBattle('mountaineer', 'overgrow');
  const r = fire(battle, 'player', 'onModifyIncomingDamage', { move: { type: 'rock' }, damage: 100, effectiveness: 1 });
  check("Mountaineer immune to rock", r && r.immune === true);
}
{
  const { battle } = newBattle('permafrost', 'overgrow');
  const r = fire(battle, 'player', 'onModifyIncomingDamage', { move: MOVES.tackle, damage: 100, effectiveness: 2.0 });
  check("Permafrost reduces SE 25%", r && r.damage === 75);
}
{
  const { battle } = newBattle('twisted_dimension', 'overgrow');
  const r = fire(battle, 'player', 'onSwitchIn');
  check("Twisted Dimension sets trick room", r && r.effects && r.effects[0].field === 'trick_room');
}
{
  const { battle } = newBattle('flaming_soul', 'overgrow');
  const r = fire(battle, 'player', 'onBeforeMove', { move: { type: 'fire' } });
  check("Flaming Soul +1 priority for fire at full HP", r && r.priorityBoost === 1);
}
{
  const { battle } = newBattle('spider_lair', 'overgrow');
  fire(battle, 'player', 'onSwitchIn');
  check("Spider Lair sets sticky web on opponent", battle.hazards && battle.hazards.opponent && battle.hazards.opponent.sticky_web === true);
}

console.log("=== BATCH 17 — Final Stubs ===");
{
  const { battle } = newBattle('nosferatu', 'overgrow');
  const r = fire(battle, 'player', 'onModifyDamage', { move: { ...MOVES.tackle, flags: ['contact'] }, damage: 100, effectiveness: 1 });
  check("Nosferatu +20% on contact", r && r.damage === 120);
}
{
  const { battle, p1 } = newBattle('hellblaze', 'overgrow');
  const r1 = fire(battle, 'player', 'onModifyDamage', { move: { type: 'fire' }, damage: 100, effectiveness: 1 });
  check("Hellblaze 1.3x fire at full HP", r1 && r1.damage === 130);
  p1.takeDamage(80);
  const r2 = fire(battle, 'player', 'onModifyDamage', { move: { type: 'fire' }, damage: 100, effectiveness: 1 });
  check("Hellblaze 1.8x fire below 1/3", r2 && r2.damage === 180, `got ${r2?.damage}`);
}
{
  const { battle } = newBattle('gravity_well', 'overgrow');
  const r = fire(battle, 'player', 'onSwitchIn');
  check("Gravity Well sets gravity", r && r.effects && r.effects[0].field === 'gravity');
}
{
  const { battle } = newBattle('well_baked_body', 'overgrow');
  const r = fire(battle, 'player', 'onModifyIncomingDamage', { move: { type: 'fire' }, damage: 100, effectiveness: 1 });
  check("Well-Baked Body halves fire", r && r.damage === 50);
  check("Well-Baked Body +2 def on fire hit", r && r.effects && r.effects[0].stages === 2);
}
{
  const { battle } = newBattle('toxic_spill', 'overgrow');
  fire(battle, 'player', 'onSwitchIn');
  check("Toxic Spill sets toxic spikes (2 layers)", battle.hazards && battle.hazards.opponent && battle.hazards.opponent.toxic_spikes === 2);
}
{
  const { battle, p1 } = newBattle('overgrow', 'pretty_princess');
  p1.statStages.atk = -1;
  const r = fire(battle, 'opponent', 'onModifyDamage', { move: MOVES.tackle, damage: 100, effectiveness: 1 });
  check("Pretty Princess +50% vs lowered-stat foe", r && r.damage === 150);
}

console.log("=== BATCH 18 — Auto -> Full Upgrades ===");
{
  const { battle } = newBattle('sand_song', 'overgrow');
  const r = fire(battle, 'player', 'onModifyMoveType', { move: { type: 'normal', flags: ['sound'] } });
  check("Sand Song: sound -> ground", r && r.newType === 'ground');
}
{
  const { battle } = newBattle('amplifier', 'overgrow');
  const r = fire(battle, 'player', 'onModifyDamage', { move: { type: 'normal', flags: ['sound'] }, damage: 100, effectiveness: 1 });
  check("Amplifier 1.3x sound", r && r.damage === 130);
}
{
  const { battle, p1 } = newBattle('sun_worship', 'overgrow');
  p1.stats = { ...p1.stats, atk: 200, spe: 150 };
  battle.weather = 'sun';
  const r = fire(battle, 'player', 'onSwitchIn');
  check("Sun Worship boosts highest stat (atk) in sun", r && r.effects && r.effects[0].stat === 'atk');
}
{
  const { battle } = newBattle('parry', 'overgrow');
  const r = fire(battle, 'player', 'onModifyIncomingDamage', { move: { ...MOVES.tackle, flags: ['contact'] }, damage: 100, effectiveness: 1 });
  check("Parry 0.8x contact damage", r && r.damage === 80);
}
{
  const { battle, p2 } = newBattle('marine_apex', 'overgrow');
  p2.species.types = ['water'];
  const r = fire(battle, 'player', 'onModifyDamage', { move: MOVES.tackle, damage: 100, effectiveness: 1 });
  check("Marine Apex 1.5x vs water", r && r.damage === 150);
}
{
  const { battle } = newBattle('precise_fist', 'overgrow');
  const r = fire(battle, 'player', 'onCriticalCheck', { move: { flags: ['punch'], power: 80 }, defender: false });
  check("Precise Fist +1 crit on punching", r && r.critStages === 1);
}
{
  const { battle } = newBattle('giant_wings', 'overgrow');
  const r = fire(battle, 'player', 'onModifyDamage', { move: { id: 'hurricane', type: 'flying', flags: ['wind'] }, damage: 100, effectiveness: 1 });
  check("Giant Wings 1.25x wind moves", r && r.damage === 125);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
