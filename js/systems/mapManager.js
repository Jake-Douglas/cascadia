// MapManager — loads Tiled JSON, builds Phaser layers, exposes queries for
// collision, warps, encounters, NPCs.

import { getMapConfig } from '../data/maps.js';

export class MapManager {
  constructor(scene) {
    this.scene = scene;
    this.currentMapId = null;
    this.tilemap = null;
    this.layers = {};       // { ground, decoration, above, ...}
    this.warps = [];        // [{x, y, w, h, targetMap, targetX, targetY, targetFacing}]
    this.encounterZones = [];
    this.npcSpawns = [];
  }

  // Load and build a map. Returns true on success.
  // Assumes the JSON has already been loaded into Phaser's cache by the PreloadScene.
  loadMap(mapId) {
    const config = getMapConfig(mapId);
    if (!config) {
      console.error(`MapManager: unknown map "${mapId}"`);
      return false;
    }

    // Clean up previous map
    this.destroy();

    // Build new tilemap from cache
    this.tilemap = this.scene.make.tilemap({ key: mapId });
    
    // Add tilesets
    const tilesets = [];
    for (const tsName of config.tilesets) {
      // Tileset name in Tiled MUST match the asset key we used in PreloadScene
      const ts = this.tilemap.addTilesetImage(tsName, tsName);
      if (!ts) {
        console.warn(`MapManager: tileset "${tsName}" not found in map "${mapId}"`);
        continue;
      }
      tilesets.push(ts);
    }

    // Create layers — only those that exist in the JSON
    const layerNames = ['Ground', 'Decoration', 'Above', 'Collision'];
    for (const name of layerNames) {
      const layer = this.tilemap.getLayer(name);
      if (!layer) continue;
      const created = this.tilemap.createLayer(name, tilesets, 0, 0);
      if (!created) continue;
      this.layers[name.toLowerCase()] = created;
      
      // Above layer renders over the player
      if (name === 'Above') created.setDepth(20);
      else created.setDepth(name === 'Collision' ? 5 : 1);
      
      // Hide collision layer visually
      if (name === 'Collision') created.setVisible(false);
    }

    // Parse object layers
    this.warps = this.parseObjectLayer('Warps');
    this.encounterZones = this.parseObjectLayer('Encounters');
    this.npcSpawns = this.parseObjectLayer('NPCs');

    this.currentMapId = mapId;
    return true;
  }

  parseObjectLayer(name) {
    const layer = this.tilemap.getObjectLayer(name);
    if (!layer) return [];
    return layer.objects.map(obj => {
      const props = {};
      if (Array.isArray(obj.properties)) {
        obj.properties.forEach(p => { props[p.name] = p.value; });
      }
      return {
        x: Math.floor(obj.x / 16),
        y: Math.floor(obj.y / 16),
        w: Math.max(1, Math.floor((obj.width || 16) / 16)),
        h: Math.max(1, Math.floor((obj.height || 16) / 16)),
        ...props
      };
    });
  }

  // Returns true if the given tile is solid
  isSolid(tileX, tileY) {
    if (!this.tilemap) return true;
    if (tileX < 0 || tileY < 0) return true;
    if (tileX >= this.tilemap.width || tileY >= this.tilemap.height) return true;

    // Check Collision layer first if present
    if (this.layers.collision) {
      const tile = this.layers.collision.getTileAt(tileX, tileY);
      if (tile && tile.index !== -1) return true;
    }

    // Check tile properties on visible layers
    for (const layerName of ['ground', 'decoration', 'above']) {
      const layer = this.layers[layerName];
      if (!layer) continue;
      const tile = layer.getTileAt(tileX, tileY);
      if (tile && tile.properties && tile.properties.collides) return true;
    }
    return false;
  }

  // Returns warp object if the player stands on/over a warp tile
  warpAt(tileX, tileY) {
    return this.warps.find(w =>
      tileX >= w.x && tileX < w.x + w.w &&
      tileY >= w.y && tileY < w.y + w.h
    ) || null;
  }

  encounterPoolAt(tileX, tileY) {
    const zone = this.encounterZones.find(z =>
      tileX >= z.x && tileX < z.x + z.w &&
      tileY >= z.y && tileY < z.y + z.h
    );
    return zone ? zone.pool : null;
  }

  pixelWidth()  { return this.tilemap ? this.tilemap.widthInPixels  : 0; }
  pixelHeight() { return this.tilemap ? this.tilemap.heightInPixels : 0; }

  destroy() {
    if (this.tilemap) {
      Object.values(this.layers).forEach(l => l.destroy());
      this.tilemap.destroy();
      this.tilemap = null;
      this.layers = {};
      this.warps = [];
      this.encounterZones = [];
      this.npcSpawns = [];
    }
  }
}
