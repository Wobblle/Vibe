/* ============================================================
 * SHRED CRAWLER · enemies.js · Phase 2
 * ============================================================
 * Enemy templates + spawn factory + simple AI.
 *
 * Phase 2 ships only two templates — one ranged grunt, one close
 * grunt, both Breaker faction — to validate the combat tick stream
 * with both posture types. Phase 3 will expand to 5 grades × 4
 * factions per spec §4 (with stat multipliers 1.0/1.6/2.4/2.0/2.0).
 *
 * Templates are the static shape; spawn(template) returns a fresh
 * instance with mutable HP for combat. AI for v0 is dumb-aggressive:
 * always attacks with the natural posture.
 *
 * Stats are tuned for ~6:1 player advantage at run start (spec §14).
 * Drakey range=10, Torred melee=8 → grunts die in 2 ranged shots
 * or 2 melee strikes.
 *
 * Depends on: nothing.
 * ============================================================ */
(function () {
    'use strict';

    // ============== TEMPLATES ==============
    //
    // shortLabel: tight in-line tag for combat events
    // label:      full name for static screen
    // posture:    natural attack posture (also default response)
    // hp:         starting HP
    // range/melee: damage per their respective attack tick
    // response:   ticks of stun after taking damage (Phase 2.5 use;
    //             stored now so the field exists)
    // Pass 3.28: each template has BASE values. spawn() rolls
    // ±20% HP and ±15% damage variance per instance, so two
    // breaker grunts in different rooms read with different bite.
    // Faction tags (breaker / chorus / portsman / higi) align with
    // spec §3 — Phase 5 will gate spawn pools by compound faction.
    var TEMPLATES = {
        // ─── BREAKER (raw kinetic damage, low HP) ─────────────
        breaker_grunt_close: {
            id: 'breaker_grunt_close',
            shortLabel: 'breaker',
            label: 'breaker grunt',
            faction: 'breaker',
            grade: 'grunt',
            posture: 'close',
            hp: 14, range: 0, melee: 5,
            response: 2,
            blurb: 'twitching. arms hang wrong.'
        },
        breaker_grunt_ranged: {
            id: 'breaker_grunt_ranged',
            shortLabel: 'breaker',
            label: 'breaker grunt',
            faction: 'breaker',
            grade: 'grunt',
            posture: 'ranged',
            hp: 12, range: 4, melee: 0,
            response: 2,
            blurb: 'augment hardware visible at the wrist. it tracks you.'
        },
        breaker_brute: {
            id: 'breaker_brute',
            shortLabel: 'brute',
            label: 'breaker brute',
            faction: 'breaker',
            grade: 'lieutenant',
            posture: 'close',
            hp: 32, range: 0, melee: 8,
            response: 3,
            blurb: 'doubled in size by a bad implant. hits hard. hits slow.'
        },

        // ─── CHORUS (signal-based, accurate ranged) ───────────
        chorus_singer: {
            id: 'chorus_singer',
            shortLabel: 'singer',
            label: 'chorus singer',
            faction: 'chorus',
            grade: 'grunt',
            posture: 'ranged',
            hp: 10, range: 6, melee: 1,
            response: 2,
            blurb: 'quiet hum at the back of your skull. eyes too still.'
        },
        chorus_disciple: {
            id: 'chorus_disciple',
            shortLabel: 'disciple',
            label: 'chorus disciple',
            faction: 'chorus',
            grade: 'runner',
            posture: 'close',
            hp: 18, range: 0, melee: 6,
            response: 2,
            blurb: 'robed. unblinking. moves on the count of three.'
        },

        // ─── PORTSMAN (fast, low damage, glassy HP) ──────────
        portsman_runner: {
            id: 'portsman_runner',
            shortLabel: 'runner',
            label: 'portsman runner',
            faction: 'portsman',
            grade: 'runner',
            posture: 'close',
            hp: 9, range: 0, melee: 4,
            response: 1,
            blurb: 'thin coat. carrying something that\'s not yours.'
        },
        portsman_marshal: {
            id: 'portsman_marshal',
            shortLabel: 'marshal',
            label: 'portsman marshal',
            faction: 'portsman',
            grade: 'lieutenant',
            posture: 'ranged',
            hp: 16, range: 7, melee: 2,
            response: 2,
            blurb: 'union badge. fires before talking.'
        },

        // ─── HIGI (corporate · balanced · armored) ────────────
        higi_agent: {
            id: 'higi_agent',
            shortLabel: 'agent',
            label: 'higi agent',
            faction: 'higi',
            grade: 'grunt',
            posture: 'ranged',
            hp: 16, range: 5, melee: 3,
            response: 2,
            blurb: 'clean suit. company sidearm. wired comms.'
        },
        higi_blackcoat: {
            id: 'higi_blackcoat',
            shortLabel: 'blackcoat',
            label: 'higi blackcoat',
            faction: 'higi',
            grade: 'officer',
            posture: 'close',
            hp: 26, range: 2, melee: 7,
            response: 2,
            blurb: 'no badge. no warning. they don\'t leave witnesses.'
        }
    };

    // ─── ROSTER POOLS (used by Rooms.getEnemyTemplateForRoom) ────
    // Phase 5 will key spawn pools off the compound's faction. For
    // now expose ALL_IDS so the rooms module can pick uniformly across
    // every template.
    var ALL_IDS = Object.keys(TEMPLATES);

    function getTemplate(id) {
        return TEMPLATES[id] || null;
    }

    // spawn(templateId) → enemy instance
    //
    // Fresh mutable enemy. hp starts at maxHp. Includes a unique
    // _instanceId so two enemies of the same template don't share
    // identity in roomState.
    var _nextId = 1;
    // Pass 3.28 variance: HP ±20%, damage ±15%. Floors are clamped
    // so a low roll on a 1-damage attack doesn't round to 0.
    function vary(base, pct) {
        if (!base) return base;
        var lo = base * (1 - pct);
        var hi = base * (1 + pct);
        var rolled = Math.round(lo + Math.random() * (hi - lo));
        if (base > 0 && rolled < 1) rolled = 1;
        return rolled;
    }
    function spawn(templateId) {
        var tpl = TEMPLATES[templateId];
        if (!tpl) return null;
        var hp     = vary(tpl.hp,    0.20);
        var range  = vary(tpl.range, 0.15);
        var melee  = vary(tpl.melee, 0.15);
        return {
            _instanceId: _nextId++,
            id: tpl.id,
            shortLabel: tpl.shortLabel,
            label: tpl.label,
            faction: tpl.faction,
            grade: tpl.grade,
            posture: tpl.posture,
            hp: hp,
            maxHp: hp,
            range: range,
            melee: melee,
            response: tpl.response,
            blurb: tpl.blurb,
            // Mutable runtime state
            stunUntil: 0,         // tick before which enemy can't act (Phase 2.5)
            // Pass 3.24 awareness — set by state.js on spawn to 'blind',
            // updated to 'aware' on first room entry if the player came
            // in unscanned, or by per-action alert rolls while blind.
            awareness: 'blind'
        };
    }

    function isDead(enemy) {
        return !enemy || enemy.hp <= 0;
    }

    // ============== AI ==============
    //
    // v0 AI: always attacks with the natural posture. Phase 3+ can
    // introduce defensive switches, posture changes based on player
    // distance/HP, faction-specific behavior. Returns a STRING that
    // the combat module's planner converts to a plan, OR returns
    // null if the enemy is unable to act this turn (dead, stunned).
    //
    //   'attack-natural'  → attack with own posture
    //   'wait'            → skip turn (placeholder for Phase 3+)
    function chooseAction(enemy, runState) {
        if (isDead(enemy)) return null;
        if (runState && enemy.stunUntil > runState.tick) return 'wait';
        // Pass 3.24: a blind enemy doesn't act. Player gets free
        // turns until alerted (per-action alert chance handled by
        // crawler.js, or instant alert on entry without scan).
        if (enemy.awareness === 'blind') return null;
        return 'attack-natural';
    }

    window.Crawler = window.Crawler || {};
    window.Crawler.Enemies = {
        TEMPLATES: TEMPLATES,
        ALL_IDS:   ALL_IDS,
        getTemplate: getTemplate,
        spawn: spawn,
        isDead: isDead,
        chooseAction: chooseAction
    };
})();
