/* ============================================================
 * SHRED CRAWLER · scheduler.js · Phase 1
 * ============================================================
 * Tick playback queue. Plays a list of events sequentially with
 * a wall-clock delay per event. Each event can apply a state
 * mutation, print a line (string or function-of-state), and
 * specify its own delay (default = TICK_MS).
 *
 * The queue supports an abort handle for future interrupts —
 * Phase 2 enemies will call abort() on the player's in-flight
 * action when they land an interrupt.
 *
 * Architectural rule: only crawler.js calls Scheduler.play().
 * Action handlers build event lists; the scheduler doesn't know
 * what an action is. Combat (Phase 2) builds shared event lists
 * by interleaving player + enemy events on the same tick number.
 *
 * No dependencies. Self-contained.
 * ============================================================ */
(function () {
    'use strict';

    var TICK_MS = 320;       // default per-event delay; tunable in §13
    var activeRun = null;    // exactly one playback at a time

    // play(events, ctx, onComplete) → abort function
    //
    // events = [{
    //   delay:   ms before this event fires (default TICK_MS)
    //   apply:   function() — state mutation, runs BEFORE line
    //   line:    string OR function() returning string (for late binding)
    //   lineCls: 'ok' | 'dim' | 'err' | 'heading' | 'ascii' | undefined
    // }, ...]
    //
    // ctx = the host terminal's output helpers (out, err, dim, ...).
    //
    // onComplete = function({ aborted: bool }) — called once after the
    // last event fires, OR immediately when abort is triggered.
    //
    // Returns an abort() function. Calling it stops further events
    // from firing and invokes onComplete with { aborted: true }.
    function play(events, ctx, onComplete) {
        if (!events || !events.length) {
            if (onComplete) setTimeout(function () { onComplete({ aborted: false }); }, 0);
            return function abort() {};
        }

        var run = { abort: false, idx: 0 };
        activeRun = run;

        function done(aborted) {
            if (activeRun === run) activeRun = null;
            if (onComplete) {
                try { onComplete({ aborted: aborted }); }
                catch (e) { console.error('[scheduler] onComplete threw:', e); }
            }
        }

        function step() {
            if (run.abort) { done(true); return; }
            if (run.idx >= events.length) { done(false); return; }

            var ev = events[run.idx++];
            var delay = (ev && typeof ev.delay === 'number') ? ev.delay : TICK_MS;

            setTimeout(function () {
                if (run.abort) { done(true); return; }

                // Apply state mutation BEFORE rendering the line so
                // line(state) can read post-mutation values (e.g.,
                // the new tick number after tick += 1).
                if (typeof ev.apply === 'function') {
                    try { ev.apply(); }
                    catch (e) { console.error('[scheduler] apply threw:', e); }
                }

                var lineText = ev.line;
                if (typeof lineText === 'function') {
                    try { lineText = lineText(); }
                    catch (e) { lineText = '[render error]'; console.error(e); }
                }

                if (lineText != null && ctx && typeof ctx.out === 'function') {
                    ctx.out(lineText, ev.lineCls);
                }

                step();
            }, delay);
        }

        step();
        return function abort() { run.abort = true; };
    }

    function setTickRate(ms) {
        if (typeof ms === 'number' && ms > 0) TICK_MS = ms;
    }
    function getTickRate() { return TICK_MS; }
    function isPlaying() { return activeRun !== null; }

    window.Crawler = window.Crawler || {};
    window.Crawler.Scheduler = {
        play: play,
        setTickRate: setTickRate,
        getTickRate: getTickRate,
        isPlaying: isPlaying
    };
})();
