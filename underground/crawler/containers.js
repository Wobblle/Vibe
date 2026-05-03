/* ============================================================
 * SHRED CRAWLER · containers.js · Phase 3.24
 * ============================================================
 * Container generation + interaction. Each room rolls 0-5
 * containers per spec §7. Containers can be open, locked
 * (matching the door lock taxonomy: physical/mechanical/digital),
 * empty (dud), or trapped.
 *
 * Container shape:
 *   {
 *     id:        'c1' | 'c2' ...   (per-room index)
 *     label:     'wooden box' | 'metal locker' | ...
 *     state:     'closed' | 'opened' | 'frozen'
 *     lockType:  null | 'physical' | 'mechanical' | 'digital'
 *     baseSuccess: 0 | 0.50 - 0.85
 *     trap:      null | { dmg: number }
 *     contents:  [item, ...]   (rolled at generation; mutated as taken)
 *     opened:    bool   (set true after first successful open)
 *     looted:    bool   (set true when contents = [])
 *   }
 *
 * Lock interactions reuse doors.js attempt() — same math, same
 * tool break semantics. A container is just another lock surface.
 *
 * Generation tuning:
 *   - 0-5 containers per room (weighted toward 1-2)
 *   - 60% open · 25% locked · 10% dud · 5% trapped
 *   - locked containers use the same lock type distribution as doors
 *   - 'common' drop table for all rooms in v0; Phase 5 may switch
 *     to 'rare' for goal-box-adjacent rooms based on grid distance
 *
 * Depends on: window.Crawler.Items, window.Crawler.Doors.
 * ============================================================ */
(function () {
    'use strict';

    var LABELS = [
        'wooden box', 'metal locker', 'plastic crate', 'tin chest',
        'service hatch', 'data drawer', 'wall niche', 'old toolbox',
        'cracked footlocker', 'maintenance bin', 'salvage tray',
        'bolted cabinet', 'duffel', 'pelican case', 'paper sack',
        'corp safe', 'first-aid kit', 'shrine offering box',
        'shelving unit', 'ammo case', 'backpack', 'milk crate',
        'filing cabinet', 'vending niche', 'vault drawer',
        'janitor bucket', 'munitions tin', 'overhead bin',
        'lost-and-found bin', 'evidence bag', 'pizza box',
        'mini fridge', 'tackle box', 'hard case'
    ];
    var LOCK_TYPES = ['physical', 'mechanical', 'digital'];

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // ============== GENERATION ==============

    // generateForRoom(opts) → array of containers
    //
    // opts.distance — distance from spawn (used to bias drop tier
    //   in future passes; currently ignored)
    // opts.faction — flavor (currently ignored)
    function generateForRoom(opts) {
        opts = opts || {};
        var count = rollCount();
        var out = [];
        for (var i = 0; i < count; i++) {
            out.push(generateOne(i + 1));
        }
        return out;
    }

    function rollCount() {
        // Pass 3.26: more loot-dense rooms. Weighted toward 2-3 per
        // room so rummaging actually feels like a thing the player does.
        // 10% none · 20% one · 30% two · 22% three · 12% four · 6% five
        var r = Math.random();
        if (r < 0.10) return 0;
        if (r < 0.30) return 1;
        if (r < 0.60) return 2;
        if (r < 0.82) return 3;
        if (r < 0.94) return 4;
        return 5;
    }

    function generateOne(idx) {
        var roll = Math.random();

        // Pass 3.27: ~8% of slots come up as a resyc station instead
        // of a regular container. Resyc has no contents — it's an
        // interaction surface (process ambient items, craft from
        // recipes). Player still types `con N` to engage.
        if (roll < 0.08) {
            return {
                id:        'c' + idx,
                kind:      'resyc',
                label:     'resyc station',
                state:     'closed',     // unused for resyc; keeps shape parallel
                lockType:  null,
                baseSuccess: 0,
                trap:      null,
                contents:  [],
                opened:    false,
                looted:    false
            };
        }

        var c = {
            id:          'c' + idx,
            kind:        'container',
            label:       pick(LABELS),
            state:       'closed',
            lockType:    null,
            baseSuccess: 0,
            trap:        null,
            contents:    [],
            opened:      false,
            looted:      false
        };

        if (roll < 0.16) {
            // dud — opens free, contains nothing
            c.contents = [];
        } else if (roll < 0.21) {
            // trap — opens free, hits player
            c.trap = { dmg: 8 + Math.floor(Math.random() * 12) };  // 8-19 dmg
            c.contents = [];
        } else if (roll < 0.45) {
            // locked — needs tool
            c.lockType    = pick(LOCK_TYPES);
            c.baseSuccess = 0.50 + Math.random() * 0.35;
            c.contents    = rollContents(2, 5);  // locked = better odds
        } else {
            // open — just contents
            c.contents = rollContents(0, 4);
        }
        return c;
    }

    function rollContents(min, max) {
        var n = min + Math.floor(Math.random() * (max - min + 1));
        var items = [];
        for (var i = 0; i < n; i++) {
            var item = window.Crawler.Items.rollFromTable('common');
            if (item) items.push(item);
        }
        return items;
    }

    // ============== INTERACTION ==============

    // attemptOpen(container, toolKey, intMultiplier) →
    //   { success, toolBroke, frozen, trapDmg, reason }
    //
    // For open containers (no lock): immediate success, trap fires
    // if present, contents revealed.
    // For locked containers: routes through doors.attempt() with the
    // same math. Mutates container.state on success/freeze.
    function attemptOpen(container, toolKey, intMultiplier) {
        if (!container) return { success: false, reason: 'no_container' };
        if (container.state === 'opened') return { success: true, reason: 'already_open' };
        if (container.state === 'frozen') return { success: false, reason: 'frozen' };

        if (container.lockType) {
            // Locked — reuse the doors lock-attempt math
            var doorLike = {
                state:       'locked',
                lockType:    container.lockType,
                baseSuccess: container.baseSuccess
            };
            var r = window.Crawler.Doors.attempt(doorLike, toolKey, intMultiplier);
            if (r.success) {
                container.state  = 'opened';
                container.opened = true;
                // Trap may still fire even on a successful pick
                var trapDmg = container.trap ? container.trap.dmg : 0;
                container.trap = null;
                return {
                    success: true, toolBroke: false, frozen: false,
                    trapDmg: trapDmg, reason: 'success'
                };
            }
            // Failed — door logic mutated doorLike.state to 'frozen'.
            // Mirror that to the container.
            container.state = 'frozen';
            return {
                success: false, toolBroke: r.toolBroke, frozen: true,
                trapDmg: 0, reason: r.reason
            };
        }

        // Unlocked — just open it
        container.state  = 'opened';
        container.opened = true;
        var trapDmg2 = container.trap ? container.trap.dmg : 0;
        container.trap = null;
        return {
            success: true, toolBroke: false, frozen: false,
            trapDmg: trapDmg2, reason: 'success'
        };
    }

    // takeItems(container, indexes) → array of taken items
    //
    // indexes: 1-based index list (matches what the player typed).
    // Removes the items from container.contents and returns them.
    // Sets container.looted if contents is now empty.
    function takeItems(container, indexes) {
        if (!container || !container.contents) return [];
        // Sort descending so splicing doesn't shift earlier indexes
        var sorted = indexes.slice().sort(function (a, b) { return b - a; });
        var taken = [];
        for (var i = 0; i < sorted.length; i++) {
            var idx = sorted[i] - 1;
            if (idx < 0 || idx >= container.contents.length) continue;
            var item = container.contents.splice(idx, 1)[0];
            if (item) taken.push(item);
        }
        if (container.contents.length === 0) container.looted = true;
        // Restore original order in returned list (player typed it)
        return taken.reverse();
    }

    // statusLabel(container) → short tag for the room option list
    function statusLabel(container) {
        if (container.kind === 'resyc') return 'resyc · always-on';
        if (container.state === 'frozen') return 'frozen · gone';
        if (container.state === 'opened') {
            if (container.contents.length === 0) return 'opened · empty';
            return 'opened · ' + container.contents.length + ' inside';
        }
        if (container.lockType) return 'locked · ' + container.lockType;
        return 'closed';
    }

    window.Crawler = window.Crawler || {};
    window.Crawler.Containers = {
        LABELS:          LABELS,
        generateForRoom: generateForRoom,
        attemptOpen:     attemptOpen,
        takeItems:       takeItems,
        statusLabel:     statusLabel
    };
})();
