/* ============================================================
 * SHRED CRAWLER · crawler.js · Phase 0
 * ============================================================
 * Main module. Mode state machine + run-setup menu screen +
 * input dispatch interface for the host terminal.
 *
 * Phase 0 ships only the run-setup menu. "Begin Run" builds a
 * fresh run state object end-to-end (proving the architecture
 * works) and then prints a Phase 0 stub message before returning
 * the terminal to shell mode. Rooms, combat, items, doors,
 * enemies arrive in later phases.
 *
 * INTEGRATION CONTRACT (with the host terminal in underground.html):
 *
 *   1. The host calls Crawler.start(ctx) when the user types `crawl`.
 *      Crawler takes over input handling at that point.
 *
 *   2. The host's runLine() must check Crawler.isActive() before
 *      its normal command dispatch. If active, it routes input via
 *      Crawler.handleInput(line, ctx) instead.
 *
 *   3. ctx is the terminal output helper bag (out, dim, err, ok,
 *      heading, ascii, clear, outRaw, session) — same shape used
 *      by the existing COMMANDS handlers.
 *
 *   4. When Crawler exits a screen (cancel, or post-run for the
 *      Phase 0 stub), it sets mode to 'inactive' and the host
 *      resumes normal command dispatch on the next input.
 *
 * Depends on:
 *   - window.Crawler.Codes
 *   - window.Crawler.State
 *   - window.Crawler.Narrate
 * ============================================================ */
(function () {
    'use strict';

    // ============== STATE MACHINE ==============
    //
    // mode lifecycle:
    //   inactive → menu → (cancel) → inactive
    //                  → (begin)  → static → tick → static → ... → dead → inactive
    //
    // Phase 0 implements: inactive ↔ menu, and the stubbed "begin"
    // path that builds a runState then returns to inactive.
    var mode = 'inactive';
    var termCtx = null;     // last-known terminal output helpers
    var runState = null;    // built by beginRun()
    var menu = null;        // form state for the menu screen

    function isActive() { return mode !== 'inactive'; }
    function getMode() { return mode; }

    // ============== TERMINAL HELPERS (3-pane routing) ==============
    //
    // Phase 3.22 ships the 3-pane layout (main left, visuals top-
    // right, history bottom-right). Output routing rules:
    //
    //   "live" events (action results, tick lines, brox lines, errors,
    //    brief, death) → main pane AND history pane
    //   "static frame" content (status, options, room header) →
    //    main pane only (refreshed clear+redraw per turn)
    //   "visual" content (ASCII frame, doors detail, enemy block) →
    //    visuals pane only (refreshed per turn)
    //
    // The default out/dim/err/ok/heading helpers below are LIVE —
    // they fan to main + history. mainOnly* helpers go to main only
    // (use these for static frame content). visual* helpers go to
    // the visuals pane only.
    //
    // If termCtx doesn't have visual / history (host hasn't been
    // upgraded), the helpers degrade gracefully to main-only.

    // Live fan-out: main pane always; history pane only during an
    // actual run (mode in {static, tick, dead}). Menu output stays
    // out of history because the menu redraws on every input and
    // would otherwise dump 30+ lines per keystroke into the log.
    function shouldFanToHistory() {
        return mode === 'static' || mode === 'tick' || mode === 'dead';
    }
    function out(text, cls) {
        if (!termCtx) return;
        termCtx.out(text, cls);
        if (termCtx.history && shouldFanToHistory()) termCtx.history.out(text, cls);
    }
    function dim(text)     { out(text, 'dim'); }
    function err(text)     { out(text, 'err'); }
    function ok(text)      { out(text, 'ok'); }
    function heading(text) { out(text, 'heading'); }
    function blank()       { out(''); }
    function clear()       { if (termCtx) termCtx.clear(); }

    // Main-only helpers — use for static frame content (status,
    // options, room header) that should NOT clog the history pane
    // because it's redrawn fresh each turn.
    function mainOut(text, cls)  { if (termCtx) termCtx.out(text, cls); }
    function mainDim(text)       { mainOut(text, 'dim'); }
    function mainErr(text)       { mainOut(text, 'err'); }
    function mainHeading(text)   { mainOut(text, 'heading'); }

    // Visuals-pane helpers — used for the ASCII room frame and the
    // enemy block. Refreshed per turn (clear before render).
    function visualOut(text, cls) {
        if (termCtx && termCtx.visual) termCtx.visual.out(text, cls);
    }
    function visualClear() {
        if (termCtx && termCtx.visual) termCtx.visual.clear();
    }
    var visualCtx = {
        // Built lazily when termCtx is set; updated in startCrawl.
        out:     function (t, c) { visualOut(t, c); },
        dim:     function (t)    { visualOut(t, 'dim'); },
        err:     function (t)    { visualOut(t, 'err'); },
        ok:      function (t)    { visualOut(t, 'ok'); },
        heading: function (t)    { visualOut(t, 'heading'); },
        ascii:   function (t)    { visualOut(t, 'ascii'); },
        clear:   function ()     { visualClear(); }
    };

    // Inventory-pane helpers (mid-right · refreshed per turn).
    function inventoryOut(text, cls) {
        if (termCtx && termCtx.inventory) termCtx.inventory.out(text, cls);
    }
    function inventoryClear() {
        if (termCtx && termCtx.inventory) termCtx.inventory.clear();
    }

    // History-pane helpers — used for the per-turn separator. Most
    // history content arrives via the live out() fan-out above, but
    // turn boundaries get an explicit marker.
    function histOut(text, cls) {
        if (termCtx && termCtx.history) termCtx.history.out(text, cls);
    }
    function histDim(text) { histOut(text, 'dim'); }

    // tickCtx — passed to Scheduler.play in place of termCtx so each
    // tick line fans to main pane AND history pane. Without this the
    // scheduler would only hit the main pane and the history would
    // miss every action's per-tick narration. Built lazily so it
    // always wraps the latest termCtx.
    function buildTickCtx() {
        return {
            out: function (text, cls) {
                if (termCtx && termCtx.out) termCtx.out(text, cls);
                if (termCtx && termCtx.history) termCtx.history.out(text, cls);
            }
        };
    }

    // ============== PUBLIC ENTRY ==============

    // Crawler.start(ctx) — invoked by the host terminal's `crawl`
    // command. Takes over input. Hydrates the menu form from session
    // state (codes + character pick may persist across runs in a
    // single browser session per spec v0.3 §9).
    function startCrawl(ctx) {
        termCtx = ctx;
        // Expose the visual ctx so cross-module code (combat.js) can
        // push visual scenes on hit / outcome events.
        window.Crawler._visualCtx = visualCtx;
        // Switch the host terminal into 3-pane crawler layout
        // (visuals top-right + history bottom-right reveal). Safe
        // no-op on hosts that don't implement crawlerOn (graceful
        // degradation to single-pane).
        if (termCtx.crawlerOn) termCtx.crawlerOn();
        mode = 'menu';
        menu = {
            character: window.Crawler.State.loadCharacter(),
            codes:     window.Crawler.State.loadCodes(),
            firstRender: true
        };
        renderMenu();
    }
    // returnToShell — single exit point that hides the crawler panes
    // and resets mode. Used by clean exit, cancel, and post-death.
    function returnToShell() {
        mode = 'inactive';
        if (termCtx && termCtx.crawlerOff) termCtx.crawlerOff();
    }

    // Crawler.handleInput(line, ctx) — invoked by the host terminal's
    // runLine() when the crawler is active. Dispatches based on the
    // current mode.
    function handleInput(line, ctx) {
        termCtx = ctx;
        if (mode === 'menu')      { handleMenuInput(line);     return; }
        if (mode === 'static')    { handleStaticInput(line);   return; }
        if (mode === 'container') { handleContainerInput(line); return; }
        if (mode === 'resyc')     { handleResycInput(line);    return; }
        if (mode === 'tick')   {
            // Tick playback in progress — input is locked at the
            // input-element level too (see enterTickMode). This is
            // the silent fallback for any input that slips through.
            return;
        }
        if (mode === 'dead') {
            // Dead mode auto-clears on the next input — gives the
            // player a beat to read the death lines before any new
            // command runs.
            returnToShell();
            return;
        }
    }

    // ============== MENU RENDER ==============

    function renderMenu() {
        clear();
        // Show the menu placeholder scene in the visuals pane so it
        // isn't blank during run setup. The first renderStatic after
        // beginRun will swap to a real state scene.
        if (window.Crawler.Visuals) {
            window.Crawler.Visuals.show('menu', visualCtx);
        }

        // Banner
        dim('═══════════════════════════════════════════════════════════');
        heading('  CRAWL · run setup');
        dim('═══════════════════════════════════════════════════════════');
        blank();

        // Brox intro line — only on first render of this menu open
        if (menu.firstRender) {
            ok('  brox: ' + window.Crawler.Narrate.say('brox.intro'));
            blank();
            menu.firstRender = false;
        }

        // Operative pick
        heading('  operative');
        renderCharacterRow('drakey', '1');
        renderCharacterRow('torred', '2');
        blank();

        // Code slots
        heading('  code slots');
        renderCodeRow('schema',    's');
        renderCodeRow('archive',   'a');
        renderCodeRow('esoterica', 'e');
        renderCodeRow('pack',      'p');
        blank();

        // INT preview — total + per-category breakdown (the Currept
        // detection surface from spec v0.3 §6).
        var intResult = window.Crawler.Codes.computeInt(menu.codes);
        ok('  combined INT  : ' + intResult.total);
        var pc = intResult.perCategory;
        dim('  contribution  : sch ' + pc.schema +
                          '   arc ' + pc.archive +
                          '   eso ' + pc.esoterica +
                          '   pck ' + pc.pack);
        blank();

        // Actions
        heading('  actions');
        out('  [1]/[2]      pick operative');
        out('  s <code>     set schema slot         (s alone clears it)');
        out('  a <code>     set archive slot');
        out('  e <code>     set esoterica slot');
        out('  p <code>     set pack slot');
        out('  begin  / b   start the run');
        out('  cancel / x   return to shell');
        blank();
    }

    function renderCharacterRow(key, num) {
        var tpl = window.Crawler.State.CHARACTERS[key];
        var selected = menu.character === key;
        var marker = selected ? '►' : ' ';
        var head = '  ' + marker + ' [' + num + '] ' +
                   tpl.label.toUpperCase() + ' · ' + tpl.role;
        out(head, selected ? 'ok' : '');
        var s = tpl.stats;
        dim('         hp ' + s.hp +
            '   energy ' + s.energy +
            '   autonode ' + s.autonode +
            '   range ' + s.range +
            '   melee ' + s.melee);
    }

    function renderCodeRow(key, letter) {
        var code = menu.codes[key];
        var label = ('  [' + letter + '] ' + key).padEnd(18);
        if (!code) {
            out(label + ' : (empty)', 'dim');
            return;
        }
        var parsed = window.Crawler.Codes.parse(code);
        if (!parsed || parsed.category !== key) {
            // Code is in the slot but no longer valid for that slot
            // (rare: only happens if the storage shape changed).
            err(label + ' : ' + code + '  ⚠ invalid for this slot');
            return;
        }
        // Player sees: code + tier + INT contribution.
        // Player does NOT see isCurrept — that's the deduction game.
        var tag = '  tier ' + parsed.tier + '  +' + parsed.intContribution + ' INT';
        out(label + ' : ' + code + tag);
    }

    // ============== MENU INPUT ==============

    function handleMenuInput(line) {
        var trimmed = String(line || '').trim();
        if (!trimmed) { renderMenu(); return; }
        var lower = trimmed.toLowerCase();

        // Operative pick
        if (trimmed === '1' || lower === 'drakey') {
            menu.character = 'drakey';
            window.Crawler.State.saveCharacter('drakey');
            ok('  brox: ' + window.Crawler.Narrate.say('brox.pick.drakey'));
            blank();
            renderMenu();
            return;
        }
        if (trimmed === '2' || lower === 'torred') {
            menu.character = 'torred';
            window.Crawler.State.saveCharacter('torred');
            ok('  brox: ' + window.Crawler.Narrate.say('brox.pick.torred'));
            blank();
            renderMenu();
            return;
        }

        // Code slot commands: s/a/e/p [<code>]
        var slotMatch = trimmed.match(/^([saep])(?:\s+(.+))?$/i);
        if (slotMatch) {
            var letterMap = { s: 'schema', a: 'archive', e: 'esoterica', p: 'pack' };
            var slot = letterMap[slotMatch[1].toLowerCase()];
            var codeArg = slotMatch[2];

            if (!codeArg) {
                // Clear slot
                menu.codes[slot] = null;
                window.Crawler.State.saveCodes(menu.codes);
                dim('  brox: ' + window.Crawler.Narrate.say('brox.code_cleared'));
                blank();
                renderMenu();
                return;
            }

            var parsed = window.Crawler.Codes.parse(codeArg);
            if (!parsed) {
                err('  brox: ' + window.Crawler.Narrate.say('brox.code_invalid'));
                blank();
                return;
            }
            if (parsed.category !== slot) {
                err('  brox: ' + window.Crawler.Narrate.say('brox.code_wrong_slot', {
                    actual: parsed.category, slot: slot
                }));
                blank();
                return;
            }

            menu.codes[slot] = parsed.code;
            window.Crawler.State.saveCodes(menu.codes);
            dim('  brox: ' + window.Crawler.Narrate.say('brox.code_set'));
            blank();
            renderMenu();
            return;
        }

        // Begin
        if (lower === 'b' || lower === 'begin') {
            if (!menu.character) {
                err('  pick an operative first ([1] drakey or [2] torred).');
                return;
            }
            beginRun();
            return;
        }

        // Cancel
        if (lower === 'x' || lower === 'cancel' || lower === 'exit') {
            cancelMenu();
            return;
        }

        // Help fall-through
        err('  unknown menu command: ' + trimmed);
        dim('  see the action list above. cancel returns to the shell.');
    }

    function cancelMenu() {
        dim('  ' + window.Crawler.Narrate.say('system.crawl_cancel'));
        blank();
        returnToShell();
    }

    // ============== BEGIN RUN (Phase 1+2) ==============
    //
    // Builds run state, drops player into starting room, runs the
    // brief in tick mode, then enters the static/tick loop. Player
    // is in a single-faction compound (placeholder — Phase 3 will
    // assign a real faction from the §3 roster).
    function beginRun() {
        runState = window.Crawler.State.newRunState(menu.character, menu.codes);
        runState.faction = 'breaker';   // placeholder · Phase 5

        // Phase 3: generate the grid procedurally. Size 5×5 for v0;
        // Phase 5 will scale by Archive tier + INT and seed by codes
        // for sharable runs.
        runState.grid = window.Crawler.Grid.generate({
            size:  5,
            spawn: { x: 0, y: 0 }
        });
        runState.currentRoomKey = window.Crawler.Rooms.startingRoomKey(runState);
        // Initialize starting room state (won't spawn enemy at spawn
        // per rooms.js seeding rule)
        window.Crawler.State.getOrInitRoomState(runState, runState.currentRoomKey);

        clear();
        dim('═══════════════════════════════════════════════════════════');
        heading('  RUN BEGINS · operative: ' +
                window.Crawler.State.CHARACTERS[runState.character].label);
        dim('═══════════════════════════════════════════════════════════');
        blank();

        enterTickMode();

        // Brief plays out in the tick stream so the player can't
        // skip-spam through it. Then static/tick loop begins.
        var briefLine = window.Crawler.Narrate.say('brox.brief', { faction: runState.faction });
        var events = [
            { delay: 500, line: '  brox: ' + briefLine, lineCls: 'ok' },
            { delay: 900, line: '' }
        ];
        window.Crawler.Scheduler.play(events, buildTickCtx(), function () {
            mode = 'static';
            unlockInput();
            renderStatic();
        });
    }

    // ============== INPUT LOCK ==============
    //
    // During tick playback we lock the terminal input element so
    // the player can't queue commands mid-action. The handleInput
    // tick-mode branch is a silent fallback for anything that gets
    // through (e.g., focus race conditions on slow devices).
    function lockInput(placeholder) {
        var inp = document.getElementById('termIn');
        if (inp) {
            inp.disabled = true;
            inp.placeholder = placeholder || '...';
        }
    }
    function unlockInput() {
        var inp = document.getElementById('termIn');
        if (inp) {
            inp.disabled = false;
            inp.placeholder = '';
            inp.focus();
        }
    }
    function enterTickMode() {
        mode = 'tick';
        lockInput('...');
    }

    // ============== STATIC RENDER ==============
    //
    // Full clear+redraw on every static entry. Players can press
    // Enter on an empty line to force a re-render at any time.
    // Scrollback is preserved by the host terminal between renders
    // — the clear() only wipes the viewport, prior session output
    // is still in browser scroll history if the host preserves it.
    // (The current host clears innerHTML; that's fine for Phase 1.)
    // Lazy room-state accessor + live-enemy accessor.
    // getCurrentEnemy() returns null if room has no enemy
    // OR the enemy is dead. Combat code keys off this.
    function getCurrentRoomState() {
        return window.Crawler.State.getOrInitRoomState(runState, runState.currentRoomKey);
    }
    function getCurrentRoom() {
        return window.Crawler.Rooms.getRoom(runState, runState.currentRoomKey);
    }
    function getCurrentEnemy() {
        var rs = getCurrentRoomState();
        return (rs.enemy && rs.enemy.hp > 0) ? rs.enemy : null;
    }
    // Tool inventory helpers. Used by renderOptions and doDoor.
    function findTool(toolKey) {
        return runState.player.inventory.findIndex(function (i) {
            return i.type === 'tool' && i.key === toolKey;
        });
    }
    function hasTool(toolKey) { return findTool(toolKey) !== -1; }

    // renderStatic — Pass 3.24 layout (3-pane, refresh-per-turn):
    //
    //   MAIN PANE (clear + redraw each turn):
    //     - room header + blurb + ASCII frame + doors detail
    //     - enemy block (blind / aware / dead) — player always sees
    //       the enemy in the current room (no fog of war on entry)
    //     - status (hp / energy / autonode / posture / int / tick)
    //     - options (with literal command labels + container list)
    //
    //   VISUALS PANE (top-right · wordless ASCII scene)
    //   INVENTORY PANE (mid-right · refreshed per turn)
    //   HISTORY PANE (bottom-right · append-only)
    function renderStatic() {
        clear();          // wipe main pane
        inventoryClear(); // refresh inventory pane each turn

        var room = getCurrentRoom();
        var rs   = getCurrentRoomState();

        // ─── HISTORY: per-turn marker (skip dup on blank-enter refresh) ───
        if (runState && termCtx && termCtx.history) {
            var stamp = runState.tick + '|' + (room ? room.key : '?');
            if (stamp !== runState._lastHistStamp) {
                histDim('  ── tick ' + runState.tick + ' · room ' +
                        (room ? room.label + ' · ' + room.key : '?') + ' ──');
                runState._lastHistStamp = stamp;
            }
        }

        // ─── MAIN: room frame · enemy block · status · options ───
        window.Crawler.Rooms.renderRoom(room, mainOnlyCtx, runState.faction, runState);
        renderEnemyBlock();
        renderStatus();
        renderOptions(room);

        // ─── INVENTORY: refreshed every turn ───
        renderInventory();

        // ─── VISUALS: state-driven scene (overridden by actions) ───
        if (window.Crawler.Visuals) {
            var sceneKey = window.Crawler.Visuals.pickStateScene(runState, rs);
            window.Crawler.Visuals.show(sceneKey, visualCtx);
        }
    }

    // renderEnemyBlock — main pane. Pass 3.24 awareness model:
    //   - dead        "[label · still on the floor]"
    //   - aware       "[label · posture · hp/maxHp]  ← they have you"
    //   - blind       "[label · posture · hp/maxHp]  ← unaware"
    //
    // Player always sees the enemy on entry; the blindness here is
    // the ENEMY's, not the player's. Awareness is set on room entry
    // (doMove) and may flip mid-turn via per-action alert rolls.
    function renderEnemyBlock() {
        var rs = getCurrentRoomState();
        var enemy = rs.enemy;
        if (!enemy) return;

        if (enemy.hp <= 0) {
            mainDim('  ' + enemy.label + ' · still on the floor.');
            mainOut('');
            return;
        }
        var stateTag = enemy.awareness === 'aware'
            ? '  ← they have you'
            : '  ← unaware of you';
        var cls = enemy.awareness === 'aware' ? 'err' : 'ok';
        mainOut('  [' + enemy.label + ' · ' + enemy.posture +
            ' · ' + enemy.hp + '/' + enemy.maxHp + ' hp]' + stateTag, cls);
        if (enemy.blurb) mainDim('  ' + enemy.blurb);
        mainOut('');
    }

    // renderInventory — Pass 3.26 layout. Three equipment slots at
    // the top (ranged · close · gear), then a numbered inventory list
    // the player can reference with `equip <N>` / `unequip <slot>`.
    //
    // Numbering matches getInventoryIndexed() — that helper is the
    // single source of truth for inventory indexing.
    function renderInventory() {
        if (!runState || !termCtx || !termCtx.inventory) return;
        var p = runState.player;
        var S = window.Crawler.State;
        var eR = S.effectiveRange ? S.effectiveRange(p) : (p.range || 0);
        var eM = S.effectiveMelee ? S.effectiveMelee(p) : (p.melee || 0);
        var eRT = S.effectiveReactionTime ? S.effectiveReactionTime(p) : (p.reactionTime || 4);

        inventoryOut('  posture · ' + p.posture +
            '   range ' + eR +
            '   melee ' + eM, 'dim');
        // Pass 3.27: surface reaction time + autonode pool so the player
        // sees the gear-economy state at a glance. Reaction time shows
        // base→effective when gear is reducing it AND can afford it.
        var rtLine = '  react ' + eRT;
        if (eRT !== (p.reactionTime || 4)) {
            rtLine += '  (base ' + (p.reactionTime || 4) + ' · gear active)';
        }
        rtLine += '   autonode ' + (p.autonode || 0) + '/' + (p.maxAutonode || 40);
        inventoryOut(rtLine, 'dim');
        inventoryOut('');

        // ─── Equipment slots ───
        inventoryOut('  equipped', 'heading');
        inventoryOut(slotLine('ranged', p.weaponRanged));
        inventoryOut(slotLine('close',  p.weaponClose));
        inventoryOut(slotLine('gear',   p.gear));
        inventoryOut('');

        // ─── Inventory (numbered) ───
        var inv = p.inventory || [];
        inventoryOut('  inventory', 'heading');
        if (inv.length === 0) {
            inventoryOut('   — empty', 'dim');
        } else {
            inv.forEach(function (item, i) {
                var num = ('[' + (i + 1) + ']').padEnd(5);
                inventoryOut('   ' + num + ' ' + invLabel(item),
                    item.type === 'ambient' ? 'dim' : '');
            });
        }
        inventoryOut('');

        // ─── Hint ───
        inventoryOut('  equip <N>     · unequip ranged|close|gear', 'dim');
    }

    function slotLine(slotName, item) {
        var name = ('   ' + slotName).padEnd(11);
        if (!item) return name + '— empty';
        var bonus = '';
        if (item.bonus) bonus = '  +' + item.bonus + ' ' + slotName;
        else if (item.damageReduction) bonus = '  -' + item.damageReduction + ' dmg';
        else if (item.intBonus) bonus = '  +' + item.intBonus + ' int';
        return name + item.label + bonus;
    }

    function invLabel(item) {
        var s = item.label;
        if (item.bonus) s += ' (+' + item.bonus + ' ' + (item.slot || item.subtype) + ')';
        else if (item.damageReduction) s += ' (-' + item.damageReduction + ' dmg)';
        else if (item.intBonus) s += ' (+' + item.intBonus + ' int)';
        else if (item.type === 'consumable') {
            var bits = [];
            if (item.hp)     bits.push((item.hp > 0 ? '+' : '') + item.hp + ' hp');
            if (item.energy) bits.push((item.energy > 0 ? '+' : '') + item.energy + ' energy');
            if (bits.length) s += ' (' + bits.join(', ') + ')';
        }
        return s;
    }

    // mainOnlyCtx — passed to rooms.js renderRoom so its heading /
    // dim / out / err calls all land on the main pane only (no
    // history fan-out, no visuals pane). Built once; safe to reuse.
    var mainOnlyCtx = {
        out:     function (t, c) { mainOut(t, c); },
        dim:     function (t)    { mainOut(t, 'dim'); },
        err:     function (t)    { mainOut(t, 'err'); },
        ok:      function (t)    { mainOut(t, 'ok'); },
        heading: function (t)    { mainOut(t, 'heading'); },
        ascii:   function (t)    { mainOut(t, 'ascii'); },
        clear:   function ()     { /* renderStatic owns the clear */ }
    };

    // setActionVisual(sceneKey) — call from action handlers BEFORE
    // playAndReturn to swap the visuals pane for the duration of
    // the action. The next renderStatic re-picks a state scene
    // automatically, so no manual revert is needed.
    function setActionVisual(sceneKey) {
        if (!window.Crawler.Visuals) return;
        window.Crawler.Visuals.show(sceneKey, visualCtx);
    }

    function renderStatus() {
        var p = runState.player;
        var charLabel = window.Crawler.State.CHARACTERS[runState.character].label;
        mainOut('  ' + charLabel.toLowerCase() +
            '   hp '       + p.hp       + '/' + p.maxHp +
            '   energy '   + p.energy   + '/' + p.maxEnergy +
            '   autonode ' + p.autonode + '/' + p.maxAutonode);
        mainDim('  tick ' + runState.tick +
            '   posture ' + p.posture +
            '   int ' + p.int);
        mainOut('');
    }

    // Static frame content (options) — main pane only via mainOut.
    // The history pane never sees the full options dump (that would
    // be 12+ lines duplicated every turn). The history captures only
    // what the player DID via the live out() fan-out from action handlers.
    //
    // Pass 3.25 redo: terminal-busy aesthetic. Each section gets its
    // own sub-heading so the player can see at a glance what's
    // available, and every command is shown with its literal syntax.
    function renderOptions(room) {
        var enemy   = getCurrentEnemy();
        var isCombat = !!enemy;
        var awareEnemy = enemy && enemy.awareness === 'aware';

        // ─── COMBAT OPTIONS (only with an enemy in the room) ───
        if (isCombat) {
            mainHeading('  combat');
            var S = window.Crawler.State;
            var atkDmg = runState.player.posture === 'ranged'
                ? (S.effectiveRange ? S.effectiveRange(runState.player) : runState.player.range)
                : (S.effectiveMelee ? S.effectiveMelee(runState.player) : runState.player.melee);
            var atkTicks = runState.player.posture === 'ranged' ? 1 : 4;
            var atkLabel = runState.player.posture === 'ranged' ? 'shoot' : 'swing';
            mainOut('   attack            ' + atkLabel + ' (' + atkTicks + ' tick · ' +
                runState.player.posture + ' · ' + atkDmg + ' dmg)');
            var newPos = runState.player.posture === 'ranged' ? 'close' : 'ranged';
            mainOut('   posture           switch to ' + newPos + ' (1 tick · vulnerable)');
            mainOut('');
        }

        // ─── MOVEMENT + SCAN ─── one row per direction, two columns:
        // left  = move/lock command, right = scan command (with state)
        mainHeading('  movement · scan');
        renderMoveScanRows(room, isCombat);
        mainOut('');

        // ─── CONTAINERS ─── always render the section header so the
        // player knows whether the room has loot to investigate.
        // Aware enemies block container interaction (already covered
        // in the section text).
        renderContainerOptions(awareEnemy);

        // ─── BASIC ACTIONS ───
        mainHeading('  basics');
        if (isCombat) {
            mainOut('   wait              wait (1 tick · they act)');
        } else {
            mainOut('   wait              wait one tick');
            mainOut('   rest              rest 10 ticks · +25 energy · vulnerable');
        }
        var bandageCount = runState.player.inventory.filter(function (i) {
            return i.subtype === 'bandage';
        }).length;
        if (bandageCount > 0 && !isCombat) {
            mainOut('   bandage           use bandage (3 ticks · +14 hp)   ×' + bandageCount);
        }
        mainOut('   comms             ping brox');
        mainOut('   exit              end run');
        // Pass 3.26 hint: equip/unequip are always available; surfaced
        // here so the player learns the syntax without opening docs.
        mainOut('   equip <N>         equip inventory item · unequip <slot>', 'dim');
        mainOut('');
    }

    // renderContainerOptions(awareBlock) — always prints the heading;
    // body varies by container state. Adds a hint line when an aware
    // enemy is in the room (containers locked down) or when the room
    // has none at all (so the player learns where loot does exist).
    function renderContainerOptions(awareBlock) {
        var rs = getCurrentRoomState();
        var list = (rs && rs.containers) || [];
        mainHeading('  containers');
        if (awareBlock) {
            mainOut('   — locked down · clear the room first', 'dim');
            mainOut('');
            return;
        }
        if (list.length === 0) {
            mainOut('   — none in this compound', 'dim');
            mainOut('');
            return;
        }
        var any = false;
        list.forEach(function (c, idx) {
            // Hide containers that have been fully looted clean
            if (c.opened && c.contents.length === 0 && c.state !== 'frozen') return;
            var num = (idx + 1);
            var lbl = ('   con ' + num).padEnd(18);
            mainOut(lbl + c.label + '  [' +
                window.Crawler.Containers.statusLabel(c) + ']');
            any = true;
        });
        if (!any) mainOut('   — all looted', 'dim');
        mainOut('');
    }

    // renderMoveScanRows — Pass 3.26 layout. One row per non-wall
    // direction, two horizontal columns:
    //   left  = move/lock command + description
    //   right = scan command + last-peek state (always present)
    //
    //   "   n  move north (1 tick)              [scan n  scan north (unscanned)]"
    //   "   e  try mech lock w/ lockpick (86%)  [scan e  scan east  (clear)]"
    //   "   s  south locked · need prybar       [scan s  scan south (breaker)]"
    //
    // Right column always renders — the player can always peek through
    // a door regardless of its open/locked/frozen state. Walls drop
    // the entire row.
    function renderMoveScanRows(room, isCombat) {
        ['n', 's', 'e', 'w'].forEach(function (dir) {
            var d = room.doors[dir];
            if (!d || d.state === 'wall') return;
            var left  = buildMoveSegment(dir, d, isCombat);
            var right = buildScanSegment(dir);
            // Pad left to col 50; if it overflows, fall back to two-space gap.
            var COL = 50;
            var pad = (left.text.length >= COL)
                ? '  '
                : new Array(COL - left.text.length + 1).join(' ');
            mainOut(left.text + pad + right, left.cls || '');
        });
    }

    function buildMoveSegment(dir, d, isCombat) {
        var doors   = window.Crawler.Doors;
        var dirName = dirWord(dir);
        var cmd     = ('   ' + dir).padEnd(6);
        if (d.state === 'open') {
            // Pass 3.27: move cost reads from State.effectiveMoveTicks
            // so the player sees the exosuit-discounted cost when they
            // can afford it. (effectiveMoveTicks does NOT charge autonode
            // — it's a preview; the actual charge happens in doMove.)
            var S = window.Crawler.State;
            var mTicks = (S && S.effectiveMoveTicks) ? S.effectiveMoveTicks(runState.player) : 3;
            return {
                text: cmd + (isCombat
                    ? 'flee ' + dirName + ' (2 ticks · free hits)'
                    : 'move ' + dirName + ' (' + mTicks + ' ticks)')
            };
        }
        if (d.state === 'frozen') {
            return { text: cmd + dirName + ' frozen · gone', cls: 'dim' };
        }
        // locked
        var wantedTool = doors.TOOL_FOR_LOCK[d.lockType];
        var toolKey    = wantedTool === 'crypt key' ? 'cryptkey' : wantedTool;
        var have       = hasTool(toolKey);
        var pct        = Math.round(doors.computeSuccessChance(d, runState.player.int) * 100);
        if (have) {
            return {
                text: cmd + 'try ' + d.lockType + ' lock w/ ' + wantedTool + ' (' + pct + '%)'
            };
        }
        return {
            text: cmd + dirName + ' locked · need ' + wantedTool,
            cls:  'dim'
        };
    }

    // buildScanSegment(dir) → "[scan n  scan north (TAG)]"
    //
    // TAG values:
    //   unscanned     never peeked
    //   clear         peeked, no enemy
    //   <shortLabel>  peeked, enemy detected (e.g. "breaker")
    //   scan failed   peeked, no_signal (false negative possible)
    function buildScanSegment(dir) {
        var dirName = dirWord(dir);
        var tag = 'unscanned';
        var adjKey = adjacentRoomKey(dir);
        if (adjKey && runState.roomState && runState.roomState[adjKey]) {
            var st = runState.roomState[adjKey];
            if (st.peeked) {
                if (st.peekResult === 'enemy') {
                    tag = st.enemy ? st.enemy.shortLabel : 'enemy';
                } else if (st.peekResult === 'clear') {
                    tag = 'clear';
                } else {
                    tag = 'scan failed';
                }
            }
        }
        return '[scan ' + dir + '  scan ' + dirName + ' (' + tag + ')]';
    }

    // adjacentRoomKey(dir) — returns the room key for the room you
    // would step into through dir (regardless of door state). Returns
    // null if the adjacent cell is off-grid. Uses Grid.getNeighborKey
    // (the public API) so we don't depend on DIR_VEC export shape.
    function adjacentRoomKey(dir) {
        if (!runState || !runState.grid || !runState.currentRoomKey) return null;
        var Grid = window.Crawler.Grid;
        if (!Grid || typeof Grid.getNeighborKey !== 'function') return null;
        return Grid.getNeighborKey(runState.grid, runState.currentRoomKey, dir);
    }

    // ============== STATIC INPUT HANDLER ==============

    function handleStaticInput(line) {
        var trimmed = String(line || '').trim().toLowerCase();
        if (!trimmed) { renderStatic(); return; }
        var enemy = getCurrentEnemy();

        // ─── direction + optional tool ─── e.g. "n", "n prybar", "south crypt key"
        var dirMatch = trimmed.match(/^(n|s|e|w|north|south|east|west)(?:\s+(.+))?$/);
        if (dirMatch) {
            var raw = dirMatch[1];
            var dir = raw.charAt(0); // n/s/e/w
            var toolArg = (dirMatch[2] || '').trim();
            if (toolArg) return doDoor(dir, toolArg);
            return doMove(dir);
        }

        if (trimmed === 'wait')                       return doWait();

        // Combat-forbidden in occupied rooms (Phase 2 simplification:
        // rest and bandage require a clear room). Phase 2.5 may revisit.
        if (trimmed === 'rest') {
            if (enemy) {
                err('  cannot rest. ' + enemy.shortLabel + ' is on you. clear the room first.');
                return;
            }
            return doRest();
        }
        if (trimmed === 'bandage' || trimmed === 'use bandage') {
            if (enemy) {
                err('  cannot bandage. ' + enemy.shortLabel + ' is on you. clear the room first.');
                return;
            }
            return doBandage();
        }

        if (trimmed === 'comms' || trimmed === 'c')   return doComms();
        if (trimmed === 'exit' ||
            trimmed === 'quit' || trimmed === 'q')    return doExit();

        // ─── Phase 2 combat actions ───
        if (trimmed === 'attack' || trimmed === 'a')  return doAttack();
        if (trimmed === 'posture' || trimmed === 'p') return doPosture();

        // ─── Pass 3.24: scan an adjacent room ───
        // `scan` alone gives the usage hint. `scan n` / `scan north`
        // peeks the room to that direction. Routes through doScan(dir).
        var scanMatch = trimmed.match(/^scan(?:\s+(.+))?$/);
        if (scanMatch) {
            var sd = (scanMatch[1] || '').trim();
            if (!sd) {
                err('  ' + window.Crawler.Narrate.say('system.scan_no_dir'));
                return;
            }
            var sdir = sd.charAt(0);
            if (['n', 's', 'e', 'w'].indexOf(sdir) === -1) {
                err('  scan needs a direction: n / s / e / w.');
                return;
            }
            return doScan(sdir);
        }

        // ─── Pass 3.24: containers ── `con N` to open / re-look ─
        var conMatch = trimmed.match(/^con(?:\s+(\d+))?$/);
        if (conMatch) {
            if (!conMatch[1]) {
                err('  ' + window.Crawler.Narrate.say('system.con_no_idx'));
                return;
            }
            return doContainer(parseInt(conMatch[1], 10));
        }

        // ─── Pass 3.26: equip / unequip ───
        var equipMatch = trimmed.match(/^equip(?:\s+(\d+))?$/);
        if (equipMatch) {
            if (!equipMatch[1]) {
                err('  equip <N> · the number from the inventory list.');
                return;
            }
            return doEquip(parseInt(equipMatch[1], 10));
        }
        var unequipMatch = trimmed.match(/^unequip(?:\s+(ranged|close|gear))?$/);
        if (unequipMatch) {
            if (!unequipMatch[1]) {
                err('  unequip <slot> · slot is one of: ranged, close, gear.');
                return;
            }
            return doUnequip(unequipMatch[1]);
        }

        err('  not an option: ' + trimmed);
        dim('  see the option list above. press enter to refresh.');
    }

    // ============== EQUIPMENT ACTIONS (Pass 3.26) ==============

    // doEquip(idx) — pull inventory item N, equip into its slot.
    // If a previous item is in that slot, it goes back to inventory
    // (no destruction — players can swap freely). Non-weapon items
    // surface a clear error.
    function doEquip(idx) {
        var p = runState.player;
        var inv = p.inventory || [];
        if (idx < 1 || idx > inv.length) {
            err('  no item [' + idx + '] in inventory.');
            return;
        }
        var item = inv[idx - 1];
        if (item.type !== 'weapon') {
            err('  cannot equip ' + item.label + ' · only weapons / gear go into slots.');
            return;
        }
        var slot = item.slot;
        if (slot !== 'ranged' && slot !== 'close' && slot !== 'gear') {
            err('  ' + item.label + ' has no slot defined.');
            return;
        }
        var slotKey = slot === 'ranged' ? 'weaponRanged'
                    : slot === 'close'  ? 'weaponClose'
                    : 'gear';
        var prev = p[slotKey];
        // Remove from inventory FIRST (splice by exact index)
        inv.splice(idx - 1, 1);
        // Old slot occupant goes back to inventory
        if (prev) inv.push(prev);
        p[slotKey] = item;
        ok('  equipped ' + item.label + ' [' + slot + '].' +
            (prev ? ' returned ' + prev.label + ' to inventory.' : ''));
        // Refresh the static frame so the player sees the new slot tag.
        renderStatic();
    }

    // doUnequip(slot) — move equipped slot back to inventory.
    function doUnequip(slot) {
        var p = runState.player;
        var slotKey = slot === 'ranged' ? 'weaponRanged'
                    : slot === 'close'  ? 'weaponClose'
                    : 'gear';
        if (!p[slotKey]) {
            err('  ' + slot + ' slot is empty.');
            return;
        }
        var item = p[slotKey];
        p[slotKey] = null;
        p.inventory.push(item);
        ok('  unequipped ' + item.label + '. now in inventory.');
        renderStatic();
    }

    // ============== ACTION HELPERS ==============

    function dirWord(d) {
        return ({ n: 'north', s: 'south', e: 'east', w: 'west' })[d] || d;
    }
    function tickLine(text) {
        return '  [t' + String(runState.tick).padStart(3, '0') + ']  ' + text;
    }
    // Per-tick energy decay during tick playback. Static mode does
    // not drain. Rest action exempts itself from this (it'd undo
    // its own gain otherwise).
    function decay(ticks) {
        if (!ticks) return;
        runState.player.energy = Math.max(0, runState.player.energy - ticks);
    }

    // playAndReturn(events, opts)
    //
    // Wraps Scheduler.play with the standard post-playback pattern:
    //   1. Check death (HP <= 0) — if dead, runs the death sequence
    //      and never returns to static.
    //   2. Otherwise: blank line, unlock input, re-render static.
    //
    // opts.preReturn: function called before re-rendering (e.g.,
    //   to print a final summary line that shouldn't be in the
    //   tick stream).
    // opts.skipReturn: if true, do not re-render static (caller
    //   will handle mode transition itself — used by doExit).
    function playAndReturn(events, opts) {
        opts = opts || {};
        window.Crawler.Scheduler.play(events, buildTickCtx(), function () {
            if (checkDeath()) return;
            if (typeof opts.preReturn === 'function') {
                try { opts.preReturn(); } catch (e) { console.error(e); }
            }
            if (opts.skipReturn) return;
            mode = 'static';
            unlockInput();
            renderStatic();
        });
    }

    // ============== ACTIONS ==============

    function doMove(dir) {
        var attempt = window.Crawler.Rooms.moveDirection(runState, runState.currentRoomKey, dir);
        if (!attempt) {
            err('  ' + window.Crawler.Narrate.say('system.door_wall', { dir: dirWord(dir) }));
            return;
        }
        if (attempt.error === 'wall') {
            err('  ' + window.Crawler.Narrate.say('system.door_wall', { dir: dirWord(dir) }));
            return;
        }
        if (attempt.error === 'frozen') {
            err('  ' + window.Crawler.Narrate.say('system.door_frozen', { dir: dirWord(dir) }));
            return;
        }
        if (attempt.error === 'locked') {
            var doors = window.Crawler.Doors;
            var wantedTool = doors.TOOL_FOR_LOCK[attempt.door.lockType];
            var toolKey = wantedTool === 'crypt key' ? 'cryptkey' : wantedTool;
            // Pass 3.24: if the player has the matching tool, just use
            // it — don't make them retype the direction with the tool
            // name. Direction + having the tool is enough information
            // to attempt the lock. The `n <tool>` syntax still works
            // for explicit control, but bare `n` auto-picks now.
            if (hasTool(toolKey)) {
                doDoor(dir, wantedTool);
                return;
            }
            // No matching tool — surface the lock type so the player
            // knows what they need to find.
            err('  ' + window.Crawler.Narrate.say('system.door_locked_no_tool', {
                dir:  dirWord(dir),
                tool: wantedTool,
                lock: attempt.door.lockType
            }));
            return;
        }
        if (runState.player.energy <= 0) {
            err('  ' + window.Crawler.Narrate.say('system.no_energy'));
            return;
        }

        var enemy = getCurrentEnemy();
        var direction = dir;
        var target    = attempt.newKey;

        if (enemy) {
            // ─── escape under fire ─── 2-tick plan, enemy interleaves.
            // Pass 3.24: leaving the room always alerts a blind enemy
            // here (movement is loud), so they immediately enter the
            // exchange and get free hits as the player flees.
            enterTickMode();
            maybeAlert('move');
            var playerPlan = window.Crawler.Combat.planPlayerSimple(
                'move',
                'flee ' + dirWord(direction),
                [
                    { label: 'flee ' + dirWord(direction) + ' · doorway' },
                    {
                        label: 'into next room',
                        apply: function () {
                            runState.currentRoomKey = target;
                            if (runState.visited.indexOf(target) === -1) {
                                runState.visited.push(target);
                            }
                            var nextState = window.Crawler.State.getOrInitRoomState(runState, target);
                            nextState.visited = true;
                            setEntryAwareness(nextState);
                        }
                    }
                ]
            );
            var combatEvents = window.Crawler.Combat.buildTurn(playerPlan, enemy, runState);
            // If the destination room has an aware enemy, append
            // reaction-lag ticks just like the peaceful move path.
            var preCheckFlee = window.Crawler.State.getOrInitRoomState(runState, target);
            var willBeAwareFlee;
            if (!preCheckFlee.enemy || preCheckFlee.enemy.hp <= 0) {
                willBeAwareFlee = false;
            } else if (preCheckFlee.enemy.awareness === 'aware') {
                willBeAwareFlee = true;
            } else {
                willBeAwareFlee = !(preCheckFlee.peeked && preCheckFlee.peekResult === 'enemy');
            }
            if (willBeAwareFlee) appendReactionLag(combatEvents, preCheckFlee);

            setActionVisual('walking');
            playAndReturn(combatEvents);
            return;
        }

        // ─── peaceful move (Phase 3.27: 3-tick default; 2 w/ exosuit) ───
        setActionVisual('walking');
        enterTickMode();

        // Pass 3.27: room move cost. Default 3 ticks (was 1 in earlier
        // passes). Exosuit gear with autonode shaves 1 tick at the cost
        // of (gear.autoCost) autonode per use. tryGearEffect mutates
        // state — call it ONCE here so the rest of the action knows
        // the answer and the autonode charge is locked in.
        var S = window.Crawler.State;
        var fastMove = S.tryGearEffect(runState.player, 'move-fast');
        var moveTicks = fastMove ? 2 : 3;
        if (fastMove) {
            out('  brox: exosuit pulse · move ' + dirWord(direction) +
                ' in ' + moveTicks + ' ticks (-' +
                (runState.player.gear.autoCost || 0) + ' autonode)', 'ok');
        }

        var events = [];
        // Tick 1 — step into the doorway. No room change yet.
        events.push({
            delay: 320,
            apply: function () { runState.tick += 1; decay(1); },
            line:  function () { return tickLine('step ' + dirWord(direction) + ' · doorway'); }
        });
        // Middle ticks — transit. Skipped when moveTicks === 2.
        for (var mt = 0; mt < moveTicks - 2; mt++) {
            events.push({
                delay: 360,
                apply: function () { runState.tick += 1; decay(1); },
                line:  function () { return tickLine('cross the threshold...'); },
                lineCls: 'dim'
            });
        }
        // Final tick — actually arrive. Room-key swap + awareness.
        events.push({
            delay: 420,
            apply: function () {
                runState.tick += 1;
                decay(1);
                runState.currentRoomKey = target;
                if (runState.visited.indexOf(target) === -1) runState.visited.push(target);
                var nextState = window.Crawler.State.getOrInitRoomState(runState, target);
                nextState.visited = true;
                setEntryAwareness(nextState);
            },
            line:  function () { return tickLine('you are in the next room.'); }
        });

        // Pre-flight peek the destination's roomState (this lazily
        // seeds enemies + containers but doesn't move the player) so
        // we can decide whether to append reaction-lag ticks.
        var preCheck = window.Crawler.State.getOrInitRoomState(runState, target);
        var willBeAware;
        if (!preCheck.enemy || preCheck.enemy.hp <= 0) {
            willBeAware = false;
        } else if (preCheck.enemy.awareness === 'aware') {
            // Already alerted (e.g., previous run-in). Player gets lag
            // even if they peeked (a peek doesn't unalert anyone).
            willBeAware = true;
        } else {
            // Blind enemy. Will flip to aware unless the player peeked
            // and the peek positively confirmed an enemy was there.
            willBeAware = !(preCheck.peeked && preCheck.peekResult === 'enemy');
        }
        if (willBeAware) {
            appendReactionLag(events, preCheck);
        }

        playAndReturn(events);
    }

    // setEntryAwareness(roomState) — called when the player crosses
    // into a new room. Determines enemy.awareness and prints the
    // corresponding brox advisory line.
    //
    //   - already aware    → stays aware, prints entered_aware
    //   - blind + peeked   → stays blind, prints entered_blind
    //   - blind + unpeeked → flips to aware, prints entered_aware
    //
    // Lines fan to main + history through the live out() helper.
    function setEntryAwareness(roomState) {
        var enemy = roomState.enemy;
        if (!enemy || enemy.hp <= 0) return;
        var startedAware = enemy.awareness === 'aware';
        if (!startedAware) {
            if (roomState.peeked && roomState.peekResult === 'enemy') {
                enemy.awareness = 'blind';
            } else {
                enemy.awareness = 'aware';
            }
        }
        if (enemy.awareness === 'aware') {
            out('  brox: ' + window.Crawler.Narrate.say('brox.entered_aware', {
                label: enemy.label,
                ticks: (window.Crawler.State.effectiveReactionTime
                    ? window.Crawler.State.effectiveReactionTime(runState.player)
                    : (runState.player.reactionTime || 4))
            }), 'err');
        } else {
            out('  brox: ' + window.Crawler.Narrate.say('brox.entered_blind', {
                label: enemy.label
            }), 'ok');
        }
    }

    // appendReactionLag(events, roomState) — pushes N enemy-only
    // attack ticks onto the end of the events stream so the player
    // visibly loses initiative on entering blind.
    //
    // Pass 3.27: lag count = State.effectiveReactionTime(player). If
    // an agro_detector is equipped AND the player has enough autonode,
    // tryGearEffect deducts the autoCost and the lag drops by the
    // gear's reactionReduce. Otherwise it falls back to player.reactionTime.
    // The brox commentary names the gear so the player learns the cause.
    function appendReactionLag(events, roomState) {
        var enemy = roomState.enemy;
        if (!enemy) return;
        var S = window.Crawler.State;
        var base = (runState.player.reactionTime != null) ? runState.player.reactionTime : 4;
        var n = base;
        var gearUsed = false;
        if (S.tryGearEffect(runState.player, 'reaction-reduce')) {
            gearUsed = true;
            var r = (runState.player.gear && runState.player.gear.reactionReduce) || 0;
            n = Math.max(0, base - r);
        }
        if (gearUsed) {
            out('  brox: agro detector pinged · reaction lag ' + base +
                ' → ' + n + ' (-' + (runState.player.gear.autoCost || 0) +
                ' autonode)', 'ok');
        }
        if (n === 0) return;  // Gear fully negated lag; player acts immediately
        for (var i = 0; i < n; i++) {
            (function (idx) {
                events.push({
                    delay: 420,
                    apply: function () {
                        runState.tick += 1;
                        var dmg = enemy.posture === 'ranged' ? enemy.range : enemy.melee;
                        // Pass 3.26: gear damageReduction also applies here.
                        var gear = runState.player.gear;
                        if (gear && gear.damageReduction) {
                            dmg = Math.max(0, dmg - gear.damageReduction);
                        }
                        if (dmg > 0) {
                            runState.player.hp = Math.max(0, runState.player.hp - dmg);
                            runState.player._lastHitDmg = dmg;
                        } else {
                            runState.player._lastHitDmg = 0;
                        }
                    },
                    line: function () {
                        var dmg = runState.player._lastHitDmg || 0;
                        var verb = enemy.posture === 'ranged' ? 'shoots' : 'strikes';
                        if (dmg > 0) {
                            setActionVisual('damaged');
                            return tickLine(enemy.shortLabel + ' ' + verb +
                                ' first · -' + dmg + ' hp · reaction lag ' + (idx + 1) + '/' + n);
                        }
                        return tickLine(enemy.shortLabel + ' moves on you · reaction lag ' + (idx + 1) + '/' + n);
                    },
                    lineCls: 'err'
                });
            })(i);
        }
    }

    // doDoor(dir, toolArg)
    //
    // Phase 3 lock-attempt action. Player typed "n prybar" or
    // "n crypt key". toolArg may be the inventory key ('cryptkey')
    // or the human label ('crypt key') — normalize.
    //
    // 2-tick action. If enemy present, enemy interleaves (lock-picking
    // under fire is a real risk).
    function doDoor(dir, toolArg) {
        var attempt = window.Crawler.Rooms.moveDirection(runState, runState.currentRoomKey, dir);
        if (!attempt) {
            err('  ' + window.Crawler.Narrate.say('system.door_wall', { dir: dirWord(dir) }));
            return;
        }
        if (attempt.error === 'wall')   { err('  ' + window.Crawler.Narrate.say('system.door_wall',   { dir: dirWord(dir) })); return; }
        if (attempt.error === 'frozen') { err('  ' + window.Crawler.Narrate.say('system.door_frozen', { dir: dirWord(dir) })); return; }
        if (!attempt.error) {
            err('  door ' + dirWord(dir) + ' is already open. just `' + dir + '` to walk through.');
            return;
        }
        if (runState.player.energy <= 0) {
            err('  ' + window.Crawler.Narrate.say('system.no_energy'));
            return;
        }

        // Normalize tool name → inventory key
        var toolKey = toolArg.replace(/\s+/g, '').toLowerCase();
        if (toolKey === 'cryptkey' || toolKey === 'cryptkeys') toolKey = 'cryptkey';
        if (!hasTool(toolKey)) {
            err('  no ' + toolArg + ' in inventory.');
            return;
        }

        var door = attempt.door;
        var doors = window.Crawler.Doors;
        var chance = Math.round(doors.computeSuccessChance(door, runState.player.int) * 100);
        var enemy = getCurrentEnemy();
        var direction = dir;

        enterTickMode();

        // Player plan: 2-tick lock attempt. Result resolved in tick 2's apply.
        var resolved = { result: null };
        var playerPlan = window.Crawler.Combat.planPlayerSimple(
            'door',
            'lock attempt',
            [
                { label: 'work the ' + toolArg + ' on ' + dir + ' lock' },
                {
                    label: 'turn the ' + toolArg,
                    apply: function () {
                        // Resolve the lock now. attempt() mutates the door.
                        var r = doors.attempt(door, toolKey, runState.player.int);
                        resolved.result = r;
                        if (r.toolBroke) {
                            var idx = findTool(toolKey);
                            if (idx !== -1) runState.player.inventory.splice(idx, 1);
                        }
                    }
                }
            ]
        );

        // Brox commentary first (chance read)
        var preEvent = {
            delay: 320,
            apply: function () {},
            line: function () { return '  brox: ' + window.Crawler.Narrate.say('brox.tool_attempt', { chance: chance }); },
            lineCls: 'ok'
        };

        var events;
        if (enemy) {
            events = window.Crawler.Combat.buildTurn(playerPlan, enemy, runState);
        } else {
            events = [];
            for (var i = 0; i < playerPlan.steps.length; i++) {
                (function (step) {
                    events.push({
                        delay: 380,
                        apply: function () {
                            runState.tick += 1;
                            decay(1);
                            if (typeof step.apply === 'function') step.apply();
                        },
                        line: function () { return tickLine(step.label); }
                    });
                })(playerPlan.steps[i]);
            }
        }
        events.unshift(preEvent);

        // Outcome line — runs after all combat ticks. The apply()
        // here also swaps the visuals scene to door-open or door-
        // frozen as the door's fate is sealed. The next renderStatic
        // re-picks a state scene automatically.
        events.push({
            delay: 420,
            apply: function () {
                var r = resolved.result;
                if (!r) return;
                setActionVisual(r.success ? 'door-open' : 'door-frozen');
            },
            line: function () {
                var r = resolved.result;
                if (!r) return null;
                if (r.success) return '  brox: ' + window.Crawler.Narrate.say('brox.tool_success');
                if (r.reason === 'wrong_tool') {
                    return '  brox: ' + window.Crawler.Narrate.say('brox.tool_wrong', {
                        tool: toolArg, lock: door.lockType
                    });
                }
                return '  brox: ' + window.Crawler.Narrate.say('brox.tool_break', { tool: toolArg });
            },
            lineCls: 'ok'
        });

        // Set the lock-pick scene before the playback starts. Later
        // events in the plan above swap it to door-open / door-frozen.
        setActionVisual('lockpick');
        playAndReturn(events);
    }

    function doWait() {
        var enemy = getCurrentEnemy();
        enterTickMode();
        setActionVisual('waiting');

        if (enemy) {
            // 1-tick wait, enemy gets one tick of their attack.
            var playerPlan = window.Crawler.Combat.planPlayerSimple(
                'wait', 'hold', [{ label: 'hold' }]
            );
            var combatEvents = window.Crawler.Combat.buildTurn(playerPlan, enemy, runState);
            playAndReturn(combatEvents);
            return;
        }

        var events = [
            {
                delay: 450,
                apply: function () { runState.tick += 1; decay(1); },
                line:  function () { return tickLine('wait. nothing.'); },
                lineCls: 'dim'
            }
        ];
        playAndReturn(events);
    }

    // ============== PHASE 2 ACTIONS ==============

    function doAttack() {
        var enemy = getCurrentEnemy();
        if (!enemy) {
            err('  ' + window.Crawler.Narrate.say('system.no_target'));
            return;
        }
        if (runState.player.energy <= 0) {
            err('  ' + window.Crawler.Narrate.say('system.no_energy'));
            return;
        }
        enterTickMode();
        // Visual reflects posture: ranged attack vs melee swing
        setActionVisual(runState.player.posture === 'ranged' ? 'attack-ranged' : 'attack-melee');

        var playerPlan = window.Crawler.Combat.planPlayerAttack(runState.player);

        // Pass 3.24: attacking a blind enemy ALWAYS alerts them
        // (the swing/shot lands and they react). The combat plan
        // builds with current awareness; we flip it BEFORE the turn
        // so the enemy interleaves their attacks normally from tick 1.
        if (enemy.awareness === 'blind') {
            enemy.awareness = 'aware';
            out('  brox: ' + window.Crawler.Narrate.say('brox.enemy_alerted', { label: enemy.label }), 'err');
        }

        var combatEvents = window.Crawler.Combat.buildTurn(playerPlan, enemy, runState);
        playAndReturn(combatEvents);
    }

    // Pass 3.24: per-action alert chance for blind enemies. Returns
    // true if the enemy was alerted (state flipped). Does nothing
    // and returns false if there's no enemy or they're already aware.
    var ALERT_CHANCE = {
        attack:  1.0,   // handled inline (always alerts)
        posture: 0.25,
        bandage: 0.50,
        wait:    0.05,
        scan:    0.0,   // scanning adjacent doesn't make noise here
        comms:   0.10,
        move:    1.0    // leaving the room is loud
    };
    function maybeAlert(action) {
        var enemy = getCurrentEnemy();
        if (!enemy || enemy.awareness === 'aware') return false;
        var p = ALERT_CHANCE[action];
        if (p == null) p = 0;
        if (Math.random() < p) {
            enemy.awareness = 'aware';
            out('  brox: ' + window.Crawler.Narrate.say('brox.enemy_alerted', { label: enemy.label }), 'err');
            return true;
        }
        return false;
    }

    function doPosture() {
        var enemy = getCurrentEnemy();
        enterTickMode();
        setActionVisual('posture-shift');

        // Roll the alert FIRST so combat planning sees the awareness flip.
        if (enemy) maybeAlert('posture');

        var playerPlan = window.Crawler.Combat.planPlayerPosture(runState.player);

        if (enemy) {
            // Enemy gets a free tick during the swap — vulnerable per spec.
            var combatEvents = window.Crawler.Combat.buildTurn(playerPlan, enemy, runState);
            // Brox flavor first
            combatEvents.unshift({
                delay: 320,
                apply: function () {},
                line: function () { return '  brox: ' + window.Crawler.Narrate.say('brox.posture_switch'); },
                lineCls: 'ok'
            });
            playAndReturn(combatEvents);
            return;
        }

        // Peaceful posture switch — 1 tick, no combat
        var events = [
            {
                delay: 320,
                apply: function () {},
                line: function () { return '  brox: ' + window.Crawler.Narrate.say('brox.posture_switch'); },
                lineCls: 'ok'
            },
            {
                delay: 380,
                apply: function () {
                    runState.tick += 1;
                    decay(1);
                    var newPos = runState.player.posture === 'ranged' ? 'close' : 'ranged';
                    runState.player.posture = newPos;
                },
                line: function () { return tickLine('shift to ' + runState.player.posture); }
            }
        ];
        playAndReturn(events);
    }

    // doScan(dir) — Pass 3.24 reworked: scans an ADJACENT room. The
    // current room is always known on entry (player can see). Scan
    // is a sensor sweep that peeks through walls to the next cell.
    //
    // Outcomes:
    //   'clear'       — room genuinely empty, brox confirms
    //   'enemy'       — enemy detected, brox names them
    //   'no_signal'   — scan failed (false negative chance)
    //
    // Stored on the adjacent room's roomState as { peeked, peekResult }.
    // Renders as ⟨peeked: ...⟩ tag on the door option next turn.
    //
    // Tick cost: 2 baseline, reduced by INT (min 1, max 3).
    // Energy cost: 1 per tick.
    function doScan(dir) {
        if (runState.player.energy <= 0) {
            err('  ' + window.Crawler.Narrate.say('system.no_energy'));
            return;
        }
        var room = getCurrentRoom();
        var d    = room.doors[dir];
        if (!d || d.state === 'wall') {
            err('  ' + window.Crawler.Narrate.say('system.scan_wall', { dir: dirWord(dir) }));
            return;
        }

        // Pass 3.27: overcharge_scanner gear adds a SECOND adjacent
        // direction to the same scan action (one autonode charge).
        // We pick the second direction up front (random non-wall,
        // non-already-peeked-this-action) so both peek targets are
        // known at planning time.
        var S = window.Crawler.State;
        var primaryKey = adjacentRoomKey(dir);
        var dirsToScan = [{ dir: dir, key: primaryKey }];

        if (S.tryGearEffect(runState.player, 'scan-second')) {
            var others = ['n', 's', 'e', 'w'].filter(function (od) {
                if (od === dir) return false;
                var dd = room.doors[od];
                return dd && dd.state !== 'wall';
            });
            if (others.length > 0) {
                var pick = others[Math.floor(Math.random() * others.length)];
                var pickKey = adjacentRoomKey(pick);
                if (pickKey) dirsToScan.push({ dir: pick, key: pickKey });
                out('  brox: overcharge scanner pulse · adding ' + dirWord(pick) +
                    ' (-' + (runState.player.gear.autoCost || 0) + ' autonode)', 'ok');
            }
            // If no second target available, the gear charge still spent
            // (you can't refund a partial scan). That's intentional fric-
            // tion — players learn to skip the overcharge in dead-end rooms.
        }

        // Tick count: 2 base, -1 if INT >= 6, +1 if INT < 2 (max 3).
        var ticks = 2;
        if (runState.player.int >= 6) ticks = 1;
        else if (runState.player.int < 2) ticks = 3;

        var falseNegative = Math.max(0.05, 0.30 - runState.player.int * 0.04);

        // Resolve outcome for each scan target up front so the apply
        // events can write deterministically.
        var resolved = dirsToScan.map(function (t) {
            var adjState = window.Crawler.State.getOrInitRoomState(runState, t.key);
            var roll = Math.random();
            var outcome;
            if (roll < falseNegative) outcome = 'no_signal';
            else if (adjState.enemy && adjState.enemy.hp > 0) outcome = 'enemy';
            else outcome = 'clear';
            return { dir: t.dir, key: t.key, outcome: outcome, adjState: adjState };
        });

        enterTickMode();
        var anyEnemy = resolved.some(function (r) { return r.outcome === 'enemy'; });
        setActionVisual(anyEnemy ? 'peek-enemy' : 'peek-clear');

        var events = [];
        events.push({
            delay: 320,
            apply: function () {},
            line:  function () {
                var dirsLabel = resolved.map(function (r) { return dirWord(r.dir); }).join(' + ');
                return '  brox: ' + window.Crawler.Narrate.say('brox.peek_start', { dir: dirsLabel });
            },
            lineCls: 'ok'
        });
        for (var i = 0; i < ticks; i++) {
            (function (n) {
                events.push({
                    delay: 380,
                    apply: function () {
                        runState.tick += 1;
                        decay(1);
                    },
                    line: function () { return tickLine('scan · sweep ' + (n + 1) + '/' + ticks); }
                });
            })(i);
        }
        // Outcome tail per target
        resolved.forEach(function (r) {
            events.push({
                delay: 420,
                apply: function () {
                    r.adjState.peeked     = true;
                    r.adjState.peekResult = r.outcome;
                },
                line: function () {
                    if (r.outcome === 'enemy') {
                        return '  brox: ' + window.Crawler.Narrate.say('brox.peek_enemy', {
                            dir: dirWord(r.dir), label: r.adjState.enemy.label
                        });
                    }
                    if (r.outcome === 'clear') {
                        return '  brox: ' + window.Crawler.Narrate.say('brox.peek_clear', { dir: dirWord(r.dir) });
                    }
                    return '  brox: ' + window.Crawler.Narrate.say('brox.peek_no_signal', { dir: dirWord(r.dir) });
                },
                lineCls: r.outcome === 'no_signal' ? 'dim' : 'ok'
            });
        });

        playAndReturn(events);
    }

    // ============== CONTAINERS (Pass 3.24) ==============

    // currentOpenContainer — set when the player has a container
    // open and is in 'container' mode. Cleared on close / room exit.
    var currentOpenContainer = null;

    // doContainer(idx) — try to open container N in this room.
    //
    // Outcomes:
    //   already opened → re-enter container mode (look again)
    //   frozen         → error
    //   locked+tool    → 2-tick lock attempt (reuses doors mechanics
    //                    via Containers.attemptOpen)
    //   locked+notool  → error
    //   unlocked       → instant open, trap fires if present,
    //                    enter container mode
    //
    // Opening with an aware enemy in the room is BLOCKED at the
    // option-list level (renderContainerOptions skips when awareEnemy).
    // This handler still defends against direct typing.
    function doContainer(idx) {
        var rs = getCurrentRoomState();
        var enemy = getCurrentEnemy();
        if (enemy && enemy.awareness === 'aware') {
            err('  cannot open containers while ' + enemy.shortLabel + ' is on you.');
            return;
        }
        if (!rs.containers || idx < 1 || idx > rs.containers.length) {
            err('  ' + window.Crawler.Narrate.say('system.con_no_such', { id: idx }));
            return;
        }
        var c = rs.containers[idx - 1];

        // Pass 3.27: resyc stations route to a different mode. They
        // never lock, never contain anything — they're an interaction
        // surface (process ambient items + craft from recipes).
        if (c.kind === 'resyc') {
            currentResyc = { container: c, idx: idx };
            mode = 'resyc';
            renderResycView();
            return;
        }

        if (c.state === 'frozen') {
            err('  ' + window.Crawler.Narrate.say('system.con_frozen', { id: idx }));
            return;
        }
        if (c.state === 'opened') {
            currentOpenContainer = c;
            mode = 'container';
            renderContainerView(idx, c);
            return;
        }

        // Locked + need tool path
        if (c.lockType) {
            var wantedTool = window.Crawler.Doors.TOOL_FOR_LOCK[c.lockType];
            var toolKey    = wantedTool === 'crypt key' ? 'cryptkey' : wantedTool;
            if (!hasTool(toolKey)) {
                err('  ' + window.Crawler.Narrate.say('system.con_locked_no_tool', {
                    id: idx, tool: wantedTool
                }));
                return;
            }
            return openLockedContainer(idx, c, toolKey, wantedTool);
        }

        // Unlocked + closed — opens this turn
        return openUnlockedContainer(idx, c);
    }

    function openUnlockedContainer(idx, c) {
        enterTickMode();
        setActionVisual('container-open');
        var events = [
            {
                delay: 320,
                apply: function () {
                    runState.tick += 1;
                    decay(1);
                    var r = window.Crawler.Containers.attemptOpen(c, null, runState.player.int);
                    c._lastTrapDmg = r.trapDmg || 0;
                    if (r.trapDmg) {
                        runState.player.hp = Math.max(0, runState.player.hp - r.trapDmg);
                        setActionVisual('container-trap');
                    } else if (c.contents.length === 0) {
                        setActionVisual('container-empty');
                    }
                    // Possibly alert a blind enemy from the noise
                    if (getCurrentEnemy()) maybeAlert('posture');
                },
                line: function () {
                    if (c._lastTrapDmg) {
                        return tickLine('open ' + c.label + ' · TRAP · -' + c._lastTrapDmg + ' hp');
                    }
                    return tickLine('open ' + c.label);
                }
            },
            {
                delay: 380,
                apply: function () {},
                line: function () {
                    if (c._lastTrapDmg) {
                        return '  brox: ' + window.Crawler.Narrate.say('brox.con_trap', { dmg: c._lastTrapDmg });
                    }
                    if (c.contents.length === 0) {
                        return '  brox: ' + window.Crawler.Narrate.say('brox.con_open_empty');
                    }
                    return '  brox: ' + window.Crawler.Narrate.say('brox.con_open_loot', { count: c.contents.length });
                },
                lineCls: c.trap ? 'err' : 'ok'
            }
        ];
        playAndReturn(events, {
            preReturn: function () {
                if (c.contents.length > 0) {
                    currentOpenContainer = c;
                    mode = 'container';
                }
            }
        });
    }

    function openLockedContainer(idx, c, toolKey, toolLabel) {
        var resolved = { result: null };
        var chance = Math.round(window.Crawler.Doors.computeSuccessChance({
            state: 'locked', lockType: c.lockType, baseSuccess: c.baseSuccess
        }, runState.player.int) * 100);

        enterTickMode();
        setActionVisual('lockpick');
        var events = [
            {
                delay: 320,
                apply: function () {},
                line: function () { return '  brox: ' + window.Crawler.Narrate.say('brox.tool_attempt', { chance: chance }); },
                lineCls: 'ok'
            },
            {
                delay: 380,
                apply: function () { runState.tick += 1; decay(1); },
                line:  function () { return tickLine('work the ' + toolLabel + ' on the lock'); }
            },
            {
                delay: 420,
                apply: function () {
                    runState.tick += 1;
                    decay(1);
                    var r = window.Crawler.Containers.attemptOpen(c, toolKey, runState.player.int);
                    resolved.result = r;
                    if (r.toolBroke) {
                        var i2 = findTool(toolKey);
                        if (i2 !== -1) runState.player.inventory.splice(i2, 1);
                    }
                    if (r.success) {
                        setActionVisual('container-open');
                        if (r.trapDmg) {
                            runState.player.hp = Math.max(0, runState.player.hp - r.trapDmg);
                            setActionVisual('container-trap');
                        } else if (c.contents.length === 0) {
                            setActionVisual('container-empty');
                        }
                    }
                    if (getCurrentEnemy()) maybeAlert('posture');
                },
                line: function () { return tickLine('turn the ' + toolLabel); }
            },
            {
                delay: 460,
                apply: function () {},
                line: function () {
                    var r = resolved.result;
                    if (!r) return null;
                    if (r.success) {
                        if (r.trapDmg) return '  brox: ' + window.Crawler.Narrate.say('brox.con_trap', { dmg: r.trapDmg });
                        if (c.contents.length === 0) return '  brox: ' + window.Crawler.Narrate.say('brox.con_open_empty');
                        return '  brox: ' + window.Crawler.Narrate.say('brox.con_open_loot', { count: c.contents.length });
                    }
                    return '  brox: ' + window.Crawler.Narrate.say('brox.tool_break', { tool: toolLabel });
                },
                lineCls: 'ok'
            }
        ];
        playAndReturn(events, {
            preReturn: function () {
                var r = resolved.result;
                if (r && r.success && c.contents.length > 0) {
                    currentOpenContainer = c;
                    mode = 'container';
                }
            }
        });
    }

    // renderContainerView(idx, c) — overlays the static frame with
    // the container contents. Container mode locks input to the
    // contents browser until the player closes.
    function renderContainerView(idx, c) {
        clear();
        inventoryClear();
        renderInventory();
        if (window.Crawler.Visuals) {
            window.Crawler.Visuals.show('container-open', visualCtx);
        }

        dim('═══════════════════════════════════════════════════════════');
        heading('  ' + c.label + ' · container ' + idx);
        dim('═══════════════════════════════════════════════════════════');
        blank();

        if (c.contents.length === 0) {
            dim('  empty.');
            blank();
            mainHeading('  options');
            mainOut('  close             back to room');
            return;
        }

        mainHeading('  contents');
        c.contents.forEach(function (item, i) {
            var num = (i + 1);
            var line = '  [' + num + ']  ' + item.label;
            if (item.blurb) line += '   ' + item.blurb;
            mainOut(line);
        });
        blank();
        mainHeading('  options');
        mainOut('  1 3 5 ...         take item numbers (space-separated)');
        mainOut('  all               take everything');
        mainOut('  close             back to room (leave the rest)');
        blank();
    }

    // handleContainerInput — runs when mode === 'container'.
    function handleContainerInput(line) {
        var trimmed = String(line || '').trim().toLowerCase();
        var c = currentOpenContainer;
        if (!c) { mode = 'static'; renderStatic(); return; }

        if (!trimmed) { renderContainerView(_findContainerIdx(c), c); return; }
        if (trimmed === 'close' || trimmed === 'x' || trimmed === 'exit' || trimmed === 'q') {
            ok('  ' + window.Crawler.Narrate.say('brox.con_close'));
            currentOpenContainer = null;
            mode = 'static';
            renderStatic();
            return;
        }
        if (trimmed === 'all') {
            var allIdx = c.contents.map(function (_, i) { return i + 1; });
            return takeFromContainer(c, allIdx);
        }
        // Parse number list "1 3 5" or "1, 3, 5"
        var nums = trimmed.split(/[\s,]+/)
            .map(function (s) { return parseInt(s, 10); })
            .filter(function (n) { return !isNaN(n) && n > 0; });
        if (nums.length === 0) {
            err('  unknown command in container view. type numbers, `all`, or `close`.');
            return;
        }
        return takeFromContainer(c, nums);
    }

    function takeFromContainer(c, indexes) {
        var taken = window.Crawler.Containers.takeItems(c, indexes);
        if (taken.length === 0) {
            err('  no valid items at those numbers.');
            return;
        }
        taken.forEach(function (item) {
            runState.player.inventory.push(item);
            ok('  ' + window.Crawler.Narrate.say('brox.con_take', { label: item.label }));
        });
        // If nothing left, close automatically.
        if (c.contents.length === 0) {
            currentOpenContainer = null;
            mode = 'static';
            renderStatic();
            return;
        }
        // Re-render container view with updated contents
        renderContainerView(_findContainerIdx(c), c);
    }

    function _findContainerIdx(c) {
        var rs = getCurrentRoomState();
        if (!rs.containers) return -1;
        for (var i = 0; i < rs.containers.length; i++) {
            if (rs.containers[i] === c) return i + 1;
        }
        return -1;
    }

    // ============== RESYC STATION (Pass 3.27) ==============

    // currentResyc — set when player has a resyc station open.
    // Cleared on close / room exit. Holds { container, idx } for
    // re-render after process / craft mutates inventory.
    var currentResyc = null;

    // renderResycView — overlays the static frame with the resyc
    // station UI. Lists the player's ambient items (with their
    // hidden-until-now autonode value + tick cost) and any recipes
    // craftable from current inventory.
    function renderResycView() {
        if (!currentResyc) { mode = 'static'; renderStatic(); return; }
        clear();
        inventoryClear();
        renderInventory();
        if (window.Crawler.Visuals) {
            window.Crawler.Visuals.show('container-open', visualCtx);
        }

        var p = runState.player;
        var ambient = (p.inventory || []).filter(function (i) { return i.type === 'ambient'; });
        // Build a STABLE numbered slice (used by `process N` commands)
        currentResyc._ambientSlice = ambient.map(function (it) {
            return { item: it, invIdx: p.inventory.indexOf(it) };
        });

        dim('═══════════════════════════════════════════════════════════');
        heading('  resyc station · room ' + (runState.currentRoomKey || '?'));
        dim('═══════════════════════════════════════════════════════════');
        blank();
        dim('  autonode ' + (p.autonode || 0) + '/' + (p.maxAutonode || 40) + '   ·   feed ambient items in. quality is real now.');
        blank();

        mainHeading('  ambient stock');
        if (ambient.length === 0) {
            mainOut('   — no ambient items in inventory', 'dim');
        } else {
            ambient.forEach(function (it, i) {
                var num = ('[' + (i + 1) + ']').padEnd(5);
                var an  = (it.autonode != null) ? it.autonode : 0;
                var pt  = (it.processTicks != null) ? it.processTicks : 1;
                mainOut('   ' + num + ' ' + it.label.padEnd(20) +
                    '· ' + an + ' autonode · ' + pt + ' ticks');
            });
        }
        blank();

        // Craftable recipes
        var recipes = (window.Crawler.Recipes && window.Crawler.Recipes.craftableFromInventory)
            ? window.Crawler.Recipes.craftableFromInventory(p.inventory)
            : [];
        currentResyc._recipeSlice = recipes;
        mainHeading('  craftable');
        if (recipes.length === 0) {
            mainOut('   — none with current inventory', 'dim');
        } else {
            recipes.forEach(function (r, i) {
                var num = ('craft ' + (i + 1)).padEnd(10);
                var reqStr = r.requires.map(function (q) {
                    return q.count + '× ' + q.key.replace(/_/g, ' ');
                }).join(' + ');
                mainOut('   ' + num + ' ' + r.label.padEnd(20) +
                    '· needs ' + reqStr + ' · ' + r.costTicks + ' ticks');
            });
        }
        blank();

        mainHeading('  options');
        mainOut('   1 3 5 ...        process ambient items by number');
        mainOut('   craft <N>        craft a listed recipe');
        mainOut('   close            back to room');
        blank();
    }

    function handleResycInput(line) {
        var trimmed = String(line || '').trim().toLowerCase();
        if (!currentResyc) { mode = 'static'; renderStatic(); return; }
        if (!trimmed) { renderResycView(); return; }
        if (trimmed === 'close' || trimmed === 'x' || trimmed === 'exit' || trimmed === 'q') {
            ok('  resyc · disengaged.');
            currentResyc = null;
            mode = 'static';
            renderStatic();
            return;
        }
        // craft N
        var craftMatch = trimmed.match(/^craft\s+(\d+)$/);
        if (craftMatch) {
            return doCraft(parseInt(craftMatch[1], 10));
        }
        // Numeric process list — "1 3 5"
        var nums = trimmed.split(/[\s,]+/)
            .map(function (s) { return parseInt(s, 10); })
            .filter(function (n) { return !isNaN(n) && n > 0; });
        if (nums.length > 0) {
            return doProcess(nums);
        }
        err('  unknown resyc command. type item numbers, `craft <N>`, or `close`.');
    }

    // doProcess(indexes) — for each ambient item (by resyc-list number),
    // play one process tick window, then add the item's rolled autonode
    // value to the player and remove it from inventory. The first time
    // a player processes a given item type, they LEARN its yield range.
    function doProcess(indexes) {
        if (!currentResyc) return;
        var slice = currentResyc._ambientSlice || [];
        // Validate + build queue (in user-typed order for readable playback)
        var queue = [];
        for (var i = 0; i < indexes.length; i++) {
            var idx = indexes[i] - 1;
            if (idx < 0 || idx >= slice.length) continue;
            queue.push(slice[idx]);
        }
        if (queue.length === 0) {
            err('  no valid ambient numbers in that list.');
            return;
        }

        enterTickMode();
        setActionVisual('container-open');
        var events = [];
        events.push({
            delay: 280,
            apply: function () {},
            line:  function () { return '  brox: feeding ' + queue.length + ' item(s) into the resyc.'; },
            lineCls: 'ok'
        });
        queue.forEach(function (entry) {
            var it = entry.item;
            var ticks = (it.processTicks != null) ? it.processTicks : 1;
            // Per-tick "grinding" lines
            for (var t = 0; t < ticks; t++) {
                (function (t2, total, label) {
                    events.push({
                        delay: 240,
                        apply: function () { runState.tick += 1; decay(1); },
                        line:  function () { return tickLine('process · ' + label + ' (' + (t2 + 1) + '/' + total + ')'); },
                        lineCls: 'dim'
                    });
                })(t, ticks, it.label);
            }
            // Yield + remove (last)
            events.push({
                delay: 320,
                apply: function () {
                    // Re-resolve the inv index (earlier removals shift it)
                    var p = runState.player;
                    var idx = p.inventory.indexOf(it);
                    if (idx !== -1) p.inventory.splice(idx, 1);
                    var gain = (it.autonode != null) ? it.autonode : 0;
                    p.autonode = Math.min(p.maxAutonode || 40, (p.autonode || 0) + gain);
                    it._lastYield = gain;
                },
                line: function () {
                    var gain = it._lastYield;
                    if (gain === 0) return '  resyc · ' + it.label + ' yielded nothing. scrap.';
                    return '  resyc · ' + it.label + ' yielded ' + gain + ' autonode.';
                },
                lineCls: it._lastYield === 0 ? 'dim' : 'ok'
            });
        });
        playAndReturn(events, {
            preReturn: function () {
                if (currentResyc) {
                    mode = 'resyc';
                    renderResycView();
                } else {
                    mode = 'static';
                    renderStatic();
                }
            }
        });
    }

    // doCraft(idx) — consume the recipe's required items, gain the
    // output item (added to inventory). Plays tick events for the
    // craft duration. Verifies again at apply time in case the player
    // queued multiple actions (defensive — there's no queue today).
    function doCraft(idx) {
        if (!currentResyc) return;
        var recipes = currentResyc._recipeSlice || [];
        if (idx < 1 || idx > recipes.length) {
            err('  no recipe [' + idx + '] in the craftable list.');
            return;
        }
        var recipe = recipes[idx - 1];

        enterTickMode();
        setActionVisual('container-open');
        var events = [];
        events.push({
            delay: 280,
            apply: function () {},
            line:  function () { return '  brox: building ' + recipe.label + '. ' + recipe.costTicks + ' ticks.'; },
            lineCls: 'ok'
        });
        for (var t = 0; t < recipe.costTicks; t++) {
            (function (n) {
                events.push({
                    delay: 220,
                    apply: function () { runState.tick += 1; decay(1); },
                    line:  function () { return tickLine('craft · ' + recipe.label + ' (' + (n + 1) + '/' + recipe.costTicks + ')'); },
                    lineCls: 'dim'
                });
            })(t);
        }
        events.push({
            delay: 360,
            apply: function () {
                var ok = window.Crawler.Recipes.consumeRequirements(runState.player.inventory, recipe);
                if (!ok) {
                    recipe._failedAtCraft = true;
                    return;
                }
                var output = window.Crawler.Items.get(recipe.output);
                if (output) runState.player.inventory.push(output);
                recipe._failedAtCraft = false;
            },
            line: function () {
                if (recipe._failedAtCraft) {
                    return '  resyc · materials shifted mid-craft. nothing built.';
                }
                return '  resyc · ' + recipe.label + ' built. it is in your inventory.';
            },
            lineCls: recipe._failedAtCraft ? 'err' : 'ok'
        });
        playAndReturn(events, {
            preReturn: function () {
                if (currentResyc) {
                    mode = 'resyc';
                    renderResycView();
                } else {
                    mode = 'static';
                    renderStatic();
                }
            }
        });
    }

    function doRest() {
        enterTickMode();
        setActionVisual('resting');
        var events = [
            {
                delay: 380,
                apply: function () { runState.tick += 1; },
                line:  function () { return tickLine('rest start.'); },
                lineCls: 'dim'
            }
        ];
        // Brox flavor on rest start
        events.push({
            delay: 380,
            apply: function () {},
            line:  function () { return '  brox: ' + window.Crawler.Narrate.say('brox.rest_start'); },
            lineCls: 'ok'
        });
        // 9 more rest ticks (we already consumed the first above).
        // Kept short (250ms) — rest is repetitive flavor, no need to
        // labor each tick. Total ~2.3s for the full 10-tick rest.
        for (var i = 0; i < 9; i++) {
            events.push({
                delay: 250,
                apply: function () { runState.tick += 1; },
                line:  function () { return tickLine('   ...'); },
                lineCls: 'dim'
            });
        }
        // Recover energy at the end (no per-tick decay during rest)
        events.push({
            delay: 400,
            apply: function () {
                var before = runState.player.energy;
                var after  = Math.min(runState.player.maxEnergy, before + 25);
                runState.player._lastRecover = after - before;
                runState.player.energy = after;
            },
            line:  function () {
                return tickLine('recovered +' + runState.player._lastRecover + ' energy.');
            },
            lineCls: 'ok'
        });
        events.push({
            delay: 480,
            apply: function () {},
            line:  function () { return '  brox: ' + window.Crawler.Narrate.say('brox.rest_end'); },
            lineCls: 'ok'
        });
        playAndReturn(events);
    }

    function doBandage() {
        var idx = runState.player.inventory.findIndex(function (i) {
            return i.subtype === 'bandage';
        });
        if (idx === -1) { err('  no bandage in inventory.'); return; }

        var bandage = runState.player.inventory[idx];
        var total   = bandage.hp;
        // Spread heal over 3 ticks. Rounding goes to the last tick
        // so the printed total matches the bandage spec exactly.
        var per     = Math.floor(total / 3);
        var lastTickBonus = total - per * 3;
        var ticks   = [per, per, per + lastTickBonus];

        // Consume the bandage now so the inventory count is correct
        // when the static screen re-renders after the playback.
        runState.player.inventory.splice(idx, 1);

        enterTickMode();
        setActionVisual('bandaging');
        var events = [];

        // Brox line first (no tick cost)
        events.push({
            delay: 320,
            apply: function () {},
            line:  function () { return '  brox: ' + window.Crawler.Narrate.say('brox.bandage'); },
            lineCls: 'ok'
        });

        for (var i = 0; i < 3; i++) {
            (function (heal) {
                events.push({
                    delay: 460,
                    apply: function () {
                        runState.tick += 1;
                        decay(1);
                        runState.player.hp = Math.min(
                            runState.player.maxHp,
                            runState.player.hp + heal
                        );
                    },
                    line: function () { return tickLine('use bandage  +' + heal + ' hp'); }
                });
            })(ticks[i]);
        }
        playAndReturn(events);
    }

    function doComms() {
        // Comms is a flavor beat — costs 0 ticks for Phase 1. Phase 7
        // (Brox's voice) may make this a real interaction with
        // multiple Brox responses based on context.
        enterTickMode();
        var events = [
            {
                delay: 380,
                apply: function () {},
                line: function () { return '  brox: ' + window.Crawler.Narrate.say('brox.ambient'); },
                lineCls: 'ok'
            }
        ];
        playAndReturn(events);
    }

    function doExit() {
        // Clean exit — no tick cost, plays a Brox sign-off, returns
        // the terminal to shell mode (NOT back to static).
        enterTickMode();
        var events = [
            {
                delay: 320,
                apply: function () {},
                line: function () { return '  brox: ' + window.Crawler.Narrate.say('brox.exit'); },
                lineCls: 'dim'
            },
            {
                delay: 480,
                apply: function () {},
                line: function () { return '  ' + window.Crawler.Narrate.say('system.crawl_cancel'); },
                lineCls: 'dim'
            }
        ];
        playAndReturn(events, {
            skipReturn: true,
            preReturn: function () {
                runState = null;
                returnToShell();
                unlockInput();
            }
        });
    }

    // ============== DEATH ==============
    //
    // Phase 1 wires the plumbing — nothing in Phase 1 deals damage,
    // so this only fires if a future system mutates HP to ≤ 0. Phase
    // 2 (combat) plugs in here.
    //
    // Death is intentionally short and final: glitch beat, Brox
    // silence, "signal disconnected", reset to inactive. No farewell.
    function checkDeath() {
        if (!runState) return false;
        if (runState.player.hp <= 0) {
            triggerDeath('hp');
            return true;
        }
        return false;
    }

    function triggerDeath(reason) {
        mode = 'dead';
        lockInput('--');
        setActionVisual('dead');

        // Three-beat sequence: brief glitch, system line, Brox.
        var events = [
            { delay: 400, line: '  ▓▒░░░░▒▓ ░░░ ▒▓░ ░',           lineCls: 'err' },
            { delay: 650, line: '  ' + window.Crawler.Narrate.say('system.death'), lineCls: 'err' },
            { delay: 850, line: '  brox: ' + window.Crawler.Narrate.say('brox.death'), lineCls: 'dim' },
            { delay: 1100, line: '' }
        ];
        window.Crawler.Scheduler.play(events, buildTickCtx(), function () {
            runState = null;
            returnToShell();
            unlockInput();
        });
    }

    // ============== EXPORTS ==============
    window.Crawler = window.Crawler || {};
    window.Crawler.start = startCrawl;
    window.Crawler.handleInput = handleInput;
    window.Crawler.isActive = isActive;
    window.Crawler.getMode = getMode;
    // Expose runState getter for debugging only (not for game logic
    // — game systems should receive runState as a parameter).
    window.Crawler._debug = {
        getRunState: function () { return runState; },
        getMenu: function () { return menu; }
    };
})();
