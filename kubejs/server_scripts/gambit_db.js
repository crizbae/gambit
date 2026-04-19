// gambit_db.js — MySQL helper. Loads before other gambit_*.js scripts.

var GAMBIT_DB_CONFIG_PATH = 'kubejs/data/gambit_db_config.json';

var _gambitDb = {
  config: null,
  connection: null,
  enabled: false,
  driverLoaded: false
};

(function() {
  try {
    Java.loadClass('com.mysql.cj.jdbc.Driver');
    _gambitDb.driverLoaded = true;
  } catch (e) {
    try {
      Java.loadClass('com.mysql.jdbc.Driver');
      _gambitDb.driverLoaded = true;
    } catch (e2) {}
  }
})();

function gambitDbLoadConfig() {
  try {
    var raw = JsonIO.read(GAMBIT_DB_CONFIG_PATH);
    if (raw && raw.enabled) {
      if (!_gambitDb.driverLoaded) {
        console.warn('[Gambit DB] MySQL is enabled in config but the JDBC driver was not found.');
        console.warn('[Gambit DB] Place mysql-connector-j-*.jar on the server classpath and restart.');
        _gambitDb.enabled = false;
        return false;
      }
      _gambitDb.config = {
        host: String(raw.host || 'localhost'),
        port: Number(raw.port || 3306),
        database: String(raw.database || 'gambit'),
        username: String(raw.username || 'root'),
        password: String(raw.password || '')
      };
      _gambitDb.enabled = true;
      return true;
    }
  } catch (e) {
    console.warn('[Gambit DB] Could not read config: ' + e);
  }
  _gambitDb.enabled = false;
  return false;
}

function gambitDbConnect() {
  if (!_gambitDb.enabled || !_gambitDb.driverLoaded || !_gambitDb.config) return false;

  try {
    if (_gambitDb.connection && !_gambitDb.connection.isClosed()) return true;
  } catch (e) {}

  try {
    var DriverManager = Java.loadClass('java.sql.DriverManager');
    var cfg = _gambitDb.config;
    var url = 'jdbc:mysql://' + cfg.host + ':' + cfg.port + '/' + cfg.database
      + '?useSSL=false&allowPublicKeyRetrieval=true&autoReconnect=true'
      + '&connectTimeout=5000&socketTimeout=10000&serverTimezone=UTC';
    _gambitDb.connection = DriverManager.getConnection(url, cfg.username, cfg.password);
    console.info('[Gambit DB] Connected to MySQL at ' + cfg.host + ':' + cfg.port + '/' + cfg.database);
    return true;
  } catch (e) {
    console.error('[Gambit DB] Connection failed: ' + e);
    _gambitDb.connection = null;
    return false;
  }
}

function gambitDbDisconnect() {
  try {
    if (_gambitDb.connection && !_gambitDb.connection.isClosed()) {
      _gambitDb.connection.close();
      console.info('[Gambit DB] Disconnected from MySQL.');
    }
  } catch (e) {}
  _gambitDb.connection = null;
}

function gambitDbIsConnected() {
  if (!_gambitDb.connection) return false;
  try { return !_gambitDb.connection.isClosed(); } catch (e) { return false; }
}

function gambitDbGetConnection() {
  if (gambitDbIsConnected()) return _gambitDb.connection;
  if (gambitDbConnect()) return _gambitDb.connection;
  return null;
}

function gambitDbIsEnabled() {
  return _gambitDb.enabled && _gambitDb.driverLoaded;
}

function gambitDbInitTables() {
  var conn = gambitDbGetConnection();
  if (!conn) return false;

  try {
    var stmt = conn.createStatement();

    stmt.executeUpdate(
      'CREATE TABLE IF NOT EXISTS gambit_player_stats ('
      + ' player_name VARCHAR(32) NOT NULL PRIMARY KEY,'
      + ' damage DOUBLE NOT NULL DEFAULT 0,'
      + ' kills INT NOT NULL DEFAULT 0,'
      + ' deaths INT NOT NULL DEFAULT 0,'
      + ' matches_played INT NOT NULL DEFAULT 0,'
      + ' wins INT NOT NULL DEFAULT 0,'
      + ' mvps INT NOT NULL DEFAULT 0,'
      + ' updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
      + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    stmt.executeUpdate(
      'CREATE TABLE IF NOT EXISTS gambit_match_history ('
      + ' match_id INT AUTO_INCREMENT PRIMARY KEY,'
      + ' map_name VARCHAR(64) NOT NULL,'
      + ' map_id INT NOT NULL DEFAULT 0,'
      + ' mode VARCHAR(16) NOT NULL,'
      + ' winner VARCHAR(8) NOT NULL,'
      + ' duration_seconds INT NOT NULL DEFAULT 0,'
      + ' played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
      + ' INDEX idx_played_at (played_at),'
      + ' INDEX idx_map_name (map_name)'
      + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    stmt.executeUpdate(
      'CREATE TABLE IF NOT EXISTS gambit_match_players ('
      + ' id INT AUTO_INCREMENT PRIMARY KEY,'
      + ' match_id INT NOT NULL,'
      + ' player_name VARCHAR(32) NOT NULL,'
      + ' team VARCHAR(8) NOT NULL,'
      + ' kills INT NOT NULL DEFAULT 0,'
      + ' deaths INT NOT NULL DEFAULT 0,'
      + ' damage DOUBLE NOT NULL DEFAULT 0,'
      + ' FOREIGN KEY (match_id) REFERENCES gambit_match_history(match_id) ON DELETE CASCADE,'
      + ' INDEX idx_player (player_name),'
      + ' INDEX idx_match (match_id)'
      + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    stmt.close();
    console.info('[Gambit DB] Tables ready (gambit_player_stats, gambit_match_history, gambit_match_players).');
    return true;
  } catch (e) {
    console.error('[Gambit DB] Failed to create tables: ' + e);
    return false;
  }
}

function gambitDbLoadAllStats() {
  var conn = gambitDbGetConnection();
  if (!conn) return null;

  try {
    var stmt = conn.createStatement();
    var rs = stmt.executeQuery(
      'SELECT player_name, damage, kills, deaths, matches_played, wins, mvps FROM gambit_player_stats'
    );
    var result = {};
    while (rs.next()) {
      result[rs.getString('player_name')] = {
        damage: rs.getDouble('damage'),
        kills: rs.getInt('kills'),
        deaths: rs.getInt('deaths'),
        matches: rs.getInt('matches_played'),
        wins: rs.getInt('wins'),
        mvps: rs.getInt('mvps')
      };
    }
    rs.close();
    stmt.close();
    return result;
  } catch (e) {
    console.error('[Gambit DB] Failed to load stats: ' + e);
    return null;
  }
}

function gambitDbSavePlayer(playerName, entry) {
  var conn = gambitDbGetConnection();
  if (!conn || !playerName || !entry) return false;

  try {
    var ps = conn.prepareStatement(
      'INSERT INTO gambit_player_stats (player_name, damage, kills, deaths, matches_played, wins, mvps)'
      + ' VALUES (?, ?, ?, ?, ?, ?, ?)'
      + ' ON DUPLICATE KEY UPDATE damage=VALUES(damage), kills=VALUES(kills),'
      + ' deaths=VALUES(deaths), matches_played=VALUES(matches_played),'
      + ' wins=VALUES(wins), mvps=VALUES(mvps)'
    );
    ps.setString(1, String(playerName));
    ps.setDouble(2, Number(entry.damage) || 0);
    ps.setInt(3, Math.floor(Number(entry.kills) || 0) | 0);
    ps.setInt(4, Math.floor(Number(entry.deaths) || 0) | 0);
    ps.setInt(5, Math.floor(Number(entry.matches) || 0) | 0);
    ps.setInt(6, Math.floor(Number(entry.wins) || 0) | 0);
    ps.setInt(7, Math.floor(Number(entry.mvps) || 0) | 0);
    ps.executeUpdate();
    ps.close();
    return true;
  } catch (e) {
    console.error('[Gambit DB] Failed to save player ' + playerName + ': ' + e);
    return false;
  }
}

function gambitDbSaveAllStats(statsObj) {
  var conn = gambitDbGetConnection();
  if (!conn || !statsObj) return false;

  try {
    var ps = conn.prepareStatement(
      'INSERT INTO gambit_player_stats (player_name, damage, kills, deaths, matches_played, wins, mvps)'
      + ' VALUES (?, ?, ?, ?, ?, ?, ?)'
      + ' ON DUPLICATE KEY UPDATE damage=VALUES(damage), kills=VALUES(kills),'
      + ' deaths=VALUES(deaths), matches_played=VALUES(matches_played),'
      + ' wins=VALUES(wins), mvps=VALUES(mvps)'
    );

    var keys = Object.keys(statsObj);
    for (var i = 0; i < keys.length; i++) {
      var name = keys[i];
      var e = statsObj[name];
      ps.setString(1, String(name));
      ps.setDouble(2, Number(e.damage) || 0);
      ps.setInt(3, Math.floor(Number(e.kills) || 0) | 0);
      ps.setInt(4, Math.floor(Number(e.deaths) || 0) | 0);
      ps.setInt(5, Math.floor(Number(e.matches) || 0) | 0);
      ps.setInt(6, Math.floor(Number(e.wins) || 0) | 0);
      ps.setInt(7, Math.floor(Number(e.mvps) || 0) | 0);
      ps.addBatch();
    }

    ps.executeBatch();
    ps.close();
    return true;
  } catch (e) {
    console.error('[Gambit DB] Failed to batch-save stats: ' + e);
    return false;
  }
}

function gambitDbResetPlayer(playerName) {
  var conn = gambitDbGetConnection();
  if (!conn || !playerName) return false;

  try {
    var ps = conn.prepareStatement(
      'UPDATE gambit_player_stats SET damage=0, kills=0, deaths=0, matches_played=0, wins=0, mvps=0 WHERE player_name=?'
    );
    ps.setString(1, String(playerName));
    ps.executeUpdate();
    ps.close();
    return true;
  } catch (e) {
    console.error('[Gambit DB] Failed to reset player ' + playerName + ': ' + e);
    return false;
  }
}

function gambitDbResetAll() {
  var conn = gambitDbGetConnection();
  if (!conn) return false;

  try {
    var stmt = conn.createStatement();
    stmt.executeUpdate(
      'UPDATE gambit_player_stats SET damage=0, kills=0, deaths=0, matches_played=0, wins=0, mvps=0'
    );
    stmt.close();
    return true;
  } catch (e) {
    console.error('[Gambit DB] Failed to reset all stats: ' + e);
    return false;
  }
}

// Returns the auto-generated match_id, or -1 on failure.
function gambitDbInsertMatch(mapName, mapId, mode, winner, durationSeconds) {
  var conn = gambitDbGetConnection();
  if (!conn) return -1;

  try {
    // Use createStatement + string SQL to avoid Rhino's PreparedStatement
    // parameter-index overload resolution bug (passes int indices as double).
    var safeName     = String(mapName).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var safeMode     = String(mode).replace(/'/g, "\\'");
    var safeWinner   = String(winner).replace(/'/g, "\\'");
    var safeMapId    = Math.floor(Number(mapId) || 0);
    var safeDuration = Math.floor(Number(durationSeconds) || 0);

    var insertSql = "INSERT INTO gambit_match_history (map_name, map_id, mode, winner, duration_seconds)"
      + " VALUES ('" + safeName + "', " + safeMapId + ", '" + safeMode + "', '" + safeWinner + "', " + safeDuration + ")";

    var stmt = conn.createStatement();
    stmt.executeUpdate(insertSql);
    stmt.close();

    var matchId = -1;
    var idStmt = conn.createStatement();
    var rs = idStmt.executeQuery('SELECT LAST_INSERT_ID() AS last_id');
    if (rs.next()) {
      matchId = parseInt(String(rs.getString('last_id')), 10) || -1;
    }
    rs.close();
    idStmt.close();
    return matchId;
  } catch (e) {
    console.error('[Gambit DB] Failed to insert match: ' + e);
    return -1;
  }
}

function gambitDbInsertMatchPlayers(matchId, players) {
  var conn = gambitDbGetConnection();
  if (!conn || matchId < 0 || !players || players.length === 0) return false;

  try {
    var ps = conn.prepareStatement(
      'INSERT INTO gambit_match_players (match_id, player_name, team, kills, deaths, damage)'
      + ' VALUES (?, ?, ?, ?, ?, ?)'
    );

    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      ps.setInt(1, matchId | 0);
      ps.setString(2, String(p.name));
      ps.setString(3, String(p.team));
      ps.setInt(4, Math.floor(Number(p.kills) || 0) | 0);
      ps.setInt(5, Math.floor(Number(p.deaths) || 0) | 0);
      ps.setDouble(6, Number(p.damage) || 0);
      ps.addBatch();
    }

    ps.executeBatch();
    ps.close();
    return true;
  } catch (e) {
    console.error('[Gambit DB] Failed to insert match players: ' + e);
    return false;
  }
}

gambitDbLoadConfig();
