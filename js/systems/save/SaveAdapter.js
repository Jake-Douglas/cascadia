// SaveAdapter — abstract interface for save/load operations.
//
// Game code calls SAVE.write(state), SAVE.read(slot), etc. without knowing
// whether the underlying storage is browser localStorage or a real file on
// disk via Electron. The adapter is selected at game start based on environment.
//
// Implementations:
//   - BrowserSaveAdapter (js/systems/save/BrowserSaveAdapter.js)
//       Used in browser demo. localStorage. Single slot. Volatile.
//   - DesktopSaveAdapter (js/systems/save/DesktopSaveAdapter.js)
//       Used in Electron build. Real files on disk. Multiple slots. Persistent.
//       Also auto-creates .bak before each save.
//
// To select adapter:
//   - If `window.cascadiaDesktop` exists (set by Electron preload script), use Desktop
//   - Else, use Browser
//
// All methods return Promises so the API is identical regardless of backend
// (file IO is async; localStorage is technically sync but we wrap it for consistency).

export const DEFAULT_SAVE = Object.freeze({
  version: 1,
  player: {
    name: 'Player',
    gender: 'boy',
    mapId: 'cedar_falls_house_player',
    x: 5,
    y: 7,
    facing: 'down'
  },
  party: [],
  storage: [],
  pokedex: {},
  bag: {
    items:    { pokeball: 5, potion: 3 },
    keyItems: []
  },
  badges: [],
  flags: {},
  playtimeSeconds: 0,
  savedAt: null
});

export function newGameState() {
  return JSON.parse(JSON.stringify(DEFAULT_SAVE));
}

// Abstract class — both adapters implement this exact surface.
export class SaveAdapter {
  // Return list of available slots: [{ slot, savedAt, playtimeSeconds, playerName, badges }, ...]
  async listSlots() { throw new Error('not implemented'); }

  // Read save state from a slot. Returns null if empty.
  async read(slot = 0) { throw new Error('not implemented'); }

  // Write save state to a slot.
  async write(state, slot = 0) { throw new Error('not implemented'); }

  // Delete a slot.
  async delete(slot = 0) { throw new Error('not implemented'); }

  // Returns max number of slots this adapter supports.
  maxSlots() { return 1; }

  // Returns adapter name for UI display.
  name() { return 'Unknown'; }

  // Returns true if this adapter persists across browser data clears.
  isPersistent() { return false; }
}
