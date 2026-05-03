// PreloadScene — loads every asset the game will need. Shows a progress bar.
// As we add maps, tilesets, sprites etc., add their loaders here.

import { MAP_REGISTRY } from '../data/maps.js';

// Tilesets — list every tileset PNG the game uses. The KEY here must match the
// "name" of the tileset inside the Tiled JSON (this is how Phaser links them).
const TILESETS = {
  cascadia_outdoor: 'assets/tilesets/outdoor/cascadia_outdoor.png',
  interior_house:   'assets/tilesets/interior/interior_house.png',
  interior_lab:     'assets/tilesets/interior/interior_lab.png'
};

// Overworld sprite sheets — frame layout: 16x16 tiles, 3 cols (idle/step-L/step-R) x 4 rows (down/left/right/up)
const OVERWORLD_SHEETS = {
  player_walk: 'assets/sprites/overworld/player_walk.png'
};

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    this.drawLoadingBar();

    // Load tilesets as plain images
    for (const [key, path] of Object.entries(TILESETS)) {
      this.load.image(key, path);
    }

    // Load sprite sheets
    for (const [key, path] of Object.entries(OVERWORLD_SHEETS)) {
      this.load.spritesheet(key, path, { frameWidth: 16, frameHeight: 16 });
    }

    // Load all maps from the registry
    for (const [mapId, config] of Object.entries(MAP_REGISTRY)) {
      this.load.tilemapTiledJSON(mapId, config.jsonPath);
    }
  }

  create() {
    // Skip title for now — go straight into the world for testing
    this.scene.start('World', { mapId: 'cedar_falls_town', x: 12, y: 8, facing: 'down' });
  }

  drawLoadingBar() {
    const { width, height } = this.cameras.main;
    const barW = width * 0.6;
    const barH = 8;
    const x = (width - barW) / 2;
    const y = height / 2;

    const bg = this.add.rectangle(x, y, barW, barH, 0x222222).setOrigin(0);
    bg.setStrokeStyle(1, 0x666666);
    const fill = this.add.rectangle(x + 1, y + 1, 0, barH - 2, 0xc4382a).setOrigin(0);

    const label = this.add.text(width / 2, y - 18, 'Loading Cascadia…',
      { font: '12px monospace', color: '#e8e0d4' }).setOrigin(0.5);

    this.load.on('progress', p => {
      fill.width = (barW - 2) * p;
    });
  }
}
