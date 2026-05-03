/* ============================================================
 * SHRED CRAWLER · combat.js · Phase 2
 * ============================================================
 * Combat plan builders + tick-stream interleaver.
 *
 * Architecture (per spec §13, §14):
 *   1. Every action a player can take while in an occupied room is
 *      represented as a "plan" — a list of per-tick steps with
 *      damage/labels/apply hooks.
 *   2. The enemy AI returns its own plan for the same turn.
 *   3. buildTurn(playerPlan, enemy, runState) merges the two plans
 *      onto a shared tick stream — one Scheduler event per tick
 *      with a combined "·"-joined line of all parties' activity.
 *   4. Damage applies during apply(); interrupt detection cancels
 *      a close-attack windup if the attacker is hit before the
 *      damage tick.
 *   5. Death checks happen in crawler.js's playAndReturn() after
 *      the entire stream completes, OR the scheduler can be
 *      aborted mid-stream by a future Phase 2.5 enhancement.
 *
 * Plan shape:
 *   {
 *     type:           'attack' | 'simple' | 'scan' | 'posture' | 'move'
 *     posture:        'ranged' | 'close' | undefined
 *     label:          short identifier ('shoot' / 'swing' / etc.)
 *     ticks:          total tick count
 *     damageTickIdx:  for close attacks, the 0-based tick where
 *                     damage applies (interrupt cancels if hit before)
 *     steps: [
 *       { label, damage: { to: 'enemy'|'player', amount }, apply, sideEffect }
 *     ]
 *   }
 *
 * Depends on: window.Crawler.Enemies, window.Crawler.Narrate.
 * ============================================================ */
(function () {
    'use strict';

    // ============== PLAN BUILDERS ==============

    // Pass 3.26: damage values pulled through State.effectiveRange /
    // effectiveMelee so equipped weapons add their bonus into combat
    // without the planners knowing about the equipment system.
    function _eRange(p) {
        var S = window.Crawler && window.Crawler.State;
        if (S && typeof S.effectiveRange === 'function') return S.effectiveRange(p);
        return p.range || 1;
    }
    function _eMelee(p) {
        var S = window.Crawler && window.Crawler.State;
        if (S && typeof S.effectiveMelee === 'function') return S.effectiveMelee(p);
        return p.melee || 1;
    }

    // Player ranged attack — 1 tick, damage on tick 0.
    // Cooldown starts instantly per spec §14.
    function planPlayerRanged(player) {
        return {
            type: 'attack',
            posture: 'ranged',
            label: 'shoot',
            ticks: 1,
            damageTickIdx: 0,
            steps: [
                { label: 'shoot', damage: { to: 'enemy', amount: _eRange(player) } }
            ]
        };
    }

    // Player close attack — 4 ticks total, damage on tick 2 (3rd tick).
    // Interrupted if hit on ticks 0 or 1 (windup).
    function planPlayerClose(player) {
        return {
            type: 'attack',
            posture: 'close',
            label: 'swing',
            ticks: 4,
            damageTickIdx: 2,
            steps: [
                { label: 'wind up' },
                { label: 'swing'   },
                { label: 'strike',  damage: { to: 'enemy', amount: _eMelee(player) } },
                { label: 'recover' }
            ]
        };
    }

    function planPlayerAttack(player) {
        return player.posture === 'ranged'
            ? planPlayerRanged(player)
            : planPlayerClose(player);
    }

    // Player posture switch — 1 tick. Vulnerable during the swap.
    function planPlayerPosture(player) {
        var newPos = player.posture === 'ranged' ? 'close' : 'ranged';
        return {
            type: 'posture',
            label: 'posture → ' + newPos,
            ticks: 1,
            steps: [
                {
                    label: 'shift to ' + newPos,
                    apply: function () { player.posture = newPos; }
                }
            ]
        };
    }

    // Player scan — indeterminate ticks (2-6), INT reduces variance.
    // Outcome is rolled at plan creation; the events apply state
    // changes at the end of the tick stream.
    //
    // Outcome:
    //   success      → roomState.scanned = true (player monitored on enemy)
    //   no_signal    → wasted ticks, no info
    //   silent_alert → enemy monitored on player, player stays blind
    //                  (mechanic stub for Phase 2.5; v0 just narrates)
    function planPlayerScan(player, roomState) {
        var int = player.int || 1;
        // Variance: at INT 1, 2-6 ticks. Higher INT shrinks the upper
        // bound. Floor at 2.
        var minT = 2;
        var maxT = Math.max(minT, 6 - Math.floor((int - 1) / 2));
        var ticks = minT + Math.floor(Math.random() * (maxT - minT + 1));

        // Outcome roll: 80% success, 15% no_signal, 5% silent_alert.
        // INT does not change outcome odds for v0 (only variance);
        // tunable in Phase 2.5.
        var roll = Math.random();
        var outcome = roll < 0.80 ? 'success' :
                      roll < 0.95 ? 'no_signal' :
                                    'silent_alert';

        var steps = [];
        for (var i = 0; i < ticks; i++) {
            steps.push({ label: i === 0 ? 'scan...' : '...' });
        }
        // Final tick carries the outcome side-effect
        var lastIdx = steps.length - 1;
        steps[lastIdx].apply = function () {
            if (outcome === 'success') {
                roomState.scanned = true;
                roomState.silentAlert = false;
            } else if (outcome === 'silent_alert') {
                roomState.scanned = false;
                roomState.silentAlert = true;
            }
            // no_signal: nothing changes
        };
        steps[lastIdx].outcome = outcome; // exposed for narrate

        return {
            type: 'scan',
            label: 'scan',
            ticks: ticks,
            damageTickIdx: null,
            outcome: outcome,
            steps: steps
        };
    }

    // Generic "simple" player plan — for non-attack actions in an
    // occupied room (move, wait, bandage, comms, rest). The crawler
    // builds these from the existing action shapes; combat just
    // wraps them with enemy events.
    //
    // simpleSteps = array of { label, apply } — one per tick.
    // The plan's tick count equals simpleSteps.length.
    function planPlayerSimple(type, label, simpleSteps) {
        return {
            type: type,
            label: label,
            ticks: simpleSteps.length,
            damageTickIdx: null,
            steps: simpleSteps.map(function (s) {
                return {
                    label: s.label || '',
                    apply: s.apply || null,
                    damage: null
                };
            })
        };
    }

    // ============== ENEMY PLANS ==============

    function planEnemyRanged(enemy) {
        return {
            type: 'attack',
            posture: 'ranged',
            label: enemy.shortLabel + ' shoots',
            ticks: 1,
            damageTickIdx: 0,
            steps: [
                { label: 'shoot', damage: { to: 'player', amount: enemy.range || 1 } }
            ]
        };
    }

    function planEnemyClose(enemy) {
        return {
            type: 'attack',
            posture: 'close',
            label: enemy.shortLabel + ' swings',
            ticks: 4,
            damageTickIdx: 2,
            steps: [
                { label: 'windup' },
                { label: 'lunge'  },
                { label: 'strike',  damage: { to: 'player', amount: enemy.melee || 1 } },
                { label: 'recover' }
            ]
        };
    }

    function planEnemy(enemy, runState) {
        var decision = window.Crawler.Enemies.chooseAction(enemy, runState);
        if (!decision || decision === 'wait') return null;
        if (decision === 'attack-natural') {
            return enemy.posture === 'ranged'
                ? planEnemyRanged(enemy)
                : planEnemyClose(enemy);
        }
        return null;
    }

    // ============== TURN BUILDER ==============
    //
    // buildTurn(playerPlan, enemy, runState, opts) → events[]
    //
    // Interleaves player + enemy plans onto a single Scheduler event
    // stream. One event per tick. apply() builds the line parts
    // dynamically (so post-apply state is reflected in the line).
    //
    // opts.tickDelayMs: per-tick wall-clock delay (default 240)
    // opts.afterTurn:   function called once after all ticks fire
    //                   (e.g., to print "enemy down" if it died)
    function buildTurn(playerPlan, enemy, runState, opts) {
        opts = opts || {};
        var tickDelay = opts.tickDelayMs || 420;

        var enemyPlan = enemy && !window.Crawler.Enemies.isDead(enemy)
            ? planEnemy(enemy, runState)
            : null;

        var span = Math.max(
            playerPlan ? playerPlan.ticks : 0,
            enemyPlan  ? enemyPlan.ticks  : 0
        );
        if (span === 0) span = 1; // always at least one tick beat

        // Per-turn cancellation flags. Closures share these.
        var turn = {
            playerCancelled: false,
            enemyCancelled:  false
        };
        // Per-tick parts cache (built in apply, read in line)
        var partsByIdx = {};

        var events = [];
        for (var t = 0; t < span; t++) {
            (function (tickIdx) {
                events.push({
                    delay: tickDelay,
                    apply: function () {
                        runState.tick += 1;
                        // Energy decay during tick playback (consistent
                        // with Phase 1 behavior; rest exempts itself).
                        runState.player.energy = Math.max(0, runState.player.energy - 1);

                        var parts = [];

                        // ----- PLAYER STEP -----
                        if (playerPlan && tickIdx < playerPlan.ticks && !turn.playerCancelled) {
                            var pStep = playerPlan.steps[tickIdx];
                            var pTag  = pStep.label ? ('YOU · ' + pStep.label) : '';

                            // Player step's own apply (e.g., posture switch
                            // mutation, room change for move-out)
                            if (typeof pStep.apply === 'function') {
                                try { pStep.apply(); } catch (e) { console.error(e); }
                            }

                            if (pStep.damage && pStep.damage.to === 'enemy' && enemy && enemy.hp > 0) {
                                var dmg = pStep.damage.amount;
                                enemy.hp = Math.max(0, enemy.hp - dmg);
                                pTag += '  (' + dmg + ' dmg → ' + enemy.shortLabel +
                                        ' [' + enemy.hp + '/' + enemy.maxHp + '])';
                                // Interrupt enemy close attack on windup
                                if (enemyPlan && enemyPlan.posture === 'close' &&
                                    tickIdx < enemyPlan.damageTickIdx) {
                                    turn.enemyCancelled = true;
                                    pTag += ' interrupted';
                                }
                                // If enemy died, cancel its remaining ticks
                                if (enemy.hp <= 0) {
                                    turn.enemyCancelled = true;
                                }
                            }
                            if (pTag) parts.push(pTag);
                        }

                        // ----- ENEMY STEP -----
                        if (enemyPlan && tickIdx < enemyPlan.ticks &&
                            !turn.enemyCancelled && enemy && enemy.hp > 0) {
                            var eStep = enemyPlan.steps[tickIdx];
                            var eTag = eStep.label ? (enemy.shortLabel.toUpperCase() + ' · ' + eStep.label) : '';

                            if (typeof eStep.apply === 'function') {
                                try { eStep.apply(); } catch (e) { console.error(e); }
                            }

                            if (eStep.damage && eStep.damage.to === 'player') {
                                var edmg = eStep.damage.amount;
                                // Pass 3.26: gear damageReduction applies
                                // to incoming hits (floor 0, never negative).
                                var gear = runState.player.gear;
                                if (gear && gear.damageReduction) {
                                    edmg = Math.max(0, edmg - gear.damageReduction);
                                }
                                runState.player.hp = Math.max(0, runState.player.hp - edmg);
                                eTag += '  (' + edmg + ' dmg → you [' + runState.player.hp + '/' + runState.player.maxHp + '])';
                                // Pass 3.24: visual feedback on hit.
                                if (window.Crawler.Visuals) {
                                    var ctx = (window.Crawler._visualCtx) || null;
                                    if (ctx) window.Crawler.Visuals.show('damaged', ctx);
                                }
                                // Interrupt player close attack on windup
                                if (playerPlan && playerPlan.type === 'attack' &&
                                    playerPlan.posture === 'close' &&
                                    tickIdx < playerPlan.damageTickIdx) {
                                    turn.playerCancelled = true;
                                    eTag += ' your strike cancels';
                                }
                            }
                            if (eTag) parts.push(eTag);
                        }

                        partsByIdx[tickIdx] = parts;
                    },
                    line: function () {
                        var parts = partsByIdx[tickIdx] || [];
                        // No activity this tick — emit nothing (scheduler
                        // skips null lines). Time still passed, energy
                        // still decayed; this just keeps the screen clean
                        // when one party is exhausted and the other can't
                        // act (e.g., post-kill recover ticks).
                        if (parts.length === 0) return null;
                        // tickLine() is owned by crawler.js; we rebuild
                        // the same shape here to stay self-contained.
                        var tickStr = String(runState.tick).padStart(3, '0');
                        return '  [t' + tickStr + ']  ' + parts.join('   ·   ');
                    }
                });
            })(t);
        }

        // Trailing event: post-turn announcement (enemy died, etc.)
        // Returns null when nothing to say so the scheduler skips
        // the render — the next static frame's separator handles
        // visual breathing room.
        events.push({
            delay: 480,
            apply: function () {},
            line: function () {
                if (enemy && enemy.hp <= 0) {
                    return '  ' + window.Crawler.Narrate.say('system.enemy_dead', {
                        label: enemy.shortLabel
                    });
                }
                return null;
            },
            lineCls: 'ok'
        });

        // afterTurn hook for caller-driven follow-ups (e.g., Brox
        // low-HP warning when player dropped below 30%).
        if (typeof opts.afterTurn === 'function') {
            events.push({
                delay: 0,
                apply: function () {
                    try { opts.afterTurn(); } catch (e) { console.error(e); }
                },
                line: ''
            });
        }

        return events;
    }

    // ============== EXPORTS ==============
    window.Crawler = window.Crawler || {};
    window.Crawler.Combat = {
        // plan builders
        planPlayerAttack:  planPlayerAttack,
        planPlayerPosture: planPlayerPosture,
        planPlayerScan:    planPlayerScan,
        planPlayerSimple:  planPlayerSimple,
        // turn assembly
        buildTurn:         buildTurn
    };
})();
