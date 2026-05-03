/* ============================================================
 * SHRED CRAWLER · state.js · Phase 0
 * ============================================================
 * Character templates (locked in spec v0.3 §1) + run state shape +
 * sessionStorage persistence for code slots and character pick.
 *
 * Run state is a single object passed to every system. Easy to seed
 * deterministically from codes. Easy to serialize for daemon-context
 * generation in future passes (the AI-daemon escape hatch from §19).
 *
 * Persistence: code slots and character pick survive between runs
 * within a browser session (sessionStorage). Browser refresh = full
 * reset. No save state. Volatility is the gameplay (§17).
 *
 * Depends on: window.Crawler.Codes (load codes.js first).
 * ============================================================ */
(function () {
    'use strict';

    // Character templates — spec v0.3 §1.
    // Both have identical HP/Energy/Autonode pools. The split is in
    // Range vs Melee plus the in-fiction role (Drakey gadgets, Torred
    // brute). Brox is the comms voice — NOT a playable character.
    var CHARACTERS = {
        drakey: {
            key: 'drakey',
            label: 'Drakey',
            role: 'gadget specialist',
            blurb: 'in-field tech operator. light, gear-heavy, range-tilted.',
            stats: {
                hp: 80,       maxHp: 80,
                energy: 200,  maxEnergy: 200,
                autonode: 40, maxAutonode: 40,
                range: 10,    melee: 3,
                int: 1
            }
        },
        torred: {
            key: 'torred',
            label: 'Torred',
            role: 'brute',
            blurb: 'heavy. close-quarters attrition. takes a beating.',
            stats: {
                hp: 80,       maxHp: 80,
                energy: 200,  maxEnergy: 200,
                autonode: 40, maxAutonode: 40,
                range: 4,     melee: 8,
                int: 1
            }
        }
    };

    var STORAGE_KEYS = {
        codes:     'shred_crawler_codes',
        character: 'shred_crawler_char'
    };

    function loadCodes() {
        try {
            var raw = sessionStorage.getItem(STORAGE_KEYS.codes);
            if (raw) {
                var parsed = JSON.parse(raw);
                // Defensive: ensure shape is correct in case old data
                // exists from a different schema version.
                return {
                    schema:    parsed.schema    || null,
                    archive:   parsed.archive   || null,
                    esoterica: parsed.esoterica || null,
                    pack:      parsed.pack      || null
                };
            }
        } catch (e) { /* fall through to default */ }
        return { schema: null, archive: null, esoterica: null, pack: null };
    }

    function saveCodes(codes) {
        try { sessionStorage.setItem(STORAGE_KEYS.codes, JSON.stringify(codes)); }
        catch (e) {}
    }

    function loadCharacter() {
        try {
            var raw = sessionStorage.getItem(STORAGE_KEYS.character);
            return CHARACTERS[raw] ? raw : null;
        } catch (e) { return null; }
    }

    function saveCharacter(char) {
        try { sessionStorage.setItem(STORAGE_KEYS.character, char || ''); }
        catch (e) {}
    }

    // newRunState(characterKey, codes) → run state object
    //
    // Builds a fresh run state from a character template and the
    // active code slots. Applies INT from codes to player.int. Sets
    // mode='static' (Phase 1+ will drive the static/tick alternation).
    //
    // Phase 0 builds this object so the architecture is exercised
    // end-to-end from the menu flow, even though no rooms/combat
    // exist yet to consume it.
    function newRunState(characterKey, codes) {
        var tpl = CHARACTERS[characterKey];
        if (!tpl) throw new Error('unknown character: ' + characterKey);

        var intResult = window.Crawler.Codes.computeInt(codes);
        var statsBase = tpl.stats;

        // Build inventory + auto-equip the first weapon of each slot
        // (so the starter blade is in the close slot at run start,
        // not buried under tools in the inventory list).
        var inv = defaultInventory(codes.pack);
        var startEquip = { ranged: null, close: null, gear: null };
        for (var ii = inv.length - 1; ii >= 0; ii--) {
            var it = inv[ii];
            if (it.type !== 'weapon') continue;
            var slot = it.slot;
            if (!slot || startEquip[slot]) continue;
            startEquip[slot] = it;
            inv.splice(ii, 1);
        }

        return {
            // ─── machine ────────────────────────────────
            mode: 'static',                 // 'static' | 'tick' | 'dead'
            tick: 0,
            scheduledEvents: [],
            log: [],
            startedAt: Date.now(),

            // ─── identity ───────────────────────────────
            character: tpl.key,
            faction:   null,                // assigned at run start (Phase 3)

            // ─── codes & INT decomposition ──────────────
            codes:         Object.assign({}, codes),
            intBreakdown:  intResult.perCategory,

            // ─── player ─────────────────────────────────
            player: {
                hp:        statsBase.hp,
                maxHp:     statsBase.maxHp,
                energy:    statsBase.energy,
                maxEnergy: statsBase.maxEnergy,
                autonode:  statsBase.autonode,
                maxAutonode: statsBase.maxAutonode,
                range:     statsBase.range,
                melee:     statsBase.melee,
                int:       intResult.total,

                inventory:    inv,
                // Pass 3.26 equipment slots. equip/unequip mutate
                // these; combat and effective-stat helpers read them.
                weaponClose:  startEquip.close,
                weaponRanged: startEquip.ranged,
                gear:         startEquip.gear,
                // Default posture by character — Drakey is range-tilted
                // (range 10, melee 3), Torred is close (range 4, melee 8).
                // Player can swap with the `posture` action.
                posture:      characterKey === 'drakey' ? 'ranged' : 'close',

                // Pass 3.27: reaction time is a CHARACTER STAT, default 4
                // for both. Higher values mean slower reactions on entering
                // a room with an aware enemy (more free enemy ticks before
                // the player can act). Future characters can vary this;
                // gear (agro_detector) can reduce it at autonode cost.
                reactionTime: 4
            },

            // ─── world (Phase 3) ────────────────────────
            grid:           null,           // populated by Grid.generate
            currentRoomKey: null,           // string key "x,y"
            visited:        [],             // keys the player has been in

            // ─── per-room runtime state (Phase 2+3) ─────
            // Lazy-initialized on room entry. Keyed by room key string.
            //   roomState["x,y"] = {
            //     enemy:        enemy instance | null,
            //     scanned:      bool (player monitored on the room)
            //     silentAlert:  bool (enemy monitored on you, you blind)
            //     cleared:      bool (room had an enemy and it died)
            //   }
            roomState:   {}
        };
    }

    // getOrInitRoomState(runState, key) → roomState entry
    //
    // Lazy-initializes a roomState entry. Spawns the enemy and
    // generates containers per spec §7. Idempotent.
    //
    // Pass 3.24 schema:
    //   enemy:       enemy instance | null   (with .awareness set on spawn)
    //   peeked:      bool                    (scanned from an adjacent room)
    //   peekResult:  'clear' | 'enemy' | 'no_signal' | null
    //   containers:  array of container objects (per containers.js)
    //   cleared:     bool   (room had an enemy and it died)
    //   visited:     bool   (player entered at least once)
    function getOrInitRoomState(runState, k) {
        if (!runState.roomState) runState.roomState = {};
        if (runState.roomState[k]) return runState.roomState[k];

        var entry = {
            enemy:      null,
            peeked:     false,
            peekResult: null,
            containers: [],
            cleared:    false,
            visited:    false
        };

        // Spawn enemy if grid + enemy seeding says so. Pass 3.24:
        // enemies spawn 'blind' (unaware of player). Awareness is
        // updated on first room entry based on whether the player
        // peeked first.
        if (window.Crawler.Rooms && window.Crawler.Enemies) {
            var room = window.Crawler.Rooms.getRoom(runState, k);
            if (room) {
                var tplId = window.Crawler.Rooms.getEnemyTemplateForRoom(runState, room);
                if (tplId) {
                    entry.enemy = window.Crawler.Enemies.spawn(tplId);
                    entry.enemy.awareness = 'blind';
                }
            }
        }

        // Generate containers — skip the spawn room (foyer is sterile)
        if (window.Crawler.Containers && window.Crawler.Grid) {
            var dist = window.Crawler.Grid.distanceFromSpawn(runState.grid, k);
            if (dist > 0) {
                entry.containers = window.Crawler.Containers.generateForRoom({
                    distance: dist
                });
            }
        }

        runState.roomState[k] = entry;
        return entry;
    }

    // defaultInventory(packCode) → array of inventory items
    //
    // Spec v0.3 §7: no Pack code → 1 basic weapon + 1 bandage.
    // Pack codes (Phase 4) will mutate this. For Phase 0 we ignore the
    // Pack code and always return the default; later phases will read
    // the parsed Pack code and apply its effects.
    //
    // Phase 3: include one of each tool (prybar, lockpick, crypt key)
    // so the player can test all three lock types. Spec §7 places
    // tools in the Pack-code derived loadout, but for v0 testing we
    // hand them out so the door mechanic is exercisable from the
    // first run. Phase 4 will move tools back behind Pack codes.
    function defaultInventory(packCode) {
        // Pass 3.27: every character starts with BOTH a basic close
        // and basic ranged weapon. Effective damage scales off their
        // base stats (Drakey's range 10 + pistol +2 = 12 ranged;
        // Torred's melee 8 + blade +2 = 10 close), so the same
        // starter kit reads differently per class without duplicating
        // class-specific gear. Future characters can override via
        // their own loadout once Pack codes carry that data.
        var inv = [
            {
                type: 'weapon', subtype: 'close', slot: 'close',
                label: 'basic blade', key: 'basic_blade',
                bonus: 2,
                blurb: '+2 melee. better than fists.'
            },
            {
                type: 'weapon', subtype: 'ranged', slot: 'ranged',
                label: 'basic pistol', key: 'basic_pistol',
                bonus: 2,
                blurb: '+2 ranged. salvaged. fits your hand.'
            },
            {
                type: 'consumable',
                subtype: 'bandage',
                label: 'bandage',
                hp: 14
            },
            // Phase 3 testing tools — Phase 4 makes these Pack-gated
            { type: 'tool', subtype: 'prybar',   key: 'prybar',   label: 'prybar' },
            { type: 'tool', subtype: 'lockpick', key: 'lockpick', label: 'lockpick' },
            { type: 'tool', subtype: 'cryptkey', key: 'cryptkey', label: 'crypt key' }
        ];
        // TODO(phase 4): apply Pack code modifications.
        return inv;
    }

    window.Crawler = window.Crawler || {};
    // Pass 3.26: effective stat helpers. Combat reads these instead
    // of the raw player.range / player.melee so equipped weapons add
    // their bonus into the damage values without combat needing to
    // know about the equipment system.
    function effectiveRange(player) {
        if (!player) return 0;
        var base  = player.range || 0;
        var bonus = (player.weaponRanged && player.weaponRanged.bonus) ? player.weaponRanged.bonus : 0;
        return Math.max(0, base + bonus);
    }
    function effectiveMelee(player) {
        if (!player) return 0;
        var base  = player.melee || 0;
        var bonus = (player.weaponClose && player.weaponClose.bonus) ? player.weaponClose.bonus : 0;
        return Math.max(0, base + bonus);
    }
    function effectiveInt(player) {
        if (!player) return 0;
        var base  = player.int || 0;
        var bonus = (player.gear && player.gear.intBonus) ? player.gear.intBonus : 0;
        return base + bonus;
    }

    // Pass 3.27: gear effect API.
    //
    // tryGearEffect(player, kind) → bool
    //   Attempts to use the equipped gear's active effect of `kind`.
    //   If the gear's effect matches AND the player has enough autonode,
    //   deducts the autoCost and returns true. Otherwise returns false
    //   (silent fallback — caller uses base behavior).
    //
    //   kinds: 'scan-second' | 'reaction-reduce' | 'move-fast'
    //
    // gearEffectAvailable(player, kind) → bool
    //   Read-only check (used by render code so option labels can show
    //   the gear-modified value as the default when affordable).
    //
    // effectiveReactionTime(player) → number
    //   READ-ONLY preview value for the option panel. Does NOT charge
    //   autonode. The actual charge happens in tryGearEffect at apply
    //   time (see appendReactionLag in crawler.js).
    //
    // effectiveMoveTicks(player) → number
    //   Same idea — preview value for door option labels.
    function gearEffectAvailable(player, kind) {
        if (!player || !player.gear) return false;
        var g = player.gear;
        if (g.effect !== kind) return false;
        var cost = g.autoCost || 0;
        return (player.autonode || 0) >= cost;
    }
    function tryGearEffect(player, kind) {
        if (!gearEffectAvailable(player, kind)) return false;
        var cost = player.gear.autoCost || 0;
        player.autonode = Math.max(0, (player.autonode || 0) - cost);
        return true;
    }
    function effectiveReactionTime(player) {
        var base = player && player.reactionTime != null ? player.reactionTime : 4;
        if (gearEffectAvailable(player, 'reaction-reduce')) {
            var r = player.gear.reactionReduce || 0;
            return Math.max(0, base - r);
        }
        return base;
    }
    function effectiveMoveTicks(player) {
        var base = 3;  // Pass 3.27 default — was 1 prior
        if (gearEffectAvailable(player, 'move-fast')) {
            var s = player.gear.moveSavings || 0;
            return Math.max(1, base - s);
        }
        return base;
    }

    window.Crawler.State = {
        CHARACTERS: CHARACTERS,
        loadCodes: loadCodes,
        saveCodes: saveCodes,
        loadCharacter: loadCharacter,
        saveCharacter: saveCharacter,
        newRunState: newRunState,
        getOrInitRoomState: getOrInitRoomState,
        effectiveRange:        effectiveRange,
        effectiveMelee:        effectiveMelee,
        effectiveInt:          effectiveInt,
        effectiveReactionTime: effectiveReactionTime,
        effectiveMoveTicks:    effectiveMoveTicks,
        gearEffectAvailable:   gearEffectAvailable,
        tryGearEffect:         tryGearEffect
    };
})();
