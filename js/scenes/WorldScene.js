// WorldScene — the overworld. Renders the current map, the player, NPCs.
// Receives data: { mapId, x, y, facing }

import { Player } from '../entities/Player.js';
import { InputManager } from '../systems/inputManager.js';
import { MapManager } from '../systems/mapManager.js';

export class WorldScene extends Phaser.Scene {
  constructor() { super('World'); }

  init(data) {
    this.startMapId  = data.mapId  || 'cedar_falls_town';
    this.startX      = data.x      ?? 12;
    this.startY      = data.y      ?? 8;
    this.startFacing = data.facing || 'down';
  }

  create() {
    this.input_ = new InputManager(this);
    this.maps   = new MapManager(this);

    this.loadMapAndPlayer(this.startMapId, this.startX, this.startY, this.startFacing);

    // Debug HUD
    this.hud = this.add.text(4, 4,
      `Map: ${this.startMapId}\nArrows/WASD to move`,
      { font: '8px monospace', color: '#fafafa', backgroundColor: '#000a', padding: { x: 4, y: 2 } }
    ).setScrollFactor(0).setDepth(1000);
  }

  loadMapAndPlayer(mapId, x, y, facing) {
    const ok = this.maps.loadMap(mapId);
    if (!ok) { console.error('Failed to load map', mapId); return; }

    // Recreate player in new map
    if (this.player) this.player.sprite.destroy();
    this.player = new Player(this, x, y, facing);

    // Camera setup — zoom in close, follow player, clamp to map bounds
    this.cameras.main.setBounds(0, 0, this.maps.pixelWidth(), this.maps.pixelHeight());
    this.cameras.main.startFollow(this.player.sprite, true, 0.2, 0.2);
    this.cameras.main.setZoom(2.5);

    if (this.hud) {
      this.hud.setText(`Map: ${mapId}\nArrows/WASD to move`);
    }
  }

  update(time) {
    if (!this.player) return;
    const input = this.input_.snapshot();
    this.player.update(time, input);
  }

  // === API consumed by Player ===

  isSolid(tx, ty) {
    return this.maps.isSolid(tx, ty);
  }

  warpAt(tx, ty) {
    return this.maps.warpAt(tx, ty);
  }

  triggerWarp(warp) {
    // Fade out, swap map, fade in
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.loadMapAndPlayer(warp.targetMap, warp.targetX, warp.targetY, warp.targetFacing);
      this.cameras.main.fadeIn(150, 0, 0, 0);
    });
  }

  onPlayerStepComplete(tx, ty) {
    // TODO: encounter check, NPC trigger, item pickup, etc.
    const pool = this.maps.encounterPoolAt(tx, ty);
    if (pool) {
      // We'll wire this up to BattleScene later.
      // For now, just log.
      // console.log(`On encounter tile, pool: ${pool}`);
    }
  }
}
