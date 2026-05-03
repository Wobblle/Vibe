/* ============================================================
 * SHRED CRAWLER · grid.js · Phase 3
 * ============================================================
 * Procedural grid generator. Replaces the Phase 1/2 linear room
 * catalog with a real N×N world the player navigates by N/S/E/W.
 *
 * Per spec §12:
 *   - Grid size scales with combined INT (via Archive tier seed)
 *   - Each room has up to 4 door positions
 *   - Mix of dead ends, 3-ways, all-4s
 *   - No map (player remembers their location or doesn't)
 *
 * Per spec §8 (doors):
 *   - Each door has lock type (physical/mechanical/digital), base
 *     success chance, and frozen state for failed attempts
 *
 * Phase 3 v0:
 *   - Fixed 5×5 grid (size scaling deferred to Phase 5 with codes)
 *   - Random door states: 65% open · 25% locked · 10% wall
 *   - No connectivity validation (some rooms may be isolated;
 *     that's gameplay until tools open them)
 *   - Math.random for now; Phase 5 will swap to a code-seeded PRNG
 *     so runs are reproducible
 *
 * Door grammar (per adjacency edge — shared between two rooms):
 *   {
 *     state:       'open' | 'locked' | 'wall' | 'frozen'
 *     lockType:    'physical' | 'mechanical' | 'digital' | null
 *     baseSuccess: 0.5 - 0.85 (per spec, scaled by INT in doors.js)
 *   }
 *
 * Each room owns four door references (n/s/e/w). Adjacency is
 * symmetric: room (0,0)'s n door IS the same object as room (0,1)'s
 * s door. Mutating one mutates the other. This is critical for
 * the "door freezes" mechanic — both sides see the same state.
 *
 * Depends on: nothing.
 * ============================================================ */
(function () {
    'use strict';

    var DEFAULT_SIZE = 5;
    var LOCK_TYPES   = ['physical', 'mechanical', 'digital'];

    // ============== KEY HELPERS ==============
    function key(x, y) { return x + ',' + y; }
    function parseKey(k) {
        var parts = String(k).split(',');
        return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) };
    }

    // Direction vectors. Convention: north = +y (deeper into the
    // compound), south = −y (back toward spawn). Spawn is (0,0).
    var DIR_VEC = {
        n: { dx:  0, dy:  1 },
        s: { dx:  0, dy: -1 },
        e: { dx:  1, dy:  0 },
        w: { dx: -1, dy:  0 }
    };
    var OPP = { n: 's', s: 'n', e: 'w', w: 'e' };

    // ============== ROOM LABEL POOLS ==============
    // Phase 3 v0 rooms are anonymous coordinates with a flavor label
    // pulled from a small pool. Phase 5 will derive labels from the
    // dungeon's faction (Chorus/Portsman/Breaker/HIGI flavors).
    var ROOM_LABELS = [
        'storeroom', 'corridor', 'antechamber', 'switching node',
        'pump bay', 'cell block', 'breaker recess', 'shrine alcove',
        'service junction', 'wet stair', 'dead pipe', 'comms closet',
        'cold room', 'sluice', 'old kitchen', 'salvage hold',
        'hub', 'turn',  'gantry', 'vestibule', 'drainpoint'
    ];
    var ROOM_BLURBS = [
        'damp. wires hang from the ceiling.',
        'iron beams. paint flaking.',
        'pipes converge. one drips.',
        'a fan turns somewhere.',
        'concrete sweat on the walls.',
        'no light source. you adjust.',
        'oil smell. metal cold to the touch.',
        'the floor sounds hollow.',
        'someone bled here a long time ago.',
        'paper on the floor. unreadable.',
        'a prayer scratched on the wall.',
        'breath on the back of your neck. just air.',
        'dust thick enough to leave prints.',
        'a chair facing the wall. nothing on it.'
    ];

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // ============== DOOR FACTORIES ==============
    function makeDoor() {
        var roll = Math.random();
        if (roll < 0.65) {
            return { state: 'open', lockType: null, baseSuccess: 0 };
        }
        if (roll < 0.90) {
            return {
                state: 'locked',
                lockType: pick(LOCK_TYPES),
                baseSuccess: 0.50 + Math.random() * 0.35   // 0.50 - 0.85
            };
        }
        return { state: 'wall', lockType: null, baseSuccess: 0 };
    }

    // Spawn-adjacent doors are guaranteed open (one door minimum
    // from (0,0)) so the player always has a starting move. We bias
    // ALL doors touching the spawn room to open-or-locked (no walls).
    function makeDoorNearSpawn() {
        var roll = Math.random();
        if (roll < 0.80) {
            return { state: 'open', lockType: null, baseSuccess: 0 };
        }
        return {
            state: 'locked',
            lockType: pick(LOCK_TYPES),
            baseSuccess: 0.60 + Math.random() * 0.25   // 0.60 - 0.85
        };
    }

    // ============== GENERATION ==============
    //
    // generate(opts) → grid object
    //
    // opts.size    — grid side length (default 5)
    // opts.spawn   — spawn coordinates (default { x:0, y:0 })
    //
    // Returns:
    //   {
    //     size, spawn, rooms: { "x,y": room, ... }
    //   }
    //
    // Each room:
    //   { id, key, x, y, label, blurb, doors: { n, s, e, w } }
    //
    // Door references are shared between adjacent rooms (mutating
    // room A's `n` door also mutates room B's `s` door). Edge-of-grid
    // door slots are wall (no neighbor).
    function generate(opts) {
        opts = opts || {};
        var size  = opts.size  || DEFAULT_SIZE;
        var spawn = opts.spawn || { x: 0, y: 0 };

        // First pass: build all rooms with shell data and empty door slots
        var rooms = {};
        for (var x = 0; x < size; x++) {
            for (var y = 0; y < size; y++) {
                var k = key(x, y);
                rooms[k] = {
                    id:    k,
                    key:   k,
                    x:     x,
                    y:     y,
                    label: pick(ROOM_LABELS),
                    blurb: pick(ROOM_BLURBS),
                    doors: { n: null, s: null, e: null, w: null }
                };
            }
        }
        // Override spawn label
        rooms[key(spawn.x, spawn.y)].label = 'foyer';
        rooms[key(spawn.x, spawn.y)].blurb = 'small intake room. cold air drifts up from below.';

        // Second pass: assign door objects on each adjacency edge.
        // Iterate north-and-east so each pair is touched exactly once.
        for (var xx = 0; xx < size; xx++) {
            for (var yy = 0; yy < size; yy++) {
                var here = rooms[key(xx, yy)];
                var isSpawnAdj = (xx === spawn.x && Math.abs(yy - spawn.y) <= 1) ||
                                 (yy === spawn.y && Math.abs(xx - spawn.x) <= 1);
                var factory = isSpawnAdj ? makeDoorNearSpawn : makeDoor;

                // North edge
                if (yy + 1 < size) {
                    var north = rooms[key(xx, yy + 1)];
                    var nDoor = factory();
                    here.doors.n = nDoor;
                    north.doors.s = nDoor;
                } else {
                    here.doors.n = wallDoor();
                }
                // East edge
                if (xx + 1 < size) {
                    var east = rooms[key(xx + 1, yy)];
                    var eDoor = factory();
                    here.doors.e = eDoor;
                    east.doors.w = eDoor;
                } else {
                    here.doors.e = wallDoor();
                }
                // Bottom edges (s for y=0 row, w for x=0 column) — already
                // set by the room to the south/west. If null at end,
                // they're outer edges and become walls.
            }
        }
        // Backfill outer walls
        for (var bx = 0; bx < size; bx++) {
            for (var by = 0; by < size; by++) {
                var room = rooms[key(bx, by)];
                if (!room.doors.n) room.doors.n = wallDoor();
                if (!room.doors.s) room.doors.s = wallDoor();
                if (!room.doors.e) room.doors.e = wallDoor();
                if (!room.doors.w) room.doors.w = wallDoor();
            }
        }

        return {
            size:  size,
            spawn: spawn,
            rooms: rooms
        };
    }

    function wallDoor() {
        return { state: 'wall', lockType: null, baseSuccess: 0 };
    }

    // ============== LOOKUPS ==============
    function getRoom(grid, k) {
        if (!grid || !grid.rooms) return null;
        return grid.rooms[k] || null;
    }

    function getNeighborKey(grid, k, dir) {
        var coords = parseKey(k);
        var v = DIR_VEC[dir];
        if (!v) return null;
        var nx = coords.x + v.dx;
        var ny = coords.y + v.dy;
        if (nx < 0 || ny < 0 || nx >= grid.size || ny >= grid.size) return null;
        return key(nx, ny);
    }

    function spawnKey(grid) {
        return key(grid.spawn.x, grid.spawn.y);
    }

    // distance(grid, k) → grid distance from spawn (Chebyshev for
    // simplicity — used by enemy seeding to make further rooms harder).
    function distanceFromSpawn(grid, k) {
        var c = parseKey(k);
        return Math.max(
            Math.abs(c.x - grid.spawn.x),
            Math.abs(c.y - grid.spawn.y)
        );
    }

    window.Crawler = window.Crawler || {};
    window.Crawler.Grid = {
        generate:           generate,
        getRoom:            getRoom,
        getNeighborKey:     getNeighborKey,
        spawnKey:           spawnKey,
        distanceFromSpawn:  distanceFromSpawn,
        key:                key,
        parseKey:           parseKey,
        DIR_VEC:            DIR_VEC,
        OPP:                OPP,
        LOCK_TYPES:         LOCK_TYPES
    };
})();
