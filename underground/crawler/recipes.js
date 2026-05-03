/* ============================================================
 * SHRED CRAWLER · recipes.js · Phase 3.27
 * ============================================================
 * Crafting recipes used by the resyc station mode (containers.js
 * variant). A recipe consumes ambient items (and sometimes broken
 * tools / weapons) to produce a higher-tier item.
 *
 * Recipe shape:
 *   {
 *     id:        unique key (used in commands)
 *     label:     display label
 *     output:    item key (resolved via Items.get)
 *     requires:  [{ key: 'exo_chip', count: 2 }, ...]
 *     costTicks: ticks consumed during craft (additive on top of
 *                the resyc station's per-action tick cost)
 *     blurb:    short flavor line
 *   }
 *
 * Recipes are intentionally sparse for v0 — the goal of Pass 3.27
 * is to ship the LOOP (gather → resyc → craft → equip), not a deep
 * tree. Phase 5+ will grow this with faction-specific recipes,
 * Pack-code-locked patterns, and Currept counters.
 *
 * Depends on: window.Crawler.Items (for output template lookup).
 * ============================================================ */
(function () {
    'use strict';

    var RECIPES = [
        {
            id:        'data_goggles',
            label:     'data goggles',
            output:    'data_goggles',
            requires:  [
                { key: 'exo_chip',   count: 2 },
                { key: 'wire_spool', count: 1 }
            ],
            costTicks: 6,
            blurb:     '+1 scan (Phase 4 read). passive gear.'
        },
        {
            id:        'comm_rig',
            label:     'comm rig',
            output:    'comm_rig',
            requires:  [
                { key: 'exo_chip',  count: 1 },
                { key: 'data_card', count: 2 }
            ],
            costTicks: 4,
            blurb:     'cosmetic flavor. brox sounds clearer.'
        },
        {
            id:        'overcharge_scanner',
            label:     'overcharge scanner',
            output:    'overcharge_scanner',
            requires:  [
                { key: 'relay_shard', count: 1 },
                { key: 'exo_chip',    count: 2 },
                { key: 'wire_spool',  count: 2 }
            ],
            costTicks: 10,
            blurb:     'scans cover an extra direction. -5 autonode/use.'
        },
        {
            id:        'agro_detector',
            label:     'agro detector',
            output:    'agro_detector',
            requires:  [
                { key: 'wire_spool', count: 2 },
                { key: 'data_card',  count: 3 }
            ],
            costTicks: 8,
            blurb:     'reaction time -2 on entry. -4 autonode/trigger.'
        },
        {
            id:        'kevlar_vest',
            label:     'kevlar vest',
            output:    'kevlar_vest',
            requires:  [
                { key: 'wire_spool',   count: 3 },
                { key: 'ration_token', count: 2 }
            ],
            costTicks: 8,
            blurb:     '-2 incoming damage. always-on, no autonode cost.'
        },
        {
            id:        'brass_knuckles',
            label:     'brass knuckles',
            output:    'brass_knuckles',
            requires:  [
                { key: 'scrap_nut',  count: 4 }
            ],
            costTicks: 4,
            blurb:     '+4 melee. simple, mean.'
        }
    ];

    // craftableFromInventory(inv) → array of recipes whose requirements
    // are all present in the player's inventory. Used by the resyc UI
    // to show only the recipes the player can actually act on right now.
    function craftableFromInventory(inv) {
        if (!inv || !inv.length) return [];
        var have = countByKey(inv);
        return RECIPES.filter(function (r) {
            return r.requires.every(function (req) {
                return (have[req.key] || 0) >= req.count;
            });
        });
    }

    function countByKey(inv) {
        var counts = {};
        for (var i = 0; i < inv.length; i++) {
            var it = inv[i];
            if (!it.key) continue;
            counts[it.key] = (counts[it.key] || 0) + 1;
        }
        return counts;
    }

    // consumeRequirements(inv, recipe) → bool
    // Mutates inventory by removing the required items in-place. Returns
    // false if the inventory no longer satisfies the recipe (race-safety).
    function consumeRequirements(inv, recipe) {
        // First verify
        var have = countByKey(inv);
        for (var i = 0; i < recipe.requires.length; i++) {
            var req = recipe.requires[i];
            if ((have[req.key] || 0) < req.count) return false;
        }
        // Remove (front-to-back, splicing as we go)
        recipe.requires.forEach(function (req) {
            var remaining = req.count;
            for (var j = inv.length - 1; j >= 0 && remaining > 0; j--) {
                if (inv[j].key === req.key) {
                    inv.splice(j, 1);
                    remaining--;
                }
            }
        });
        return true;
    }

    function getById(id) {
        for (var i = 0; i < RECIPES.length; i++) {
            if (RECIPES[i].id === id) return RECIPES[i];
        }
        return null;
    }

    window.Crawler = window.Crawler || {};
    window.Crawler.Recipes = {
        ALL:                   RECIPES,
        craftableFromInventory: craftableFromInventory,
        consumeRequirements:    consumeRequirements,
        getById:                getById
    };
})();
