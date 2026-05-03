# Move Animation System

Cascadia plays move animations using an Essentials-compatible JSON format. We import animations from the **Gen 9 Move Animation Project** (Eevee Expo, free) which covers Gen 1-9 moves in Pokémon Reborn / Gen 3 visual style. Compatible animations work across our entire move database with no per-move coding from us.

## How it works

1. Each move can have an animation defined in `assets/animations/json/<move_id>.json`
2. The JSON references a sprite sheet in `assets/animations/sheets/<sheet>.png` and an optional sound in `assets/animations/sounds/<sound>.ogg`
3. The `AnimationPlayer` in `js/systems/animation/AnimationPlayer.js` reads the JSON and plays it via Phaser tweens, sprites, and screen effects
4. Moves with no animation file get a type-colored placeholder (projectile or status flash)

## Importing animations from the Gen 9 Move Animation Project

### One-time setup

1. **Download the pack** from https://eeveeexpo.com/resources/1480/ (or the Gen 3 pack at https://eeveeexpo.com/resources/1669/ for fewer animations in Gen 3 style)
2. **Install Ruby** (free):
   - macOS: comes pre-installed (run `ruby --version` in Terminal to confirm)
   - Linux: `sudo apt install ruby` or equivalent
   - Windows: install RubyInstaller from https://rubyinstaller.org/

### Convert the pack

The Eevee Expo pack ships as a folder containing:
- `*.anm` files (binary Ruby Marshal format with animation timing data)
- `Graphics/Animations/*.png` (the sprite sheets — 192×192 cels in a grid)
- `Audio/SE/*.ogg` (sound effects)

Run our converter (one command):

```bash
ruby tools/convert_anm_to_json.rb path/to/pack/anm_files assets/animations/json
```

The converter reads each `.anm` file and writes a Cascadia-format JSON. ~100 files in v1.0 of the Gen 3 pack, ~300+ in the Gen 9 project.

Then copy the assets:

```bash
cp path/to/pack/Graphics/Animations/*.png assets/animations/sheets/
cp path/to/pack/Audio/SE/*.ogg assets/animations/sounds/
```

### Map move IDs

The Eevee Expo packs use Essentials' move IDs (e.g. "FIREPUNCH", "EMBER"). Cascadia uses snake_case (e.g. "fire_punch", "ember"). The converter automatically handles the mapping — uppercase to lowercase, "FIREPUNCH" → "fire_punch", etc.

Some moves in the pack won't match Cascadia's IDs (e.g. moves we don't have, or moves with different names). Those JSON files will sit unused in `assets/animations/json/` — harmless. Cascadia loads animations on demand by move ID, so unused files cost nothing.

### Override timing

If a converted animation feels off in our game (different sprite size than Pokémon's 96×96, different battle layout, etc.), edit the JSON directly. No re-conversion needed. The format is designed to be hand-editable.

## Format reference

```json
{
  "id": "ember",
  "displayName": "Ember",
  "sheet": "ember",                      // <- assets/animations/sheets/ember.png
  "cellSize": 192,                       // each cel in the sheet is 192×192
  "cellsPerRow": 5,                      // how many cels per row in the sheet
  "fps": 20,                             // playback speed
  "background": null,                    // optional: background image
  "sound": null,                         // optional: SE filename
  "screenShake": { "intensity": 4, "duration": 200 },   // optional
  "screenFlash": { "color": "0xffffff", "alpha": 0.4 }, // optional
  "frames": [
    {
      "duration": 2,                     // how many frames at this fps
      "cels": [
        {
          "cel": 0,                      // index into the sheet (0-based)
          "focus": "midpoint",           // "user" | "target" | "midpoint" | "screen"
          "x": 0,                        // offset from focus point (px)
          "y": 0,
          "scale": 1.0,
          "rotation": 0,                 // degrees
          "alpha": 1.0,
          "blend": "normal",             // "normal" | "add" | "screen"
          "flip": false                  // horizontal flip
        }
      ]
    }
  ]
}
```

## Licensing & Attribution

The Gen 9 Move Animation Project is licensed for free use in fan games. Credit goes to:
- Gen 9 project lead: KRLW890, Nut0066
- Gen 8 project lead: StCooler (with DarrylBD99, WolfPP, ardicoozer, riddlemeree, Drake Baku)
- Original animations: Pokémon Reborn team
- Sound effects: BellBlitzKing's "Pokemon Sound Effects Pack: Gen 1 to Gen 7"
- Gen 3 pack: TheTinfoilTemplar

Cascadia credits these contributors in `docs/CREDITS.md` (to be created when we publish).

The pack does NOT contain any official Game Freak / Nintendo code or assets — all sprites are fan-made in the style of vanilla Pokémon games. Our use is consistent with the pack's intended distribution.

## Performance

- Animations cache after first load — playing the same move twice is free
- Each animation is roughly 50KB (sheet + sound + JSON)
- 100 animations ≈ 5MB total, well within our budget
- Phaser load happens on-demand at battle start; no preload of all animations

## What if Ruby fails or the pack format changes?

Backup plan: hand-edit the JSON files directly using the example format. We can also generate placeholder animations via ChatGPT (described in `docs/prompts/ANIMATION_PROMPTS.md`, to be written) for moves not covered by the pack.

The placeholder fallback in `AnimationPlayer.js` ensures **any move plays SOMETHING** even if its JSON is missing — type-colored projectiles or status flashes. So missing animations never break the game.
