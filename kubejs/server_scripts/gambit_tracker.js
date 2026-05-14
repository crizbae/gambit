// ============================================================
// Gambit Tracker
//
// Runtime event handlers: damage tracking, down/execution system,
// kill credit, kill streaks, revive tracking, and player lifecycle.
//
// Depends on: gambit_billboard.js, gambit_stats.js, gambit_helpers.js
// ============================================================

var DOWNS_CONFIG_FILE                = 'kubejs/data/gambit_downs_config.json';
var LAST_TACZ_ATTACK_TTL_MS          = 15000;
var ATTACKER_CACHE_CLEANUP_INTERVAL_TICKS = 200;

// ── Canonical kit list (Item 3) ───────────────────────────────
// Single source of truth for JS. Used by loggedOut cleanup.
var VALID_KITS = ['assault', 'breacher', 'burst', 'flanker', 'marksman', 'ranger', 'sniper', 'sentry'];

// ── Runtime tracking state ────────────────────────────────────
var recentPlayerAttackers = {};
var currentStreaks         = {}; // { playerName: number } — reset on death, not persisted
var downerNames           = {}; // { deadPlayerName: downerName } — most recent downer (bleed-out kill credit)
var firstDownerNames      = {}; // { deadPlayerName: downerName } — first downer this life (assist credit)
var pendingExecutions     = []; // { victimName, killerName, victimTeam } — deferred to next tick
var _executingVictims     = {}; // { playerName: true } — set while gambit:execution damage is in flight
var syringeCounts         = {}; // { playerName: syringe count last poll } — revive tracking
var recentlyDowned        = {}; // { playerName: expiresAtMs } — window for syringe revive credit

var reviveCheckTicker          = 0;
var attackerCacheCleanupTicker = 0;
var firstBloodDone             = false; // reset by gambit_reset_downs and gambit_match_end

// ── Down limit config ─────────────────────────────────────────
// max_downs: how many times a player can be downed before the next lethal hit kills for real.
// bypass_source_types: getMsgId() strings that skip down tracking (fall, fire, etc.)
var downsConfig = { enabled: true, max_downs: 2, bypass_source_types: [] };

function loadDownsConfig() {
  try {
    var raw = JsonIO.read(DOWNS_CONFIG_FILE);
    if (!raw) return;
    if (typeof raw.enabled === 'boolean') downsConfig.enabled = raw.enabled;
    if (typeof raw.max_downs === 'number') downsConfig.max_downs = Math.max(1, Math.floor(raw.max_downs));
    if (raw.bypass_source_types) {
      var list = [];
      for (var i = 0; i < raw.bypass_source_types.length; i++) {
        list.push(String(raw.bypass_source_types[i]));
      }
      downsConfig.bypass_source_types = list;
    }
  } catch (e) {
    console.error('[Gambit Downs] Failed to load downs config: ' + e);
  }
}

// ── Attacker cache helpers ────────────────────────────────────
function getPlayerId(player) {
  if (!player) return null;
  try { if (player.uuid) return String(player.uuid); } catch (e) {}
  var name = player.name && player.name.string ? player.name.string : null;
  return name ? String(name) : null;
}

function rememberRecentAttacker(victim, attacker) {
  var victimId     = getPlayerId(victim);
  var attackerName = attacker && attacker.name && attacker.name.string ? attacker.name.string : null;
  if (!victimId || !attackerName) return;
  var entry = recentPlayerAttackers[victimId];
  if (!entry || !entry.all) { entry = { last: attackerName, all: {} }; recentPlayerAttackers[victimId] = entry; }
  entry.last = attackerName;
  entry.all[attackerName] = Date.now() + LAST_TACZ_ATTACK_TTL_MS;
}

// Returns { killerName, assistNames[] } — killerName is the last attacker within the TTL window.
function consumeRecentAttackInfo(victim) {
  var victimId = getPlayerId(victim);
  if (!victimId) return { killerName: null, assistNames: [] };
  var entry = recentPlayerAttackers[victimId];
  delete recentPlayerAttackers[victimId];
  if (!entry) return { killerName: null, assistNames: [] };
  var now        = Date.now();
  var killerName = entry.last || null;
  var assistNames = [];
  if (!entry.all) return { killerName: killerName, assistNames: [] };
  // Verify killer entry hasn't expired
  if (killerName && entry.all[killerName] && now > entry.all[killerName]) killerName = null;
  var names = Object.keys(entry.all);
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    if (n === killerName) continue;
    if (now <= entry.all[n]) assistNames.push(n);
  }
  return { killerName: killerName, assistNames: assistNames };
}

function cleanupExpiredAttackerCache() {
  var now       = Date.now();
  var victimIds = Object.keys(recentPlayerAttackers);
  for (var i = 0; i < victimIds.length; i++) {
    var vid   = victimIds[i];
    var entry = recentPlayerAttackers[vid];
    if (!entry || !entry.all) { delete recentPlayerAttackers[vid]; continue; }
    var names = Object.keys(entry.all);
    for (var j = 0; j < names.length; j++) {
      if (now > entry.all[names[j]]) delete entry.all[names[j]];
    }
    if (Object.keys(entry.all).length === 0) delete recentPlayerAttackers[vid];
  }
}

// ── Server loaded ─────────────────────────────────────────────
ServerEvents.loaded(function(event) {
  // Initialize MySQL connection if configured
  if (typeof gambitDbIsEnabled === 'function' && gambitDbIsEnabled()) {
    gambitDbConnect();
    gambitDbInitTables();
  }

  var loaded = loadStatsFromDisk();
  loadBillboardPos();
  // Re-apply forceload for any billboard positions that survived across restarts.
  // loadBillboardPos() restores JS state but does not re-run the forceload command.
  var _bRestoreModes = ['combined', 'elim', 'tdm'];
  for (var _bri = 0; _bri < _bRestoreModes.length; _bri++) {
    var _brp = billboardPositions[_bRestoreModes[_bri]];
    if (_brp) event.server.runCommandSilent('execute in minecraft:overworld run forceload add ' + _brp.x + ' ' + _brp.z);
  }

  // Push authoritative disk stats to online players' NBT.
  // Pulling FROM players here could overwrite clean JSON data with zeroed NBT
  // (e.g. after a /reload that clears persistentData).
  if (event.server && event.server.players) {
    event.server.players.forEach(function(p) {
      if (!p) return;
      var name = p.name && p.name.string ? p.name.string : null;
      if (!name) return;
      if (stats[name]) { saveEntryToPlayer(p); } else { loadEntryFromPlayer(p); }
    });
  }
  if (loaded) saveStatsToDisk();
});

// ── Player login ──────────────────────────────────────────────
PlayerEvents.loggedIn(function(event) {
  var player = event.player;
  var name   = player && player.name && player.name.string ? player.name.string : null;
  if (!name) return;

  // OPs are exempt from forced gamemode and spawn TP so they can work on maps freely.
  if (!player.hasPermissions(2)) {
    player.server.runCommandSilent('gamemode adventure ' + name);
    player.server.runCommandSilent('execute in minecraft:overworld run tp ' + name + ' 0 101 0');
  }

  // Ensure player is in lobby team (covers first-ever login and post-reload edge cases)
  player.server.runCommandSilent('team join lobby ' + name);

  // Reset down counter on join so a disconnect/reconnect between matches starts clean.
  writeTagNumber(player.persistentData, PD_DOWNS, 0, true);
  player.server.runCommandSilent('scoreboard players set ' + name + ' gun_downs 0');

  if (stats[name]) { saveEntryToPlayer(player); return; }
  loadEntryFromPlayer(player);
  markStatsDirty();
});

// ── Respawn ───────────────────────────────────────────────────
EntityEvents.spawned('minecraft:player', function(event) {
  // Reset PD_DOWNS on every spawn/respawn (covers TDM respawns where EntityEvents.death
  // may have already fired but persistent data can get reloaded with stale values).
  var player = event.entity;
  var name   = player && player.name && player.name.string ? player.name.string : null;
  if (!name) return;
  writeTagNumber(player.persistentData, PD_DOWNS, 0, true);
  // Scoreboard is also reset in respawn_player.mcfunction, but belt-and-suspenders.
  player.server.runCommandSilent('scoreboard players set ' + name + ' gun_downs 0');
});

// ── Player logout ─────────────────────────────────────────────
PlayerEvents.loggedOut(function(event) {
  var player = event.player;
  var name   = player && player.name && player.name.string ? player.name.string : null;
  if (!name) return;

  var server = player.server;

  // Team tags
  server.runCommandSilent('tag ' + name + ' remove Red');
  server.runCommandSilent('tag ' + name + ' remove Blue');

  // Death / respawn tags
  server.runCommandSilent('tag ' + name + ' remove gun_dead');
  server.runCommandSilent('tag ' + name + ' remove gun_just_died');
  server.runCommandSilent('tag ' + name + ' remove gun_spec_tp_pending');

  // Queue opt-out
  server.runCommandSilent('tag ' + name + ' remove gun_optout');

  // Kit tags — loop over VALID_KITS so new kits only need to be added in one place
  for (var ki = 0; ki < VALID_KITS.length; ki++) {
    server.runCommandSilent('tag ' + name + ' remove ' + VALID_KITS[ki]);
  }

  // Scoreboard timers / counters
  server.runCommandSilent('scoreboard players set ' + name + ' tdm_respawn_timer 0');
  server.runCommandSilent('scoreboard players set ' + name + ' spec_respawn_timer 0');
  server.runCommandSilent('scoreboard players set ' + name + ' gun_downs 0');

  // Reset gamemode, inventory, effects, and spawnpoint (OPs keep their gamemode and inventory)
  if (!player.hasPermissions(2)) {
    server.runCommandSilent('gamemode adventure ' + name);
    server.runCommandSilent('clear ' + name);
  }
  server.runCommandSilent('effect clear ' + name);
  server.runCommandSilent('spawnpoint ' + name + ' 0 101 0');

  // Place back in lobby team
  server.runCommandSilent('team join lobby ' + name);

  // Persist stats so a restart never loses data for this player.
  // saveEntryToPlayer writes to NBT; saveStatsToDisk flushes to JSON immediately.
  if (stats[name]) {
    saveEntryToPlayer(player);
    saveStatsToDisk();
  }

  // Clear in-memory tracking state for this player
  delete currentStreaks[name];
  delete syringeCounts[name];
  delete recentlyDowned[name];
  delete downerNames[name];
  delete firstDownerNames[name];
});

// ── Server tick ───────────────────────────────────────────────
ServerEvents.tick(function(event) {
  // ── Deferred executions ──────────────────────────────────
  // Processed first each tick so the kill fires as soon as possible after the
  // hurt event that queued it, but outside that event's dispatch cycle.
  if (pendingExecutions.length > 0) {
    var toExecute  = pendingExecutions.slice(0);
    pendingExecutions = [];
    for (var _ei = 0; _ei < toExecute.length; _ei++) {
      var pe = toExecute[_ei];
      if (!pe.victimName) continue;
      var peTarget = getOnlinePlayerByName(event.server, pe.victimName);
      if (peTarget) {
        // Clear hurt cooldown so the execution damage isn't blocked.
        try { peTarget.invulnerableTime = 0; } catch (_ie) {}
        writeTagNumber(peTarget.persistentData, PD_DOWNS, 0, true);
      }
      event.server.runCommandSilent('scoreboard players set ' + pe.victimName + ' gun_downs 0');
      // Close the downed window — this player is being executed, not revived.
      delete recentlyDowned[pe.victimName];
      if (pe.killerName) {
        var killerLookup   = getOnlinePlayerByName(event.server, pe.killerName);
        var execKillerTeam = killerLookup
          ? (hasTagSafe(killerLookup, 'Red') ? 'Red' : (hasTagSafe(killerLookup, 'Blue') ? 'Blue' : null))
          : null;
        var vTeam  = pe.victimTeam || null;
        var kTeam  = execKillerTeam;
        var vColor = vTeam === 'Red' ? 'red' : (vTeam === 'Blue' ? 'aqua' : 'white');
        var kColor = kTeam === 'Red' ? 'red' : (kTeam === 'Blue' ? 'aqua' : 'white');
        var tellrawParts = ['""'];
        if (vTeam) tellrawParts.push('{"text":"[' + vTeam + '] ","color":"' + vColor + '"}');
        tellrawParts.push('{"text":"' + pe.victimName + '","color":"' + vColor + '"}');
        tellrawParts.push('{"text":"' + (pe.finisher ? ' was finished by ' : ' was shot by ') + '","color":"white"}');
        if (kTeam) tellrawParts.push('{"text":"[' + kTeam + '] ","color":"' + kColor + '"}');
        tellrawParts.push('{"text":"' + pe.killerName + '","color":"' + kColor + '"}');
        event.server.runCommandSilent('tellraw @a [' + tellrawParts.join(',') + ']');
      }
      event.server.runCommandSilent('gamerule showDeathMessages false');
      _executingVictims[pe.victimName] = true;
      event.server.runCommandSilent('damage ' + pe.victimName + ' 1000 gambit:execution');
      delete _executingVictims[pe.victimName];
      event.server.runCommandSilent('gamerule showDeathMessages true');
      // Blood burst — runs after damage so the victim's position is still valid for one tick
      event.server.runCommandSilent('execute at ' + pe.victimName + ' run particle minecraft:dust 1 0 0 1 ~ ~1 ~ 0.4 0.6 0.4 0.05 80 normal');
      event.server.runCommandSilent('execute at ' + pe.victimName + ' run particle minecraft:dust 0.6 0 0 0.8 ~ ~1 ~ 0.2 0.4 0.2 0.02 40 normal');
    }
  }

  // ── Clear invulnerableTime for downed players ──────────────
  // PlayerRevive may keep invulnerableTime high while a player is downed, which
  // would block EntityEvents.hurt from firing for finisher sword swings.
  // Clearing it each tick guarantees the sword can always register.
  var _rdNow = Date.now();
  for (var _rdKey in recentlyDowned) {
    if (recentlyDowned[_rdKey] > _rdNow) {
      var _rdP = getOnlinePlayerByName(event.server, _rdKey);
      if (_rdP) try { _rdP.invulnerableTime = 0; } catch (_re) {}
    }
  }

  // ── Attacker cache cleanup + periodic stat save ───────────
  attackerCacheCleanupTicker += 1;
  if (attackerCacheCleanupTicker >= ATTACKER_CACHE_CLEANUP_INTERVAL_TICKS) {
    attackerCacheCleanupTicker = 0;
    cleanupExpiredAttackerCache();
    statsSaveTicker += ATTACKER_CACHE_CLEANUP_INTERVAL_TICKS;
    if (statsDirty && statsSaveTicker >= STATS_FLUSH_INTERVAL_TICKS) {
      saveStatsToDisk();
    }
  }

  // ── Billboard refresh ─────────────────────────────────────
  billboardUpdateTicker += 1;
  if (billboardUpdateTicker >= BILLBOARD_UPDATE_INTERVAL_TICKS) {
    billboardUpdateTicker = 0;
    updateBillboard(event.server);
  }

  // ── Revive tracking ───────────────────────────────────────
  // Poll syringe counts every 10 ticks for in-match players.
  // marbledsfirstaid:syringe is consumed on use. Any decrease in count while the
  // player has a Red or Blue tag and a downed teammate is nearby counts as a revive.
  reviveCheckTicker += 1;
  if (reviveCheckTicker >= 10) {
    reviveCheckTicker = 0;
    if (event.server && event.server.players) {
      event.server.players.forEach(function(p) {
        if (!p) return;
        var pName = p.name && p.name.string ? p.name.string : null;
        if (!pName) return;
        if (!hasTagSafe(p, 'Red') && !hasTagSafe(p, 'Blue')) return;

        var currentCount = 0;
        try {
          var inv     = p.inventory;
          var invSize = inv.getContainerSize ? inv.getContainerSize() : 41;
          for (var _si = 0; _si < invSize; _si++) {
            var _stack = inv.getItem(_si);
            if (_stack && !_stack.isEmpty() && String(_stack.id) === 'marbledsfirstaid:syringe') {
              currentCount += _stack.getCount();
            }
          }
        } catch (_se) {}

        var prevCount = syringeCounts[pName];
        if (typeof prevCount === 'number' && currentCount < prevCount) {
          // Only credit when a downed player is within 4 blocks of the reviver.
          var _now          = Date.now();
          var _rdKeys       = Object.keys(recentlyDowned);
          var _creditedRdName = null;
          for (var _ri = _rdKeys.length - 1; _ri >= 0; _ri--) {
            var _rdName = _rdKeys[_ri];
            if (_now >= recentlyDowned[_rdName]) { delete recentlyDowned[_rdName]; continue; }
            var _downedP = getOnlinePlayerByName(event.server, _rdName);
            if (!_downedP) continue;
            var _dx = _downedP.x - p.x;
            var _dy = _downedP.y - p.y;
            var _dz = _downedP.z - p.z;
            if ((_dx*_dx + _dy*_dy + _dz*_dz) <= 16) { _creditedRdName = _rdName; break; }
          }
          if (_creditedRdName) {
            if (typeof statsTrackingEnabled === 'undefined' || statsTrackingEnabled) {
              loadEntryFromPlayer(p);
              var reviverEntry = getEntry(pName);
              reviverEntry.revives = (reviverEntry.revives || 0) + 1;
              if (!reviverEntry.session || reviverEntry.session.date !== getTodayDateString()) reviverEntry.session = makeDefaultSession();
              reviverEntry.session.revives = (reviverEntry.session.revives || 0) + 1;
              markStatsDirty();
              saveEntryToPlayer(p);
            }
            // Consume the downed window so no second syringe use near the same player
            // causes a duplicate revive credit.
            delete recentlyDowned[_creditedRdName];
          }
        }
        syringeCounts[pName] = currentCount;
      });
    }
  }
});

// ── Damage event ──────────────────────────────────────────────
// source.immediate = the EntityKineticBullet (type: tacz:bullet)
// source.player    = the player who fired the gun
EntityEvents.hurt(function(event) {
  var entity = event.entity;
  var source = event.source;
  var damage = event.damage;

  // Guard: skip re-entry from our own gambit:execution damage command.
  // getMsgId() was removed in MC 1.20.1, so we use a JS flag as the primary guard.
  var _reEntryVictim = entity.name && entity.name.string ? entity.name.string : null;
  if (_reEntryVictim && _executingVictims[_reEntryVictim]) return;
  // Fallback msgId guard (handles outOfWorld / generic_kill from other sources).
  var _srcMsgId = '';
  try { _srcMsgId = String(source.getMsgId()); } catch (e) {
    try { _srcMsgId = String(source.type().msgId()); } catch (e2) {}
  }
  if (_srcMsgId === 'gambit.execution' || _srcMsgId === 'gambit:execution'
      || _srcMsgId === 'generic_kill' || _srcMsgId === 'outOfWorld') return;

  // ── Lobby damage immunity ─────────────────────────────────
  if (entity.player && hasTagSafe(entity, 'gun_in_lobby')) {
    event.cancel();
    return;
  }

  // ── Finisher sword ─────────────────────────────────────────────────────────
  // Resolve attacker — source.player is null for melee in KubeJS 1.20.1;
  // fall back to source.entity / source.directEntity.
  var _fAttacker = null;
  try { if (source.player) _fAttacker = source.player; } catch (_fe1) {}
  if (!_fAttacker) { try { var _fse = source.entity;       if (_fse && _fse.mainHandItem) _fAttacker = _fse; } catch (_fe2) {} }
  if (!_fAttacker) { try { var _fde = source.directEntity; if (_fde && _fde.mainHandItem) _fAttacker = _fde; } catch (_fe3) {} }

  if (_fAttacker && entity && entity.player) {
    var _fItem = null;
    try { _fItem = _fAttacker.mainHandItem; } catch (_fie) {}
    var _fHasFinisher = false;
    if (_fItem) {
      var _fnbtStr = 'null';
      try { _fnbtStr = String(_fItem.nbt); } catch (_fne) {}
      if (_fnbtStr !== 'null') {
        _fHasFinisher = _fnbtStr.indexOf('GambitFinisher') !== -1;
      } else {
        try { _fnbtStr = String(_fItem.orCreateTag); _fHasFinisher = _fnbtStr.indexOf('GambitFinisher') !== -1; } catch (_fne2) {}
      }
      if (!_fHasFinisher) {
        try {
          var _fDispName = String(_fItem.displayName ? _fItem.displayName.string : '');
          _fHasFinisher = (String(_fItem.id) === 'minecraft:iron_sword') && _fDispName.indexOf('Finisher') !== -1;
        } catch (_fne3) {}
      }
    }
    if (_fHasFinisher) {
      event.cancel();
      var _fVName = entity.name && entity.name.string ? entity.name.string : null;
      var _fCross = (hasTagSafe(entity, 'Red') && hasTagSafe(_fAttacker, 'Blue'))
                 || (hasTagSafe(entity, 'Blue') && hasTagSafe(_fAttacker, 'Red'));
      // Consider the victim downed if tracked in recentlyDowned OR if PlayerRevive
      // has them at very low health (it keeps downed players at ≤1 HP).
      var _fIsDowned = _fVName && _fCross && (
        (recentlyDowned[_fVName] && Date.now() < recentlyDowned[_fVName]) ||
        (entity.health <= 1.0 && (hasTagSafe(entity, 'Red') || hasTagSafe(entity, 'Blue')))
      );
      if (_fIsDowned) {
        var _fAlready = false;
        for (var _fpi = 0; _fpi < pendingExecutions.length; _fpi++) {
          if (pendingExecutions[_fpi].victimName === _fVName) { _fAlready = true; break; }
        }
        if (!_fAlready) {
          var _fKName = _fAttacker.name && _fAttacker.name.string ? _fAttacker.name.string : null;
          var _fVTeam = hasTagSafe(entity, 'Red') ? 'Red' : 'Blue';
          pendingExecutions.push({ victimName: _fVName, killerName: _fKName, victimTeam: _fVTeam, finisher: true });
        }
      }
      return;
    }
  }

  // ── TACZ stats tracking ───────────────────────────────────
  var bullet      = source.immediate;
  var isTaczBullet = bullet && bullet.type.toString().indexOf('tacz') !== -1;
  var _hurtMatchActive = typeof matchActive === 'undefined' || matchActive;
  if (isTaczBullet) {
    var shooter = source.player;
    if (shooter) {
      var shooterName  = shooter.name.string;
      if (_hurtMatchActive) {
        var entry        = getEntry(shooterName);
        var roundEntry   = getRoundEntry(shooterName);
        // Cap to remaining health to avoid overkill inflation
        var actualDamage = Math.min(damage, entity.health);
        if (typeof statsTrackingEnabled === 'undefined' || statsTrackingEnabled) entry.damage += actualDamage;
        roundEntry.damage += actualDamage;
        var _dmgInt = Math.floor(actualDamage);
        if (_dmgInt > 0) event.server.runCommandSilent('scoreboard players add ' + shooterName + ' life_dmg ' + _dmgInt);
        if (typeof statsTrackingEnabled === 'undefined' || statsTrackingEnabled) saveEntryToPlayer(shooter);
      }
      if (entity && entity.player) {
        // Only track cross-team hits — skip friendly fire so teammates can't
        // steal kill credit or assist credit.
        var _enemyTeam = (hasTagSafe(entity, 'Red') && hasTagSafe(shooter, 'Blue'))
                      || (hasTagSafe(entity, 'Blue') && hasTagSafe(shooter, 'Red'))
                      || (!hasTagSafe(entity, 'Red') && !hasTagSafe(entity, 'Blue'));
        if (_enemyTeam) rememberRecentAttacker(entity, shooter);
      }
    }
  }

  // ── Down limit ────────────────────────────────────────────
  if (entity && entity.player
      && (hasTagSafe(entity, 'Red') || hasTagSafe(entity, 'Blue'))
      && !hasTagSafe(entity, 'gun_just_died')
      && damage >= entity.health
      && _hurtMatchActive) {

    var srcMsgId  = '';
    try { srcMsgId = String(source.getMsgId()); } catch (e) {}
    if (srcMsgId === 'gambit.execution' || srcMsgId === 'gambit:execution') return;

    // Tournament mode: skip downs entirely — every lethal hit is an immediate kill.
    if (typeof tournamentMode !== 'undefined' && tournamentMode) {
      var tVictimName = entity.name && entity.name.string ? entity.name.string : null;
      if (tVictimName) {
        var tVictimId   = getPlayerId(entity);
        var tDowner     = tVictimId ? recentPlayerAttackers[tVictimId] : null;
        var tDownerName = tDowner ? (tDowner.last || null) : null;
        var tVictimTeam = hasTagSafe(entity, 'Red') ? 'Red' : (hasTagSafe(entity, 'Blue') ? 'Blue' : null);
        var _tAlreadyQueued = false;
        for (var _ti = 0; _ti < pendingExecutions.length; _ti++) {
          if (pendingExecutions[_ti].victimName === tVictimName) { _tAlreadyQueued = true; break; }
        }
        if (!_tAlreadyQueued) {
          pendingExecutions.push({ victimName: tVictimName, killerName: tDownerName, victimTeam: tVictimTeam });
        }
      }
      return;
    }

    var isBypassed = downsConfig.bypass_source_types.indexOf(srcMsgId) !== -1;
    if (!downsConfig.enabled || isBypassed) return;

    var victimName = entity.name && entity.name.string ? entity.name.string : null;
    // Skip if the player is already in a downed window — prevents non-finisher melee /
    // bullet splash from re-triggering down logic while they're waiting for execution or revive.
    if (victimName && recentlyDowned[victimName] && Date.now() < recentlyDowned[victimName]) return;
    var currentDowns = Math.floor(readTagNumber(entity.persistentData, PD_DOWNS, 0));

    // Peek at attacker cache (don't consume — EntityEvents.death still needs it).
    var victimId      = getPlayerId(entity);
    var downerCached  = victimId ? recentPlayerAttackers[victimId] : null;
    var downerNameHurt = downerCached ? (downerCached.last || null) : null;

    // Store downer for bleed-out kill credit (always updated to most recent downer).
    // firstDownerNames is set once per life and never overwritten — used for assist credit.
    // Only set when the downer is on the opposite team (block friendly-fire credit).
    if (downerNameHurt && victimName && downerNameHurt !== victimName) {
      var _downerP = getOnlinePlayerByName(event.server, downerNameHurt);
      var _friendlyFire = _downerP && (
        (hasTagSafe(entity, 'Red')  && hasTagSafe(_downerP, 'Red')) ||
        (hasTagSafe(entity, 'Blue') && hasTagSafe(_downerP, 'Blue'))
      );
      if (!_friendlyFire) {
        downerNames[victimName] = downerNameHurt;
        if (!firstDownerNames[victimName]) firstDownerNames[victimName] = downerNameHurt;
      }
    }
    if (victimName) currentStreaks[victimName] = 0;

    var newDowns = currentDowns + 1;
    writeTagNumber(entity.persistentData, PD_DOWNS, newDowns, true);
    if (victimName) {
      event.server.runCommandSilent('scoreboard players set ' + victimName + ' gun_downs ' + newDowns);
      recentlyDowned[victimName] = Date.now() + 15000;
    }
    // Down confirmation sound — played only to the downer.
    if (downerNameHurt && downerNameHurt !== victimName) {
      event.server.runCommandSilent('execute as ' + downerNameHurt + ' at @s run playsound minecraft:block.note_block.bass master @s ~ ~ ~ 1.5 1.0');
      event.server.runCommandSilent('execute as ' + downerNameHurt + ' at @s run playsound minecraft:entity.hostile.big_fall master @s ~ ~ ~ 1.5 0.7');
    }

    if (currentDowns >= downsConfig.max_downs && victimName) {
      var _alreadyQueued = false;
      for (var _pei = 0; _pei < pendingExecutions.length; _pei++) {
        if (pendingExecutions[_pei].victimName === victimName) { _alreadyQueued = true; break; }
      }
      if (!_alreadyQueued) {
        var execVictimTeam = hasTagSafe(entity, 'Red') ? 'Red' : (hasTagSafe(entity, 'Blue') ? 'Blue' : null);
        pendingExecutions.push({ victimName: victimName, killerName: downerNameHurt || null, victimTeam: execVictimTeam });
      }
    }
  }
});

// ── Death event ───────────────────────────────────────────────
EntityEvents.death(function(event) {
  var dead = event.entity;
  if (!dead || !dead.player) return;

  var deadName = dead.name && dead.name.string ? dead.name.string : null;
  if (!deadName) return;

  // PlayerRevive cancels LivingDeathEvent (HIGH priority) before KubeJS sees it,
  // so this handler only fires for true final deaths: gambit:execution and bled_to_death.
  var sourceId  = '';
  try { sourceId = String(event.source.getMsgId()); } catch (e) {}
  var isBleedOut = (sourceId === 'bled_to_death');

  var _attackInfo = consumeRecentAttackInfo(dead);
  var killerName  = _attackInfo.killerName;

  currentStreaks[deadName] = 0;
  delete recentlyDowned[deadName];

  // Cancel any queued execution — they're already dead.
  for (var _pi = pendingExecutions.length - 1; _pi >= 0; _pi--) {
    if (pendingExecutions[_pi].victimName === deadName) pendingExecutions.splice(_pi, 1);
  }

  writeTagNumber(dead.persistentData, PD_DOWNS, 0, true);
  event.server.runCommandSilent('scoreboard players set ' + deadName + ' gun_downs 0');

  if (typeof matchActive === 'undefined' || matchActive) {
    var entry      = getEntry(deadName);
    if (typeof statsTrackingEnabled === 'undefined' || statsTrackingEnabled) {
      entry.deaths += 1;
      var _dMode = (typeof currentModeId !== 'undefined') ? currentModeId : -1;
      if (_dMode === 1) entry.tdm_deaths  = (entry.tdm_deaths  || 0) + 1;
      else if (_dMode === 0) entry.elim_deaths = (entry.elim_deaths || 0) + 1;
    }
    var deadRoundEntry = getRoundEntry(deadName);
    deadRoundEntry.deaths = (deadRoundEntry.deaths || 0) + 1;
    if (typeof statsTrackingEnabled === 'undefined' || statsTrackingEnabled) saveEntryToPlayer(dead);
  }

  // For bleed-outs the attacker cache has almost certainly expired (bleed timer is 60s,
  // cache TTL is 15s). Fall back to the stored downer as the kill credit.
  if ((!killerName || killerName === deadName) && isBleedOut) {
    killerName = downerNames[deadName] || null;
  }

  delete downerNames[deadName];
  var firstDowner = firstDownerNames[deadName];
  delete firstDownerNames[deadName];

  if (!killerName || killerName === deadName) return;
  if (!(typeof matchActive === 'undefined' || matchActive)) return;

  var killerPlayer = getOnlinePlayerByName(event.server, killerName);
  if (killerPlayer) loadEntryFromPlayer(killerPlayer);

  var killerEntry      = getEntry(killerName);
  var killerRoundEntry = getRoundEntry(killerName);
  if (typeof statsTrackingEnabled === 'undefined' || statsTrackingEnabled) {
    killerEntry.kills += 1;
    var _kMode = (typeof currentModeId !== 'undefined') ? currentModeId : -1;
    if (_kMode === 1) killerEntry.tdm_kills  = (killerEntry.tdm_kills  || 0) + 1;
    else if (_kMode === 0) killerEntry.elim_kills = (killerEntry.elim_kills || 0) + 1;
  }
  killerRoundEntry.kills += 1;
  event.server.runCommandSilent('scoreboard players add ' + killerName + ' life_kills 1');
  // Kill confirmation sound — sharp high-pitched pling played only to the killer.
  // Suppressed when a killstreak fires this same kill (streak replaces kill sound).
  var _isStreakKill = streak >= 4 && streak % 4 === 0;
  if (killerPlayer && !_isStreakKill) {
    event.server.runCommandSilent('execute as ' + killerName + ' at @s run playsound minecraft:entity.horse.land master @s ~ ~ ~ 1.5 2');
    event.server.runCommandSilent('execute as ' + killerName + ' at @s run playsound minecraft:entity.experience_orb.pickup master @s ~ ~ ~ 1.5 2');
  }

  // First blood announcement (suppressed in tournament mode).
  if (!firstBloodDone && !(typeof tournamentMode !== 'undefined' && tournamentMode)) {
    firstBloodDone = true;
    var _kColor = killerPlayer
      ? (hasTagSafe(killerPlayer, 'Red') ? 'red' : (hasTagSafe(killerPlayer, 'Blue') ? 'aqua' : 'red'))
      : 'red';
    var _vColor = dead
      ? (hasTagSafe(dead, 'Red') ? 'red' : (hasTagSafe(dead, 'Blue') ? 'aqua' : 'red'))
      : 'red';
    event.server.runCommandSilent('tellraw @a ["",' +
      '{"text":"\u2620 FIRST BLOOD ","color":"dark_red","bold":true},' +
      '{"text":"' + killerName.replace(/"/g, '') + '","color":"' + _kColor + '","bold":true},' +
      '{"text":" drew first blood on ","color":"dark_red","bold":true},' +
      '{"text":"' + deadName.replace(/"/g, '') + '","color":"' + _vColor + '","bold":true}' +
    ']');
  }

  // Kill streak tracking.
  currentStreaks[killerName] = (currentStreaks[killerName] || 0) + 1;
  var streak = currentStreaks[killerName];
  if ((typeof statsTrackingEnabled === 'undefined' || statsTrackingEnabled) && streak > (killerEntry.longest_streak || 0)) {
    killerEntry.longest_streak = streak;
    if (!killerEntry.session || killerEntry.session.date !== getTodayDateString()) killerEntry.session = makeDefaultSession();
    if (streak > (killerEntry.session.longest_streak || 0)) killerEntry.session.longest_streak = streak;
  }

  // Killstreak sound — plays on reward milestones (multiples of 4), only for the killer.
  if (killerPlayer && _isStreakKill) {
    event.server.runCommandSilent('execute as ' + killerName + ' at @s run playsound minecraft:block.bell.use master @s ~ ~ ~ 1.5 1.5');
  }

  // TDM kill streak rewards + announcements.
  var _isTdm = typeof currentModeId !== 'undefined' && currentModeId === 1;
  if (_isTdm && killerPlayer && streak >= 4 && streak % 4 === 0) {
    var _kColorStreak = hasTagSafe(killerPlayer, 'Red') ? 'red' : 'aqua';
    event.server.runCommandSilent('tellraw @a ["",' +
      '{"text":"' + killerName.replace(/"/g, '') + '","color":"' + _kColorStreak + '","bold":true},' +
      '{"text":" is on a ' + streak + '-kill streak!","color":"gold","bold":true}' +
    ']');
    if      (streak === 4)  killerPlayer.give(Item.of('minecraft:golden_apple', 3));
    else if (streak === 8)  killerPlayer.give(Item.of('marbledsfirstaid:panacea_pills', 1));
    else if (streak === 12) killerPlayer.give(Item.of('marbledsfirstaid:morphine', 1));
    else if (streak === 16) killerPlayer.give(Item.of('marbledsfirstaid:panacea_pills', 1));
    else if (streak === 20) {
      killerPlayer.give(Item.of('minecraft:golden_apple', 3));
      killerPlayer.give(Item.of('marbledsfirstaid:bandages', 5));
    }
    else if (streak === 24) killerPlayer.give(Item.of('minecraft:enchanted_golden_apple', 1));
    killerPlayer.give(Item.of('minecraft:golden_carrot', 4, '{display:{Name:\'{"text":"Golden Rations","italic":false}\'}}'));
  }

  if (typeof statsTrackingEnabled === 'undefined' || statsTrackingEnabled) {
    markStatsDirty();
    if (killerPlayer) saveEntryToPlayer(killerPlayer);
  }

  // Assists: only credit the first player who downed the victim this life.
  var _assistSet = {};
  if (firstDowner && firstDowner !== killerName && firstDowner !== deadName) {
    _assistSet[firstDowner] = true;
  }
  var _assistList = Object.keys(_assistSet);
  for (var _aci = 0; _aci < _assistList.length; _aci++) {
    var _assistorName   = _assistList[_aci];
    var _assistorPlayer = getOnlinePlayerByName(event.server, _assistorName);
    if (_assistorPlayer) loadEntryFromPlayer(_assistorPlayer);
    var _assistorEntry      = getEntry(_assistorName);
    if (typeof statsTrackingEnabled === 'undefined' || statsTrackingEnabled) _assistorEntry.assists = (_assistorEntry.assists || 0) + 1;
    var _assistorRoundEntry = getRoundEntry(_assistorName);
    _assistorRoundEntry.assists = (_assistorRoundEntry.assists || 0) + 1;
    if (typeof statsTrackingEnabled === 'undefined' || statsTrackingEnabled) {
      markStatsDirty();
      if (_assistorPlayer) saveEntryToPlayer(_assistorPlayer);
    }
    if (_assistorPlayer) {
      var _assistorIsRed  = hasTagSafe(_assistorPlayer, 'Red');
      var _deadColor      = _assistorIsRed ? '§b' : '§c'; // enemy = opposite team
      var _finishColor    = _assistorIsRed ? '§c' : '§b'; // finisher = same team
      _assistorPlayer.tell('§7[§eAssist§7] You helped take down ' + _deadColor + deadName + '§7, finished by ' + _finishColor + killerName + '§7.');
    }
  }
});

loadDownsConfig();
