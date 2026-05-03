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
    var TEMPLATES = {
        breaker_grunt_close: {
            id: 'breaker_grunt_close',
            shortLabel: 'breaker',
            label: 'breaker grunt',
            faction: 'breaker',
            grade: 'grunt',
            posture: 'close',
            hp: 14,
            range: 0,
            melee: 5,
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
            hp: 12,
            range: 4,
            melee: 0,
            response: 2,
            blurb: 'augment hardware visible at the wrist. it tracks you.'
        }
    };

    function getTemplate(id) {
        return TEMPLATES[id] || null;
    }

    // spawn(templateId) → enemy instance
    //
    // Fresh mutable enemy. hp starts at maxHp. Includes a unique
    // _instanceId so two enemies of the same template don't share
    // identity in roomState.
    var _nextId = 1;
    function spawn(templateId) {
        var tpl = TEMPLATES[templateId];
        if (!tpl) return null;
        return {
            _instanceId: _nextId++,
            id: tpl.id,
            shortLabel: tpl.shortLabel,
            label: tpl.label,
            faction: tpl.faction,
            grade: tpl.grade,
            posture: tpl.posture,
            hp: tpl.hp,
            maxHp: tpl.hp,
            range: tpl.range,
            melee: tpl.melee,
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
        getTemplate: getTemplate,
        spawn: spawn,
        isDead: isDead,
        chooseAction: chooseAction
    };
})();
