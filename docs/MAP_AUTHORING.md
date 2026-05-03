# Map Authoring Guide

Maps are built in Tiled (free editor: https://www.mapeditor.org), exported as JSON, and placed in `assets/maps/`. The game's MapManager loads any map by id.

## One-Time Setup
1. Download Tiled
2. Place tileset PNGs in `assets/tilesets/outdoor/` etc.
3. Open Tiled → File → New → Map
   - Orientation: Orthogonal
   - Tile layer format: CSV
   - Tile size: 16 x 16
   - Map size: as needed (e.g. 30x25 for a small town)

## Layer Structure (every map needs these)
Order from bottom to top:

1. **Ground** (Tile Layer)
   - The base terrain. Walkable.

2. **Decoration** (Tile Layer)
   - Things drawn over ground (paths, grass tufts, flowers, decals).

3. **Above** (Tile Layer)
   - Things drawn OVER the player. Tree canopies, eaves, signs hanging.
   - The player walks behind these visually.

4. **Collision** (Tile Layer, OR use property `collides=true` on tiles in Ground/Decoration/Above)
   - Easiest approach: in Tiled, edit your tileset and set the `collides` custom property to `true` on tiles that are solid (tree trunks, walls, water, fences, signs).

5. **Warps** (Object Layer)
   - Place rectangle objects on tiles where the player should be transported to another map.
   - Properties on each rectangle:
     - `targetMap` (string) — id of destination map (must exist in `data/maps.js`)
     - `targetX` (int) — landing tile x
     - `targetY` (int) — landing tile y
     - `targetFacing` (string) — `down` / `up` / `left` / `right`

6. **Encounters** (Object Layer)
   - Rectangles defining wild encounter zones (over tall grass, water, caves).
   - Properties:
     - `pool` (string) — encounter pool id (e.g. "route_1_grass")

7. **NPCs** (Object Layer)
   - Single point or small rectangle objects. One per NPC.
   - Properties:
     - `npcId` (string) — looked up in `data/npcs.js`

## Map IDs
Naming convention: lowercase, snake_case, descriptive
- `cedar_falls_town` (your starting town)
- `route_1`
- `cedar_falls_house_player` (player's house interior)
- `cedar_falls_lab` (Professor's lab)

## Example Warp Setup
You're in `cedar_falls_town`. There's a house door at tile (12, 8). Inside the house, the player should land at tile (5, 7) facing up.

In `cedar_falls_town.tmx`:
- Add Warps object layer
- Place a 16x16 rectangle at pixel (12*16, 8*16) = (192, 128)
- Set properties:
  - targetMap: `cedar_falls_house_player`
  - targetX: `5`
  - targetY: `7`
  - targetFacing: `up`

Then in `cedar_falls_house_player.tmx`:
- Add the inverse warp at the doormat tile (5, 8) — player walks SOUTH out, lands in town.

## Export
File → Export As → JSON (.json) → save to `assets/maps/<map_id>.json`.

Then add to `js/data/maps.js`:
```js
cedar_falls_town: { 
  jsonPath: 'assets/maps/cedar_falls_town.json',
  tilesets: ['cascadia_outdoor']
}
```

## Tips
- Build `cedar_falls_town` first as your reference. Get one map perfect before making more.
- Don't make a giant world map — Pokémon games are made of many small maps connected by warps. A "town" might be 30x25 tiles. A "route" might be 25x15. An "interior" might be 12x10.
- Save the .tmx (Tiled source) too — JSON is the export, .tmx is the editable source. Keep both.
