// Shared helpers for Gambit KubeJS scripts.
// Loads before gambit_maps.js and gambit_utils.js (alphabetical).

function hasTagSafe(player, tagName) {
  if (!player || !tagName) return false;
  try {
    if (player.hasTag) return player.hasTag(tagName);
  } catch (e) {
  }

  try {
    if (player.tags && player.tags.includes) return player.tags.includes(tagName);
  } catch (e) {
  }

  try {
    if (player.tags && player.tags.contains) return player.tags.contains(tagName);
  } catch (e) {
  }

  return false;
}

function getPlayerName(player) {
  return player && player.name && player.name.string ? player.name.string : null;
}
