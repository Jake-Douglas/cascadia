# Tileset Prompts for ChatGPT

The hardest asset type to generate consistently. Tiles must be modular — every grass tile must edge-match every other grass tile, paths must connect cleanly, water tiles must tile seamlessly. ChatGPT image generation does not natively understand "tileability" — we have to compensate with constraints and post-processing.

## The Strategy
1. Generate **one full-screen reference scene** first to establish style (single image of the biome).
2. Then generate **individual tile sheets** referencing that scene's style.
3. Manually slice tile sheets in any image editor (free options: Piskel, Aseprite trial, GIMP) into 16x16 individual tiles, name them per tileset spec.
4. Import as a single PNG into Tiled, use it on a map.

This gives us roughly 90% style consistency, the remaining 10% touched up in an editor.

---

## Prompt 1: Establish Biome Reference

Use this once per biome (Cascadia outdoor, Foothills outdoor, ski resort, beach, etc.) to lock the visual feel before generating tiles. Save the image, reference it in subsequent prompts.

```
Pixel art reference scene of a [BIOME DESCRIPTOR], in the style of Pokémon Ruby/Sapphire/Emerald (Generation 3, GBA, top-down 3/4 perspective). 
A single 480x320 illustration showing a small outdoor area with [3-5 SPECIFIC FEATURES]. 
Tile-grid aware: everything sits on a 16x16 grid. 
Cel-shaded with hard 1px black outlines. No anti-aliasing. 
Palette of 24-32 colors maximum. Slightly muted, naturalistic colors.
No text, no UI, no character sprites, no border.
```

### Cascadia outdoor reference example
```
[BIOME] = lush Pacific Northwest coastal village in autumn
[FEATURES] = a wood-shingled cottage, a dirt path bordered by ferns and moss, 
tall Douglas fir trees, fog patches near the ground, a fence post with carved 
totem markings
```

### Foothills outdoor reference example
```
[BIOME] = arid Alberta badlands in late afternoon
[FEATURES] = sandstone hoodoos, dry sage brush, a dirt path of red-orange 
clay, scattered fossils embedded in rock, distant Rocky Mountain silhouettes
```

---

## Prompt 2: Generate the Tile Sheet

Once you have a reference scene, generate the actual tileable tiles.

```
Pixel art tileset for a 2D top-down RPG in the style of Pokémon Gen 3. 
Output as a single image arranged in a clean grid of 16x16 pixel tiles, 
8 tiles wide by 8 tiles tall (so the final image is 128x128 pixels), 
on a transparent or solid magenta background (#ff00ff) so I can key it out.

Tiles to include, left-to-right, top-to-bottom:

ROW 1: grass-base, grass-tuft-1, grass-tuft-2, tall-grass-encounter, 
        dirt-path-center, dirt-path-edge-N, dirt-path-edge-S, dirt-path-edge-W

ROW 2: tree-base-trunk, tree-canopy-NW, tree-canopy-NE, tree-canopy-SW, 
        tree-canopy-SE, fern-decor, moss-rock, flower-pink

ROW 3: water-center, water-edge-N, water-edge-S, water-edge-E, 
        water-edge-W, water-corner-NW, water-corner-NE, water-corner-SE

ROW 4: sand-base, sand-edge-grass-N, fence-horizontal, fence-vertical, 
        sign-wood, mailbox, shrub-small, shrub-large

ROW 5-8: [reserved for biome-specific tiles, fill with: pine-saplings, 
        wood-bridge-N-S, wood-bridge-E-W, ledge-jump-S, stairs-up, 
        cliff-edge variations, totem-post, mushroom-cluster]

Style match this reference image: [paste reference scene from Prompt 1]
Cel-shaded, 1px black outline, no anti-aliasing, palette pulled from reference.
Each tile must visually edge-match adjacent tiles where logical (grass-to-path, 
water-to-shore, etc).
No text labels, no grid lines visible in the output.
```

## Prompt 3: Building / Interior Tilesets
Same structure as Prompt 2 but with interior elements:
- floor (wood, tile, carpet variations)
- wall-N, wall-S, wall-E, wall-W
- wall-corner variations
- door (closed, open)
- bed-head, bed-foot, table, chair-N/S/E/W
- bookshelf, TV, computer, fridge, oven, sink
- pokemart counter, healing machine

---

## QA Checklist for Generated Tiles
Before importing a tileset:
- [ ] Background is pure magenta `#ff00ff` or transparent (so it can be keyed out)
- [ ] All tiles are exactly 16x16 (use a pixel ruler in your image editor)
- [ ] Grass tiles when placed adjacent to each other show no seams
- [ ] Path edge tiles connect properly when laid out as expected
- [ ] No anti-aliased pixels around outlines (zoom in 800%, check)
- [ ] Color palette pulled from `docs/PALETTE.md`
- [ ] No text or watermark from ChatGPT slipped in

If the sheet fails any check, regenerate or touch up manually. Don't ship inconsistent tiles — they will visibly clash.

---

## Realistic Expectations

ChatGPT will get tilesets ~70% right on first try. You'll spend time:
- Fixing background color (magenta-key in any editor)
- Aligning tile edges (Aseprite has a tile-edit mode that helps)
- Recoloring outliers to fit the palette

Plan ~2-3 generation rounds + ~30 min manual cleanup per tileset. Don't skip the cleanup; it's what separates "fan game" from "looks broken."

For really tricky tiles (water animation frames, autotile corners), you may end up hand-pixeling 1-2 tiles. That's fine — that's how every fan game works.
