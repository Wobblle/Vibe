/* ============================================================
 * SHRED CRAWLER · rooms.js · Phase 3
 * ============================================================
 * Thin wrapper around the procedural grid (grid.js). Phase 1/2's
 * static linear catalog (PHASE2_ROOMS) is gone — rooms now come
 * from the grid generator and door states from doors.js.
 *
 * Same external interface as Phase 1/2 so crawler.js callers stay
 * mostly unchanged (modulo currentRoomIdx → currentRoomKey rename):
 *
 *   getRoom(runState, key)          → room object | null
 *   moveDirection(runState, key, d) → { newKey, door } | null
 *   renderRoom(room, ctx, faction, runState)
 *   getEnemyTemplateForRoom(runState, room)
 *   startingRoomKey(runState)       → string
 *
 * Depends on: window.Crawler.Grid, window.Crawler.Doors,
 *             window.Crawler.Enemies (for distance-based seeding).
 * ============================================================ */
(function () {
    'use strict';

    function getRoom(runState, k) {
        if (!runState || !runState.grid) return null;
        return window.Crawler.Grid.getRoom(runState.grid, k);
    }

    function startingRoomKey(runState) {
        if (!runState || !runState.grid) return '0,0';
        return window.Crawler.Grid.spawnKey(runState.grid);
    }

    // moveDirection(runState, currentKey, dir)
    //   → { newKey: string, door: doorObject } if movable through `dir`
    //   → { error: 'wall'|'locked'|'frozen', door } if blocked
    //   → null if dir is invalid
    //
    // The crawler uses this to (a) detect failure modes for the
    // static "no door" message, and (b) get the new key + door
    // reference for the move playback.
    function moveDirection(runState, currentKey, dir) {
        var room = getRoom(runState, currentKey);
        if (!room) return null;
        var door = room.doors[dir];
        if (!door) return null;

        if (door.state === 'wall')   return { error: 'wall',   door: door };
        if (door.state === 'locked') return { error: 'locked', door: door };
        if (door.state === 'frozen') return { error: 'frozen', door: door };

        var newKey = window.Crawler.Grid.getNeighborKey(runState.grid, currentKey, dir);
        if (!newKey) return { error: 'wall', door: door };
        return { newKey: newKey, door: door };
    }

    // ============== ENEMY SEEDING ==============
    //
    // getEnemyTemplateForRoom(runState, room) → templateId | null
    //
    // Phase 3 v0:
    //   - spawn room is always empty
    //   - rooms at distance 1 from spawn: 30% chance of grunt
    //   - rooms at distance 2+: 50% chance of grunt
    //   - random close vs ranged
    //
    // Decision is cached on the room object so re-reading is stable
    // (otherwise re-rendering would re-roll, which would be silly).
    function getEnemyTemplateForRoom(runState, room) {
        if (!room) return null;
        if (room._enemyDecision !== undefined) return room._enemyDecision;

        var dist = window.Crawler.Grid.distanceFromSpawn(runState.grid, room.key);
        if (dist === 0) { room._enemyDecision = null; return null; }

        var chance = dist === 1 ? 0.30 : 0.50;
        if (Math.random() >= chance) {
            room._enemyDecision = null;
            return null;
        }
        var template = Math.random() < 0.5 ? 'breaker_grunt_close' : 'breaker_grunt_ranged';
        room._enemyDecision = template;
        return template;
    }

    // ============== RENDER ==============
    //
    // renderRoom(room, ctx, faction, runState)
    //
    // Header line + description + ASCII frame with door symbols
    // (per doors.js doorSymbol). Followed by an explicit `doors:`
    // detail line for any non-open/non-wall door so the player
    // knows what they're up against without parsing the symbols.
    //
    //          n      ← open door north
    //      ┌───┴───┐
    //      │       │
    //   ───┤   @   ├──*  ← locked door east
    //      │       │
    //      └───x───┘
    //          x      ← frozen door south
    //
    //   doors:  n  open    ·  e  locked · physical  ·  s  frozen · gone
    function renderRoom(room, ctx, faction, runState) {
        if (!room) { ctx.err('  no room.'); return; }
        var doors = window.Crawler.Doors;
        var fac = faction || 'unknown';

        // Per-direction symbol for the frame
        var symN = doors.doorSymbol(room.doors.n, 'n');
        var symS = doors.doorSymbol(room.doors.s, 's');
        var symE = doors.doorSymbol(room.doors.e, 'e');
        var symW = doors.doorSymbol(room.doors.w, 'w');

        // Frame inset characters depending on whether E/W slots have
        // doors (any state ≠ wall) — wall slots show '│', the rest
        // show '┤' / '├' to indicate the doorway exists.
        var hasN = room.doors.n && room.doors.n.state !== 'wall';
        var hasS = room.doors.s && room.doors.s.state !== 'wall';
        var hasE = room.doors.e && room.doors.e.state !== 'wall';
        var hasW = room.doors.w && room.doors.w.state !== 'wall';

        var nNotch = hasN ? '┴' : '─';
        var sNotch = hasS ? '┬' : '─';
        var wNotch = hasW ? (symW + '──┤') : '   │';
        var eNotch = hasE ? ('├──' + symE) : '│   ';

        ctx.heading('  [' + room.label + ' · ' + room.key + '] · ' + fac + ' compound');
        ctx.dim('  ' + room.blurb);
        ctx.out('');
        // Frame layout — column anchors:
        //   ┌ at col 6, notch at col 10, ┐ at col 14
        //   so N/S door labels must sit at col 10 to align with notch
        //   middle row: w-connector at cols 3-6, @ at col 10, e-connector at 14-17
        ctx.out('          ' + (hasN ? symN : ' '));
        ctx.out('      ┌───' + nNotch + '───┐');
        ctx.out('      │           │');
        ctx.out('   ' + wNotch + '   @   ' + eNotch);
        ctx.out('      │           │');
        ctx.out('      └───' + sNotch + '───┘');
        ctx.out('          ' + (hasS ? symS : ' '));
        ctx.out('');

        // Doors detail line — only show non-open / non-wall doors
        // (open ones are obvious from the frame; wall slots aren't
        // doors).
        var details = [];
        ['n', 's', 'e', 'w'].forEach(function (dir) {
            var d = room.doors[dir];
            if (!d || d.state === 'wall' || d.state === 'open') return;
            details.push(dir + ' ' + doors.doorLabel(d));
        });
        if (details.length) {
            ctx.dim('  doors:  ' + details.join('   ·   '));
            ctx.out('');
        }
    }

    window.Crawler = window.Crawler || {};
    window.Crawler.Rooms = {
        getRoom:                 getRoom,
        startingRoomKey:         startingRoomKey,
        moveDirection:           moveDirection,
        renderRoom:              renderRoom,
        getEnemyTemplateForRoom: getEnemyTemplateForRoom
    };
})();
