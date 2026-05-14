// ============================================================
// Gambit Launch Pads
//
// Any slime block launches the player ~45 blocks in the direction
// they are facing. Only fires outside of matches.
//
// Tune LAUNCH_HORIZONTAL and LAUNCH_VERTICAL to adjust distance/arc.
//   LAUNCH_HORIZONTAL: blocks/tick — controls distance (~45 blocks at 4.5)
//   LAUNCH_VERTICAL:   blocks/tick upward — controls arc height
// ============================================================

var LAUNCH_HORIZONTAL  = 6.5;
var LAUNCH_VERTICAL    = 1.5;
var LAUNCH_COOLDOWN_MS = 2000;
var launchCooldowns    = {}; // { playerName: expiresAtMs }
var Vec3 = Java.loadClass('net.minecraft.world.phys.Vec3');

PlayerEvents.tick(function(event) {
  var player = event.player;
  if (hasTagSafe(player, 'Red') || hasTagSafe(player, 'Blue')) return;
  if (player.isCreative()) return;

  var name = getPlayerName(player);
  if (!name) return;

  var now = Date.now();
  if (launchCooldowns[name] && now < launchCooldowns[name]) return;

  try {
    var pos = player.blockPosition();
    var below = player.level.getBlock(pos.x, pos.y - 1, pos.z);
    if (!below || below.id !== 'minecraft:slime_block') return;
  } catch(e) {
    return;
  }

  // getLookAngle() returns a Vec3 implementing Position — use x()/z() methods not fields
  var look = player.getLookAngle();
  if (!look) return;
  var vx = look.x() * LAUNCH_HORIZONTAL;
  var vz = look.z() * LAUNCH_HORIZONTAL;

  player.setDeltaMovement(new Vec3(vx, LAUNCH_VERTICAL, vz));
  player.hurtMarked = true;
  launchCooldowns[name] = now + LAUNCH_COOLDOWN_MS;
  console.log('[LaunchPad] launched ' + name + ' vx=' + vx.toFixed(2) + ' vz=' + vz.toFixed(2));
});

