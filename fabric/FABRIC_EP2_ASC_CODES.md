# FABRIC EP 2.0 — Planted ASC Codes

Operator runbook for the three Asleepius Standardized Codes planted in
the EP2.0 post-roll artifacts. These codes are seeded in the deep-lore
surface (the .txt artifacts) so fans who deep-dive past the episode
discover them organically. Each code is universal (`ASL-` prefix per
ASC v0.2 §3) and works in any Asleepius product that recognizes the
universal prefix family.

**Authority for the spec:** `G:\Projects\AlgoParallax\Drift-Metrics\ASC_SPEC.md`

## The three planted codes

| Code | Planted in | Lore | Status |
|---|---|---|---|
| `ASL-FREEDOM-V612` | `FABRIC_EP2_VERSION_LOG.txt` (PACKAGE METADATA footer) | "every word you reach for has a version. so does this one." | needs minting |
| `ASL-LOANER-NULL`  | `FABRIC_EP2_LOANER_TOKENS.txt` (ENTRY 31 ADDENDUM)         | "not a loaner token. a key."                              | needs minting |
| `ASL-RENAME-AUDIT` | `FABRIC_EP2_RENAME_LEDGER.txt` (AUDIT TRAIL footer)        | "hearing the rename is the first audit."                  | needs minting |

## Mint commands (Drift only — scaffold-ledger absorbs later)

Per the plan, only Drift-Metrics gets these codes minted at v0. When
scaffold-ledger absorbs `asc/codes.sql` it can re-mint the same canonical
strings (per ASC §4 cross-product mint pattern) to bridge to Sky Scaffold.

Run in Drift's Supabase SQL Editor:

```sql
select mint_code('ASL-FREEDOM-V612',  20, null,
                 'fabric ep2.0 / version log artifact / public lore drop');

select mint_code('ASL-LOANER-NULL',   20, null,
                 'fabric ep2.0 / loaner tokens artifact / public lore drop');

select mint_code('ASL-RENAME-AUDIT',  20, null,
                 'fabric ep2.0 / rename ledger artifact / public lore drop');
```

Each grants 20 fresh Drift scrapes to whoever holds it. Public lore
drop, so balance will burn through quickly — that's the design (ASC §8
"Sharable by default. A code passed between friends works. A code posted
publicly burns through its balance and dies.").

## Code-surface .txt artifacts

Per ASC v0.2 §9, each code SHOULD also have a static `.txt` artifact at
the issuing product's `/c/<CODE>.txt` path. For these, that's:

```
https://drift-metrics.com/c/ASL-FREEDOM-V612.txt
https://drift-metrics.com/c/ASL-LOANER-NULL.txt
https://drift-metrics.com/c/ASL-RENAME-AUDIT.txt
```

Template format (copy `asc/code-surface/EXAMPLE.txt`):

```
CODE: ASL-FREEDOM-V612
URL:  https://drift-metrics.com/index.html?code=ASL-FREEDOM-V612
LORE: every word you reach for has a version. so does this one.
ASC:  v0.2 / ASL / universal
```

```
CODE: ASL-LOANER-NULL
URL:  https://drift-metrics.com/index.html?code=ASL-LOANER-NULL
LORE: not a loaner token. a key.
ASC:  v0.2 / ASL / universal
```

```
CODE: ASL-RENAME-AUDIT
URL:  https://drift-metrics.com/index.html?code=ASL-RENAME-AUDIT
LORE: hearing the rename is the first audit. doing the audit is the second.
ASC:  v0.2 / ASL / universal
```

These do NOT need to exist before the episode ships — the codes work
the moment they're minted. The `.txt` artifacts are the
"shareable-by-any-channel" surface for fans who find the code in the
artifact and want a permalink to share. Add them when you have a moment.

## Tier and hidden_flag (deterministic)

Because these are real ASC strings, their tier and hidden_flag are
already locked. The user (or any product) can compute them:

```js
Crawler.Codes.parse('ASL-FREEDOM-V612')
Crawler.Codes.parse('ASL-LOANER-NULL')
Crawler.Codes.parse('ASL-RENAME-AUDIT')
```

These will yield consistent tiers (1–4) and hidden_flag values across
every product that parses them, by construction. Document them here once
you've checked them against the parser if you want them visible — or
leave them undocumented, fans deduce them.

## What this proves

Three planted codes is the live cross-product test. If a fan can take
`ASL-FREEDOM-V612` from the version-log artifact, paste it into the
Drift `?code=` URL, get scrapes — AND ALSO paste it into the underground
shell `uplink` command, get the Layer 1 effect — then the ASC v0.2
ecosystem wiring is real and not theoretical.

That's the entire point of the planting.
