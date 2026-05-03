// InputManager — single source of truth for input state. Player and other 
// entities read from this rather than touching keyboard directly.
// Resolves the question "which direction is being held right now?" with priority
// rules so diagonal presses don't lock movement.

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys('W,A,S,D');
    this.actionKeys = scene.input.keyboard.addKeys('Z,X,ENTER,SHIFT,SPACE,ESC');
    
    // Track direction press order so that pressing a new direction takes 
    // priority over a still-held old direction
    this.pressOrder = [];
    this.lastDir = null;

    // Single-shot action tracking
    this._aJustPressed = false;
    this._bJustPressed = false;
    this._startJustPressed = false;
    this.scene.input.keyboard.on('keydown-Z', () => this._aJustPressed = true);
    this.scene.input.keyboard.on('keydown-ENTER', () => this._aJustPressed = true);
    this.scene.input.keyboard.on('keydown-SPACE', () => this._aJustPressed = true);
    this.scene.input.keyboard.on('keydown-X', () => this._bJustPressed = true);
    this.scene.input.keyboard.on('keydown-SHIFT', () => this._bJustPressed = true);
    this.scene.input.keyboard.on('keydown-ESC', () => this._startJustPressed = true);
  }

  // Returns the currently-most-recently-pressed direction, or null
  getDirection() {
    const isDown = {
      up:    this.cursors.up.isDown    || this.wasd.W.isDown,
      down:  this.cursors.down.isDown  || this.wasd.S.isDown,
      left:  this.cursors.left.isDown  || this.wasd.A.isDown,
      right: this.cursors.right.isDown || this.wasd.D.isDown
    };

    // Update press order: newly-pressed dirs go to the front, released dirs removed
    for (const d of ['up','down','left','right']) {
      if (isDown[d] && !this.pressOrder.includes(d)) this.pressOrder.unshift(d);
      if (!isDown[d]) this.pressOrder = this.pressOrder.filter(x => x !== d);
    }

    return this.pressOrder[0] || null;
  }

  // Snapshot of input state for the frame
  snapshot() {
    const snap = {
      direction: this.getDirection(),
      aPressed: this._aJustPressed,
      bPressed: this._bJustPressed,
      startPressed: this._startJustPressed
    };
    // Reset edge-trigger flags so each press counts once
    this._aJustPressed = false;
    this._bJustPressed = false;
    this._startJustPressed = false;
    return snap;
  }
}
