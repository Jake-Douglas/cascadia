# Fakédex Schema — LOCKED (v2)

Every Fakemon in `js/data/fakedex.js` follows this exact shape. No exceptions.

## Schema

```js
{
  id: 1,
  name: "Fakemon Name",
  types: ["grass"],                 // 1 or 2 types
  baseStats: {
    hp: 45, atk: 49, def: 49,
    spAtk: 65, spDef: 65, spe: 45
  },
  abilityPool: ["overgrow", "fog_walker"],   // 1-4 possible abilities
  defaultAbility: "overgrow",                // which one is active by default
  learnset: [
    { level: 1, move: "tackle" },
    { level: 7, move: "vine_whip" }
  ],
  evolution: {
    into: 2,
    method: "level",                // level | stone | trade | friendship | item
    requirement: 16
  },                                // null if final stage
  catchRate: 45,                    // 3-255, lower = harder
  expYield: 64,
  growthRate: "medium-slow",        // fast | medium-fast | medium-slow | slow
  height: 0.7,                      // metres
  weight: 6.9,                      // kg
  category: "Seed",                 // dex category, e.g. "Mossfrog"
  region: "cascadia",               // cascadia | foothills | both — hint for distribution
  habitat: ["forest", "town"],      // tags for encounter pool grouping
  dexEntry: "Flavor text here.",
  sprites: {
    front: "fakemon/001_front.png",
    back:  "fakemon/001_back.png",
    icon:  "fakemon/001_icon.png"
  }
}
```

## Ability System (Cascadia rule)

- Each Fakemon has an **ability pool** of 1-4 possible abilities.
- Only **ONE** is active at any time.
- Active ability can be changed at:
  - Pokémon Centers (free service)
  - Specific NPCs in late-game towns (cost varies)
  - Via items: Ability Capsule (rotate to next in pool), Ability Patch (set to specific)
- Default active = first in `abilityPool` unless `defaultAbility` overrides.

This is the **Elite Redux "abilities" mechanic minus their innates** — multiple possibilities, one active. No always-on innates layer in Cascadia (deliberately scoped down for design clarity).

## Stat Total Guidelines
- First-stage common: 250-320 BST
- Mid evolution: 380-450 BST
- Final evolution: 500-540 BST
- Pseudo-legendary final: ~600 BST
- Legendary: 660-720 BST (post-game)

## Region Distribution
- `region: "cascadia"` — appears in PNW areas
- `region: "foothills"` — appears in Southern Alberta areas (badlands, ski, etc.)
- `region: "both"` — found across both biomes
```
