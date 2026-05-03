// save/index.js — picks the right adapter at game start. Game code imports
// `SAVE` from here and uses it; the underlying adapter is invisible.

import { BrowserSaveAdapter } from './BrowserSaveAdapter.js';
import { DesktopSaveAdapter } from './DesktopSaveAdapter.js';
import { newGameState, DEFAULT_SAVE } from './SaveAdapter.js';

function selectAdapter() {
  // Electron preload script sets this — see desktop/preload.js
  if (typeof window !== 'undefined' && window.cascadiaDesktop) {
    try {
      const adapter = new DesktopSaveAdapter();
      console.log('[SAVE] Using desktop adapter');
      return adapter;
    } catch (e) {
      console.warn('[SAVE] Desktop adapter init failed, falling back to browser:', e.message);
    }
  }
  console.log('[SAVE] Using browser adapter');
  return new BrowserSaveAdapter();
}

export const SAVE = selectAdapter();
export { newGameState, DEFAULT_SAVE };
