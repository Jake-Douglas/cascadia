// BrowserSaveAdapter — localStorage backed save for the browser demo build.
//
// Limitations (deliberate, since browser storage is volatile):
//   - Single slot only
//   - Demo cap: hard-coded badge/playtime ceiling enforced by the game shell,
//     not this adapter (this adapter just stores whatever it's given).
//   - Strongly recommends export-to-file via UI button.

import { SaveAdapter } from './SaveAdapter.js';

const KEY = 'cascadia_save_v1';

export class BrowserSaveAdapter extends SaveAdapter {
  name() { return 'Browser (localStorage)'; }
  isPersistent() { return false; }
  maxSlots() { return 1; }

  async listSlots() {
    const state = await this.read(0);
    if (!state) return [];
    return [{
      slot: 0,
      savedAt: state.savedAt,
      playtimeSeconds: state.playtimeSeconds || 0,
      playerName: state.player?.name || 'Player',
      badges: (state.badges || []).length
    }];
  }

  async read(slot = 0) {
    if (slot !== 0) return null;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('[BrowserSaveAdapter] read failed:', e);
      return null;
    }
  }

  async write(state, slot = 0) {
    if (slot !== 0) throw new Error('Browser adapter only supports slot 0');
    state.savedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('[BrowserSaveAdapter] write failed:', e);
      return false;
    }
  }

  async delete(slot = 0) {
    if (slot === 0) localStorage.removeItem(KEY);
  }

  // === Demo-only helpers (not part of base interface) ===

  // Manual export of the save to a downloaded JSON file. Critical for browser
  // demo since localStorage can be wiped without warning.
  exportToFile(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cascadia_save_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Manual import from a user-selected JSON file.
  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (!parsed.version) throw new Error('Invalid save file (no version)');
          resolve(parsed);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}
