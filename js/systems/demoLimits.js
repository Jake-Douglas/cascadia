// demoLimits.js — enforces hard caps on the browser demo so players don't sink
// hours into a save that browser storage might wipe.
//
// In the desktop build (window.cascadiaDesktop is true), all caps are LIFTED —
// it's the full game.
//
// In the browser build, the game enforces:
//   - Single save slot (already enforced by BrowserSaveAdapter)
//   - Cannot leave the starter region (Cedar Falls + Route 1 + Port Haida)
//   - Cannot earn more than 1 badge
//   - Cannot exceed level 20 on any party member
//   - Save attempts after these caps trigger the "download to continue" prompt
//
// The numbers are tunable. The intent is: enough to feel the game, not enough
// to invest hours. Roughly 30-60 minutes of play.

const DESKTOP = (typeof window !== 'undefined' && window.cascadiaDesktop);

export const IS_DEMO = !DESKTOP;
export const IS_FULL = DESKTOP;

export const DEMO_LIMITS = {
  maxBadges: 1,
  maxPartyLevel: 20,
  allowedMaps: new Set([
    'cedar_falls_house_player',
    'cedar_falls_town',
    'cedar_falls_lab',
    'route_1',
    'port_haida'
  ]),
  // After this much real-time playtime, prompt the player to download.
  // Doesn't block — just nags.
  promptAfterPlaytimeSeconds: 30 * 60
};

// Returns null if the action is allowed, or a string reason if blocked.
export function checkMapAllowed(mapId) {
  if (IS_FULL) return null;
  if (DEMO_LIMITS.allowedMaps.has(mapId)) return null;
  return 'This area is part of the full game. Download Cascadia to continue your journey.';
}

export function checkLevelCap(level) {
  if (IS_FULL) return null;
  if (level <= DEMO_LIMITS.maxPartyLevel) return null;
  return `Demo Pokémon are capped at Level ${DEMO_LIMITS.maxPartyLevel}. Download Cascadia for the full level cap.`;
}

export function checkBadgeCap(badgeCount) {
  if (IS_FULL) return null;
  if (badgeCount < DEMO_LIMITS.maxBadges) return null;
  return `The demo includes ${DEMO_LIMITS.maxBadges} badge. Download Cascadia for the full Gym Challenge.`;
}

export function shouldShowDownloadPrompt(state) {
  if (IS_FULL) return false;
  if ((state.playtimeSeconds || 0) >= DEMO_LIMITS.promptAfterPlaytimeSeconds) return true;
  if ((state.badges || []).length >= DEMO_LIMITS.maxBadges) return true;
  return false;
}

// URL the "Download" button takes the user to. We'll fill this in with the real
// release page later (probably a Netlify-hosted landing page or an itch.io page).
export const DOWNLOAD_URL = 'https://cascadia-game.netlify.app/download';
