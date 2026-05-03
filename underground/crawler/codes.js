/* ============================================================
 * SHRED CRAWLER · codes.js · Phase 0
 * ============================================================
 * Code grammar: PREFIX-BODY (e.g., SCH-9301-PRIME, ARC-§37-RUNOFF).
 * Prefix → category. The full string is hashed (FNV-1a, 32-bit)
 * to derive tier and Currept-status deterministically. Players
 * cannot read tier or rot off the prefix; only the in-game effect
 * over multiple runs reveals it.
 *
 * Tier distribution favors lower tiers (most codes are tier 1,
 * very few are tier 4). Currept rate is ~40% across SCH/ARC/ESO;
 * Pack codes are NEVER Currept (per spec v0.3 §9).
 *
 * Same code string always parses identically. Sharable. The
 * deduction game (§6, §10) requires this determinism.
 *
 * No dependencies. Self-contained. Safe to load first.
 * ============================================================ */
(function () {
    'use strict';

    var CATEGORIES = {
        SCH: 'schema',
        ARC: 'archive',
        ESO: 'esoterica',
        PCK: 'pack'
    };

    var PREFIX_OF = {
        schema:    'SCH',
        archive:   'ARC',
        esoterica: 'ESO',
        pack:      'PCK'
    };

    // INT contribution by tier (spec v0.3 §6, simple scaling)
    var INT_BY_TIER = { 1: 1, 2: 2, 3: 4, 4: 7 };

    // FNV-1a 32-bit hash — fast, deterministic, no dependencies.
    function hashCode(str) {
        var h = 0x811c9dc5;
        for (var i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }

    // parseCode(raw) → null | { code, category, tier, isCurrept, intContribution }
    //
    // Returns null for missing/empty/malformed input. Otherwise returns
    // the canonical parsed object. Currept-status is included in the
    // return value but the player-facing UI must NOT display it (the
    // game shows tier and INT contribution only).
    function parseCode(raw) {
        if (!raw) return null;
        var code = String(raw).trim().toUpperCase().replace(/\s+/g, '');
        if (!code) return null;
        var m = code.match(/^(SCH|ARC|ESO|PCK)-(.+)$/);
        if (!m) return null;
        var category = CATEGORIES[m[1]];
        var h = hashCode(code);

        // Tier roll on the low byte (0-255). Distribution:
        //   tier 1 ≈ 55%   (rolls 0-139)
        //   tier 2 ≈ 27%   (rolls 140-209)
        //   tier 3 ≈ 14%   (rolls 210-244)
        //   tier 4 ≈ 4%    (rolls 245-255)
        var tierRoll = h & 0xff;
        var tier;
        if (tierRoll < 140)      tier = 1;
        else if (tierRoll < 210) tier = 2;
        else if (tierRoll < 245) tier = 3;
        else                     tier = 4;

        // Currept roll on the second byte. ~40% rate for SCH/ARC/ESO.
        // Pack is never Currept (spec v0.3 §9).
        var currRoll = (h >> 8) & 0xff;
        var isCurrept = (category !== 'pack') && (currRoll < 102);

        return {
            code: code,
            category: category,
            tier: tier,
            isCurrept: isCurrept,
            intContribution: INT_BY_TIER[tier]
        };
    }

    // computeInt(codes) → { total, perCategory: { schema, archive, esoterica, pack } }
    //
    // codes = { schema, archive, esoterica, pack } where each value is
    // a code string or null. Returns combined INT (with the +1 base for
    // both characters) and the per-category breakdown that the player
    // sees in the codes panel — this is the Currept deduction surface.
    //
    // A code in the wrong slot (e.g., ARC-... in the schema slot) is
    // ignored for INT computation. The menu UI flags it as invalid.
    function computeInt(codes) {
        var per = { schema: 0, archive: 0, esoterica: 0, pack: 0 };
        var total = 1;
        ['schema', 'archive', 'esoterica', 'pack'].forEach(function (key) {
            var raw = codes[key];
            if (!raw) return;
            var parsed = parseCode(raw);
            if (parsed && parsed.category === key) {
                per[key] = parsed.intContribution;
                total += parsed.intContribution;
            }
        });
        return { total: total, perCategory: per };
    }

    // generateExampleCode(category) → string
    //
    // Used by debug/tooling only. The game itself generates real codes
    // from grammar tables in later phases (Phase 5). This is a quick
    // way to mint a parseable string for testing the run-start menu
    // flow without authoring real drop content yet.
    function generateExampleCode(category) {
        var prefix = PREFIX_OF[category];
        if (!prefix) return null;
        var seed = Math.random().toString(36).slice(2, 6).toUpperCase();
        var words = ['PRIME','MELT','RUNOFF','ZULU','DRYDOCK','LATTICE',
                     'HARBOR','ECHO','GHOST','SHRED','FOLD','KEEL','BRINE',
                     'ITERATE','PARTRIDGE','NIGHTSHIFT','OFFLINE'];
        var word = words[Math.floor(Math.random() * words.length)];
        return prefix + '-' + seed + '-' + word;
    }

    window.Crawler = window.Crawler || {};
    window.Crawler.Codes = {
        parse: parseCode,
        computeInt: computeInt,
        generateExample: generateExampleCode,
        hash: hashCode,
        PREFIX_OF: PREFIX_OF,
        INT_BY_TIER: INT_BY_TIER
    };
})();
