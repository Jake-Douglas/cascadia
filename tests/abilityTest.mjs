import { FakemonInstance } from '../js/entities/FakemonInstance.js';
import { BattleEngine } from '../js/systems/battleEngine.js';

// Force a specific ability for testing
const attacker = new FakemonInstance(1, { level: 30, ability: 'overgrow' });
const defender = new FakemonInstance(1, { level: 30, nickname: 'Defender' });
defender.species = { ...defender.species, abilityPool: ['fort_knox'], defaultAbility: 'fort_knox' };
defender.activeAbility = 'fort_knox';

console.log('=== Fort Knox test ===');
console.log(`Defender def stage before: ${defender.statStages.def}`);

const e = new BattleEngine({
  player: { team: [attacker], activeIndex: 0 },
  opponent: { team: [defender], activeIndex: 0, isWild: true },
  onLog: (m) => console.log('  ' + m)
});
// Manually trigger a stat-down on defender
e.changeStatStage(defender, 'atk', -1, 'Test');
console.log(`Defender def stage after attempted -atk: ${defender.statStages.def}`);
console.log(`Defender atk stage after attempted -atk: ${defender.statStages.atk}`);

console.log('\n=== Energy Siphon test ===');
const siphoner = new FakemonInstance(2, { level: 30 });
siphoner.activeAbility = 'energy_siphon';
const punchee = new FakemonInstance(1, { level: 30 });
siphoner.currentHP = 10; // low HP
const startHP = siphoner.currentHP;

const e2 = new BattleEngine({
  player: { team: [siphoner], activeIndex: 0 },
  opponent: { team: [punchee], activeIndex: 0, isWild: true },
  onLog: (m) => console.log('  ' + m)
});
e2.queueAction('player', { type: 'move', moveId: 'ember' });
e2.queueAction('opponent', { type: 'move', moveId: 'tackle' });
e2.executeTurn();
console.log(`Siphoner HP: ${startHP} -> ${siphoner.currentHP} (should heal from damage dealt)`);
