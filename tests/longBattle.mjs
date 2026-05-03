import { FakemonInstance } from '../js/entities/FakemonInstance.js';
import { BattleEngine } from '../js/systems/battleEngine.js';

const a = new FakemonInstance(1, { level: 25 });
const b = new FakemonInstance(1, { level: 25, nickname: "Foe" });
console.log(`A HP=${a.stats.hp} moves=${a.moves} ability=${a.activeAbility}`);
console.log(`B HP=${b.stats.hp} moves=${b.moves} ability=${b.activeAbility}`);

const engine = new BattleEngine({
  player: { team: [a], activeIndex: 0 },
  opponent: { team: [b], activeIndex: 0, isWild: true },
  onLog: () => {},
  onEnd: (r) => console.log(`Battle ended: ${r.result}`)
});

let turns = 0;
while (!engine.ended && turns < 50) {
  engine.queueAction('player', { type: 'move', moveId: a.moves.find(m => m === 'razor_leaf') || a.moves[0] });
  engine.queueAction('opponent', engine.aiChoose());
  engine.executeTurn();
  turns++;
}
console.log(`Total turns: ${turns}`);
console.log(`A: HP ${a.currentHP}/${a.stats.hp}`);
console.log(`B: HP ${b.currentHP}/${b.stats.hp}`);
