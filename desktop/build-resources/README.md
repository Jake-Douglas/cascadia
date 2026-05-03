# Build Resources

Place installer assets here before building distributables.

## Required files

- `icon.icns` — macOS icon (1024×1024 PNG converted to .icns)
- `icon.ico` — Windows icon (256×256 multi-resolution .ico)
- `icon.png` — Linux icon (512×512 PNG)

## Optional

- `background.png` — DMG background image for Mac installer (540×380)
- `installer-sidebar.bmp` — Windows NSIS installer sidebar (164×314)

## How to generate

We'll generate these from a single 1024×1024 PNG once we have a Cascadia logo.
Tools like https://cloudconvert.com/png-to-icns and https://convertico.com handle
the format conversions. For now this folder can stay empty — Electron will use
its default icons during dev.
