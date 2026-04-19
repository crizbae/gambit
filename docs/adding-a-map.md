# Adding a New Map to Gambit

All map data lives in a single file: `kubejs/server_scripts/gambit_maps.js`.

---

## 1. Get the coordinates

Stand at each position in-world and press `F3` to copy coordinates.

| What | Format | Notes |
|---|---|---|
| **Red team spawn** | `X Y Z YAW PITCH` | Where Red TPs at round start and on respawn |
| **Blue team spawn** | `X Y Z YAW PITCH` | Where Blue TPs at round start and on respawn |
| **Spectator point** | `X Y Z YAW PITCH` | Elevated overview for spectators / dead players |
| **Elim start Red** *(optional)* | `X Y Z YAW PITCH` | Override Red spawn for elimination round start only |
| **Elim start Blue** *(optional)* | `X Y Z YAW PITCH` | Override Blue spawn for elimination round start only |

---

## 2. Add the map entry

Open `kubejs/server_scripts/gambit_maps.js` and add an object to the `MAPS` array:

```js
{
  id: 6,                // Next unused integer ID
  name: 'My Map',       // Display name shown in announcements
  preset: 'mymap',      // Command literal for /setmap (lowercase, no spaces)
  modes: ['elimination', 'tdm'],  // Supported modes — one or both
  red_spawn: 'X Y Z YAW PITCH',
  blue_spawn: 'X Y Z YAW PITCH',
  spectator: 'X Y Z YAW PITCH',
  // Optional — only needed if elimination start differs from respawn spawn:
  // elim_start_red: 'X Y Z YAW PITCH',
  // elim_start_blue: 'X Y Z YAW PITCH',
}
```

That's it. The `/setmap` and `/start` commands, respawn TPs, spectator TPs, and TDM spawnpoints are all generated automatically from this array.

---

## 3. Reload

```
/kubejs reload server_scripts
```

The new map is immediately available via `/setmap <preset>` (or `tdm_<preset>` for TDM mode).
