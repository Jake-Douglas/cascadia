// Test batches 1-2: stat-on-entry abilities + status immunities

import { FakemonInstance } from '../js/entities/FakemonInstance.js';
import { BattleEngine } from '../js/systems/battleEngine.js';

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

let pass = 0, fail = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  PASS  ${label}`); pass++; }
  else    { console.log(`  FAIL  ${label}  ${detail}`); fail++; }
}

console.log("\n=== BATCH 1: STAT-ON-ENTRY ===\n");

{ const { battle } = newBattle('drizzle', 'overgrow');
  check("Drizzle sets rain", battle.weather === 'rain', `weather=${battle.weather}`); }

{ const { battle } = newBattle('drought', 'overgrow');
  check("Drought sets sun", battle.weather === 'sun', `weather=${battle.weather}`); }

{ const { battle } = newBattle('sand_stream', 'overgrow');
  check("Sand Stream sets sand", battle.weather === 'sand', `weather=${battle.weather}`); }

{ const { battle } = newBattle('snow_warning', 'overgrow');
  check("Snow Warning sets snow", battle.weather === 'snow', `weather=${battle.weather}`); }

{ const { battle } = newBattle('electric_surge', 'overgrow');
  check("Electric Surge sets terrain", battle.terrain === 'electric', `terrain=${battle.terrain}`); }

{ const { battle } = newBattle('grassy_surge', 'overgrow');
  check("Grassy Surge sets terrain", battle.terrain === 'grassy', `terrain=${battle.terrain}`); }

// Download — facing high-Def opponent should boost SpAtk
{ const downloader = makeMon('download', { nickname: 'DL' });
  const target = new FakemonInstance(1, { level: 50, nickname: 'Wall' });
  target.stats = { ...target.stats, def: 250, spDef: 50 };
  const battle = new BattleEngine({
    player: { team: [downloader], activeIndex: 0 },
    opponent: { team: [target], activeIndex: 0, isWild: true },
    onLog: () => {}
  });
  check("Download vs high-Def boosts SpAtk", downloader.statStages.spAtk === 1, `spAtk=${downloader.statStages.spAtk}`);
}

// Download — facing high-SpDef should boost Atk
{ const downloader = makeMon('download', { nickname: 'DL' });
  const target = new FakemonInstance(1, { level: 50, nickname: 'SpWall' });
  target.stats = { ...target.stats, def: 50, spDef: 250 };
  const battle = new BattleEngine({
    player: { team: [downloader], activeIndex: 0 },
    opponent: { team: [target], activeIndex: 0, isWild: true },
    onLog: () => {}
  });
  check("Download vs high-SpDef boosts Atk", downloader.statStages.atk === 1, `atk=${downloader.statStages.atk}`);
}

console.log("\n=== BATCH 2: STATUS IMMUNITIES ===\n");

const statusTests = [
  ['insomnia', 'sleep', true],
  ['insomnia', 'burn', false],
  ['vital_spirit', 'sleep', true],
  ['limber', 'paralysis', true],
  ['limber', 'burn', false],
  ['immunity', 'poison', true],
  ['water_veil', 'burn', true],
  ['water_veil', 'poison', false],
  ['magma_armor', 'freeze', true],
  ['oblivious', 'infatuation', true],
  ['own_tempo', 'confusion', true],
];

for (const [ability, status, shouldBlock] of statusTests) {
  const { battle, p1 } = newBattle(ability, 'overgrow');
  battle.applyStatus(p1, status);
  const blocked = p1.status !== status;
  const correct = blocked === shouldBlock;
  check(`${ability} ${shouldBlock ? 'blocks' : 'allows'} ${status}`, correct, `status=${p1.status}`);
}

// Comatose blocks all 5 major statuses
{ const { battle, p1 } = newBattle('comatose', 'overgrow');
  let allBlocked = true;
  for (const s of ['burn','poison','paralysis','sleep','freeze']) {
    p1.status = null;
    battle.applyStatus(p1, s);
    if (p1.status === s) { allBlocked = false; break; }
  }
  check("Comatose blocks all major status", allBlocked);
}

console.log("\n=== BATCH 3: ON-CONTACT EFFECTS ===\n");

// Mock-fire the contact hook directly to test the logic
import { ABILITIES } from '../js/data/abilities.js';

{ const { battle, p1, p2 } = newBattle('rough_skin', 'overgrow');
  const startHP = p2.currentHP;
  // Call the hook directly with mock damage move
  const hook = ABILITIES['rough_skin'].onTakeContact;
  hook({ attacker: p2, defender: p1, move: { flags: ['contact'] }, damage: 10, battle });
  const expectedDmg = Math.max(1, Math.floor(p2.stats.hp / 8));
  check("Rough Skin damages attacker", p2.currentHP === startHP - expectedDmg, `HP: ${startHP}->${p2.currentHP}`);
}

{ const { battle, p1, p2 } = newBattle('iron_barbs', 'overgrow');
  const startHP = p2.currentHP;
  ABILITIES['iron_barbs'].onTakeContact({ attacker: p2, defender: p1, move: { flags: ['contact'] }, damage: 10, battle });
  const expectedDmg = Math.max(1, Math.floor(p2.stats.hp / 8));
  check("Iron Barbs damages attacker", p2.currentHP === startHP - expectedDmg);
}

console.log("\n=== BATCH 4: TYPE/FLAG DAMAGE BOOSTERS ===\n");

{ const { battle, p1, p2 } = newBattle('tough_claws', 'overgrow');
  const result = ABILITIES['tough_claws'].onModifyDamage({ user: p1, target: p2, move: { flags: ['contact'], type: 'normal' }, damage: 100 });
  check("Tough Claws boosts contact 1.3x", result && Math.abs(result.damage - 130) < 0.1, `damage=${result?.damage}`);
}

{ const { battle, p1, p2 } = newBattle('tough_claws', 'overgrow');
  const result = ABILITIES['tough_claws'].onModifyDamage({ user: p1, target: p2, move: { flags: [], type: 'normal' }, damage: 100 });
  check("Tough Claws does NOT boost non-contact", !result, `result=${JSON.stringify(result)}`);
}

{ const { battle, p1, p2 } = newBattle('strong_jaw', 'overgrow');
  const result = ABILITIES['strong_jaw'].onModifyDamage({ user: p1, target: p2, move: { flags: ['biting'], type: 'dark' }, damage: 100 });
  check("Strong Jaw boosts biting 1.5x", result && Math.abs(result.damage - 150) < 0.1);
}

{ const { battle, p1, p2 } = newBattle('punk_rock', 'overgrow');
  const result = ABILITIES['punk_rock'].onModifyDamage({ user: p1, target: p2, move: { flags: ['sound'], type: 'normal' }, damage: 100 });
  check("Punk Rock boosts sound 1.3x outgoing", result && Math.abs(result.damage - 130) < 0.1);
  const result2 = ABILITIES['punk_rock'].onModifyIncomingDamage({ user: p1, move: { flags: ['sound'], type: 'normal' }, damage: 100 });
  check("Punk Rock halves incoming sound", result2 && Math.abs(result2.damage - 50) < 0.1);
}

{ const { battle, p1, p2 } = newBattle('reckless', 'overgrow');
  const result = ABILITIES['reckless'].onModifyDamage({ user: p1, target: p2, move: { recoil: 0.33 }, damage: 100 });
  check("Reckless boosts recoil moves 1.2x", result && Math.abs(result.damage - 120) < 0.1);
}

console.log("\n=== BATCH 5: -ATE TYPE CHANGERS ===\n");

{ const { battle, p1, p2 } = newBattle('pixilate', 'overgrow');
  const result = ABILITIES['pixilate'].onModifyMoveType({ user: p1, target: p2, move: { type: 'normal' }, battle });
  check("Pixilate converts Normal to Fairy", result && result.newType === 'fairy');
}

{ const { battle, p1, p2 } = newBattle('aerilate', 'overgrow');
  const result = ABILITIES['aerilate'].onModifyMoveType({ user: p1, target: p2, move: { type: 'normal' }, battle });
  check("Aerilate converts Normal to Flying", result && result.newType === 'flying');
}

{ const { battle, p1, p2 } = newBattle('refrigerate', 'overgrow');
  const result = ABILITIES['refrigerate'].onModifyMoveType({ user: p1, target: p2, move: { type: 'fire' }, battle });
  check("Refrigerate does NOT change non-Normal moves", !result);
}

console.log("\n=== BATCH 6: WEATHER SPEED ===\n");

// Set up battle with rain weather, then test Swift Swim modifier query
{ const { battle, p1, p2 } = newBattle('swift_swim', 'overgrow');
  battle.weather = 'rain';
  const baseSpeed = p1.effectiveStat('spe');
  const boostedSpeed = p1.effectiveStat('spe', battle);
  check("Swift Swim 1.5x speed in rain", boostedSpeed === Math.floor(baseSpeed * 1.5), `${baseSpeed} -> ${boostedSpeed}`);
}

{ const { battle, p1, p2 } = newBattle('swift_swim', 'overgrow');
  battle.weather = null;
  const baseSpeed = p1.effectiveStat('spe');
  const querySpeed = p1.effectiveStat('spe', battle);
  check("Swift Swim no boost without rain", querySpeed === baseSpeed);
}

{ const { battle, p1, p2 } = newBattle('chlorophyll', 'overgrow');
  battle.weather = 'sun';
  const baseSpeed = p1.effectiveStat('spe');
  const boostedSpeed = p1.effectiveStat('spe', battle);
  check("Chlorophyll 1.5x speed in sun", boostedSpeed === Math.floor(baseSpeed * 1.5));
}

{ const { battle, p1, p2 } = newBattle('huge_power', 'overgrow');
  const baseAtk = p1.effectiveStat('atk');
  const boostedAtk = p1.effectiveStat('atk', battle);
  check("Huge Power doubles Attack", boostedAtk === Math.floor(baseAtk * 2));
}

console.log("\n=== BATCH 7: END OF TURN ===\n");

{ const { battle, p1, p2 } = newBattle('speed_boost', 'overgrow');
  const before = p1.statStages.spe || 0;
  battle.fireAbilityHook('player', 'onEndOfTurn', { weather: null });
  check("Speed Boost +1 spe at EoT", p1.statStages.spe === before + 1, `stage=${p1.statStages.spe}`);
}

{ const { battle, p1, p2 } = newBattle('rain_dish', 'overgrow');
  battle.weather = 'rain';
  p1.currentHP = Math.max(1, p1.stats.hp - 50);
  const before = p1.currentHP;
  battle.fireAbilityHook('player', 'onEndOfTurn', { weather: 'rain' });
  check("Rain Dish heals in rain", p1.currentHP > before, `${before} -> ${p1.currentHP}`);
}

{ const { battle, p1, p2 } = newBattle('defeatist', 'overgrow');
  p1.currentHP = Math.floor(p1.stats.hp / 3);  // below half
  const result = ABILITIES['defeatist'].onModifyDamage({ user: p1, target: p2, move: { type: 'normal' }, damage: 100 });
  check("Defeatist halves damage at low HP", result && Math.abs(result.damage - 50) < 0.1);
}

console.log("\n=== BATCH 8: CRIT & DAMAGE REDUCTION ===\n");

{ const { battle, p1, p2 } = newBattle('battle_armor', 'overgrow');
  const result = ABILITIES['battle_armor'].onCriticalCheck({ user: p2, target: p1, move: {}, defender: true });
  check("Battle Armor blocks crits", result && result.blockCrit);
}

{ const { battle, p1, p2 } = newBattle('super_luck', 'overgrow');
  const result = ABILITIES['super_luck'].onCriticalCheck({ user: p1, target: p2, move: {}, defender: false });
  check("Super Luck +1 crit stage on attack", result && result.critStages === 1);
}

{ const { battle, p1, p2 } = newBattle('multiscale', 'overgrow');
  // p1 at full HP
  const result = ABILITIES['multiscale'].onModifyIncomingDamage({ user: p1, move: { type: 'fire' }, damage: 100, effectiveness: 1 });
  check("Multiscale halves damage at full HP", result && Math.abs(result.damage - 50) < 0.1);
}

{ const { battle, p1, p2 } = newBattle('multiscale', 'overgrow');
  p1.currentHP = p1.stats.hp - 1;
  const result = ABILITIES['multiscale'].onModifyIncomingDamage({ user: p1, move: { type: 'fire' }, damage: 100, effectiveness: 1 });
  check("Multiscale does NOT halve below full HP", !result);
}

{ const { battle, p1, p2 } = newBattle('thick_fat', 'overgrow');
  const result = ABILITIES['thick_fat'].onModifyIncomingDamage({ user: p1, move: { type: 'fire' }, damage: 100 });
  check("Thick Fat halves Fire damage", result && Math.abs(result.damage - 50) < 0.1);
  const result2 = ABILITIES['thick_fat'].onModifyIncomingDamage({ user: p1, move: { type: 'water' }, damage: 100 });
  check("Thick Fat does NOT halve Water damage", !result2);
}

{ const { battle, p1, p2 } = newBattle('water_bubble', 'overgrow');
  const out = ABILITIES['water_bubble'].onModifyDamage({ user: p1, target: p2, move: { type: 'water' }, damage: 100 });
  check("Water Bubble doubles own Water moves", out && Math.abs(out.damage - 200) < 0.1);
  const inFire = ABILITIES['water_bubble'].onModifyIncomingDamage({ user: p1, move: { type: 'fire' }, damage: 100 });
  check("Water Bubble halves incoming Fire", inFire && Math.abs(inFire.damage - 50) < 0.1);
  const burn = ABILITIES['water_bubble'].onTryStatus({ user: p1, status: 'burn' });
  check("Water Bubble immune to burn", burn && burn.blocked);
}

console.log("\n=== BATCH 9: SWITCH-OUT & UTILITY ===\n");

{ const { battle, p1, p2 } = newBattle('regenerator', 'overgrow');
  p1.currentHP = Math.floor(p1.stats.hp / 2);
  const before = p1.currentHP;
  // Manually call switch-out hook
  ABILITIES['regenerator'].onSwitchOut({ user: p1, battle });
  const expected = before + Math.floor(p1.stats.hp / 3);
  check("Regenerator heals 1/3 on switch out", p1.currentHP === Math.min(p1.stats.hp, expected));
}

{ const { battle, p1, p2 } = newBattle('natural_cure', 'overgrow');
  p1.status = 'burn';
  ABILITIES['natural_cure'].onSwitchOut({ user: p1, battle });
  check("Natural Cure heals status on switch", p1.status === null);
}

{ const { battle, p1, p2 } = newBattle('soundproof', 'overgrow');
  const result = ABILITIES['soundproof'].onModifyIncomingDamage({ user: p1, move: { flags: ['sound'], type: 'normal' }, damage: 100 });
  check("Soundproof immune to sound moves", result && result.immune);
}

{ const { battle, p1, p2 } = newBattle('dazzling', 'overgrow');
  const result = ABILITIES['dazzling'].onModifyIncomingDamage({ user: p1, move: { priority: 1 }, damage: 100 });
  check("Dazzling blocks priority moves", result && result.immune);
  const result2 = ABILITIES['dazzling'].onModifyIncomingDamage({ user: p1, move: { priority: 0 }, damage: 100 });
  check("Dazzling does NOT block normal moves", !result2);
}

{ const { battle, p1, p2 } = newBattle('wonder_guard', 'overgrow');
  const result = ABILITIES['wonder_guard'].onModifyIncomingDamage({ user: p1, move: { power: 80 }, damage: 100, effectiveness: 1 });
  check("Wonder Guard blocks neutral hits", result && result.immune);
  const result2 = ABILITIES['wonder_guard'].onModifyIncomingDamage({ user: p1, move: { power: 80 }, damage: 100, effectiveness: 2 });
  check("Wonder Guard allows super effective hits", !result2);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);

