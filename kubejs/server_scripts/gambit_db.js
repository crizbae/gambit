// gambit_db.js — MySQL helper. Loads before other gambit_*.js scripts.

var GAMBIT_DB_CONFIG_PATH = 'kubejs/data/gambit_db_config.json';

var _gambitDb = {
  config: null,
  connection: null,
  enabled: false,
  driverLoaded: false,
  driverInstance: null  // set when loaded via URLClassLoader fallback
};

// Try to find the MySQL connector JAR under libraries/com/mysql/mysql-connector-j/
// Returns the File object if found, null otherwise.
function _gambitFindDriverJar() {
  try {
    var File = Java.loadClass('java.io.File');
    var root = new File('libraries/com/mysql/mysql-connector-j');
    if (!root.isDirectory()) return null;
    var versions = root.listFiles();
    if (!versions) return null;
    for (var vi = 0; vi < versions.length; vi++) {
      if (!versions[vi].isDirectory()) continue;
      var jars = versions[vi].listFiles();
      if (!jars) continue;
      for (var ji = 0; ji < jars.length; ji++) {
        var n = jars[ji].getName();
        if (n.indexOf('mysql-connector') !== -1 && n.lastIndexOf('.jar') === n.length - 4) {
          return jars[ji];
        }
      }
    }
  } catch (e) {}
  return null;
}

(function() {
  // 1. Try normal class lookup (works if JAR is on the mod classloader).
  try {
    Java.loadClass('com.mysql.cj.jdbc.Driver');
    _gambitDb.driverLoaded = true;
    return;
  } catch (e) {}
  try {
    Java.loadClass('com.mysql.jdbc.Driver');
    _gambitDb.driverLoaded = true;
    return;
  } catch (e) {}

  // 2. Fallback: load the JAR directly via URLClassLoader.
  try {
    var jarFile = _gambitFindDriverJar();
    if (!jarFile) {
      console.warn('[Gambit DB] MySQL driver JAR not found under libraries/com/mysql/mysql-connector-j/.');
      return;
    }
    var URLClassLoader = Java.loadClass('java.net.URLClassLoader');
    var parentLoader = Java.loadClass('java.lang.Object').class.getClassLoader();
    var ucl = new URLClassLoader([jarFile.toURI().toURL()], parentLoader);
    var driverClass;
    try {
      driverClass = ucl.loadClass('com.mysql.cj.jdbc.Driver');
    } catch (e) {
      driverClass = ucl.loadClass('com.mysql.jdbc.Driver');
    }
    _gambitDb.driverInstance = driverClass.getDeclaredConstructor().newInstance();
    _gambitDb.driverLoaded = true;
    console.info('[Gambit DB] MySQL driver loaded via URLClassLoader from ' + jarFile.getPath());
  } catch (e) {
    console.warn('[Gambit DB] URLClassLoader driver load failed: ' + e);
  }
})();

function gambitDbLoadConfig() {
  try {
    var raw = JsonIO.read(GAMBIT_DB_CONFIG_PATH);
    if (raw && raw.enabled) {
      if (!_gambitDb.driverLoaded) {
        console.warn('[Gambit DB] MySQL is enabled in config but the JDBC driver was not found.');
        console.warn('[Gambit DB] Place mysql-connector-j-*.jar under libraries/com/mysql/mysql-connector-j/<version>/ and restart.');
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

  var cfg = _gambitDb.config;
  var url = 'jdbc:mysql://' + cfg.host + ':' + cfg.port + '/' + cfg.database
    + '?useSSL=false&allowPublicKeyRetrieval=true&autoReconnect=true'
    + '&connectTimeout=5000&socketTimeout=10000&serverTimezone=UTC';

  try {
    if (_gambitDb.driverInstance) {
      // Driver was loaded via URLClassLoader — connect through the driver instance directly
      // because DriverManager won't see a driver loaded by a child classloader.
      var Properties = Java.loadClass('java.util.Properties');
      var props = new Properties();
      props.setProperty('user', cfg.username);
      props.setProperty('password', cfg.password);
      _gambitDb.connection = _gambitDb.driverInstance.connect(url, props);
      if (!_gambitDb.connection) throw new Error('driver.connect() returned null — URL not accepted');
    } else {
      var DriverManager = Java.loadClass('java.sql.DriverManager');
      _gambitDb.connection = DriverManager.getConnection(url, cfg.username, cfg.password);
    }
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
  try {
    if (_gambitDb.connection.isClosed()) return false;
    // isValid() actually pings the server; catches silently-dropped TCP connections
    // that isClosed() alone cannot detect (e.g. MySQL wait_timeout expiry).
    return _gambitDb.connection.isValid(2);
  } catch (e) { return false; }
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
      + ' assists INT NOT NULL DEFAULT 0,'
      + ' longest_streak INT NOT NULL DEFAULT 0,'
      + ' revives INT NOT NULL DEFAULT 0,'
      + ' elim_score_total DOUBLE NOT NULL DEFAULT 0,'
      + ' elim_matches INT NOT NULL DEFAULT 0,'
      + ' tdm_score_total DOUBLE NOT NULL DEFAULT 0,'
      + ' tdm_matches INT NOT NULL DEFAULT 0,'
      + ' updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
      + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    // Migration: add columns that may be missing from older installations.
    // Each ALTER TABLE is run individually; MySQL error 1060 (Duplicate column name)
    // is silently ignored because it just means the column already exists.
    var psColMigrations = [
      ['gambit_player_stats', 'assists',          'INT NOT NULL DEFAULT 0'],
      ['gambit_player_stats', 'longest_streak',   'INT NOT NULL DEFAULT 0'],
      ['gambit_player_stats', 'revives',          'INT NOT NULL DEFAULT 0'],
      ['gambit_player_stats', 'elim_score_total', 'DOUBLE NOT NULL DEFAULT 0'],
      ['gambit_player_stats', 'elim_matches',     'INT NOT NULL DEFAULT 0'],
      ['gambit_player_stats', 'tdm_score_total',  'DOUBLE NOT NULL DEFAULT 0'],
      ['gambit_player_stats', 'tdm_matches',      'INT NOT NULL DEFAULT 0']
    ];
    for (var mci = 0; mci < psColMigrations.length; mci++) {
      try {
        var mStmt = conn.createStatement();
        mStmt.executeUpdate('ALTER TABLE ' + psColMigrations[mci][0]
          + ' ADD COLUMN ' + psColMigrations[mci][1] + ' ' + psColMigrations[mci][2]);
        mStmt.close();
        console.info('[Gambit DB] Migration: added ' + psColMigrations[mci][0] + '.' + psColMigrations[mci][1]);
      } catch (mColErr) {
        var mColMsg = String(mColErr);
        if (mColMsg.indexOf('Duplicate column') === -1 && mColMsg.indexOf('1060') === -1) {
          console.warn('[Gambit DB] Migration warning: ' + mColErr);
        }
      }
    }

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
      + ' assists INT NOT NULL DEFAULT 0,'
      + ' match_score DOUBLE NOT NULL DEFAULT 0,'
      + ' FOREIGN KEY (match_id) REFERENCES gambit_match_history(match_id) ON DELETE CASCADE,'
      + ' INDEX idx_player (player_name),'
      + ' INDEX idx_match (match_id)'
      + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    // Migration for gambit_match_players
    var mpColMigrations = [
      ['gambit_match_players', 'assists',     'INT NOT NULL DEFAULT 0'],
      ['gambit_match_players', 'match_score', 'DOUBLE NOT NULL DEFAULT 0']
    ];
    for (var mpi = 0; mpi < mpColMigrations.length; mpi++) {
      try {
        var mpStmt = conn.createStatement();
        mpStmt.executeUpdate('ALTER TABLE ' + mpColMigrations[mpi][0]
          + ' ADD COLUMN ' + mpColMigrations[mpi][1] + ' ' + mpColMigrations[mpi][2]);
        mpStmt.close();
        console.info('[Gambit DB] Migration: added ' + mpColMigrations[mpi][0] + '.' + mpColMigrations[mpi][1]);
      } catch (mpErr) {
        var mpErrMsg = String(mpErr);
        if (mpErrMsg.indexOf('Duplicate column') === -1 && mpErrMsg.indexOf('1060') === -1) {
          console.warn('[Gambit DB] Migration warning: ' + mpErr);
        }
      }
    }

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
    // Use SELECT * so the query succeeds even if new columns haven't been migrated yet.
    var rs = stmt.executeQuery('SELECT * FROM gambit_player_stats');
    var result = {};
    while (rs.next()) {
      var entry = {
        damage:          rs.getDouble('damage'),
        kills:           rs.getInt('kills'),
        deaths:          rs.getInt('deaths'),
        matches:         rs.getInt('matches_played'),
        wins:            rs.getInt('wins'),
        mvps:            rs.getInt('mvps'),
        assists:         0,
        longest_streak:  0,
        revives:         0,
        elim_score_total: 0,
        elim_matches:    0,
        tdm_score_total: 0,
        tdm_matches:     0
      };
      try { entry.assists        = rs.getInt('assists');            } catch(e) {}
      try { entry.longest_streak = rs.getInt('longest_streak');     } catch(e) {}
      try { entry.revives        = rs.getInt('revives');            } catch(e) {}
      try { entry.elim_score_total = rs.getDouble('elim_score_total'); } catch(e) {}
      try { entry.elim_matches   = rs.getInt('elim_matches');       } catch(e) {}
      try { entry.tdm_score_total  = rs.getDouble('tdm_score_total');  } catch(e) {}
      try { entry.tdm_matches    = rs.getInt('tdm_matches');        } catch(e) {}
      result[rs.getString('player_name')] = entry;
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
      'INSERT INTO gambit_player_stats (player_name, damage, kills, deaths, matches_played, wins, mvps, assists, longest_streak, revives, elim_score_total, elim_matches, tdm_score_total, tdm_matches)'
      + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      + ' ON DUPLICATE KEY UPDATE damage=VALUES(damage), kills=VALUES(kills),'
      + ' deaths=VALUES(deaths), matches_played=VALUES(matches_played),'
      + ' wins=VALUES(wins), mvps=VALUES(mvps),'
      + ' assists=VALUES(assists), longest_streak=VALUES(longest_streak),'
      + ' revives=VALUES(revives), elim_score_total=VALUES(elim_score_total),'
      + ' elim_matches=VALUES(elim_matches), tdm_score_total=VALUES(tdm_score_total),'
      + ' tdm_matches=VALUES(tdm_matches)'
    );
    ps.setString(1, String(playerName));
    ps.setDouble(2, Number(entry.damage) || 0);
    ps.setInt(3, Math.floor(Number(entry.kills) || 0) | 0);
    ps.setInt(4, Math.floor(Number(entry.deaths) || 0) | 0);
    ps.setInt(5, Math.floor(Number(entry.matches) || 0) | 0);
    ps.setInt(6, Math.floor(Number(entry.wins) || 0) | 0);
    ps.setInt(7, Math.floor(Number(entry.mvps) || 0) | 0);
    ps.setInt(8, Math.floor(Number(entry.assists) || 0) | 0);
    ps.setInt(9, Math.floor(Number(entry.longest_streak) || 0) | 0);
    ps.setInt(10, Math.floor(Number(entry.revives) || 0) | 0);
    ps.setDouble(11, Number(entry.elim_score_total) || 0);
    ps.setInt(12, Math.floor(Number(entry.elim_matches) || 0) | 0);
    ps.setDouble(13, Number(entry.tdm_score_total) || 0);
    ps.setInt(14, Math.floor(Number(entry.tdm_matches) || 0) | 0);
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
      'INSERT INTO gambit_player_stats (player_name, damage, kills, deaths, matches_played, wins, mvps, assists, longest_streak, revives, elim_score_total, elim_matches, tdm_score_total, tdm_matches)'
      + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      + ' ON DUPLICATE KEY UPDATE damage=VALUES(damage), kills=VALUES(kills),'
      + ' deaths=VALUES(deaths), matches_played=VALUES(matches_played),'
      + ' wins=VALUES(wins), mvps=VALUES(mvps),'
      + ' assists=VALUES(assists), longest_streak=VALUES(longest_streak),'
      + ' revives=VALUES(revives), elim_score_total=VALUES(elim_score_total),'
      + ' elim_matches=VALUES(elim_matches), tdm_score_total=VALUES(tdm_score_total),'
      + ' tdm_matches=VALUES(tdm_matches)'
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
      ps.setInt(8, Math.floor(Number(e.assists) || 0) | 0);
      ps.setInt(9, Math.floor(Number(e.longest_streak) || 0) | 0);
      ps.setInt(10, Math.floor(Number(e.revives) || 0) | 0);
      ps.setDouble(11, Number(e.elim_score_total) || 0);
      ps.setInt(12, Math.floor(Number(e.elim_matches) || 0) | 0);
      ps.setDouble(13, Number(e.tdm_score_total) || 0);
      ps.setInt(14, Math.floor(Number(e.tdm_matches) || 0) | 0);
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
      'UPDATE gambit_player_stats SET damage=0, kills=0, deaths=0, matches_played=0, wins=0, mvps=0, assists=0, longest_streak=0, revives=0, elim_score_total=0, elim_matches=0, tdm_score_total=0, tdm_matches=0 WHERE player_name=?'
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
      'UPDATE gambit_player_stats SET damage=0, kills=0, deaths=0, matches_played=0, wins=0, mvps=0, assists=0, longest_streak=0, revives=0, elim_score_total=0, elim_matches=0, tdm_score_total=0, tdm_matches=0'
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
      'INSERT INTO gambit_match_players (match_id, player_name, team, kills, deaths, damage, assists, match_score)'
      + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      ps.setInt(1, matchId | 0);
      ps.setString(2, String(p.name));
      ps.setString(3, String(p.team));
      ps.setInt(4, Math.floor(Number(p.kills) || 0) | 0);
      ps.setInt(5, Math.floor(Number(p.deaths) || 0) | 0);
      ps.setDouble(6, Number(p.damage) || 0);
      ps.setInt(7, Math.floor(Number(p.assists) || 0) | 0);
      ps.setDouble(8, Number(p.match_score) || 0);
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
