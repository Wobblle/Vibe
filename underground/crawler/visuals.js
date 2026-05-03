/* ============================================================
 * SHRED CRAWLER · visuals.js · Phase 3.23
 * ============================================================
 * Scene library for the visuals pane (top-right). Pure ASCII
 * pictures, no text labels — per spec Pass 3.23 the visuals
 * pane is a wordless action visualization, not a room display.
 *
 * Two ways scenes are chosen:
 *   1. State-driven on each renderStatic — picks idle / blind /
 *      silent_alert / combat-close / combat-ranged / enemy-down /
 *      dead based on the current run state.
 *   2. Action-driven during tick playback — action handlers in
 *      crawler.js call Visuals.show() before scheduler.play to
 *      swap the scene for the duration of the action. The next
 *      renderStatic re-picks a state scene to revert.
 *
 * Width budget: ~22 chars (fits the visuals pane with padding)
 * Height budget: ~9 lines including padding
 *
 * No text in any scene. Only glyphs:
 *   ◯  player
 *   ◊  enemy
 *   ░  open / safe space / door open
 *   ▒▓ lock material
 *   ✕  damage marks
 *   ╳  broken / frozen
 *   ⌒  sensor wave
 *   z  rest
 *   ⊙  enemy eye on you
 *   ?  unknown / blind
 *   !  alert
 *   ┄  waiting / passing time
 *   ═►─►  projectile / movement
 *
 * Depends on: nothing.
 * ============================================================ */
(function () {
    'use strict';

    // Each scene is an array of lines. show() clears the visuals
    // pane and emits each line via ctx.ascii (so they get the
    // ASCII line color from underground.html CSS).
    var SCENES = {

        // ─── ROOM / IDLE STATES ─────────────────────────────────
        idle: [
            '',
            '    ┌─ · ─┐',
            '    ·     ·',
            '    ·     ·',
            '    ·  ◯  ·',
            '    ·     ·',
            '    └─ · ─┘',
            ''
        ],
        blind: [
            '',
            '    ┌─ ? ─┐',
            '    ?  ?  ?',
            '    ?     ?',
            '    ?  ◯  ?',
            '    ?  ?  ?',
            '    └─ ? ─┘',
            ''
        ],
        silent_alert: [
            '',
            '    ┌─ ! ─┐',
            '    !  ⊙  !',
            '    !     !',
            '    !  ◯  !',
            '    !  !  !',
            '    └─ ! ─┘',
            ''
        ],

        // ─── COMBAT STATES (scanned · enemy known) ──────────────
        'combat-close': [
            '',
            '    ┌──────┐',
            '    │      │',
            '    │      │',
            '    │ ◯  ◊ │',
            '    │      │',
            '    └──────┘',
            ''
        ],
        'combat-ranged': [
            '',
            '    ┌─────────┐',
            '    │         │',
            '    │         │',
            '    │ ◯ ─── ◊ │',
            '    │         │',
            '    └─────────┘',
            ''
        ],

        // ─── ACTION SCENES (swapped during tick playback) ──────
        'attack-melee': [
            '',
            '    ┌──────┐',
            '    │  ╲   │',
            '    │   ╳  │',
            '    │ ◯ ◊  │',
            '    │      │',
            '    └──────┘',
            ''
        ],
        'attack-ranged': [
            '',
            '    ┌─────────┐',
            '    │         │',
            '    │         │',
            '    │ ◯ ════►◊│',
            '    │         │',
            '    └─────────┘',
            ''
        ],
        'damaged': [
            '',
            '    ┌──────┐',
            '    │  ✕   │',
            '    │ ✕◯✕  │',
            '    │  ✕   │',
            '    │      │',
            '    └──────┘',
            ''
        ],
        'walking': [
            '',
            '    ┌──    ',
            '    │      ',
            '    │      ',
            '    │ ◯ ─► ',
            '    │      ',
            '    └──    ',
            ''
        ],
        'lockpick': [
            '',
            '    ┌──┬──┐',
            '    │  ▒  │',
            '    │  ▓  │',
            '    │ ◯▒  │',
            '    │  ▓  │',
            '    │  ▒  │',
            '    └──┴──┘',
            ''
        ],
        'door-open': [
            '',
            '    ┌─   ─┐',
            '    │     │',
            '    │     │',
            '    │ ◯ ░ │',
            '    │     │',
            '    └─   ─┘',
            ''
        ],
        'door-frozen': [
            '',
            '    ┌──╳──┐',
            '    │  ╳  │',
            '    │ ╳╳╳ │',
            '    │ ◯╳  │',
            '    │ ╳╳╳ │',
            '    └──╳──┘',
            ''
        ],
        'resting': [
            '',
            '    ┌──────┐',
            '    │ z    │',
            '    │   z  │',
            '    │ z    │',
            '    │ ◯╶   │',
            '    │ ┴    │',
            '    └──────┘',
            ''
        ],
        'bandaging': [
            '',
            '    ┌──────┐',
            '    │      │',
            '    │      │',
            '    │ ═◯═  │',
            '    │      │',
            '    │      │',
            '    └──────┘',
            ''
        ],
        'scanning': [
            '',
            '    ┌──────┐',
            '    │ ⌒  ⌒ │',
            '    │   ⌒  │',
            '    │ ◯))) │',
            '    │   ⌒  │',
            '    │ ⌒  ⌒ │',
            '    └──────┘',
            ''
        ],
        'waiting': [
            '',
            '    ┌──────┐',
            '    │      │',
            '    │      │',
            '    │  ◯   │',
            '    │  ┄┄  │',
            '    │      │',
            '    └──────┘',
            ''
        ],
        'posture-shift': [
            '',
            '    ┌──────┐',
            '    │      │',
            '    │ ◯⇄   │',
            '    │      │',
            '    │      │',
            '    │      │',
            '    └──────┘',
            ''
        ],

        // ─── END STATES ──────────────────────────────────────────
        'enemy-down': [
            '',
            '    ┌──────┐',
            '    │      │',
            '    │      │',
            '    │  ◯   │',
            '    │      │',
            '    │ ◊___ │',
            '    └──────┘',
            ''
        ],
        'dead': [
            '',
            '    ┌──────┐',
            '    │░░░░░░│',
            '    │░░░░░░│',
            '    │░░◯_░░│',
            '    │░░░░░░│',
            '    │░░░░░░│',
            '    └──────┘',
            ''
        ],

        // ─── PRE-RUN / IDLE-SHELL placeholder ───────────────────
        // Shown before the first room is entered (menu screen).
        'menu': [
            '',
            '    ┌──────┐',
            '    │      │',
            '    │      │',
            '    │  ··  │',
            '    │      │',
            '    │      │',
            '    └──────┘',
            ''
        ],

        // ─── Pass 3.24 additions ────────────────────────────────
        'container-open': [
            '',
            '    ┌──────┐',
            '    │ ╔══╗ │',
            '    │ ║░░║ │',
            '    │ ║░░║ │',
            '    │ ╚══╝ │',
            '    │ ◯    │',
            '    └──────┘',
            ''
        ],
        'container-empty': [
            '',
            '    ┌──────┐',
            '    │ ╔══╗ │',
            '    │ ║  ║ │',
            '    │ ║  ║ │',
            '    │ ╚══╝ │',
            '    │ ◯    │',
            '    └──────┘',
            ''
        ],
        'container-trap': [
            '',
            '    ┌──────┐',
            '    │ ✕✕✕✕ │',
            '    │ ✕══✕ │',
            '    │ ✕  ✕ │',
            '    │ ✕══✕ │',
            '    │ ◯ ✕  │',
            '    └──────┘',
            ''
        ],
        'peek-clear': [
            '',
            '    ┌──┐ ░ ┌──┐',
            '    │  │   │  │',
            '    │ ◯│ ⌒ │  │',
            '    │  │   │  │',
            '    └──┘   └──┘',
            ''
        ],
        'peek-enemy': [
            '',
            '    ┌──┐ ░ ┌──┐',
            '    │  │   │  │',
            '    │ ◯│ ⌒ │ ◊│',
            '    │  │   │  │',
            '    └──┘   └──┘',
            ''
        ]
    };

    // show(key, ctx) — clear the visuals pane and emit the scene.
    // Falls back to 'idle' if the key isn't found. Uses the 'scene'
    // CSS class which gives the line:
    //   - bright amber color (matches visuals pane theme)
    //   - white-space: pre (preserves ASCII spacing exactly)
    //   - tight line-height (figures don't gap apart)
    function show(key, ctx) {
        if (!ctx || typeof ctx.clear !== 'function') return;
        ctx.clear();
        var scene = SCENES[key] || SCENES.idle;
        for (var i = 0; i < scene.length; i++) {
            ctx.out(scene[i], 'scene');
        }
    }

    // pickStateScene(runState, roomState) — chooses the appropriate
    // state-driven scene for the current room. Called from
    // renderStatic to set the default visual after every turn.
    // Pass 3.24: scene selection by enemy.awareness, not roomState.scanned.
    // Player always knows the enemy in their room — the awareness
    // refers to the ENEMY's view of the player.
    function pickStateScene(runState, roomState) {
        if (!runState) return 'menu';
        if (runState.player && runState.player.hp <= 0) return 'dead';
        var enemy = roomState && roomState.enemy;
        if (enemy && enemy.hp <= 0) return 'enemy-down';
        if (enemy) {
            // Blind enemy → use 'blind' scene (they don't see you yet)
            if (enemy.awareness === 'blind') return 'blind';
            // Aware enemy → posture-appropriate combat scene
            return enemy.posture === 'ranged' ? 'combat-ranged' : 'combat-close';
        }
        return 'idle';
    }

    window.Crawler = window.Crawler || {};
    window.Crawler.Visuals = {
        show:           show,
        pickStateScene: pickStateScene,
        SCENES:         SCENES
    };
})();
