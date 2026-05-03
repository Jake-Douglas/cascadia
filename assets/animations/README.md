# assets/animations/

Move animations and battle effects live here. Four subfolders:

- `json/` — Cascadia-format animation descriptors (one per animation id)
- `sheets/` — sprite sheets (PNG, 192×192 cels in a 5-column grid)
- `sounds/` — sound effects (OGG/WAV/MP3 — first match wins)
- `backgrounds/` — optional full-screen overlay images

## Coverage

- **1,466 animations** — covers all 430 vanilla moves, plus common animations
  for status conditions, weather, terrain, stat changes, mega evolution, etc.
- **1,479 sound effects** — 99% of timing-event sound references resolve
- All 5 weather animations: `common_sun`, `common_rain`, `common_sandstorm`,
  `common_hail`, `common_snow`

## How animations are loaded

The `AnimationPlayer` in `/js/systems/animation/AnimationPlayer.js` resolves
move ids to animation files. Lookup order:

1. `assets/animations/json/{moveId}.json` (e.g. `tackle.json`)
2. `assets/animations/json/{moveId-without-underscores}.json` (e.g.
   `firepunch.json` for `fire_punch`)

Common (non-move) animations are stored under `common_*.json`:
- `common_burn`, `common_paralysis`, `common_poison`, `common_sleep`,
  `common_frozen`, `common_attract`, `common_drowsy`, `common_frostbite`
- `common_statup`, `common_statdown`, `common_healthup`, `common_healthdown`
- `common_grassyterrain`, `common_electricterrain`, `common_psychicterrain`,
  `common_mistyterrain`
- `common_megaevolution`, `common_pulseevolution`, `common_primalkyogre`,
  `common_primalgroudon`, `common_ultraburst`, `common_zpower`
- `common_protect`, `common_kingsshield`, `common_spikyshield`,
  `common_banefulbunker`, `common_obstruct`, `common_quickguard`, `common_wideguard`
- `common_eatberry`, `common_useitem`, `common_levelup`, `common_shiny`,
  `common_illusion`, `common_fade_in`, `common_fade_out`

## Source / Credits

All animation data was extracted from the
**Gen 9 Move Animation Project** by KRLW890 and Nut0066, which is itself
a continuation of:
- Gen 8 Move Animation Project — StCooler, DarryBD99, WolfPP, Ardicoozer,
  Riddlemeree, Drake Baku
- Pokémon Reborn — Amethyst, Jan, Inuki, Smeargletail, Mde, Koyo
- Sound effects — Amethyst, BellBlitzKing's "Pokemon Sound Effects Pack:
  Gen 1 to Gen 7 - All Attacks SFX", Pokemon Mystery Universe
- Graphic rip — Neslug

Source: https://eeveeexpo.com/resources/1480/

These resources are public for fan use with proper credit. Cascadia
preserves all attribution per the original projects' terms.
