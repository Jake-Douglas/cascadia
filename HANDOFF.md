# Pokémon Cascadia — Project Handoff

**This is the canonical state-of-the-project document. Read this first.**
Updated: end of v0.10 development cycle.

If anything in `docs/ARCHITECTURE.md` or other docs contradicts this file, this file wins. Older docs are kept for reference but may be stale.

---

## 1. WHO YOU'RE WORKING WITH

**Jake** — solo developer, based in Edmonton, Alberta. Mac user.

**Hard constraint: Jake does not write code.** He directs design, names choices, sets scope, and tests builds. All code is written by Claude (or, eventually, ChatGPT for visual assets). This means:

- Don't propose solutions that require Jake to edit code, run terminal commands beyond `open` / drag-and-drop, debug stack traces, or "look at the console output."
- Don't ask Jake which library to use, which framework, which file format. Make the call yourself based on the constraints; explain it briefly; move on.
- Do ask Jake design questions: which of these three town layouts feels right, should the rival be cocky or quiet, which Fakémon idea sounds better.
- Communications style: be direct. Don't pad responses. Don't ask permission for every step. Show work, get sign-off on direction, execute.

**Background relevant to design discussions:**
- Sports knowledge (NHL, NFL, MLB, EPL): hockey-deep especially
- MTG Commander player (brackets 3-4, prefers mechanically distinct commanders)
- Pokémon fan game player (HLM26, ER, Reborn-aware)
- Built ConvertEverything.ai (AdSense passive revenue site) so understands monetization-via-traffic models, but Cascadia is a fan game so cannot be monetized — explain this if Jake asks
- Other active projects: The Sporting Chronicle, OHM (Online Hockey Manager), Space League Baseball, Pokémon Tungsten — Cascadia is one of several

---

## 2. WHAT THIS GAME IS

**Pokémon Cascadia.** Browser-tech-stack monster-catching RPG, distributed as native desktop app. Setting: Pacific Northwest (Cascadia region) initially, expanding into reimagined Southern Alberta (Foothills region) via a mountain pass.

**Distinguishing design decisions:**

1. **All-original Fakémon, designed just-in-time as we build each route.** No vanilla Pokemon in the final game (Pidgey/Rattata/etc are placeholders only during development). Designs come from ChatGPT using locked prompt templates (see `docs/prompts/`).

2. **Elite Redux ability system.** Cascadia uses ER's 441-ability roster as its abilities. NOT ER's "innates" layer — single active ability per Fakémon, like vanilla Pokemon. Fakédex entries declare an `abilityPool: ['ability_id_1', 'ability_id_2']` and one is rolled at species creation.

3. **Vanilla Pokemon move set.** Gen 1-9 vanilla moves, ~430 of them, in `js/data/moves.js`. ER moves NOT included. ER abilities + vanilla moves is the design.

4. **Cross-platform desktop, no Wine/Whiskey.** Mac (Apple Silicon + Intel), Windows, Linux from one Electron codebase. Real `.dmg`, `.exe`, `.AppImage` installers via electron-builder.

5. **Difficulty calibration screen at game start.** After the professor intro, before the game begins, player picks: difficulty preset, IV/EV behavior, level cap behavior, exp share on/off, autosave, etc. This is unique to Cascadia — most fan games hardcode these.

6. **Real save system.** Saves to OS-managed app data folder (Mac: `~/Library/Application Support/Cascadia/`). Manual save from menu, optional autosave. No localStorage as primary store — that was rejected as too fragile.

---

## 3. DISTRIBUTION & DEPLOYMENT (LOCKED — Jake confirmed in v0.10 session)

**ONE distribution channel: GitHub Releases with electron-updater auto-update.**

- Private GitHub repo: `github.com/<jake-username>/cascadia` (Jake just created account; username pending in next session)
- GitHub Actions builds Mac/Windows/Linux installers automatically on tag push
- Initial install via direct `.dmg` download from chat
- After first install, game checks GitHub Releases on launch, auto-downloads diff, restarts. ~30 sec per update.
- Saves persist in `~/Library/Application Support/Cascadia/` untouched by updates

**REJECTED alternatives (do not re-propose without strong reason):**
- ❌ Browser version on Netlify — Jake said "I don't want to start a proof of concept on a system it won't actually be running on." Browser versions cause input/audio/save behavior differences that need to be re-engineered later. Skip the browser entirely.
- ❌ Itch.io HTML upload — same reason as above
- ❌ Public GitHub repo — Jake wants the work-in-progress not copyable. Repo is private.
- ❌ Wine/Whiskey for Mac — explicitly the thing we're solving for

**Jake's testing loop (the workflow we built for this):**
1. Claude pushes new code to private repo
2. GitHub Actions builds Mac `.dmg`
3. Either auto-update fires (after first install) OR Claude sends `.dmg` directly via chat for first install
4. Jake double-clicks installer, plays, gives feedback

**Why private repo even though auto-updates are harder:**
- Public would require fewer setup steps, but Jake doesn't want code copyable
- Private + auto-update requires a Personal Access Token. Token is configured on Jake's machine only. Works for solo testing.
- When Cascadia is ready for outside testers, revisit (likely flip to public, since by then there will be a community).

---

## 4. TECH STACK (LOCKED)

| Layer | Choice | Why |
|---|---|---|
| Game engine | Phaser 3.80+ via CDN | Mature 2D engine, Pokemon-style render works well |
| Language | Vanilla JS, ES modules | No build step, no transpiler, Jake-friendly file edits |
| Maps | Tiled editor, JSON export | Industry standard, ChatGPT can read/write JSON |
| Desktop wrapper | Electron + electron-builder | Real `.dmg`/`.exe`/`.AppImage`, no Wine needed |
| Auto-update | electron-updater (GitHub Releases feed) | Built-in, well-tested |
| Save adapter | Disk on desktop, localStorage in dev only | Real saves on real disk |
| Battle engine | Custom JS (NOT Pokémon Showdown) | ER abilities require custom hooks Showdown doesn't expose |

**File layout:**
```
/home/claude/cascadia/
├── index.html                  # Phaser entry point
├── package.json                # Electron config + scripts
├── README.md                   # User-facing readme
├── HANDOFF.md                  # ← THIS FILE
├── desktop/                    # Electron main process
│   ├── main.js
│   └── preload.js
├── js/
│   ├── main.js                 # Phaser bootstrap
│   ├── data/
│   │   ├── fakedex.js          # Fakémon species (currently empty)
│   │   ├── moves.js            # 430 vanilla moves
│   │   ├── typeChart.js        # 18-type effectiveness chart
│   │   ├── abilities.js        # 441 ER abilities, all impl: 'full'
│   │   └── maps.js             # Map registry
│   ├── scenes/                 # Phaser scenes (BootScene, PreloadScene, WorldScene)
│   ├── systems/
│   │   ├── battleEngine.js     # Custom turn-based engine, all 17 ability hooks
│   │   ├── inputManager.js
│   │   ├── mapManager.js
│   │   ├── demoLimits.js       # Old (browser-demo era), kept but unused
│   │   ├── save/               # SaveAdapter + Browser/Desktop implementations
│   │   └── animation/
│   │       └── AnimationPlayer.js   # Loads Reborn-format animations
│   └── entities/
│       ├── Player.js
│       └── FakemonInstance.js
├── assets/
│   ├── maps/                   # 3 placeholder Tiled JSONs
│   ├── tilesets/               # Empty, awaiting Gen 4/5 tileset import
│   ├── sprites/                # Empty, awaiting Fakémon designs
│   └── animations/             # ~1466 animations, ~1479 sounds — fully populated
│       ├── json/               # Compact-format animation descriptors
│       ├── sheets/             # Sprite sheets (PNG)
│       ├── sounds/             # SFX (WAV/OGG/MP3)
│       └── backgrounds/
├── tests/                      # Node-based headless tests (110 ability + 20 integration)
├── tools/                      # Conversion utilities (rxdata parser etc.)
└── docs/                       # Long-form docs (see section 11)
```

---

## 5. WHAT'S DONE (as of v0.10)

### Battle engine — fully working, headless
- 17 ability hooks fired at the right times: onSwitchIn, onTryMove, onModifyMove, onModifyDamage, onAfterMove, onTryStatus, onAfterStatus, onResidual, onSwitchOut, onModifyStat, onComputeStats, onDamageReceived, onTryHit, onSetWeather, onSetTerrain, onTrapPokemon, onModifyAccuracy
- 441 ER abilities, all with `impl: 'full'` — no stubs
- Critical bug fixed in v0.10: `fireAbilityHook` was setting `ctx.user` to caller's user (attacker), breaking all defender-side abilities. Fixed: ctx.user always = ability owner; attacker preserved as ctx.attacker.
- 30+ ability flags actually wired into engine: contact, punch, biting, pulse, sound, slicing, kick, wind, powder, ball, bomb, bone, heal, spread; long_reach strips contact; skill_link multi-hits; recoil suppression via no_recoil; type-eff overrides (scrappy, ground_shock, overwhelm, molten_down, seaweed); corrosion bypasses Steel/Poison immunity; trapping blocks switching; forced switch (wimp_out/emergency_exit) actually swaps mons.
- Tests: 110/110 ability tests pass, 15/20 integration tests pass (5 failures are pre-existing test harness issues, not engine bugs)

### Animations — fully working
- 1,466 animations (covers all 430 vanilla moves + 82 common animations)
- All 5 weather animations (Sun/Rain/Sandstorm/Hail/Snow)
- All status condition animations (Burn/Paralysis/Poison/Sleep/Frozen/Attract/Drowsy/Frostbite)
- All terrain animations (Grassy/Electric/Psychic/Misty)
- Stat change animations (StatUp/StatDown)
- Form change animations (Mega/Primal/UltraBurst/Z-Power)
- 1,479 sound files, 99% of sound references in animation timings resolve
- AnimationPlayer.js fixed in v0.10: no more double `.png` extensions in URLs; audio preloading wired; timing-event scheduler for SFX + flash effects.

### Save system
- SaveAdapter abstraction with BrowserSaveAdapter (localStorage) + DesktopSaveAdapter (Electron disk)
- Both work, currently no UI to invoke them

### Skeleton scenes
- BootScene, PreloadScene, WorldScene exist as stubs — they don't do much yet

### NOT done yet (this is the interesting list)
- No title screen
- No main menu
- No settings screen
- No professor intro / name selection / calibration screen
- No actual map content (just 3 placeholder JSONs)
- No NPCs, no dialogue system
- No catching, no party screen, no Pokédex, no bag, no trainer card
- No actual Fakémon designs (waiting on ChatGPT generation)
- No music (waiting on Tier 2 asset grab)
- No tilesets, no town visuals (Tier 1 asset grab needed first)
- Auto-update workflow not yet set up (waiting on Jake's GitHub username + Mac chip confirmation)

---

## 6. ASSET STRATEGY (decided in v0.10 session)

**What we ARE legitimately importing from elsewhere (with credit):**

Already imported:
- ✅ Reborn move animations + sounds via the **Gen 9 Move Animation Project** (KRLW890, Nut0066, StCooler, Reborn team) — ALL animations + 99% SFX coverage
- ✅ Elite Redux ability designs (public domain via pokeemerald lineage)

To be imported just-in-time as needed:
- 🔜 **Mr. Gela Gen 4/5 trainer sprite pack** (Eevee Expo, public-with-credit) — for ~180 generic trainer types in the world (bug catchers, hikers, swimmers, rivals, gym leaders, etc.). Includes back sprites that ChatGPT can use as style references for Cascadia-original protagonist.
- 🔜 **Gen 4 (DPP/HGSS) NPC overworld pack** (LOCKED as the visual style for ALL of Cascadia) — for non-trainer NPCs walking around towns. Mr. Gela has a comprehensive pack on Eevee Expo.
- 🔜 Eventually: tilesets in matching Gen 4 style (Eevee Expo has multiple)
- 🔜 Eventually: official Pokemon HGSS/Platinum/BW music as placeholder background tracks, replaced over time with originals or commissioned tracks

**What we are NOT importing (Jake confirmed):**
- ❌ Pokemon battle sprites — Cascadia is all-original Fakémon, will not use any vanilla Pokemon sprites in shipped game. Pidgey or similar may be used as a placeholder species during development, but only one or two, and only for code testing.
- ❌ Reborn music (mostly GlitchxCity originals, not cleared for general reuse)
- ❌ Insurgence/Uranium custom assets (creators specifically said no)
- ❌ Reborn trainer sprites (depict named Reborn characters, not appropriate to reskin)

**Visual style locked: Gen 4 (DPP/HGSS).** Matches the Reborn animations we already imported (designed for those proportions). Looks polished without being overwhelming for ChatGPT to extend in matching style. This is the reference style for ALL future visual assets — tilesets, NPCs, trainer sprites, Fakémon sprites.

**Fakémon designs:** generated by ChatGPT just-in-time as Jake builds each route. Designs are Jake's creative work, not pulled from anywhere. Locked prompt templates live in `docs/prompts/` (or will, once we start generating).

---

## 7. ROADMAP

**Immediate (next session):**
- ✅ Get Jake's GitHub username + Mac chip
- Push code to private repo
- Set up GitHub Actions for Mac/Windows/Linux installer builds
- Set up electron-updater against private GitHub release feed
- Build first Mac installer, send `.dmg` directly to Jake
- Jake installs once, future updates auto-download

**Short term (sessions 2-5):**
- Title screen with animated logo, music, "Press Start"
- Main menu: New Game / Continue / Mystery Gift / Settings
- Settings screen: text speed, battle style, animations on/off, sound/music volume, button config, autosave
- Intro: Professor monologue, name selection, gender (or none — Jake's choice)
- Difficulty calibration screen (Cascadia-specific, see §2 point 5)
- Game start: bedroom, mom dialogue, leave house

**Medium term (sessions 5-15):**
- First town: Cedar Falls (need to design layout — Jake will direct)
- In-game menu (X/Esc): Pokédex / Pokémon / Bag / Trainer Card / Save / Settings / Exit
- Save: writes to disk on desktop, pause + confirmation
- Wild encounter trigger (world → battle handoff)
- NPC + dialogue system
- First gym
- First 12-15 Fakémon designs (starters + early route)

**Long term:**
- Full Cascadia region (~5-7 towns, ~10 routes)
- Full Foothills region
- ~150 Fakémon total
- ~40 music tracks
- Endgame content (Battle Tower equivalent, post-game story)

---

## 8. KEY DESIGN DECISIONS (settled — don't reopen without reason)

| Decision | Choice | Rationale |
|---|---|---|
| Battle engine | Custom (not Showdown) | ER ability hooks need custom |
| Ability system | ER, single active (not innates) | Closer to vanilla feel |
| Move set | Vanilla Gen 1-9 | Familiar to players, ER abilities are the twist |
| Visual style | Gen 4 DPP/HGSS | Matches Reborn animations, polished |
| Distribution | Electron desktop, GitHub Releases auto-update | No Wine, real saves |
| Repo visibility | Private | Jake doesn't want WIP copyable |
| Browser version | None | Avoid pivot work later |
| Save format | OS app data folder, JSON | Real saves like real games |
| Fakémon design | Just-in-time per route | Don't design 150 mons upfront |
| Region | Cascadia (PNW) → Foothills (S. Alberta) | Jake's home region |
| Difficulty | Player-configured at start | Differentiator vs. other fangames |
| Music sourcing | Placeholder Pokemon official → eventually originals | Common fangame pattern |
| Engine size budget | "It's downloadable, size doesn't matter" | Confirmed v0.10 |

---

## 9. CRITICAL ENGINE IMPLEMENTATION NOTES

For any Claude working on the battle engine:

- `effectiveStat(statKey, battle)` on `FakemonInstance` — accepts optional battle for ability stat modifiers
- `bindStatModifiers()` on `BattleEngine` — binds closures at switch-in for `onComputeStats` abilities
- `applyEffect` handles types: stat, status, flinch, heal, weather, terrain, field
- `applyStatus` fires `onTryStatus` + checks type-based immunity (corrosion bypass) + ability blocks
- **`fireAbilityHook(side, hookName, ctx)`**: ctx.user is ALWAYS the ability owner. attacker preserved as ctx.attacker. **DO NOT reset ctx.user inside the hook.**
- Move flags consumed by engine: contact, punch, biting, pulse, sound, slicing, kick, wind, powder, ball, bomb, bone, heal, spread

For animation work:
- AnimationPlayer.js: `loadAnimation(moveId)` tries both `moveId` and `moveId.replace(/_/g,'')` — Reborn pack uses concatenated names
- Common animations follow `common_*` naming convention for things like weather, status, stat changes
- `ensureSheetLoaded` preloads referenced audio from timing events; multiple audio formats tried in order: ogg, wav, mp3
- Sheet name normalization: strip existing `.png` before re-appending so we never produce double extensions

---

## 10. STILL-OPEN ITEMS (need decision in future sessions)

- **Protagonist gender selection**: include or skip? Jake hasn't decided.
- **Rival character**: needed for intro. Personality? Name?
- **Professor name**: "Professor Cedar"? Something else? Tied to first town name.
- **Region map style**: how detailed?
- **Music workflow**: who/what generates original tracks eventually?
- **First gym leader's type**: drives early-route Fakémon design priorities
- **Whether to implement Mega Evolution / Z-Moves / Dynamax / Tera**: ER has frameworks for some of these but Jake hasn't decided what's canon for Cascadia
- **Whether protagonist follows the player as overworld sprite ("walking Pokémon" feature)**

---

## 11. OTHER DOCUMENTS

These exist in `docs/` but may be partially stale. This handoff doc supersedes any contradiction.

- `ARCHITECTURE.md` — older, mentions browser demo (now killed). Engine + scene structure mostly still accurate.
- `ANIMATION_SYSTEM.md` — accurate, describes the JSON format and player
- `FAKEDEX_SCHEMA.md` — accurate, describes the species data structure
- `MAP_AUTHORING.md` — accurate, describes the Tiled → JSON workflow
- `PALETTE.md` — color palette reference

---

## 12. HOW TO TALK TO JAKE

- He thinks fast and types fast. Don't over-explain.
- He'll push back if a decision feels wrong. Don't capitulate immediately — explain reasoning, then defer.
- He doesn't want to be asked which option to pick when there's an obvious right answer. Make the call.
- He DOES want to be asked when it's a real design choice (story, names, region details, art direction).
- He fact-checks aggressively. If you're not sure about a Pokemon mechanic, an MTG card, an ER ability — search/verify, don't guess.
- He'll tell you if a previous Claude was wrong about something. Believe him; don't get defensive.
- "do these steps one at a time" means literally: one step, confirm, next step. Not all at once with a summary.
- When he says "okay" or "yes" without elaboration, proceed. Don't ask for additional confirmation.

---

## 13. VERSION HISTORY

- **v0.1-v0.5**: Initial scaffolding, ER ability port, basic engine
- **v0.6-v0.8**: Battle engine maturation, ability hook completion, ER ability auditing
- **v0.9**: Animation system implemented, Reborn pack imported (820 animations)
- **v0.10**: Gen 9 Animation Project imported (1466 animations, 1479 sounds), critical fireAbilityHook bug fixed, ~30 ability flags wired into engine consumers, audio playback wired, deployment strategy locked (Electron + private GitHub repo + auto-update)

Current bundle: `cascadia-v0.10.zip` — 41 MB zipped, 66 MB extracted, 3,560 files.

Next bundle (v0.11): Will be the first Mac `.dmg` installer, delivered via the auto-update infrastructure once GitHub repo is set up.
