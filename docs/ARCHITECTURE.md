# Pokémon Cascadia — Architecture (v3)

## Setting
Pacific Northwest (Cascadia) expanding into reimagined Southern Alberta (Foothills): badlands desert, dinosaur fossils, Rocky Mountain ski resorts, hot springs, prairie grasslands, multiple ocean coastlines, alpine peaks. Two distinct biome regions joined by a mountain pass route.

## Distribution Strategy (LOCKED — important)

**Cascadia is a downloadable game first, with a small browser demo.**

The browser version is a **strictly capped 30-60 minute demo** (first town, first route, first gym only, level cap 20, single badge). Players who want the real game download a native installer for their OS:

- Windows: `Pokemon Cascadia Setup X.Y.Z.exe`
- macOS: `Pokemon Cascadia-X.Y.Z.dmg` (universal — Intel & Apple Silicon)
- Linux: `Pokemon Cascadia-X.Y.Z.AppImage`

All built from one codebase via Electron. **No Whiskey, Wine, or other compatibility layer needed.** Mac users get a real `.app`; Windows users get a real `.exe`. This is the same pattern used by Discord, VS Code, Slack, Notion, etc.

### Why download-primary

Browser saves are volatile. Safari already wipes localStorage after 7 days of inactivity. Chrome's "clear site data" includes localStorage. Switching browsers wipes saves. For a multi-hour Pokémon game, this is a dealbreaker — players invest 100+ hours and a save loss is catastrophic.

Native downloads put save files in real OS folders the player owns, can back up, and can move between machines. This is why Reborn, Insurgence, Infinite Fusion, and every serious narrative fangame ships as a download.

### Why browser demo at all

- **Marketing**: "Try in your browser, download for the full game" lowers the friction of trying it
- **Show friends**: send a URL, no install required
- **Dev iteration**: I push to Netlify, you verify in seconds without building installers

The demo exists for those three reasons. It does not exist as a way for players to "play the game in browser" — that's the desktop build's job.

## Reference Games

| Game | Engine | Distribution |
|------|--------|--------------|
| Pokémon Infinite Fusion | RPG Maker XP / Essentials | Download (Windows-only via Essentials) |
| Pokémon Elite Redux, Radical Red, etc. | pokeemerald decomp (C, GBA ROM patch) | Download .gba + emulator |
| Pokémon Reborn, Insurgence | Pokémon Essentials | Download (`.exe` installer) |
| **Cascadia** | **Phaser 3 (web tech) + Electron wrapper** | **Download (`.exe`/`.dmg`/`.AppImage`)** + browser demo |
| PokéRogue | Phaser 3 + TypeScript | Browser-only (with backend for cloud saves) |

Cascadia's closest analog by **distribution model** is Reborn/Insurgence: native cross-platform installer for a story-driven single-player game. By **tech stack** it's closest to PokéRogue: Phaser 3 web tech. The combination (web tech + native distribution via Electron) gives us the best of both worlds.

## Tech Stack

- **Phaser 3.80+** game engine via CDN (no build step for the game itself)
- **Vanilla JS ES modules** for game code (no npm in the game runtime)
- **Tiled Map Editor** → JSON → loaded by Phaser
- **Electron** for desktop wrapper (`desktop/` folder)
- **electron-builder** for cross-platform installer generation
- **localStorage** in browser demo, **real files via Node fs** in desktop
- **GitHub Actions** (planned) for automated multi-platform builds

## Save Architecture

Two implementations, one interface (`js/systems/save/SaveAdapter.js`):

| Adapter | Used in | Storage | Slots | Persistent |
|---------|---------|---------|-------|------------|
| BrowserSaveAdapter | Browser demo | localStorage | 1 | NO |
| DesktopSaveAdapter | Desktop build | OS userData folder | 5 | YES |

Game code calls `SAVE.write(state)` and `SAVE.read(slot)` without knowing or caring which backend is active. The selector in `js/systems/save/index.js` picks the right one based on whether `window.cascadiaDesktop` exists (set by Electron's preload script).

Desktop saves go to:
- Windows: `%APPDATA%\Pokemon Cascadia\saves\slotN.json`
- macOS: `~/Library/Application Support/Pokemon Cascadia/saves/slotN.json`
- Linux: `~/.config/Pokemon Cascadia/saves/slotN.json`

Each save creates a `.bak` of the previous save before overwriting. A crash mid-write loses one save event, not the whole playthrough.

## Demo Caps (browser only)

Enforced in `js/systems/demoLimits.js`:
- Single save slot
- Cannot leave starter region (Cedar Falls + Route 1 + Port Haida)
- Cannot earn more than 1 badge
- Level cap: 20
- Download prompt after 30 minutes of playtime

In desktop build (`window.cascadiaDesktop` present), all caps lifted automatically.

## Battle Engine

Custom JS implementation in `js/systems/battleEngine.js`. Independent of Pokémon Showdown (avoids GPL entanglement). Implements:
- Gen 3+ damage formula (verified against expected outputs)
- Stat stages with Gen 3+ multipliers
- Status effects (burn, poison, paralysis, sleep, freeze)
- Volatile statuses (flinch)
- Ability hook system: onSwitchIn, onBeforeMove, onModifyDamage, onModifyIncomingDamage, onAfterDamage, onTakeDamage, onAfterKO, onStatStageChange, onWeatherChange, onEndOfTurn
- Multi-hit moves (engine-driven and ability-driven)
- Drain moves
- Priority resolution including ability-driven boosts
- Speed-based turn order with paralysis modifier
- Switch and flee actions
- Basic AI (highest expected damage)

Verified by `tests/battleTest.mjs`, `tests/longBattle.mjs`, `tests/abilityTest.mjs`. AI to be upgraded to Elite Redux-style (switch logic, setup awareness, status play) in a later pass.

## Ability System (Cascadia rule)

Each Fakémon has an **ability pool** (1-4 possible) but only ONE active. Inspired by Elite Redux's switchable abilities, minus their always-on innates layer. Active ability changes via Pokémon Centers, NPCs, or Ability Capsule/Patch items.

Currently 12 abilities loaded: vanilla (Overgrow, Blaze, Torrent, Intimidate, Static, Levitate) + Elite Redux ports with attribution to Darky92 (Fort Knox, Raging Boxer, Soul Eater, Hyper Aggressive, Opportunist, Energy Siphon, Sea Guardian) + Cascadia originals (Fog Walker, Totem Carved).

## Folder Structure

```
cascadia/
├── package.json                # Electron build config
├── index.html                  # Game entry (loaded in browser AND Electron)
├── README.md
├── js/
│   ├── main.js
│   ├── data/                   # fakedex, moves, types, abilities, maps registry
│   ├── scenes/                 # Phaser scenes (Boot, Preload, World, …)
│   ├── systems/
│   │   ├── inputManager.js
│   │   ├── mapManager.js
│   │   ├── battleEngine.js
│   │   ├── demoLimits.js       # Browser demo caps
│   │   └── save/
│   │       ├── SaveAdapter.js          # Abstract interface
│   │       ├── BrowserSaveAdapter.js   # localStorage impl
│   │       ├── DesktopSaveAdapter.js   # Electron file impl
│   │       └── index.js                # Selects right adapter
│   └── entities/               # Player, FakemonInstance
├── desktop/                    # Electron wrapper
│   ├── main.js                 # Electron main process (Node)
│   ├── preload.js              # Safe bridge to expose desktop APIs
│   ├── README.md               # Build instructions
│   └── build-resources/        # Icons (.icns, .ico, .png) for installers
├── tests/                      # Headless test scripts (run via node)
├── assets/                     # tilesets, sprites, maps
└── docs/                       # ARCHITECTURE, schemas, prompts, etc.
```

## Build Order

1. ✅ Architecture lock
2. ✅ Grid movement system + Tiled JSON pipeline + warps
3. ✅ Battle engine, type chart, moves, abilities, FakemonInstance
4. ✅ Save adapter abstraction (browser + desktop)
5. ✅ Electron wrapper skeleton
6. ✅ Demo caps in browser builds
7. ✅ Animation system (Essentials-format JSON, Phaser playback, fallback for missing)
8. ✅ **Move database** — 429 vanilla Pokémon moves loaded with full stats
9. ✅ **Animation assets imported** — 823 Reborn animations (94% coverage of our moves)
10. **Battle scene UI** — connect engine to Phaser graphics
11. **Encounter trigger** — wild Fakémon hand-off from world to battle
12. **NPC + dialogue system**
13. **Title + Intro flow** — name select, professor speech, get starter
14. **Catch + Party + Dex screens**
15. **Pause menu (party, bag, save UI)**
16. **First real Cascadia tilesets via ChatGPT**
17. **Design Fakémon #001-010 one at a time**
18. **First playable demo build** (.exe / .dmg / .AppImage)

## What we're explicitly NOT doing in v0.x

- Online play / trading
- Mobile (PWA possible later, native iOS/Android later via Capacitor)
- Audio (deferred until visuals locked)
- Animated battle sprites
- Day/night cycle
- Code-signing certificates (deferred until first real release; players accept unsigned warnings on fan games)
