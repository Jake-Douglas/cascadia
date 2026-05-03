// Player entity. Grid-based movement (Pokémon style):
// - Each press = step exactly one tile in that direction
// - Hold = continuous stepping
// - Cannot move through solid tiles
// - First press in a new direction TURNS the player without moving (one frame),
//   subsequent press of same direction MOVES — this matches Pokémon games and
//   prevents accidentally walking off a ledge when you only meant to face it.

const TILE_SIZE = 16;
const STEP_DURATION_MS = 180;     // Time to traverse one tile
const TURN_GRACE_MS = 80;         // Press-to-step delay if facing changed

export class Player {
  constructor(scene, startX, startY, facing = 'down') {
    this.scene = scene;
    this.tileX = startX;
    this.tileY = startY;
    this.facing = facing;
    this.isMoving = false;
    this.lastTurnAt = 0;
    this.queuedDir = null;

    // Sprite — uses 'player_walk' texture sheet (4 dirs x 3 frames = 12 frames)
    // Frame layout: down 0/1/2, left 3/4/5, right 6/7/8, up 9/10/11
    // Frame index in row: 0 = idle, 1 = step-left, 2 = step-right
    this.sprite = scene.add.sprite(
      startX * TILE_SIZE + TILE_SIZE / 2,
      startY * TILE_SIZE + TILE_SIZE / 2,
      'player_walk',
      this.frameForDir(facing, 'idle')
    );
    this.sprite.setOrigin(0.5, 0.75); // anchor near feet for above-layer overlap
    this.sprite.setDepth(10);

    this.stepFrame = 'left'; // alternates between steps for walk cycle
  }

  frameForDir(dir, phase) {
    // Returns sprite frame index. phase = 'idle' | 'left' | 'right'
    const rowMap  = { down: 0, left: 1, right: 2, up: 3 };
    const colMap  = { idle: 0, left: 1, right: 2 };
    return rowMap[dir] * 3 + colMap[phase];
  }

  setFacing(dir) {
    if (this.facing === dir) return;
    this.facing = dir;
    this.sprite.setFrame(this.frameForDir(dir, 'idle'));
    this.lastTurnAt = this.scene.time.now;
  }

  // Called by InputManager every frame
  update(time, inputState) {
    if (this.isMoving) return;

    const dir = inputState.direction;
    if (!dir) return;

    // If facing has just changed (player pivoted), give a small grace period
    // before walking. This is the classic Pokémon "tap to turn, hold to walk" feel.
    if (dir !== this.facing) {
      this.setFacing(dir);
      return; // turn this frame, don't step
    }

    // Allow tiny grace after turn so a quick double-tap turns then walks
    if (time - this.lastTurnAt < TURN_GRACE_MS) return;

    // Compute target tile
    const [dx, dy] = this.dirToVec(dir);
    const tx = this.tileX + dx;
    const ty = this.tileY + dy;

    // Ask the scene if target is walkable
    if (this.scene.isSolid(tx, ty)) {
      // Bonk: face the wall, play short bump effect later
      return;
    }

    // Check for warp at target
    const warp = this.scene.warpAt(tx, ty);
    if (warp) {
      this.scene.triggerWarp(warp);
      return;
    }

    // Step
    this.stepTo(tx, ty);
  }

  stepTo(tx, ty) {
    this.isMoving = true;
    this.tileX = tx;
    this.tileY = ty;

    // Alternate walk frame each step
    this.stepFrame = this.stepFrame === 'left' ? 'right' : 'left';
    this.sprite.setFrame(this.frameForDir(this.facing, this.stepFrame));

    this.scene.tweens.add({
      targets: this.sprite,
      x: tx * TILE_SIZE + TILE_SIZE / 2,
      y: ty * TILE_SIZE + TILE_SIZE / 2,
      duration: STEP_DURATION_MS,
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false;
        // Return to idle frame
        this.sprite.setFrame(this.frameForDir(this.facing, 'idle'));

        // Notify scene we landed (for encounter checks, etc.)
        this.scene.onPlayerStepComplete(this.tileX, this.tileY);
      }
    });
  }

  dirToVec(dir) {
    switch (dir) {
      case 'up':    return [0, -1];
      case 'down':  return [0,  1];
      case 'left':  return [-1, 0];
      case 'right': return [ 1, 0];
    }
    return [0, 0];
  }

  // Returns the tile directly in front of the player (for interactions)
  getTileInFront() {
    const [dx, dy] = this.dirToVec(this.facing);
    return { x: this.tileX + dx, y: this.tileY + dy };
  }
}
