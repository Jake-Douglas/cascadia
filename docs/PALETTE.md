# Cascadia Region Palette

Two distinct biome regions, each with its own accent palette, sharing a core neutral palette. Every Fakemon, tile, and NPC pulls from these.

## Core Neutrals (used by both regions)
- `#0e0e10` outline black
- `#2a2a2e` deep grey
- `#5a5a5e` mid grey
- `#9a9a9e` light grey
- `#e8e0d4` cream / off-white
- `#fafafa` near-white

## Cascadia Accent Palette (Pacific Northwest)
Cool, lush, foggy, mossy.

### Greens (dominant in Cascadia)
- `#1f3a1f` deep evergreen
- `#2e5a2e` cedar green
- `#5a8a5a` moss green
- `#8aba8a` fern light
- `#c5e0a5` new-growth pale

### Blues (cool ocean & rain)
- `#1a3850` deep sound blue
- `#2e6a8a` inlet blue
- `#5a9ec0` foggy sky
- `#a8d0e0` sea-foam pale

### Browns (cedar, totem, soil)
- `#2a1810` cedar bark
- `#5a3a20` totem brown
- `#8a6a40` driftwood
- `#c0a070` damp sand

### Cascadia accents
- `#7a3a5a` salmonberry pink (rare flowers, Fakemon highlights)
- `#3a5a3a` algae teal (water-types)
- `#d4d0c0` low-fog white

## Foothills Accent Palette (Southern Alberta reimagined)
Warm, arid, rocky, prairie. Includes alpine extensions.

### Reds & Oranges (badlands, hoodoos)
- `#5a1a10` rust red
- `#a8482a` clay orange
- `#d47a3a` sandstone
- `#f0c070` sun-bleached yellow

### Tans & Yellows (prairie, sage)
- `#8a6a3a` dry grass
- `#c0a060` golden prairie
- `#e8d4a0` straw pale

### Foothills accents
- `#5a4a2e` sagebrush green-grey
- `#3a2a1f` fossilized bone-brown
- `#a08a70` weathered wood

### Alpine extensions (ski resorts, hot springs, peaks)
- `#1a2a3a` evening alpine sky
- `#5a7a9a` snow-shadow blue
- `#f0f0f0` snow white
- `#c0d0e0` glacial ice
- `#3a8aa0` hot spring teal

## Usage Rules

### For Fakemon
- Pick 4-6 colors per Fakemon
- Cascadia natives skew greens/blues/browns
- Foothills natives skew reds/tans/yellows
- Alpine natives use cool blues + whites
- Cross-region Fakemon may exist; use a balanced pull

### For Tilesets
- A tileset uses the FULL palette of its region (~24 colors max)
- Outline always `#0e0e10`
- Avoid pure white/pure black — they look harsh in pixel art

### For NPCs
- Neutral skin tones from the brown range
- Outfits using accents from the region they live in
- Player character: neutral palette so they fit anywhere

### Hard Don'ts
- No pure `#ff0000`, `#00ff00`, `#0000ff` — too saturated
- No more than 6 colors per single sprite
- No gradients between palette colors (cel-shading only)
