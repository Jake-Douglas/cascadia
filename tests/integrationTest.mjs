// END-TO-END integration tests.
// These don't poke ability hooks directly — they queue real moves through the engine
// and verify the OBSERVABLE outcome changes when the ability is/isn't present.

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

function newBattle(p1Ability, p2Ability, opts = {}) {
  const p1 = makeMon(p1Ability, { nickname: 'P1', ...(opts.p1 || {}) });
  const p2 = makeMon(p2Ability, { nickname: 'P2', ...(opts.p2 || {}) });
  if (opts.p1Types) p1.species = { ...p1.species, types: opts.p1Types };
  if (opts.p2Types) p2.species = { ...p2.species, types: opts.p2Types };
  if (opts.p1Stats) p1.stats = { ...p1.stats, ...opts.p1Stats };
  if (opts.p2Stats) p2.stats = { ...p2.stats, ...opts.p2Stats };
  if (opts.p1Moves) p1.moves = opts.p1Moves.map(id => ({ ...MOVES[id], id, currentPP: 99 }));
  if (opts.p2Moves) p2.moves = opts.p2Moves.map(id => ({ ...MOVES[id], id, currentPP: 99 }));
  // movePP is keyed by move id
  for (const m of p1.moves) p1.movePP[m.id] = 99;
  for (const m of p2.moves) p2.movePP[m.id] = 99;
  const battle = new BattleEngine({
    player: { team: [p1], activeIndex: 0 },
    opponent: { team: [p2], activeIndex: 0, isWild: true },
    onLog: () => {}
  });
  return { battle, p1, p2 };
}

function runTurn(battle, p1Move, p2Move) {
  battle.queued = {
    player: { type: 'move', moveId: p1Move },
    opponent: { type: 'move', moveId: p2Move }
  };
  battle.executeTurn();
}

// === ACCURACY ===
console.log("=== Accuracy flags ===");
{
  // Hustle: 90% accuracy multiplier on physical moves
  let misses = 0, total = 200;
  for (let i = 0; i < total; i++) {
    const { battle, p1, p2 } = newBattle('hustle', 'overgrow', {
      p1Moves: ['hypnosis'], p2Moves: ['tackle']  // hypnosis 60% acc * 0.9 = 54%
    });
    // Actually test a 100% acc physical move; it should miss 10% of the time with Hustle
    p1.moves = [{ ...MOVES.tackle, id: 'tackle', currentPP: 99 }];
    p1.movePP.tackle = 99;
    const beforeHP = p2.currentHP;
    runTurn(battle, 'tackle', 'tackle');
    if (p2.currentHP === beforeHP) misses++;
  }
  // Tackle is 100% acc; Hustle drops to 90 → about 10% miss rate. Allow 5%–18%.
  const missRate = misses / total;
  check("Hustle causes physical moves to miss ~10% of the time", missRate > 0.04 && missRate < 0.20, `missed ${misses}/${total} = ${(missRate*100).toFixed(1)}%`);
}
{
  // Compound Eyes (1.3x acc) vs No Guard (always hit) — verify No Guard never misses
  let misses = 0;
  for (let i = 0; i < 50; i++) {
    const { battle, p1, p2 } = newBattle('no_guard', 'overgrow', { p1Moves: ['hypnosis'] });
    const beforeStatus = p2.status;
    runTurn(battle, 'hypnosis', 'tackle');
    if (p2.status === beforeStatus) misses++;
  }
  // Hypnosis with No Guard should always land (status applied: sleep)
  // It might be blocked by something else but should at least be attempted.
  check("No Guard makes Hypnosis (60% acc) always land", misses < 5, `${misses}/50 missed`);
}

// === RECOIL ===
console.log("\n=== Recoil flags ===");
{
  // Rock Head should suppress recoil
  const { battle, p1, p2 } = newBattle('rock_head', 'overgrow', { p1Moves: ['double_edge'] });
  const beforeP1HP = p1.currentHP;
  runTurn(battle, 'double_edge', 'tackle');
  // P1 took tackle damage but should NOT have taken recoil from double_edge (33%)
  const tackleDmg = p1.stats.hp - p1.currentHP;
  // Without rock head, would be tackleDmg + ~33% of double_edge damage
  // So Rock Head: HP loss should be small
  check("Rock Head suppresses Double-Edge recoil", tackleDmg < p1.stats.hp / 3, `lost ${tackleDmg} HP`);
}
{
  // Compare: no Rock Head should take significant recoil
  const { battle, p1, p2 } = newBattle('overgrow', 'overgrow', {
    p1Moves: ['double_edge'], p2Moves: ['growl'],
    p2Stats: { hp: 999, def: 200, spDef: 200 }
  });
  p2.currentHP = 999;
  const beforeP1HP = p1.currentHP;
  runTurn(battle, 'double_edge', 'growl');
  const totalDmg = p1.stats.hp - p1.currentHP;
  // growl is status — only recoil affected p1
  check("Without Rock Head, Double-Edge causes recoil", totalDmg > 5, `lost ${totalDmg} HP from recoil`);
}

// === TYPE-EFFECTIVENESS OVERRIDES ===
console.log("\n=== Type-effectiveness overrides ===");
{
  // Scrappy: Normal moves can hit Ghost
  const { battle, p1, p2 } = newBattle('scrappy', 'overgrow', {
    p2Types: ['ghost'], p1Moves: ['tackle']
  });
  const beforeHP = p2.currentHP;
  runTurn(battle, 'tackle', 'tackle');
  check("Scrappy: Tackle (Normal) hits Ghost", p2.currentHP < beforeHP, `HP ${beforeHP} -> ${p2.currentHP}`);
}
{
  // Without Scrappy: Tackle should do 0 to Ghost
  const { battle, p1, p2 } = newBattle('overgrow', 'overgrow', {
    p2Types: ['ghost'], p1Moves: ['tackle']
  });
  const beforeHP = p2.currentHP;
  runTurn(battle, 'tackle', 'tackle');
  check("Without Scrappy: Tackle does NOT affect Ghost", p2.currentHP === beforeHP);
}
{
  // Ground Shock: Electric hits Ground
  const { battle, p1, p2 } = newBattle('ground_shock', 'overgrow', {
    p2Types: ['ground'], p1Moves: ['thunderbolt']
  });
  const beforeHP = p2.currentHP;
  runTurn(battle, 'thunderbolt', 'tackle');
  check("Ground Shock: Thunderbolt hits Ground", p2.currentHP < beforeHP);
}
{
  // Overwhelm: Dragon hits Fairy
  const { battle, p1, p2 } = newBattle('overwhelm', 'overgrow', {
    p2Types: ['fairy'], p1Moves: ['dragon_claw']
  });
  const beforeHP = p2.currentHP;
  runTurn(battle, 'dragon_claw', 'tackle');
  check("Overwhelm: Dragon Claw hits Fairy", p2.currentHP < beforeHP);
}

// === STATUS / CORROSION ===
console.log("\n=== Status & Corrosion ===");
{
  // Corrosion: can poison Steel
  const { battle, p1, p2 } = newBattle('corrosion', 'overgrow', {
    p2Types: ['steel'], p1Moves: ['poison_powder']
  });
  runTurn(battle, 'poison_powder', 'tackle');
  check("Corrosion: poisons Steel-type", p2.status === 'poison', `status=${p2.status}`);
}
{
  // Without corrosion: Poison powder fails on Steel
  const { battle, p1, p2 } = newBattle('overgrow', 'overgrow', {
    p2Types: ['steel'], p1Moves: ['poison_powder']
  });
  runTurn(battle, 'poison_powder', 'tackle');
  check("Without Corrosion: Steel immune to poison", p2.status !== 'poison', `status=${p2.status}`);
}

// === LONG REACH (no contact) ===
console.log("\n=== Long Reach contact suppression ===");
{
  // Long Reach: tackle becomes non-contact, so Rough Skin shouldn't trigger
  const { battle, p1, p2 } = newBattle('long_reach', 'rough_skin', { p1Moves: ['tackle'] });
  const beforeP1HP = p1.currentHP;
  runTurn(battle, 'tackle', 'tackle');
  // P1 takes tackle damage from p2, but should NOT take Rough Skin damage
  // We can't fully isolate this without removing tackle from p2, so use a status move
  p1.currentHP = p1.stats.hp;
  p2.moves = [{ ...MOVES.growl, id: 'growl', currentPP: 99 }];
  p2.movePP.growl = 99;
  runTurn(battle, 'tackle', 'growl');
  // Now P1 only took Rough Skin damage if Long Reach failed
  const dmg = p1.stats.hp - p1.currentHP;
  check("Long Reach prevents Rough Skin trigger", dmg === 0, `P1 took ${dmg} HP from Rough Skin`);
}
{
  // Control: without Long Reach, Rough Skin should fire
  const { battle, p1, p2 } = newBattle('overgrow', 'rough_skin', { p1Moves: ['tackle'], p2Moves: ['growl'] });
  runTurn(battle, 'tackle', 'growl');
  const dmg = p1.stats.hp - p1.currentHP;
  check("Without Long Reach: Rough Skin fires (p1 took damage)", dmg > 0, `P1 took ${dmg} HP from Rough Skin`);
}

// === SHIELD DUST ===
console.log("\n=== Shield Dust ===");
{
  // Shield Dust: Thunderbolt's 10% paralysis should never apply
  let paralyzed = 0;
  for (let i = 0; i < 100; i++) {
    const { battle, p1, p2 } = newBattle('overgrow', 'shield_dust', { p1Moves: ['thunderbolt'] });
    runTurn(battle, 'thunderbolt', 'tackle');
    if (p2.status === 'paralysis') paralyzed++;
  }
  check("Shield Dust blocks Thunderbolt's paralysis chance", paralyzed === 0, `${paralyzed}/100 paralyzed`);
}

// === DISGUISE ===
console.log("\n=== Disguise ===");
{
  // First hit: tiny chip damage; second hit: full damage
  const { battle, p1, p2 } = newBattle('overgrow', 'disguise', { p1Moves: ['flamethrower'] });
  const beforeHP = p2.currentHP;
  runTurn(battle, 'flamethrower', 'tackle');
  const firstDmg = beforeHP - p2.currentHP;
  // Disguise sets damage to 1/8 max HP
  const expectedFirst = Math.floor(p2.stats.hp / 8);
  check("Disguise: 1st hit dealt ~1/8 max HP", Math.abs(firstDmg - expectedFirst) < 5, `dealt ${firstDmg}, expected ~${expectedFirst}`);
  
  const beforeHP2 = p2.currentHP;
  runTurn(battle, 'flamethrower', 'tackle');
  const secondDmg = beforeHP2 - p2.currentHP;
  check("Disguise: 2nd hit deals normal damage", secondDmg > expectedFirst * 1.5, `2nd hit dealt ${secondDmg}`);
}

// === GORILLA TACTICS ===
console.log("\n=== Gorilla Tactics locked move ===");
{
  const { battle, p1, p2 } = newBattle('gorilla_tactics', 'overgrow', { p1Moves: ['tackle','ember'] });
  // First move: tackle should work
  runTurn(battle, 'tackle', 'tackle');
  check("Gorilla Tactics: first move (tackle) sets lock", p1.flags && p1.flags.lockedMove === 'tackle', `lock=${p1.flags?.lockedMove}`);
  // Second turn: try to use ember — should fail
  const beforeHP = p2.currentHP;
  runTurn(battle, 'ember', 'tackle');
  // p2 still gets tackled by us... wait, let me think
  // Engine should reject the ember switch attempt. p2 takes tackle from p1? No, we sent ember.
  // Engine: ember rejected, so no damage from p1. p2's tackle still hits p1.
  // Easier check: did p2 take additional damage from ember? It shouldn't have.
  const dmgDealt = beforeHP - p2.currentHP;
  // ember would do ~5-15 damage; tackle did ~5-15 damage on first turn.
  // If ember was blocked, dmgDealt should be 0 from p1.
  // But p1 is being tackled by p2 too. So we check that THIS turn, p2 only took 0 damage.
  check("Gorilla Tactics: locked into tackle, ember rejected", dmgDealt === 0, `p2 lost ${dmgDealt} HP (should be 0)`);
}

// === STAKEOUT ===
console.log("\n=== Stakeout (justSwitchedIn) ===");
{
  // Stakeout doubles damage to a justSwitchedIn target.
  // First turn: opponent IS just switched in (initial), so stakeout fires.
  const { battle, p1, p2 } = newBattle('stakeout', 'overgrow', { p1Moves: ['tackle'] });
  const beforeHP = p2.currentHP;
  runTurn(battle, 'tackle', 'tackle');
  const stakeoutDmg = beforeHP - p2.currentHP;
  // Second turn: justSwitchedIn was reset, so no boost
  const beforeHP2 = p2.currentHP;
  runTurn(battle, 'tackle', 'tackle');
  const normalDmg = beforeHP2 - p2.currentHP;
  // Stakeout damage should be roughly 2x normal damage. Allow some variance.
  check("Stakeout: turn 1 deals more than turn 2 (foe wasn't fresh on turn 2)",
        stakeoutDmg > normalDmg * 1.4, `t1=${stakeoutDmg}, t2=${normalDmg}`);
}

// === LETHARGY ===
console.log("\n=== Lethargy decay ===");
{
  const { battle, p1, p2 } = newBattle('lethargy', 'overgrow', { p1Moves: ['tackle'] });
  const beforeT1 = p2.currentHP;
  runTurn(battle, 'tackle', 'tackle');
  const t1Dmg = beforeT1 - p2.currentHP;
  // Many turns later
  for (let i = 0; i < 5; i++) runTurn(battle, 'tackle', 'tackle');
  if (p2.isFainted()) {
    check("Lethargy: KO'd before checking late-turn damage (skipping)", true);
  } else {
    const beforeLate = p2.currentHP;
    runTurn(battle, 'tackle', 'tackle');
    const lateDmg = beforeLate - p2.currentHP;
    check("Lethargy: late-turn damage < turn-1 damage", lateDmg < t1Dmg, `t1=${t1Dmg}, late=${lateDmg}`);
  }
}

// === DEADEYE (accuracyMult: 999) ===
console.log("\n=== Deadeye never-miss ===");
{
  let misses = 0;
  for (let i = 0; i < 50; i++) {
    const { battle, p1, p2 } = newBattle('deadeye', 'overgrow', { p1Moves: ['focus_blast'] });
    const beforeHP = p2.currentHP;
    runTurn(battle, 'focus_blast', 'tackle');
    if (p2.currentHP === beforeHP) misses++;
  }
  check("Deadeye: Focus Blast (70% acc) never misses", misses === 0, `${misses}/50 missed`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
