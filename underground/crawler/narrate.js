/* ============================================================
 * SHRED CRAWLER · narrate.js · Phase 0
 * ============================================================
 * THE CHOKEPOINT.
 *
 * Every line of generated text in the crawler — Brox's comms,
 * room descriptions, enemy reads, scan results, death messages,
 * drop reward text — passes through narrate(channel, context).
 *
 * For v0 channels dispatch to hardcoded BANKS per channel with
 * simple {key} templating. For a future pass each channel can be
 * overridden via setNarrator(channel, fn) to dispatch to a daemon
 * narrator (Brox's daemon card already exists). Same signature,
 * different implementation, swappable per channel.
 *
 * ARCHITECTURAL RULE: no other module touches text generation.
 * No string literals scattered through combat or room code.
 * If a system needs text, it asks narrate() for it.
 *
 * Tone (spec v0.3 §18): hardcore, mean, unfriendly, arguably fair.
 * Brox (spec v0.3 §2): deep lore, mysterious, do not over-explain.
 *
 * No dependencies. Self-contained.
 * ============================================================ */
(function () {
    'use strict';

    function pickRandom(arr) {
        if (!arr || !arr.length) return '';
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function template(str, ctx) {
        if (!str) return '';
        return String(str).replace(/\{(\w+)\}/g, function (m, key) {
            var v = ctx && ctx[key];
            return v == null ? m : String(v);
        });
    }

    // ============== BANKS ==============
    // Channel naming convention: 'speaker.event'.
    //   system.*   — out-of-character system text (boot, death, errors)
    //   brox.*     — comms voice (mysterious, sparse, arguably fair)
    //   room.*     — room description register (Phase 1+)
    //   enemy.*    — enemy read register (Phase 2+)
    //   scan.*     — scan result register (Phase 2+)
    //   drop.*     — goal-box reward register (Phase 5+)
    //
    // Phase 0 ships only the channels the menu and Phase 0 stub need.
    // Later phases register additional channels via registerChannel().
    var BANKS = {

        // ────── system / boot ──────────────────────────
        'system.crawl_intro': [
            'opening relay tunnel...',
            'shred-relay/37 :: cargo channel handshake',
            'sync nominal'
        ],
        'system.crawl_cancel': [
            'tunnel closed. nothing logged.',
            'session aborted before commit.',
            'returning to shell.'
        ],

        // ────── brox / comms ───────────────────────────
        'brox.intro': [
            "i'm on the line. you're on the line.",
            "comms up. don't say my name out loud.",
            "i'm here. you're not yet."
        ],

        // Character pick acknowledgement — Brox sees who's in the field
        'brox.pick.drakey': [
            "drakey. light kit. don't burn the autonode early.",
            "drakey then. you'll feel range before melee. fine.",
            "drakey. quiet hands. keep them quiet."
        ],
        'brox.pick.torred': [
            "torred. you'll soak. don't enjoy it.",
            "torred. close work. that's the work.",
            "torred. heavy hands. don't lose the bandage early."
        ],

        // Code slot management
        'brox.code_set': [
            "code logged. doesn't mean it's good.",
            "logged. you'll see what it does soon enough.",
            "in. we'll see.",
            "noted. carry it."
        ],
        'brox.code_invalid': [
            "that's not a code. try again.",
            "garbage. paste the real string.",
            "no. that's not the format."
        ],
        'brox.code_wrong_slot': [
            "wrong slot. that one's a {actual}, you put it in {slot}.",
            "no. {actual}-prefix goes in the {actual} slot."
        ],
        'brox.code_cleared': [
            "slot empty. fine.",
            "cleared. clean slate in that one.",
            "out. fine."
        ],

        // Run brief (used by Phase 0 stub; Phase 3+ will pass real faction)
        'brox.brief': [
            "compound's quiet. that's a lie. {faction} doesn't do quiet.",
            "you're going in cold. brox out for thirty seconds.",
            "this one's a {faction} hold. expect what you expect.",
            "{faction} bunker. usual tells. don't get clever."
        ],

        // ────── Phase 1 · static/tick loop ─────────────

        // Player tries to move where there's no door
        'system.no_door': [
            "no door {dir}. wall.",
            "wall {dir}. nothing there.",
            "you push against the wall {dir}. it does not push back."
        ],

        // Brox flavor when player invokes `comms`. Phase 7 replaces
        // this with the real Brox daemon adapter; for v0 it's tonal
        // placeholder lines.
        'brox.ambient': [
            "still here.",
            "i'm watching the floor maps. they're wrong, but i'm watching.",
            "quiet on my end. eat something.",
            "you're walking circles. i'd say something if you weren't.",
            "two things on the wire. neither relevant.",
            "the cameras blink in pairs. i don't know why.",
            "mark the codes. don't trust the codes."
        ],

        // Player asks energy is gone
        'system.no_energy': [
            "you're empty. rest before you do anything else.",
            "no energy. legs won't carry it.",
            "out. rest now or get dragged."
        ],

        // Player rests
        'brox.rest_start': [
            "rest. i'll watch.",
            "down for ten. don't snore.",
            "ten ticks. nothing should happen."
        ],
        'brox.rest_end': [
            "up.",
            "back on it.",
            "that'll hold."
        ],

        // Player uses bandage
        'brox.bandage': [
            "wrap it tight.",
            "good. the cheap ones don't last but they hold.",
            "bandage. don't waste them."
        ],

        // Player exits the run cleanly
        'brox.exit': [
            "you're pulling out. fine.",
            "logged. nothing taken.",
            "out. clean."
        ],

        // ────── Phase 2 · combat & scan ────────────────

        // Player enters a room blind to the contents
        'system.room_blind': [
            "the room reads occupied. you can't tell what.",
            "movement in here. scan or eat it blind.",
            "something's in the room. shape unclear."
        ],
        // Player asks for a posture switch
        'brox.posture_switch': [
            "swap. fine.",
            "you're vulnerable for the swap. they know.",
            "shifting. don't get hit on the turn."
        ],
        // Scan start
        'brox.scan_start': [
            "running scan. hold.",
            "pinging the room. don't move.",
            "scan up. eyes off the door."
        ],
        // Scan outcomes
        'brox.scan_success': [
            "{label}. that's what's in there.",
            "got them. {label}. posture {posture}.",
            "{label} on the read. {hp} left in them."
        ],
        'brox.scan_no_signal': [
            "no signal. wasted ticks.",
            "scan came back empty. wrong frequency.",
            "nothing. the room ate the ping."
        ],
        'brox.scan_silent_alert': [
            "scan failed. they heard you. you're still blind.",
            "they have you now. you don't have them.",
            "you tripped a wire. they're listening."
        ],
        // Combat ambient
        'system.enemy_dead': [
            "{label} down.",
            "{label} stops moving.",
            "{label} folded."
        ],
        'brox.combat_low_hp': [
            "you're bleeding. wrap something.",
            "low. very low.",
            "rest or die. those are the options."
        ],
        // Player tries to attack with no enemy in the room
        'system.no_target': [
            "nothing to attack. room's empty.",
            "no target. you swing at the wall and stop yourself.",
            "no one here. save the round."
        ],

        // ────── Phase 3 · doors & locks ────────────────

        // Player tries to walk through a wall
        'system.door_wall': [
            "wall {dir}. nothing there.",
            "no door {dir}. solid.",
            "you push at the wall {dir}. it's a wall."
        ],
        // Player tries to walk through a locked door without a tool arg
        'system.door_locked': [
            "door {dir} is locked · {tool} type. type `{cmd}` to try.",
            "{dir} door · {tool} lock. you have a {tool}. type `{cmd}` to try the lock.",
            "{dir} is shut · {tool} type. `{cmd}` to attempt."
        ],
        'system.door_locked_no_tool': [
            "door {dir} is locked. needs {tool}. you don't have one.",
            "{dir} door · {tool} lock. you have nothing for it.",
            "{dir} is shut and you can't open it. no {tool}."
        ],
        // Player tries to walk through a frozen door
        'system.door_frozen': [
            "{dir} door is gone. you broke it.",
            "{dir} door is frozen. dead lock. dead door.",
            "{dir} door is past saving."
        ],
        // Tool attempt brox lines
        'brox.tool_attempt': [
            "go on. {chance}% by my read.",
            "try it. {chance}% with your int.",
            "{chance}% says it opens. roll."
        ],
        // Tool success
        'brox.tool_success': [
            "good. through.",
            "open. don't waste it.",
            "in. move."
        ],
        // Tool fail (wrong tool)
        'brox.tool_wrong': [
            "wrong tool. that {tool} was never going to work on a {lock} lock.",
            "you broke a {tool} on a {lock} lock. that's on you.",
            "{tool} doesn't fit a {lock}. you knew that. or you didn't."
        ],
        // Tool fail (right tool, bad roll)
        'brox.tool_break': [
            "snapped. tool's gone. door's frozen.",
            "tool broke. door's done. that one's a dead end.",
            "lost the {tool}. lost the door. keep moving."
        ],

        // ────── Pass 3.24 · scan (adjacent rooms) ──────────────
        'system.scan_no_dir': [
            "scan which way? `scan n` / `scan s` / `scan e` / `scan w`."
        ],
        'system.scan_wall': [
            "no door {dir}. nothing to scan through.",
            "wall {dir}. sweep returns junk."
        ],
        'brox.peek_start': [
            "sending a sweep {dir}. hold.",
            "ping going {dir}. listen.",
            "scope's on {dir}."
        ],
        'brox.peek_clear': [
            "{dir} reads clear.",
            "nothing in the {dir} room. or nothing that registers.",
            "{dir} is empty by my read."
        ],
        'brox.peek_enemy': [
            "{dir} reads hot. {label} in there.",
            "got a body {dir}. {label}.",
            "{dir} room: {label}. unaware right now."
        ],
        'brox.peek_no_signal': [
            "{dir} sweep came back garbage. try again or eat it blind.",
            "no signal from {dir}. could be jammed. could be empty.",
            "scope's lying about {dir}. inconclusive."
        ],

        // ────── Pass 3.28 · confidence-scan readouts ───
        // Picked by (band, suspectedEnemy[, isReversal]) in crawler.js.
        // Bands: weak (0-30%), trace (30-55%), leaning (55-80%),
        // confirmed (80%+). Reversal triggers when re-scan flips the
        // suspected state from a prior scan.
        'brox.scan_weak_enemy': [
            "{dir} signal weak. trace of movement. cannot confirm anything yet.",
            "{dir} something's there. maybe. needles barely twitch.",
            "{dir} reads dirty. ghost or body. can't say."
        ],
        'brox.scan_weak_clear': [
            "{dir} scope's quiet. nothing on the first pass.",
            "{dir} reads empty so far. don't trust it.",
            "{dir} signal flat. could just be the walls."
        ],
        'brox.scan_trace_enemy': [
            "{dir} picking up movement. keep an eye out.",
            "{dir} something is breathing in there. probably.",
            "{dir} smells like a body. don't quote me."
        ],
        'brox.scan_trace_clear': [
            "{dir} still reads empty. mostly.",
            "{dir} no heat. no motion. probably clear.",
            "{dir} feels hollow. could go either way."
        ],
        'brox.scan_leaning_enemy': [
            "{dir} fairly sure that's a hostile. {label}, by the silhouette.",
            "{dir} got a body. reads {label} from the gait.",
            "{dir} something's there and it's the wrong shape. {label}."
        ],
        'brox.scan_leaning_clear': [
            "{dir} leaning empty. one more sweep if you're nervous.",
            "{dir} most likely clear. most.",
            "{dir} no contacts. confidence isn't great though."
        ],
        'brox.scan_confirmed_enemy': [
            "{dir} confirmed. {label}.",
            "{dir} hostile. {label}. unaware right now.",
            "{dir} {label} sitting in there. clean read."
        ],
        'brox.scan_confirmed_clear': [
            "{dir} confirmed clear.",
            "{dir} empty. nothing biological.",
            "{dir} dead air. all yours."
        ],
        // Reversal lines play when the re-scan flips the previous
        // suspectedEnemy guess. The {prev} placeholder takes the OLD
        // suspected label ('enemy' or 'clear').
        'brox.scan_reversal_to_enemy': [
            "okay — scratch that. now I am picking up movement {dir}. keep an eye out.",
            "correction {dir}: that wasn't empty. there's something in there.",
            "previous read was wrong. {dir} has a body in it after all."
        ],
        'brox.scan_reversal_to_clear': [
            "false positive. {dir} is showing empty now.",
            "okay disregard the earlier read. {dir} is clean.",
            "it was a ghost. {dir} reads empty on the second pass."
        ],
        'brox.scan_charged': [
            "scan deck spun up. burning {auto} autonode for the sweep.",
            "scope's drawing power. -{auto} autonode.",
            "running active sensors. -{auto} autonode."
        ],

        // ────── Pass 3.24 · awareness (enemy notices player) ───
        'brox.enemy_alerted': [
            "{label}'s on you now.",
            "they made you. {label} is moving.",
            "blew it. {label} is awake."
        ],
        'brox.entered_aware': [
            "{label} was waiting. you're behind by {ticks} ticks.",
            "{label} had the room. they get the first hits.",
            "walked into a ready {label}. brace."
        ],
        'brox.entered_blind': [
            "{label} hasn't seen you. take what you need.",
            "you're behind {label}. they don't know yet.",
            "{label} is blind. for now."
        ],

        // ────── Pass 3.24 · containers ─────────────────────────
        'system.con_no_idx': [
            "which container? `con 1` / `con 2` etc."
        ],
        'system.con_no_such': [
            "no container {id} in this room.",
            "container {id} doesn't exist here."
        ],
        'system.con_locked_no_tool': [
            "container {id} is locked. needs {tool}. you don't have one."
        ],
        'system.con_frozen': [
            "container {id} is wrecked. nothing to do with it now."
        ],
        'system.con_already_open': [
            "container {id} is already open. type `con {id}` again to look inside, or `close` if you're done."
        ],
        'brox.con_open_empty': [
            "nothing in it.",
            "dud. someone got here first.",
            "empty. as expected."
        ],
        'brox.con_open_loot': [
            "{count} thing(s) in there. type the numbers to take, or `close`.",
            "{count} item(s). pick what you want.",
            "{count} inside. number them off, or close it."
        ],
        'brox.con_trap': [
            "tripwire. you took {dmg} hp.",
            "trap fired. {dmg} hp gone.",
            "should've checked. {dmg} hp."
        ],
        'brox.con_take': [
            "took {label}.",
            "got {label}.",
            "{label} pocketed."
        ],
        'brox.con_close': [
            "closed it.",
            "done with it.",
            "moving on."
        ],

        // ────── death (Phase 2+) ───────────────────────
        'system.death': [
            'signal disconnected.',
            'signal lost.',
            'connection severed.'
        ],
        'brox.death': [
            "...",
            "(static)",
            "(comms cut)"
        ],

        // ────── sign-off (Phase 5+) ────────────────────
        'brox.signoff': [
            "you got the box. note the codes. burn this session.",
            "out. write them down. don't trust them.",
            "good. now leave."
        ]
    };

    // ============== DISPATCH ==============

    var overrides = {};

    // narrate(channel, context) → string
    //
    // Primary entry point. Looks up an override first (for daemon-
    // driven channels in future passes); falls back to BANKS dispatch
    // with template substitution.
    function narrate(channel, context) {
        context = context || {};
        if (overrides[channel]) {
            try {
                var result = overrides[channel](channel, context);
                if (result != null) return String(result);
            } catch (e) {
                console.error('[narrate] override threw, falling back:', e);
            }
        }
        var bank = BANKS[channel];
        if (!bank) {
            console.warn('[narrate] unknown channel:', channel);
            return '';
        }
        return template(pickRandom(bank), context);
    }

    // narrateAll(channel, context) → array of strings
    //
    // Returns the entire bank for a channel with templating applied.
    // Useful when a system wants to print multiple lines (e.g., the
    // boot intro that prints all system.crawl_intro lines in order).
    function narrateAll(channel, context) {
        context = context || {};
        var bank = BANKS[channel];
        if (!bank) return [];
        return bank.map(function (line) { return template(line, context); });
    }

    // registerChannel(channel, lines) — runtime registration
    //
    // Allows later phase modules (or the user) to register additional
    // banks without editing this file. Replaces an existing bank.
    function registerChannel(channel, lines) {
        if (!Array.isArray(lines)) return false;
        BANKS[channel] = lines.slice();
        return true;
    }

    // setNarrator(channel, fn) — daemon hookup point
    //
    // Override a channel with a function that takes (channel, context)
    // and returns a string. This is the AI-daemon escape hatch from
    // spec v0.3 §19. A future pass will provide an adapter that takes
    // a Daemon Card and returns a narrator function compatible with
    // this signature.
    //
    // Pass null/undefined to remove an override.
    function setNarrator(channel, fn) {
        if (typeof fn === 'function') overrides[channel] = fn;
        else delete overrides[channel];
    }

    window.Crawler = window.Crawler || {};
    window.Crawler.Narrate = {
        say: narrate,
        sayAll: narrateAll,
        registerChannel: registerChannel,
        setNarrator: setNarrator,
        BANKS: BANKS         // exposed for inspection / authoring tooling
    };
})();
