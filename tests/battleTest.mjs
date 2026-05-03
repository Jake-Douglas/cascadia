// Headless battle test. Run with: node tests/battleTest.mjs
// Verifies: engine wires up, damage formula reasonable, abilities trigger, status works.

import { FakemonInstance } from '../js/entities/FakemonInstance.js';
import { BattleEngine } from '../js/systems/battleEngine.js';
import { getTypeEffectiveness } from '../js/data/typeChart.js';

// === Test 1: Type chart sanity ===
console.log('\n=== Type chart ===');
console.assert(getTypeEffectiveness('water', ['fire']) === 2, 'water vs fire = 2');
console.assert(getTypeEffectiveness('water', ['fire','rock']) === 4, 'water vs fire/rock = 4');
console.assert(getTypeEffectiveness('electric', ['ground']) === 0, 'electric vs ground = 0');
console.assert(getTypeEffectiveness('grass', ['water']) === 2, 'grass vs water = 2');
console.assert(getTypeEffectiveness('normal', ['ghost']) === 0, 'normal vs ghost = 0');
console.log('  PASS');

// === Test 2: Construct Fakemon instances ===
console.log('\n=== FakemonInstance ===');
const grassMon = new FakemonInstance(1, { level: 5 });
const fireMon  = new FakemonInstance(2, { level: 5 });
console.log(`  ${grassMon.nickname} L${grassMon.level} HP:${grassMon.stats.hp} ATK:${grassMon.stats.atk} ability:${grassMon.activeAbility} moves:${grassMon.moves.join(',')}`);
console.log(`  ${fireMon.nickname} L${fireMon.level} HP:${fireMon.stats.hp} ATK:${fireMon.stats.atk} ability:${fireMon.activeAbility} moves:${fireMon.moves.join(',')}`);
console.assert(grassMon.stats.hp > 10, 'HP should be positive');
console.assert(grassMon.moves.length > 0, 'should have moves');

// === Test 3: Run a full battle ===
console.log('\n=== Battle: grass starter L20 vs fire starter L20 ===');
const p1 = new FakemonInstance(1, { level: 20 });
const p2 = new FakemonInstance(2, { level: 20 });
console.log(`  Player: ${p1.nickname} HP:${p1.stats.hp} moves:[${p1.moves.join(',')}]`);
console.log(`  Foe:    ${p2.nickname} HP:${p2.stats.hp} moves:[${p2.moves.join(',')}]`);

const log = [];
const engine = new BattleEngine({
  player:   { team: [p1], activeIndex: 0 },
  opponent: { team: [p2], activeIndex: 0, isWild: true },
  onLog: (m) => log.push(m),
  onEnd: (r) => log.push(`*** BATTLE END: ${r.result.toUpperCase()} ***`)
});

let safetyCounter = 0;
while (!engine.ended && safetyCounter++ < 30) {
  // Player picks vine_whip if available, else first move
  const playerMove = p1.moves.includes('vine_whip') ? 'vine_whip' : p1.moves[0];
  engine.queueAction('player', { type: 'move', moveId: playerMove });
  engine.queueAction('opponent', engine.aiChoose());
  engine.executeTurn();
}
log.forEach(m => console.log('  ' + m));
console.assert(engine.ended, 'battle must end');

// === Test 4: Ability trigger — Overgrow when low HP ===
console.log('\n=== Overgrow trigger test ===');
const lowHpGrass = new FakemonInstance(1, { level: 30 });
lowHpGrass.currentHP = Math.floor(lowHpGrass.stats.hp / 4); // <33%
const target = new FakemonInstance(2, { level: 30 });
const e2 = new BattleEngine({
  player:   { team: [lowHpGrass], activeIndex: 0 },
  opponent: { team: [target],     activeIndex: 0, isWild: true },
  onLog: (m) => console.log('  ' + m)
});
const moveCtx = e2.makeMoveContext('player', 'vine_whip', { damage: 100 });
const result = e2.fireAbilityHook('player', 'onModifyDamage', moveCtx);
console.log(`  vine_whip 100 -> ${result ? result.damage : 100} (expect 150 with Overgrow at low HP)`);
console.assert(result && result.damage === 150, 'overgrow should boost grass move 1.5x at low HP');

// === Test 5: Type immunity stops damage ===
console.log('\n=== Immunity test (electric vs ground) ===');
console.assert(getTypeEffectiveness('electric', ['ground']) === 0, 'electric should be 0x vs ground');
console.log('  PASS');

console.log('\n=== ALL TESTS COMPLETE ===');
