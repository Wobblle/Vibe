/* ============================================================
 * SHRED CRAWLER · items.js · Phase 3.24
 * ============================================================
 * Item template registry. Defines every item that can appear
 * in a container drop, a Pack code starting loadout (Phase 4),
 * or a goal-box reward (Phase 5).
 *
 * Item shape (matches state.js inventory):
 *   { type, subtype, label, key?, hp?, energy?, autonode?, damage?, ticks?, damageTick? }
 *
 * Categories:
 *   ambient     — flavor + small autonode boost (chips, cards)
 *   consumable  — one-shot use (bandage, food, drink)
 *   tool        — multi-use (prybar, lockpick, crypt key)
 *   weapon      — equip + use (Phase 4 expansion)
 *
 * Drop tables are weighted lists used by containers.js when
 * generating contents. Spec §22 tone: items are blunt and small.
 * Most rolls give nothing or ambient junk. Real loot is rare.
 *
 * Depends on: nothing.
 * ============================================================ */
(function () {
    'use strict';

    // ============== ITEM TEMPLATES ==============

    var TEMPLATES = {

        // ─── ambient (flavor + autonode) ──────────────────────
        // Pass 3.27: each ambient template has a qualityRange — the
        // possible autonode yield when scrapped at a resyc station —
        // and a processTicks cost. The actual autonode value rolls on
        // SPAWN (in get()) and is HIDDEN from the player on pickup.
        // Players learn by processing things and watching the yield.
        exo_chip: {
            type: 'ambient', subtype: 'chip',
            label: 'exochip', key: 'exo_chip',
            qualityRange: [2, 5], processTicks: 4,
            blurb: 'a salvaged compute chip. small charge in it.'
        },
        data_card: {
            type: 'ambient', subtype: 'card',
            label: 'data card', key: 'data_card',
            qualityRange: [0, 2], processTicks: 2,
            blurb: 'cracked. trace power left.'
        },
        wire_spool: {
            type: 'ambient', subtype: 'wire',
            label: 'wire spool', key: 'wire_spool',
            qualityRange: [1, 3], processTicks: 3,
            blurb: 'copper, partly oxidized.'
        },
        relay_shard: {
            type: 'ambient', subtype: 'shard',
            label: 'relay shard', key: 'relay_shard',
            qualityRange: [3, 6], processTicks: 5,
            blurb: 'dense. you can feel the field on it.'
        },
        bone_die: {
            type: 'ambient', subtype: 'curio',
            label: 'bone die', key: 'bone_die',
            qualityRange: [0, 1], processTicks: 1,
            blurb: 'four sides. teeth-marked. someone\'s old game.'
        },
        subway_pass: {
            type: 'ambient', subtype: 'pass',
            label: 'subway pass', key: 'subway_pass',
            qualityRange: [0, 1], processTicks: 1,
            blurb: 'expired. magnetic strip still intact.'
        },
        scrap_nut: {
            type: 'ambient', subtype: 'scrap',
            label: 'scrap nut', key: 'scrap_nut',
            qualityRange: [0, 1], processTicks: 1,
            blurb: 'a hex nut. heavier than it looks.'
        },
        broken_stylus: {
            type: 'ambient', subtype: 'curio',
            label: 'broken stylus', key: 'broken_stylus',
            qualityRange: [0, 2], processTicks: 2,
            blurb: 'tip is gone. body is solid.'
        },
        glass_marble: {
            type: 'ambient', subtype: 'curio',
            label: 'glass marble', key: 'glass_marble',
            qualityRange: [0, 1], processTicks: 1,
            blurb: 'one of a set, probably.'
        },
        photo_strip: {
            type: 'ambient', subtype: 'curio',
            label: 'photo strip', key: 'photo_strip',
            qualityRange: [0, 1], processTicks: 2,
            blurb: 'four faces. none of them yours.'
        },
        ration_token: {
            type: 'ambient', subtype: 'token',
            label: 'ration token', key: 'ration_token',
            qualityRange: [1, 3], processTicks: 2,
            blurb: 'corp-issued. someone earned this.'
        },
        plastic_ring: {
            type: 'ambient', subtype: 'curio',
            label: 'plastic ring', key: 'plastic_ring',
            qualityRange: [0, 1], processTicks: 1,
            blurb: 'gaudy. slightly chewed.'
        },
        paper_note: {
            type: 'ambient', subtype: 'note',
            label: 'paper note', key: 'paper_note',
            qualityRange: [0, 0], processTicks: 1,
            blurb: 'soaked through. ink is gone.'
        },

        // ─── consumables ───────────────────────────────────────
        bandage: {
            type: 'consumable', subtype: 'bandage',
            label: 'bandage', key: 'bandage',
            hp: 14,
            blurb: 'standard wrap. +14 hp over 3 ticks.'
        },
        fizza: {
            type: 'consumable', subtype: 'drink',
            label: 'fizza', key: 'fizza',
            energy: 30,
            blurb: 'cold sting. +30 energy.'
        },
        corpo_cola: {
            type: 'consumable', subtype: 'drink',
            label: 'corpo cola', key: 'corpo_cola',
            energy: 20,
            blurb: 'warm. +20 energy. tastes like the brand.'
        },
        pizza: {
            type: 'consumable', subtype: 'food',
            label: 'cold pizza slice', key: 'pizza',
            hp: 6, energy: 10,
            blurb: 'unidentifiable toppings. +6 hp, +10 energy.'
        },
        stimject: {
            type: 'consumable', subtype: 'stim',
            label: 'stimject', key: 'stimject',
            hp: 30,
            blurb: 'big needle. +30 hp. one-shot.'
        },
        jolt_bar: {
            type: 'consumable', subtype: 'food',
            label: 'jolt bar', key: 'jolt_bar',
            hp: 4, energy: 18,
            blurb: 'sticks to your teeth. +4 hp, +18 energy.'
        },
        brutal_energy: {
            type: 'consumable', subtype: 'drink',
            label: 'brutal energy', key: 'brutal_energy',
            energy: 45, hp: -5,
            blurb: '+45 energy. -5 hp. recommended dosage: zero.'
        },
        blue_shot: {
            type: 'consumable', subtype: 'drink',
            label: 'blue shot', key: 'blue_shot',
            hp: 6, energy: 15,
            blurb: 'unbranded. +6 hp, +15 energy.'
        },
        cigarette: {
            type: 'consumable', subtype: 'smoke',
            label: 'cigarette', key: 'cigarette',
            energy: 10,
            blurb: 'one drag. +10 energy. not a question.'
        },
        gauze_pack: {
            type: 'consumable', subtype: 'bandage',
            label: 'gauze pack', key: 'gauze_pack',
            hp: 8,
            blurb: 'lighter than a bandage. +8 hp.'
        },

        // ─── tools (drops for replacing broken ones) ──────────
        prybar: {
            type: 'tool', subtype: 'prybar',
            label: 'prybar', key: 'prybar'
        },
        lockpick: {
            type: 'tool', subtype: 'lockpick',
            label: 'lockpick', key: 'lockpick'
        },
        cryptkey: {
            type: 'tool', subtype: 'cryptkey',
            label: 'crypt key', key: 'cryptkey'
        },

        // ─── weapons · CLOSE slot (Pass 3.26) ──────────────────
        // bonus = damage added on top of player.melee when equipped
        rusted_shiv: {
            type: 'weapon', subtype: 'close', slot: 'close',
            label: 'rusted shiv', key: 'rusted_shiv',
            bonus: 2,
            blurb: 'edge is gone. point is still a point. +2 melee.'
        },
        steel_pipe: {
            type: 'weapon', subtype: 'close', slot: 'close',
            label: 'steel pipe', key: 'steel_pipe',
            bonus: 3,
            blurb: 'good weight. honest. +3 melee.'
        },
        brass_knuckles: {
            type: 'weapon', subtype: 'close', slot: 'close',
            label: 'brass knuckles', key: 'brass_knuckles',
            bonus: 4,
            blurb: '+4 melee. fits your hand.'
        },
        cleaver: {
            type: 'weapon', subtype: 'close', slot: 'close',
            label: 'cleaver', key: 'cleaver',
            bonus: 5,
            blurb: 'kitchen-grade. +5 melee.'
        },
        rebar: {
            type: 'weapon', subtype: 'close', slot: 'close',
            label: 'rebar length', key: 'rebar',
            bonus: 4,
            blurb: 'rusted thread. heavy. +4 melee.'
        },
        monkey_wrench: {
            type: 'weapon', subtype: 'close', slot: 'close',
            label: 'monkey wrench', key: 'monkey_wrench',
            bonus: 6,
            blurb: 'two-handed. +6 melee.'
        },

        // ─── weapons · RANGED slot ─────────────────────────────
        // Starter sidearm — equipped on every run regardless of class.
        // Damage scales off the character's base range stat (Drakey 10,
        // Torred 4) so the same pistol matters more on a ranged char.
        basic_pistol: {
            type: 'weapon', subtype: 'ranged', slot: 'ranged',
            label: 'basic pistol', key: 'basic_pistol',
            bonus: 2,
            blurb: '+2 ranged. salvaged. fits your hand.'
        },
        slug_pistol: {
            type: 'weapon', subtype: 'ranged', slot: 'ranged',
            label: 'slug pistol', key: 'slug_pistol',
            bonus: 3,
            blurb: 'stamped frame. +3 ranged.'
        },
        bolt_thrower: {
            type: 'weapon', subtype: 'ranged', slot: 'ranged',
            label: 'bolt thrower', key: 'bolt_thrower',
            bonus: 4,
            blurb: 'silent. +4 ranged.'
        },
        service_rifle: {
            type: 'weapon', subtype: 'ranged', slot: 'ranged',
            label: 'service rifle', key: 'service_rifle',
            bonus: 6,
            blurb: 'standard issue. +6 ranged.'
        },
        riot_launcher: {
            type: 'weapon', subtype: 'ranged', slot: 'ranged',
            label: 'riot launcher', key: 'riot_launcher',
            bonus: 7,
            blurb: 'short barrel. wide spread. +7 ranged.'
        },
        repeater: {
            type: 'weapon', subtype: 'ranged', slot: 'ranged',
            label: 'repeater', key: 'repeater',
            bonus: 5,
            blurb: 'lever-action. +5 ranged.'
        },

        // ─── gear · GEAR slot ──────────────────────────────────
        // Pass 3.27: gear is a passive augment that costs autonode
        // per relevant action. When autonode is empty the gear's
        // bonus simply doesn't apply (silent fallback). The `effect`
        // field is the trigger key used by State.tryGearEffect.
        // `autoCost` is the autonode price per use.
        //
        // Passive (always-on) modifiers — damageReduction, intBonus —
        // do NOT consume autonode (they're not "uses", they're being
        // worn). Active triggers (scan, move, reaction lag) do.
        overcharge_scanner: {
            type: 'weapon', subtype: 'gear', slot: 'gear',
            label: 'overcharge scanner', key: 'overcharge_scanner',
            effect: 'scan-second', autoCost: 5,
            blurb: 'scans cover an extra adjacent direction. -5 autonode/use.'
        },
        agro_detector: {
            type: 'weapon', subtype: 'gear', slot: 'gear',
            label: 'agro detector', key: 'agro_detector',
            effect: 'reaction-reduce', reactionReduce: 2, autoCost: 4,
            blurb: 'reaction time -2 ticks on room entry. -4 autonode/trigger.'
        },
        exosuit: {
            type: 'weapon', subtype: 'gear', slot: 'gear',
            label: 'exosuit', key: 'exosuit',
            effect: 'move-fast', moveSavings: 1, autoCost: 2,
            blurb: 'room moves cost 2 ticks instead of 3. -2 autonode/move.'
        },
        kevlar_vest: {
            type: 'weapon', subtype: 'gear', slot: 'gear',
            label: 'kevlar vest', key: 'kevlar_vest',
            damageReduction: 2,
            blurb: '-2 incoming damage. always-on, no autonode cost.'
        },
        corp_suit: {
            type: 'weapon', subtype: 'gear', slot: 'gear',
            label: 'corp suit', key: 'corp_suit',
            intBonus: 1,
            blurb: '+1 INT. always-on, no autonode cost.'
        },
        data_goggles: {
            type: 'weapon', subtype: 'gear', slot: 'gear',
            label: 'data goggles', key: 'data_goggles',
            scanBonus: 1,
            blurb: 'scans read cleaner. +1 scan accuracy (Phase 4).'
        },
        comm_rig: {
            type: 'weapon', subtype: 'gear', slot: 'gear',
            label: 'comm rig', key: 'comm_rig',
            blurb: 'brox sounds clearer. (cosmetic for now)'
        },
        biker_jacket: {
            type: 'weapon', subtype: 'gear', slot: 'gear',
            label: 'biker jacket', key: 'biker_jacket',
            damageReduction: 1,
            blurb: '-1 incoming damage. always-on, no autonode cost.'
        }
    };

    // ============== DROP TABLES ==============
    //
    // Each table is a weighted list. spawn() rolls one entry.
    // Higher weight = more likely. Tables are referenced by name
    // from containers.js based on container type and tier.

    var TABLES = {
        // standard container drop (mostly junk + ambient flavor)
        common: [
            { template: null,             weight: 25, label: 'nothing' },
            // ambient (heavy weight — most drops are flavor)
            { template: 'data_card',      weight: 14 },
            { template: 'wire_spool',     weight: 10 },
            { template: 'bone_die',       weight: 8  },
            { template: 'subway_pass',    weight: 7  },
            { template: 'scrap_nut',      weight: 7  },
            { template: 'broken_stylus',  weight: 5  },
            { template: 'glass_marble',   weight: 5  },
            { template: 'photo_strip',    weight: 4  },
            { template: 'plastic_ring',   weight: 4  },
            { template: 'paper_note',     weight: 4  },
            { template: 'ration_token',   weight: 4  },
            // consumables
            { template: 'bandage',        weight: 8  },
            { template: 'gauze_pack',     weight: 6  },
            { template: 'corpo_cola',     weight: 6  },
            { template: 'cigarette',      weight: 5  },
            { template: 'jolt_bar',       weight: 4  },
            { template: 'blue_shot',      weight: 4  },
            { template: 'fizza',          weight: 3  },
            // ambient hi-tier
            { template: 'exo_chip',       weight: 3  },
            // weapons (rare in common)
            { template: 'rusted_shiv',    weight: 3  },
            { template: 'steel_pipe',     weight: 3  },
            { template: 'slug_pistol',    weight: 2  },
            { template: 'biker_jacket',   weight: 2  },
            // Pass 3.27: thin chance for active gear in common rolls
            { template: 'agro_detector',  weight: 1  },
            { template: 'overcharge_scanner', weight: 1 }
        ],
        // higher tier (goal-box adjacent or end-of-run)
        rare: [
            { template: 'exo_chip',       weight: 18 },
            { template: 'relay_shard',    weight: 12 },
            { template: 'stimject',       weight: 12 },
            { template: 'bandage',        weight: 10 },
            { template: 'fizza',          weight: 8  },
            { template: 'pizza',          weight: 8  },
            { template: 'brutal_energy',  weight: 6  },
            // weapons (heavier in rare)
            { template: 'brass_knuckles', weight: 6  },
            { template: 'cleaver',        weight: 5  },
            { template: 'rebar',          weight: 5  },
            { template: 'monkey_wrench',  weight: 4  },
            { template: 'bolt_thrower',   weight: 5  },
            { template: 'service_rifle',  weight: 4  },
            { template: 'repeater',       weight: 4  },
            { template: 'riot_launcher',  weight: 3  },
            // gear (active augments are rare even in rare drops)
            { template: 'kevlar_vest',        weight: 4  },
            { template: 'corp_suit',          weight: 3  },
            { template: 'data_goggles',       weight: 3  },
            { template: 'comm_rig',           weight: 2  },
            { template: 'overcharge_scanner', weight: 2  },
            { template: 'agro_detector',      weight: 2  },
            { template: 'exosuit',            weight: 1  },
            // tools
            { template: 'prybar',         weight: 4  },
            { template: 'lockpick',       weight: 4  },
            { template: 'cryptkey',       weight: 2  }
        ],
        // tool replacement (specifically when player loses one)
        tools: [
            { template: 'prybar',   weight: 1 },
            { template: 'lockpick', weight: 1 },
            { template: 'cryptkey', weight: 1 }
        ]
    };

    // ============== API ==============

    function get(key) {
        var tpl = TEMPLATES[key];
        if (!tpl) return null;
        // Deep clone so consumers can mutate freely
        var inst = JSON.parse(JSON.stringify(tpl));
        // Pass 3.27: roll the per-instance autonode value from
        // qualityRange. Hidden from the player on pickup; revealed
        // only when processed at a resyc station. Some rolls land
        // at 0 — by design (paper note, low-roll glass marble, etc.).
        if (tpl.qualityRange && tpl.qualityRange.length === 2) {
            var lo = tpl.qualityRange[0];
            var hi = tpl.qualityRange[1];
            inst.autonode = lo + Math.floor(Math.random() * (hi - lo + 1));
        }
        return inst;
    }

    // rollFromTable(tableName) → item template instance OR null
    //
    // Performs a weighted random pick. A 'null' template entry
    // means the slot rolled empty (this is intentional — many
    // container slots come up dry per spec §22 fairness).
    function rollFromTable(tableName) {
        var table = TABLES[tableName] || TABLES.common;
        var total = 0;
        for (var i = 0; i < table.length; i++) total += table[i].weight;
        var roll = Math.random() * total;
        var acc  = 0;
        for (var j = 0; j < table.length; j++) {
            acc += table[j].weight;
            if (roll < acc) {
                if (!table[j].template) return null;
                return get(table[j].template);
            }
        }
        return null;
    }

    window.Crawler = window.Crawler || {};
    window.Crawler.Items = {
        TEMPLATES:     TEMPLATES,
        TABLES:        TABLES,
        get:           get,
        rollFromTable: rollFromTable
    };
})();
