# Fakemon Sprite Prompts for ChatGPT

Each Fakemon needs three sprite assets: front (battle), back (battle), overworld icon. We generate them in that order.

## Master Prompt — Front Sprite

```
Pixel art creature sprite in the exact style of Pokémon Ruby/Sapphire/Emerald 
(Generation 3 GBA). 

Subject: [DETAILED CREATURE DESCRIPTION — 2-3 sentences covering body shape, 
distinguishing features, expression, posture]

Specifications:
- 64x64 pixels exact dimensions
- Transparent background (or pure magenta #ff00ff if transparent unsupported)
- 3/4 view angle, creature facing toward the viewer's left
- Solid 1-pixel BLACK outline (#000000), NO anti-aliasing on the outline
- Cel-shaded with exactly 2 tones per surface: a base color + one shadow tone
- No highlights, no gradients, no glow effects
- Limited palette: 4-6 colors total, drawn from these hex values: 
  [LIST 4-6 SPECIFIC HEX FROM docs/PALETTE.md]
- Pose: neutral standing, slight personality lean indicating its temperament
- Crisp pixel art, no painterly effects, no soft edges
- No text, no signature, no border, no background scenery

Reference style: classic Pokémon Gen 3 sprites (look up Treecko, Mudkip, 
Torchic on Bulbapedia for proportions and shading approach)
```

## Master Prompt — Back Sprite

```
Same specifications as the front sprite I just generated for [FAKEMON NAME], 
but now showing the creature from BEHIND (rear view), 64x64 pixels.

The back sprite is what the player sees during battle, so it should be 
slightly larger framing than the front (creature fills more of the frame).
Show the back of its head/body, partial silhouette of the same features 
visible from behind. Same palette, same outline rules, same shading.
Transparent or magenta background.
```

## Master Prompt — Overworld Icon

```
Pixel art top-down chibi sprite of [FAKEMON NAME] for use as a small 
overworld/map sprite. 16x16 pixels exact dimensions, transparent background.

- Top-down view (looking straight down at the creature from above)
- Simplified shapes — just enough detail to recognize the species
- 3-4 colors maximum, palette matching the front sprite's main colors
- 1-pixel black outline
- Single static pose facing south (toward camera bottom)

This is for the world map and party menu icons, not for animation. Keep it 
simple and readable at small size.
```

---

## Concept-Building Prompt (use BEFORE generating any sprites)

For a new Fakemon, first ask ChatGPT (text-only) to expand a one-line concept into a full design brief:

```
I'm designing Fakemon #[N] for my fan-game Pokémon Cascadia (Pacific 
Northwest setting). 

Concept: [ONE LINE — e.g. "Grass-type starter based on a Pacific tree frog 
holding a fern frond"]

Type(s): [TYPE]
Role: [STARTER / EARLY-ROUTE COMMON / MID-EVOLUTION / GYM ACE / etc.]
Stage: [first-stage / mid-evolution / final-evolution]

Please provide:
1. Refined visual description (3-4 sentences) — body shape, key features, 
   color choices, expression, distinctive traits
2. Pokédex category (e.g. "Mossfrog Pokémon")
3. Pokédex flavor text (2-3 sentences, in the slightly mysterious tone of 
   real Pokédex entries)
4. Suggested name (2-3 options, evoking the concept and biome)
5. Suggested ability name and effect (one ability for now)
6. Base stat distribution suggestion (HP/Atk/Def/SpA/SpD/Spe summing to 
   appropriate BST for stage)
7. Three move-learn ideas at early levels (1-15)

Keep designs grounded — no overly busy details, since this needs to read 
clearly at 64x64 pixel art resolution.
```

This gives you a complete design brief you can drop straight into the 
sprite-generation prompt and into the `fakedex.js` data entry.

---

## QA Checklist (every sprite, before adding to dex)
- [ ] Exactly 64x64 (or 16x16 for icon) — count the pixels
- [ ] Transparent or magenta-keyed background
- [ ] Solid 1px black outline, no soft anti-aliasing
- [ ] No more than 6 colors in front/back sprite
- [ ] Cel-shaded, no gradients
- [ ] Silhouette test: fill with solid black — is it still recognizable as a creature?
- [ ] Style match: place next to a previously approved sprite — do they belong to the same world?
- [ ] No text or signatures from ChatGPT in the image

---

## Common Failure Modes & Fixes

**"It looks too detailed / painterly"** → Add to prompt: "VERY simple pixel 
art, blocky shapes, minimal interior detail. Style of Game Boy Advance era 
sprites, NOT modern indie pixel art."

**"Outline is fuzzy/anti-aliased"** → Add: "ABSOLUTE requirement: 1-pixel 
hard black outline, no anti-aliasing whatsoever, no soft edges anywhere on 
the sprite."

**"Wrong size"** → ChatGPT often outputs 1024x1024. Downscale in image 
editor with nearest-neighbor (NOT bilinear) to 64x64. Or ask ChatGPT 
explicitly: "Output the image so the creature itself is exactly 64x64 
pixels — if you generate at higher resolution, ensure each pixel cleanly 
maps to the 64x64 grid."

**"Background not transparent"** → Use magenta key in prompt, then in any 
image editor use 'Select by Color' on magenta and delete to alpha.

**"Style doesn't match prior Fakemon"** → Always include this line in 
prompts: "Match the style of these reference images:" and attach 2-3 
already-approved Fakemon sprites.
