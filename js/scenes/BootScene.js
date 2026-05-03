// BootScene — sets up early Phaser configs that need to happen before any
// asset loading. Then transitions to PreloadScene.

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // Anything needed to render the loading screen itself would go here.
    // We don't need anything fancy yet.
  }

  create() {
    this.scene.start('Preload');
  }
}
