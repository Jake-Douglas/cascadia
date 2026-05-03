// Map Registry. Every map in the game is listed here. The MapManager loads
// them on demand. To add a new map: build it in Tiled, export JSON, drop it 
// in assets/maps/, register it here.

export const MAP_REGISTRY = {

  // === Player's starting house ===
  cedar_falls_house_player: {
    jsonPath: 'assets/maps/cedar_falls_house_player.json',
    tilesets: ['interior_house'],
    music: null,
    indoor: true
  },

  // === Starting town ===
  cedar_falls_town: {
    jsonPath: 'assets/maps/cedar_falls_town.json',
    tilesets: ['cascadia_outdoor'],
    music: null,
    indoor: false
  },

  // === Professor's lab ===
  cedar_falls_lab: {
    jsonPath: 'assets/maps/cedar_falls_lab.json',
    tilesets: ['interior_lab'],
    music: null,
    indoor: true
  },

  // === First route — leads north out of town ===
  route_1: {
    jsonPath: 'assets/maps/route_1.json',
    tilesets: ['cascadia_outdoor'],
    music: null,
    indoor: false
  },

  // === First gym town ===
  port_haida: {
    jsonPath: 'assets/maps/port_haida.json',
    tilesets: ['cascadia_outdoor'],
    music: null,
    indoor: false
  }

  // ... add more here as we build them
};

export function getMapConfig(mapId) {
  return MAP_REGISTRY[mapId] || null;
}
