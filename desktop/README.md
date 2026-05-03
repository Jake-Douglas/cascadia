# Desktop build (Electron)

This folder turns Cascadia into a real downloadable game for Windows, macOS, and Linux.
Players double-click an installer like any other native application — no Whiskey, no
Wine, no compatibility layer.

## What's in here

- `main.js` — Electron main process. Creates the window, handles file I/O for saves.
- `preload.js` — Safe bridge that exposes `window.cascadiaDesktop` to the game.
- `build-resources/` — Icons (.icns, .ico, .png) and other installer assets. Place
  art here when generated. Stub files okay during dev.

## Where saves go (real files on disk, not browser storage)

When players run the desktop build, their saves live in:

| OS | Path |
|----|------|
| Windows | `%APPDATA%\Pokemon Cascadia\saves\slotN.json` |
| macOS | `~/Library/Application Support/Pokemon Cascadia/saves/slotN.json` |
| Linux | `~/.config/Pokemon Cascadia/saves/slotN.json` |

Up to 5 slots. Every save automatically writes a `.bak` of the previous save first,
so a crash mid-write loses one save event, not the whole playthrough.

## Building installers

From the project root:

```bash
# One-time setup
npm install

# Run the Electron version locally to test
npm run dev:server     # in one terminal — serves the game
npm run electron-dev   # in another — opens the Electron window

# Build distributables
npm run build:mac      # produces dist/Pokemon Cascadia-X.Y.Z.dmg (macOS only — needs a Mac)
npm run build:win      # produces dist/Pokemon Cascadia Setup X.Y.Z.exe
npm run build:linux    # produces dist/Pokemon Cascadia-X.Y.Z.AppImage
npm run build          # all three at once (Mac one will only succeed if run on Mac)
```

## Cross-platform reality check

- **Windows and Linux installers** can be built on any OS (Windows, Mac, or Linux machine).
- **Mac installer** can only be built on a Mac. Apple's signing tools are macOS-only.
  - If you don't have a Mac: use GitHub Actions (free macOS build minutes for public repos)
    or rent a cloud Mac for a few cents per build.

## Code signing (deferred until first real release)

Players will see a SmartScreen warning on Windows ("Windows protected your PC") and a
Gatekeeper warning on Mac ("Cascadia can't be opened because it's from an unidentified
developer") on first launch unless the app is signed. Both let users click through.

For a fan game, this is normal — Reborn, Insurgence, Infinite Fusion all ship unsigned.
Signing certificates cost $99/year (Apple) and $200-400/year (Windows). Not worth it
for a hobby project until there's a clear audience.

When ready: signing can be added via electron-builder config without code changes.

## Why Electron

One codebase produces native apps for all three desktop OSes. Same JS/HTML/CSS that
runs in the browser version runs as a real `.app`/`.exe`/`.AppImage`. No emulation
required by players. This is how Discord, VS Code, Slack, Notion, Figma desktop, etc.
ship cross-platform from a web codebase.

Trade-off: ~150 MB installer size (Electron bundles a stripped Chromium). Acceptable
for a Pokémon-scale game where players expect 100MB+ downloads anyway.
