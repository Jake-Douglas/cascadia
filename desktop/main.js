// Electron main process. Runs in Node.js, creates the BrowserWindow that loads the game.
//
// To run in dev: `npm run electron-dev` from project root (starts a local HTTP server
// then opens the Electron window pointing at it).
//
// To build distributables: `npm run build` -- spits out installers in dist/
//
// Save files live in app.getPath('userData')/saves/ which resolves to:
//   Windows: %APPDATA%/Pokemon Cascadia/saves/
//   macOS:   ~/Library/Application Support/Pokemon Cascadia/saves/
//   Linux:   ~/.config/Pokemon Cascadia/saves/

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

// Auto-updater (only kicks in for packaged builds, not dev)
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  // electron-updater not installed (e.g. raw dev environment) — skip silently
}

const SAVES_DIR = path.join(app.getPath('userData'), 'saves');

async function ensureSavesDir() {
  await fs.mkdir(SAVES_DIR, { recursive: true });
}

function slotPath(slot) {
  return path.join(SAVES_DIR, `slot${slot}.json`);
}

function bakPath(slot) {
  return path.join(SAVES_DIR, `slot${slot}.json.bak`);
}

// === IPC handlers — exposed to the game via preload.js ===

ipcMain.handle('save:list', async () => {
  await ensureSavesDir();
  const files = await fs.readdir(SAVES_DIR).catch(() => []);
  const slots = [];
  for (const f of files) {
    const m = f.match(/^slot(\d+)\.json$/);
    if (!m) continue;
    const slot = Number(m[1]);
    try {
      const raw = await fs.readFile(path.join(SAVES_DIR, f), 'utf8');
      const data = JSON.parse(raw);
      slots.push({
        slot,
        savedAt: data.savedAt,
        playtimeSeconds: data.playtimeSeconds || 0,
        playerName: data.player?.name || 'Player',
        badges: (data.badges || []).length
      });
    } catch (e) { /* corrupted slot, skip */ }
  }
  return slots.sort((a, b) => a.slot - b.slot);
});

ipcMain.handle('save:read', async (_evt, slot) => {
  await ensureSavesDir();
  try {
    return await fs.readFile(slotPath(slot), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
});

ipcMain.handle('save:write', async (_evt, slot, jsonString) => {
  await ensureSavesDir();
  // Backup current save (if any) before overwriting
  try {
    const existing = await fs.readFile(slotPath(slot), 'utf8');
    await fs.writeFile(bakPath(slot), existing, 'utf8');
  } catch (e) {
    // No existing save = no backup needed
  }
  await fs.writeFile(slotPath(slot), jsonString, 'utf8');
  return true;
});

ipcMain.handle('save:delete', async (_evt, slot) => {
  await fs.unlink(slotPath(slot)).catch(() => {});
  await fs.unlink(bakPath(slot)).catch(() => {});
  return true;
});

ipcMain.handle('save:dir', async () => SAVES_DIR);

ipcMain.handle('shell:openSavesDir', async () => {
  await ensureSavesDir();
  shell.openPath(SAVES_DIR);
});

// === Window creation ===

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: 'Pokémon Cascadia',
    backgroundColor: '#0e0e10',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // In dev: load from local HTTP server (so live-reload works)
  // In production: load from packaged index.html
  const devUrl = process.env.CASCADIA_DEV_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'index.html'));
  }

  // Hide the menu bar in production for a cleaner game-like feel
  if (!devUrl) win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Auto-update check (production only — dev builds skip)
  if (autoUpdater && app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log(`Cascadia: update available, version ${info.version}`);
    });
    autoUpdater.on('update-downloaded', async (info) => {
      const choice = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        title: 'Update Ready',
        message: `Cascadia ${info.version} is ready to install.`,
        detail: 'The game needs to restart to apply the update. Your save will be preserved.'
      });
      if (choice.response === 0) autoUpdater.quitAndInstall();
    });
    autoUpdater.on('error', (err) => {
      console.error('Cascadia: auto-update error', err);
    });

    // Check on startup
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('Cascadia: update check failed', err);
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
