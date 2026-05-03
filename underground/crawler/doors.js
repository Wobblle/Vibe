/* ============================================================
 * SHRED CRAWLER · doors.js · Phase 3
 * ============================================================
 * Lock-attempt mechanic per spec §8:
 *
 *   success = clamp( base × intMultiplier, 0, 0.95 )
 *   intMultiplier = 1 + (combinedINT / 20)
 *
 *   On success: door opens, tool consumed = no
 *   On fail:    tool consumed = yes (it breaks),
 *               door freezes (becomes permanently impassable)
 *
 * Tool ↔ lock-type matching:
 *   prybar      ↔ physical
 *   lockpick    ↔ mechanical
 *   crypt key   ↔ digital
 *
 * Wrong tool always fails (and breaks). This punishes guessing.
 *
 * Door states (mutated through this module only):
 *   'open'    — passable, no tool needed
 *   'locked'  — needs tool of matching type
 *   'frozen'  — failed attempt, no further attempts allowed
 *   'wall'    — no door (outer edge or generation choice)
 *
 * Depends on: window.Crawler.Grid (for OPP map, not strictly needed
 * but kept for symmetry with other modules).
 * ============================================================ */
(function () {
    'use strict';

    // Tool ↔ lock-type map. Used both for matching (success path)
    // and for the option list (so the player sees which tool fits
    // a given lock once it's discovered).
    var TOOL_FOR_LOCK = {
        physical:   'prybar',
        mechanical: 'lockpick',
        digital:    'crypt key'
    };
    var LOCK_FOR_TOOL = {
        prybar:      'physical',
        lockpick:    'mechanical',
        cryptkey:    'digital',
        'crypt key': 'digital'
    };

    function intMultiplier(combinedInt) {
        var multiplier = 1 + (combinedInt / 20);
        return multiplier;
    }

    function clamp(v, lo, hi) {
        return Math.min(hi, Math.max(lo, v));
    }

    // computeSuccessChance(door, combinedInt) → number in [0, 0.95]
    //
    // Per spec §8 formula. Returns 0 for non-locked doors (caller
    // should never reach here for those, but defensive).
    function computeSuccessChance(door, combinedInt) {
        if (!door || door.state !== 'locked') return 0;
        var raw = door.baseSuccess * intMultiplier(combinedInt || 1);
        return clamp(raw, 0, 0.95);
    }

    // attempt(door, toolKey, combinedInt) →
    //   { success, toolBroke, frozen, reason }
    //
    // Mutates the door in place on fail (state → 'frozen') so both
    // sides of the adjacency see the freeze (the grid generator made
    // the door object shared between adjacent rooms).
    //
    // The caller is responsible for removing the broken tool from
    // the player's inventory. attempt() reports toolBroke so the
    // caller can do that consistently.
    //
    // Returns:
    //   success=true   → door.state mutated to 'open'
    //   success=false  → door.state mutated to 'frozen', toolBroke=true
    function attempt(door, toolKey, combinedInt) {
        if (!door) return { success: false, toolBroke: false, frozen: false, reason: 'no_door' };
        if (door.state === 'open') return { success: true, toolBroke: false, frozen: false, reason: 'already_open' };
        if (door.state === 'wall') return { success: false, toolBroke: false, frozen: false, reason: 'wall' };
        if (door.state === 'frozen') return { success: false, toolBroke: false, frozen: false, reason: 'frozen' };

        // door.state === 'locked' from here on
        var matchingType = LOCK_FOR_TOOL[toolKey];
        var matches = matchingType && matchingType === door.lockType;

        if (!matches) {
            // Wrong tool — always fails AND breaks (per spec implication
            // "tool consumed = yes" on any fail, and the punishment for
            // guessing is real).
            door.state = 'frozen';
            return {
                success: false,
                toolBroke: true,
                frozen: true,
                reason: 'wrong_tool'
            };
        }

        var chance = computeSuccessChance(door, combinedInt);
        if (Math.random() < chance) {
            door.state = 'open';
            return {
                success: true,
                toolBroke: false,
                frozen: false,
                reason: 'success'
            };
        }
        door.state = 'frozen';
        return {
            success: false,
            toolBroke: true,
            frozen: true,
            reason: 'fail'
        };
    }

    // doorLabel(door) → short tag for UI ("open" / "locked·physical" /
    // "frozen" / "wall"). Used by rendering and option list builders.
    function doorLabel(door) {
        if (!door) return 'none';
        if (door.state === 'open')   return 'open';
        if (door.state === 'wall')   return 'wall';
        if (door.state === 'frozen') return 'frozen · gone';
        if (door.state === 'locked') return 'locked · ' + (door.lockType || 'unknown');
        return 'unknown';
    }

    // doorSymbol(door, dir) → single character for room ASCII frame
    //   open     → direction letter (n/s/e/w)
    //   locked   → '*'
    //   frozen   → 'x'
    //   wall     → '─' (n/s) or '│' (e/w)
    function doorSymbol(door, dir) {
        if (!door || door.state === 'wall') {
            return (dir === 'n' || dir === 's') ? '─' : '│';
        }
        if (door.state === 'locked') return '*';
        if (door.state === 'frozen') return 'x';
        // open
        return dir;
    }

    window.Crawler = window.Crawler || {};
    window.Crawler.Doors = {
        TOOL_FOR_LOCK:        TOOL_FOR_LOCK,
        LOCK_FOR_TOOL:        LOCK_FOR_TOOL,
        intMultiplier:        intMultiplier,
        computeSuccessChance: computeSuccessChance,
        attempt:              attempt,
        doorLabel:            doorLabel,
        doorSymbol:           doorSymbol
    };
})();
