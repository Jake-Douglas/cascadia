import { BootScene }    from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { WorldScene }   from './scenes/WorldScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 480,
  height: 320,
  pixelArt: true,
  backgroundColor: '#0e0e10',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, PreloadScene, WorldScene]
};

new Phaser.Game(config);
