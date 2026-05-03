// AnimationPlayer — plays move animations from JSON descriptors that mirror
// Pokémon Essentials' animation format. We use Essentials-format sprite sheets
// (192×192 cels, 5 cels per row, transparent background) directly.
//
// USAGE in a battle scene:
//   const player = new AnimationPlayer(this, { userPos, targetPos });
//   await player.play('ember');                    // promise resolves when done
//   await player.play('vine_whip', { fromOpponent: true });
//
// FORMAT of an animation JSON (loaded from assets/animations/json/<id>.json):
//   {
//     "id": "ember",
//     "displayName": "Ember",
//     "sheet": "ember",              // -> assets/animations/sheets/ember.png
//     "cellSize": 192,
//     "cellsPerRow": 5,
//     "fps": 20,                     // frames per second of the animation
//     "background": null,            // optional: assets/animations/backgrounds/<id>.png
//     "sound": null,                 // optional: assets/animations/sounds/<id>.ogg
//     "screenShake": null,           // optional: { atFrame: 8, intensity: 4, duration: 200 }
//     "screenFlash": null,           // optional: { atFrame: 0, color: 0xffffff, alpha: 0.4, duration: 100 }
//     "frames": [                    // array of frame definitions, played in order
//       {
//         "duration": 1,             // how many animation frames this frame holds
//         "cels": [                  // each cel = one sprite drawn this frame
//           {
//             "cel": 0,              // index into the sheet (0 = top-left)
//             "focus": "user",       // "user" | "target" | "midpoint" | "screen"
//             "x": 0,                // offset from focus point in pixels
//             "y": 0,
//             "scale": 1.0,
//             "rotation": 0,         // degrees
//             "alpha": 1.0,
//             "tint": null,          // optional hex color for tinting
//             "blend": "normal"      // "normal" | "add" | "screen"
//           }
//         ]
//       }
//     ]
//   }
//
// FALLBACK: if a move has no animation file, the player draws a simple
// type-colored "flash + impact" placeholder so the battle still feels alive.

import { MOVES } from '../../data/moves.js';

const TYPE_COLORS = {
  normal:   0xc8c8a0, fire:     0xf08030, water:    0x6890f0,
  grass:    0x78c850, electric: 0xf8d030, ice:      0x98d8d8,
  fighting: 0xc03028, poison:   0xa040a0, ground:   0xe0c068,
  flying:   0xa890f0, psychic:  0xf85888, bug:      0xa8b820,
  rock:     0xb8a038, ghost:    0x705898, dragon:   0x7038f8,
  dark:     0x705848, steel:    0xb8b8d0, fairy:    0xee99ac
};

export class AnimationPlayer {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.userPos = opts.userPos || { x: 120, y: 220 };
    this.targetPos = opts.targetPos || { x: 360, y: 100 };
    // Cache: id -> parsed animation descriptor
    this.animationCache = new Map();
  }

  // Plays a move animation. Returns a Promise that resolves when the animation
  // is fully done (so the battle engine can wait before applying damage text).
  async play(moveId, opts = {}) {
    const flip = opts.fromOpponent === true;

    // Try to load the animation descriptor; fall back to placeholder
    const anim = await this.loadAnimation(moveId);
    if (!anim) {
      return this.playPlaceholder(moveId, flip);
    }
    return this.playFromDescriptor(anim, flip);
  }

  async loadAnimation(moveId) {
    if (this.animationCache.has(moveId)) return this.animationCache.get(moveId);
    // Reborn pack uses concatenated names like "firepunch.json"
    // Cascadia uses snake_case like "fire_punch"
    // Try both variants in order
    const variants = [moveId, moveId.replace(/_/g, '')];
    for (const variant of variants) {
      try {
        const res = await fetch(`assets/animations/json/${variant}.json`);
        if (res.ok) {
          const raw = await res.json();
          const json = this.expandCompactFormat(raw);
          this.animationCache.set(moveId, json);
          await this.ensureSheetLoaded(json);
          return json;
        }
      } catch (e) { /* try next variant */ }
    }
    this.animationCache.set(moveId, null);
    return null;
  }

  // Converts the on-disk compact format to the verbose internal format.
  // On-disk: { id, n, s, cs, cr, fps, snd, f: [{d, c: [{i, fc, x, y, s, r, a, b, fl}]}] }
  // Internal: { id, displayName, sheet, cellSize, cellsPerRow, fps, sound, frames: [...] }
  expandCompactFormat(raw) {
    if (raw.frames) return raw;  // already verbose
    const focusMap = ['screen', 'user', 'target', 'midpoint'];
    const blendMap = ['normal', 'add', 'screen'];
    return {
      id: raw.id,
      displayName: raw.n || '',
      sheet: raw.s || '',
      cellSize: raw.cs || 192,
      cellsPerRow: raw.cr || 5,
      fps: raw.fps || 20,
      sound: raw.snd || null,
      // Timing events from the on-disk JSON. Types (tt):
      //   0 = play SE,    1 = set BG,   2 = mod BG,
      //   3 = set FG,     4 = mod FG
      // Plus optional flash effect (fs/fc/fd) on any timing.
      timings: (raw.t || []).map(t => ({
        frame: t.f || 0,
        type: t.tt || 0,
        name: t.n || null,
        duration: t.d || 5,
        volume: (t.v != null) ? t.v / 100 : 0.8,
        pitch: (t.p != null) ? t.p / 100 : 1.0,
        flashScope: t.fs || 0,
        flashColor: t.fc || null,
        flashDuration: t.fd || 5,
        opacity: t.o,
        bgX: t.bx, bgY: t.by
      })),
      frames: (raw.f || []).map(frame => ({
        duration: frame.d || 1,
        cels: (frame.c || []).map(cel => ({
          cel: cel.i ?? 0,
          focus: focusMap[cel.fc ?? 3] || 'midpoint',
          x: cel.x || 0,
          y: cel.y || 0,
          scale: cel.s ?? 1.0,
          rotation: cel.r || 0,
          alpha: cel.a ?? 1.0,
          blend: blendMap[cel.b || 0],
          flip: cel.fl === 1
        }))
      }))
    };
  }

  ensureSheetLoaded(anim) {
    return new Promise((resolve) => {
      const key = `anim_${anim.id}`;
      const sheetReady = this.scene.textures.exists(key);

      // Collect audio files we need to preload (from tt: 0 timings + the
      // top-level anim.sound, if any). Each timing's `name` may include any of
      // these extensions (Reborn's pack uses .wav primarily, with .ogg/.mp3
      // siblings); Phaser will pick whatever the browser can decode.
      const audioToLoad = [];
      const queueAudio = (name) => {
        if (!name) return;
        // Strip any extension; we'll pass all available sibling formats so
        // Phaser can fall back gracefully across browsers.
        const base = name.replace(/\.(wav|ogg|mp3)$/i, '');
        const audioKey = `sfx_${base}`;
        if (this.scene.cache.audio.exists(audioKey)) return;
        const baseUrl = `assets/animations/sounds/${encodeURIComponent(base)}`;
        // Reborn ships .wav for most clips; .ogg for some; .mp3 for a few.
        // Provide all candidates — Phaser will use the first that loads.
        audioToLoad.push({ key: audioKey, urls: [
          `${baseUrl}.ogg`, `${baseUrl}.wav`, `${baseUrl}.mp3`
        ]});
      };

      if (anim.sound) queueAudio(anim.sound);
      for (const t of anim.timings || []) {
        if (t.type === 0 && t.name) queueAudio(t.name);
      }

      // Sheet/background may already be loaded
      const needsSheet = !sheetReady && anim.sheet;
      if (!needsSheet && audioToLoad.length === 0) {
        resolve();
        return;
      }

      if (needsSheet) {
        const sheetName = (anim.sheet || '').replace(/\.png$/i, '');
        const sheetUrl = `assets/animations/sheets/${encodeURIComponent(sheetName)}.png`;
        this.scene.load.spritesheet(key, sheetUrl, {
          frameWidth: anim.cellSize || 192,
          frameHeight: anim.cellSize || 192
        });
        if (anim.background) {
          const bgName = anim.background.replace(/\.png$/i, '');
          this.scene.load.image(`anim_bg_${anim.id}`, `assets/animations/backgrounds/${encodeURIComponent(bgName)}.png`);
        }
      }
      for (const a of audioToLoad) {
        this.scene.load.audio(a.key, a.urls);
      }
      this.scene.load.once('complete', () => resolve());
      // Loader errors are non-fatal (audio file might genuinely be missing)
      this.scene.load.once('loaderror', () => { /* swallow per-file failure */ });
      this.scene.load.start();
    });
  }

  // Resolves a focus point name into world coordinates
  focalPos(focus, flip) {
    const u = flip ? this.targetPos : this.userPos;
    const t = flip ? this.userPos   : this.targetPos;
    switch (focus) {
      case 'user':     return { x: u.x, y: u.y };
      case 'target':   return { x: t.x, y: t.y };
      case 'midpoint': return { x: (u.x + t.x) / 2, y: (u.y + t.y) / 2 };
      case 'screen':   return { x: this.scene.cameras.main.width / 2, y: this.scene.cameras.main.height / 2 };
      default:         return { x: t.x, y: t.y };
    }
  }

  async playFromDescriptor(anim, flip) {
    return new Promise((resolve) => {
      const sheetKey = `anim_${anim.id}`;
      const fps = anim.fps || 20;
      const frameDelay = 1000 / fps;
      const layer = this.scene.add.container(0, 0).setDepth(500);
      const sprites = [];

      // Schedule timing events (sound effects, flash, BG/FG color tints).
      // These come from the original Reborn `@timing` array and fire at
      // `frame * frameDelay` ms into the animation.
      for (const t of anim.timings || []) {
        const at = (t.frame || 0) * frameDelay;
        if (t.type === 0 && t.name) {
          // Play SE
          const base = t.name.replace(/\.(wav|ogg|mp3)$/i, '');
          const audioKey = `sfx_${base}`;
          this.scene.time.delayedCall(at, () => {
            if (this.scene.cache.audio.exists(audioKey)) {
              try {
                this.scene.sound.play(audioKey, {
                  volume: t.volume ?? 0.8,
                  rate: t.pitch ?? 1.0
                });
              } catch (e) { /* audio decode failure is non-fatal */ }
            }
          });
        }
        // Flash effect (any timing type can carry one)
        if (t.flashScope > 0 && t.flashColor) {
          this.scene.time.delayedCall(at, () => {
            const [r, g, b] = t.flashColor;
            this.scene.cameras.main.flash(
              (t.flashDuration || 5) * frameDelay,
              r, g, b
            );
          });
        }
      }

      // Optional one-shot effects from the descriptor
      if (anim.screenFlash) {
        this.scene.cameras.main.flash(
          anim.screenFlash.duration || 100,
          (anim.screenFlash.color >> 16) & 0xff,
          (anim.screenFlash.color >> 8) & 0xff,
          anim.screenFlash.color & 0xff
        );
      }
      if (anim.screenShake) {
        this.scene.cameras.main.shake(
          anim.screenShake.duration || 200,
          (anim.screenShake.intensity || 4) / 1000
        );
      }
      if (anim.background) {
        const bg = this.scene.add.image(
          this.scene.cameras.main.width / 2,
          this.scene.cameras.main.height / 2,
          `anim_bg_${anim.id}`
        ).setAlpha(0.5);
        layer.add(bg);
      }

      let totalDuration = 0;
      let cumulative = 0;

      for (const frame of anim.frames) {
        const startAt = cumulative;
        const cels = frame.cels || [];

        // Schedule each cel's appearance
        for (const cel of cels) {
          this.scene.time.delayedCall(startAt * frameDelay, () => {
            const focus = this.focalPos(cel.focus || 'target', flip);
            const offsetX = (flip && (cel.focus === 'user' || cel.focus === 'target')) ? -cel.x : cel.x;
            const sprite = this.scene.add.sprite(
              focus.x + (offsetX || 0),
              focus.y + (cel.y || 0),
              sheetKey,
              cel.cel || 0
            );
            sprite.setScale(cel.scale ?? 1);
            if (cel.rotation) sprite.setRotation(cel.rotation * Math.PI / 180);
            sprite.setAlpha(cel.alpha ?? 1);
            if (cel.tint) sprite.setTint(cel.tint);
            if (cel.blend === 'add')    sprite.setBlendMode(Phaser.BlendModes.ADD);
            if (cel.blend === 'screen') sprite.setBlendMode(Phaser.BlendModes.SCREEN);
            if (flip) sprite.setFlipX(true);
            layer.add(sprite);
            sprites.push(sprite);

            // Auto-remove cel at end of its frame block
            this.scene.time.delayedCall((frame.duration || 1) * frameDelay, () => {
              sprite.destroy();
            });
          });
        }

        cumulative += frame.duration || 1;
      }
      totalDuration = cumulative * frameDelay;

      // Resolve when all frames + a small buffer are done
      this.scene.time.delayedCall(totalDuration + 50, () => {
        sprites.forEach(s => { if (s.active) s.destroy(); });
        layer.destroy();
        resolve();
      });
    });
  }

  // Fallback animation when a move has no JSON descriptor.
  // Type-colored projectile-or-flash based on move category.
  async playPlaceholder(moveId, flip) {
    const move = MOVES[moveId];
    const color = move ? (TYPE_COLORS[move.type] || 0xffffff) : 0xffffff;
    const isStatus = move && move.category === 'status';

    return new Promise((resolve) => {
      if (isStatus) {
        // Status move: flash the user briefly, screen tint
        const flash = this.scene.add.rectangle(
          this.scene.cameras.main.width / 2,
          this.scene.cameras.main.height / 2,
          this.scene.cameras.main.width,
          this.scene.cameras.main.height,
          color, 0.2
        ).setDepth(499).setScrollFactor(0);
        this.scene.tweens.add({
          targets: flash, alpha: 0, duration: 400, ease: 'Power2',
          onComplete: () => { flash.destroy(); resolve(); }
        });
      } else {
        // Damage move: little colored projectile from user to target
        const u = flip ? this.targetPos : this.userPos;
        const t = flip ? this.userPos   : this.targetPos;
        const proj = this.scene.add.circle(u.x, u.y, 8, color).setDepth(500);
        this.scene.tweens.add({
          targets: proj,
          x: t.x, y: t.y,
          duration: 300, ease: 'Quad.easeOut',
          onComplete: () => {
            // Impact flash + small camera shake
            this.scene.cameras.main.shake(150, 0.005);
            const burst = this.scene.add.circle(t.x, t.y, 12, color, 0.8).setDepth(501);
            this.scene.tweens.add({
              targets: burst, scale: 2.5, alpha: 0, duration: 250,
              onComplete: () => { burst.destroy(); resolve(); }
            });
            proj.destroy();
          }
        });
      }
    });
  }
}
