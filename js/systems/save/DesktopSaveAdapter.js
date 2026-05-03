// DesktopSaveAdapter — uses real files on disk via Electron's IPC bridge.
//
// The Electron preload script (desktop/preload.js) exposes a `cascadiaDesktop`
// object on window with these methods:
//   - listSlots()
//   - readSlot(slot)
//   - writeSlot(slot, jsonString)  — also auto-writes a .bak of previous save
//   - deleteSlot(slot)
//   - getSavesDir()                 — for "show me my saves folder" UX
//
// Game code never touches `window.cascadiaDesktop` directly — only this adapter
// does. This keeps platform coupling in one file.
//
// Save files live in the OS standard user data folder:
//   Windows: %APPDATA%/PokemonCascadia/saves/slotN.json
//   macOS:   ~/Library/Application Support/PokemonCascadia/saves/slotN.json
//   Linux:   ~/.config/PokemonCascadia/saves/slotN.json
//
// Each save creates a .bak of the previous save before overwriting. So if a
// crash mid-save corrupts slotN.json, slotN.json.bak is one save behind but
// intact.

import { SaveAdapter } from './SaveAdapter.js';

const MAX_SLOTS = 5;

export class DesktopSaveAdapter extends SaveAdapter {
  constructor() {
    super();
    if (!window.cascadiaDesktop) {
      throw new Error('DesktopSaveAdapter requires Electron preload bridge — fall back to BrowserSaveAdapter');
    }
    this.bridge = window.cascadiaDesktop;
  }

  name() { return 'Desktop (file system)'; }
  isPersistent() { return true; }
  maxSlots() { return MAX_SLOTS; }

  async listSlots() {
    try {
      const slots = await this.bridge.listSlots();
      return slots.map(s => ({
        slot: s.slot,
        savedAt: s.savedAt,
        playtimeSeconds: s.playtimeSeconds || 0,
        playerName: s.playerName || 'Player',
        badges: s.badges || 0
      }));
    } catch (e) {
      console.error('[DesktopSaveAdapter] listSlots failed:', e);
      return [];
    }
  }

  async read(slot = 0) {
    try {
      const raw = await this.bridge.readSlot(slot);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error(`[DesktopSaveAdapter] read slot ${slot} failed:`, e);
      return null;
    }
  }

  async write(state, slot = 0) {
    state.savedAt = new Date().toISOString();
    try {
      await this.bridge.writeSlot(slot, JSON.stringify(state, null, 2));
      return true;
    } catch (e) {
      console.error(`[DesktopSaveAdapter] write slot ${slot} failed:`, e);
      return false;
    }
  }

  async delete(slot = 0) {
    try {
      await this.bridge.deleteSlot(slot);
    } catch (e) {
      console.error(`[DesktopSaveAdapter] delete slot ${slot} failed:`, e);
    }
  }

  // Desktop-only convenience for "Open Saves Folder" menu item
  async getSavesDir() {
    try { return await this.bridge.getSavesDir(); }
    catch (e) { return null; }
  }
}
