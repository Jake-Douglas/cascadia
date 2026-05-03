// Electron preload script. Runs in the renderer's context but with access to
// Node APIs and Electron's ipcRenderer. Exposes a SAFE limited API to the game
// via window.cascadiaDesktop. The game NEVER gets full Node access — only the
// specific methods exposed here.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cascadiaDesktop', {
  // Save/load
  listSlots:   ()                  => ipcRenderer.invoke('save:list'),
  readSlot:    (slot)              => ipcRenderer.invoke('save:read', slot),
  writeSlot:   (slot, jsonString)  => ipcRenderer.invoke('save:write', slot, jsonString),
  deleteSlot:  (slot)              => ipcRenderer.invoke('save:delete', slot),
  getSavesDir: ()                  => ipcRenderer.invoke('save:dir'),

  // Shell
  openSavesDir: ()                 => ipcRenderer.invoke('shell:openSavesDir'),

  // Build identification — the game can show different UI in browser vs desktop
  isDesktop: true,
  platform: process.platform     // 'win32' | 'darwin' | 'linux'
});
