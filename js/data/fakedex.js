// Fakédex — every Fakemon. Slots 1-3 reserved for starters (designs TBD).

import { MOVES } from './moves.js';

export const FAKEDEX = {

  1: {
    id: 1,
    name: "Grass Starter",            // TODO: design
    types: ["grass"],
    baseStats: { hp: 45, atk: 49, def: 49, spAtk: 65, spDef: 65, spe: 45 },
    abilityPool: ["overgrow"],         // expand later, e.g. ["overgrow", "fog_walker"]
    defaultAbility: "overgrow",
    learnset: [
      { level: 1, move: "tackle" },
      { level: 1, move: "growl" },
      { level: 4, move: "absorb" },
      { level: 7, move: "vine_whip" },
      { level: 13, move: "razor_leaf" }
    ],
    evolution: { into: 2, method: "level", requirement: 16 },
    catchRate: 45, expYield: 64, growthRate: "medium-slow",
    height: 0.7, weight: 6.9, category: "Seed",
    region: "cascadia", habitat: ["starter"],
    dexEntry: "Placeholder dex entry. Will be written when design is locked.",
    sprites: { front: "fakemon/001_front.png", back: "fakemon/001_back.png", icon: "fakemon/001_icon.png" }
  },

  2: {
    id: 2,
    name: "Fire Starter",             // TODO: design
    types: ["fire"],
    baseStats: { hp: 39, atk: 52, def: 43, spAtk: 60, spDef: 50, spe: 65 },
    abilityPool: ["blaze"],
    defaultAbility: "blaze",
    learnset: [
      { level: 1, move: "scratch" },
      { level: 1, move: "growl" },
      { level: 7, move: "ember" },
      { level: 13, move: "flame_charge" }
    ],
    evolution: { into: 3, method: "level", requirement: 16 },
    catchRate: 45, expYield: 62, growthRate: "medium-slow",
    height: 0.6, weight: 8.5, category: "Lizard",
    region: "cascadia", habitat: ["starter"],
    dexEntry: "Placeholder dex entry.",
    sprites: { front: "fakemon/002_front.png", back: "fakemon/002_back.png", icon: "fakemon/002_icon.png" }
  },

  3: {
    id: 3,
    name: "Water Starter",            // TODO: design
    types: ["water"],
    baseStats: { hp: 44, atk: 48, def: 65, spAtk: 50, spDef: 64, spe: 43 },
    abilityPool: ["torrent"],
    defaultAbility: "torrent",
    learnset: [
      { level: 1, move: "tackle" },
      { level: 1, move: "tail_whip" },
      { level: 4, move: "bubble" },
      { level: 7, move: "water_gun" }
    ],
    evolution: { into: 4, method: "level", requirement: 16 },
    catchRate: 45, expYield: 63, growthRate: "medium-slow",
    height: 0.5, weight: 9.0, category: "Tiny Turtle",
    region: "cascadia", habitat: ["starter"],
    dexEntry: "Placeholder dex entry.",
    sprites: { front: "fakemon/003_front.png", back: "fakemon/003_back.png", icon: "fakemon/003_icon.png" }
  }
};

export function getFakemon(id) { return FAKEDEX[id] || null; }
export function allFakemonIds() { return Object.keys(FAKEDEX).map(Number).sort((a, b) => a - b); }
