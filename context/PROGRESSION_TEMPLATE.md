# SHRED CRAWLER · PROGRESSION TEMPLATE  ·  v2

> **Purpose**
> Worksheet to lock the meta-progression numbers BEFORE we touch
> code. v2 incorporates your fill-in answers and reframes §2 / §3 /
> §4 to match the corrected architecture (12 real stems as a fixed
> backbone, corrupt as branch-CHAINS off the backbone).
>
> Status: **REVISION 2 · awaiting numeric fills in §2.4, §3, §4, §5**
> Last revised: Pass 3.28 (post-confidence-scan)

---

## 1 · LOCKED VOCABULARY  ✓ (confirmed)

| term            | meaning                                                                 |
|-----------------|-------------------------------------------------------------------------|
| **SEAP**        | Schema · Esoterica · Archive · Pack. UI display order: S → E → A → P. |
| **artifact**    | A single code the player can enter into a SEAP slot.                    |
| **INT level**   | Tier 1-10. INT contribution to player stat unchanged.                   |
| **stem**        | A vertical chain of related artifacts within one SEAP type.             |
| **real stem**   | One of the 12 backbone stems. Linear chain of 10 artifacts (INT 1-10). Top artifact contributes to end-path eligibility. |
| **corrupt chain**| A 4-6 artifact dead-end branch grown off some point of a real stem. Drops only within itself. Goes nowhere — INT 10 of a corrupt chain unlocks nothing. |
| **end artifact**| A "trophy" code formed by combining 4 specific INT 10 real-stem codes (one per SEAP). Unlocks an end-game effect. |
| **run-source artifact** | The artifact whose SEAP type drove THIS run's drop type. |

---

## 2 · TARGET SCALE  · v2 reframe

### 2.1 · Real backbone (the spine of the game)

This is the **fixed** part. 120 real artifacts arranged in 12 stems.

| layer                       | count     | derivation                            |
|-----------------------------|-----------|---------------------------------------|
| SEAP types                  | 4         | S, E, A, P                            |
| Real stems per SEAP         | **3**     | (so each end-artifact can use 1-of-3) |
| Real stems total            | **12**    | 4 × 3                                 |
| INT levels per real stem    | 10        | 1-10                                  |
| Real artifacts per stem     | 10        | 1 per INT level                       |
| **Real artifacts TOTAL**    | **120**   | 12 stems × 10 INT                     |

Each real stem is a strictly LINEAR upgrade chain:
`real_INT1 → real_INT2 → real_INT3 → … → real_INT10`

There is exactly ONE real INT N+1 that can be reached from a given
real INT N artifact (its own next link in the chain).

### 2.2 · End artifacts (arbitrary 4-stem combinations)

Each end artifact is defined as a CHOICE of 4 specific real stems
(one per SEAP type). When the player has all 4 of those INT 10
artifacts equipped, they qualify for that end artifact's run.

| end artifact | required real stems (1 per SEAP) |
|--------------|----------------------------------|
| End A · Truth Bomb        | `[FILL: stem-S-?, stem-E-?, stem-A-?, stem-P-?]` |
| End B · Asset 0000        | `[FILL: stem-S-?, stem-E-?, stem-A-?, stem-P-?]` |
| End C · Flash Breaker     | `[FILL: stem-S-?, stem-E-?, stem-A-?, stem-P-?]` |
| End D · (corrupt-only secret, §8 Q8) | (defer until corruption is locked) |

> Note: with 3 stems per SEAP and 3 end artifacts, the simplest case
> is **disjoint** — each end uses a distinct stem of each SEAP type
> (so all 12 stems are exhausted across the 3 ends, no sharing).
> Alternative: ends can share stems (multi-end stems), but this means
> the same INT-10 code unlocks toward multiple ends.
>
> **[FILL: disjoint (12 unique stems, no overlap) or shared (some
> stems contribute to multiple ends)?]**

### 2.3 · Corrupt chains (the noise around the spine)

Corrupt is **NOT** a fixed grid. It's a population of chain BRANCHES
that grow off real stems. Each corrupt chain is:

- **4-6 artifacts long** (vertical INT span)
- **Self-contained** — INT N corrupt of chain X only drops INT N+1
  corrupt of the SAME chain X (or other chains via the cross-stem
  rule, see §4)
- **Anchored** — each chain has an "entry INT" (the INT level it
  branches off the backbone)
- **Dead-end** — the chain's top artifact does NOT contribute to any
  end artifact

Where chains spawn / how many: governed by the corruption ratio (§3)
and the per-stem chain count (§2.4). The total corrupt artifact
count is DERIVED from those numbers.

### 2.4 · Corrupt count knobs (FILL THESE)

The total corrupt artifact count comes from this formula:

```
total_corrupt = sum over all 12 stems of:
                  sum over INT levels 2-9 of:
                    chains_at(stem, INT) × avg_chain_length
```

The two knobs you need to set:

**Knob A — chain spawn density per INT level**
At what INT level does a NEW corrupt chain branch off the backbone?
And how many chains are introduced AT each INT level?

| INT level (entry) | new chains per stem | new chains TOTAL (×12 stems) |
|-------------------|---------------------|------------------------------|
| 1 (entry)         | `[FILL: 0]`         | `[FILL: 0]`                  |
| 2                 | `[FILL: 1]`         | `[FILL: 12]`                 |
| 3                 | `[FILL: 2]`         | `[FILL: 24]`                 |
| 4                 | `[FILL: 4]`         | `[FILL: 48]`                 |
| 5                 | `[FILL: 8]`         | `[FILL: 96]`                 |
| 6                 | `[FILL: 16]`        | `[FILL: 192]`  ← your "20:1" pinch point |
| 7                 | `[FILL: 8]`         | `[FILL: 96]`   (chains short, fewer enter here) |
| 8                 | `[FILL: 4]`         | `[FILL: 48]`                 |
| 9                 | `[FILL: 2]`         | `[FILL: 24]`                 |
| 10                | `[FILL: 0]`         | `[FILL: 0]`                  |

Numbers shown are EXAMPLES picked to peak at INT 6 (your stated
"flatten the curve to peak at INT 6, 20:1 there"). Adjust each row.

**Knob B — chain length distribution**
How many INT levels does each corrupt chain span?

| chain length (INT levels) | weight |
|---------------------------|--------|
| 4                         | `[FILL: 0.40]` |
| 5                         | `[FILL: 0.40]` |
| 6                         | `[FILL: 0.20]` |

Average chain length given those weights: **4.8 artifacts**.

### 2.5 · Total artifact count (DERIVED · for Supabase planning)

Using the example numbers above:
```
chains total      = 0+12+24+48+96+192+96+48+24+0 = 540
avg chain length  = 4.8
corrupt artifacts = 540 × 4.8 = ~2,592
real artifacts    = 120
GRAND TOTAL       = ~2,712 artifacts
```

> **You said:** "the topology I am suggesting will be significantly
> more and will make the api bottleneck much more viable"
>
> **2,712 codes ≈ 5.6× the v1 estimate.** Comfortable scale for
> Supabase. The `artifacts` table at 2.7k rows is trivial; the
> Edge Function lookup stays single-digit milliseconds.

If your real numbers in §2.4 produce >50k artifacts, we should
revisit (still works on Supabase but Edge Function compute time
matters at that scale).

---

## 3 · CORRUPTION DENSITY CURVE  · v2 (peaks at INT 6)

> Your fill-in: "growing fast so we could reduce, maybe down to 6
> as the highest with a 20:1 at INT tier 6?"

This curve governs **what kind of NEXT-TIER drop is selected** when
a real artifact rolls a successful upgrade (the rare 5% / §4.1 path).
At INT N, when the upgrade fires, this is the chance the picked
INT N+1 successor is corrupt vs the real backbone successor.

| INT level | corrupt drop chance | real drop chance | notes              |
|-----------|---------------------|------------------|--------------------|
| 1         | `[FILL: 0.40]`      | `[FILL: 0.60]`   | starter zone       |
| 2         | `[FILL: 0.55]`      | `[FILL: 0.45]`   |                    |
| 3         | `[FILL: 0.70]`      | `[FILL: 0.30]`   |                    |
| 4         | `[FILL: 0.83]`      | `[FILL: 0.17]`   |                    |
| 5         | `[FILL: 0.92]`      | `[FILL: 0.08]`   |                    |
| 6         | `[FILL: 0.95]`      | `[FILL: 0.05]`   | **20:1 anchor**    |
| 7         | `[FILL: 0.95]`      | `[FILL: 0.05]`   | plateau at 20:1    |
| 8         | `[FILL: 0.95]`      | `[FILL: 0.05]`   |                    |
| 9         | `[FILL: 0.95]`      | `[FILL: 0.05]`   |                    |
| 10        | n/a                 | n/a              | INT 10 doesn't upgrade — it's terminal |

**Confirm the plateau at INT 6+** or specify a slope past 6 (e.g.
push to 30:1 by INT 9 if you want late-game even crueler).

---

## 4 · DROP COMPOSITION  · v2

Per your spec: every run drops exactly 1 artifact.

### 4.1 · Drop SEAP type

The dropped artifact's SEAP type is rolled randomly across the
player's currently-equipped SEAP codes. (Default if no codes
equipped: random across all 4 types — `[FILL: confirm default]`.)

### 4.2 · Drop tier (INT level shift)

When the run-source artifact is at INT N, the dropped artifact's
INT level is governed by:

| outcome           | weight (REAL source) | weight (CORRUPT source) | notes                |
|-------------------|----------------------|-------------------------|----------------------|
| same INT (N)      | `[FILL: 0.45]`       | `[FILL: 0.50]`          | sideways drop        |
| INT N − 1         | `[FILL: 0.30]`       | `[FILL: 0.30]`          | step down            |
| INT N − 2         | `[FILL: 0.15]`       | `[FILL: 0.15]`          | bigger step down     |
| INT N − 3 or lower| `[FILL: 0.05]`       | `[FILL: 0.05]`          | back to early game   |
| INT N + 1 (UPGRADE)| `[FILL: 0.05]`      | `0` (corrupt cannot upgrade) | **REAL ONLY** |

When real upgrades fire, §3 decides if the picked INT N+1 is real
(continues backbone) or corrupt (starts a corrupt chain branch).

### 4.3 · Drop stem · v2 (corrected per your message)

> Your fill: "All artifacts have a chance to drop artifacts of any
> seap type that are below the artifacts INT tier that are either
> real or corrupt. Only real artifacts have a chance to trigger 1
> specific upgrade based on the chain."

So the rule is:

- Drops at SAME INT or LOWER → can be ANY stem of the dropped SEAP
  type (real or corrupt). Picked uniformly random across all stems
  of that SEAP × INT slot.
- Drops at INT N+1 (real only, 5% chance) → resolved through §3:
  - Real result → the dropped artifact is the SPECIFIC next link in
    the source artifact's own real stem chain.
  - Corrupt result → the dropped artifact is a corrupt chain entry
    at INT N+1 of any chain anchored to the same real stem.

This means the only way to advance the BACKBONE is the 5% real-real
upgrade path. Lateral / lower drops just shuffle the equip pool.

**[FILL: confirm.]** ← important, this is the central rule.

### 4.4 · Trap-fortify within corrupt  ✓ (your fill confirmed)

Same-stem same-INT bonus chance when a corrupt artifact at INT N
drops a same-INT successor:

| INT level | bonus chance |
|-----------|--------------|
| 1-3       | 0.00 (your note: limited by few fakes at low INT) |
| 4         | 0.05         |
| 5         | 0.10         |
| 6         | 0.15         |
| 7         | 0.22         |
| 8         | 0.30         |
| 9         | 0.40         |
| 10        | 0.50         |

> Note: with the new "corrupt chains terminate" rule, INT 10 corrupt
> only exists for chains that entered at INT 5-6 with length 5-6.
> The 0.50 trap-fortify at INT 10 still fires — it just produces
> ANOTHER copy of that terminal corrupt artifact.

---

## 5 · EXPECTED RUN ECONOMY  ✓ (your numbers locked)

> Your design intent: "Make it nearly impossible for a single person
> to complete the entire thing quickly. Make it last years. I expect
> people to be confronted by the difficulty and forced into
> collaboration. Should be difficult past INT 4."

| milestone                            | expected effort           |
|--------------------------------------|---------------------------|
| First real INT 1 artifact            | 1-2 runs (near-guaranteed)|
| Climb a single SEAP type to INT 3    | hours of play             |
| Climb a single SEAP type to INT 5    | days of play              |
| Climb a single SEAP type to INT 7    | weeks-months              |
| Climb a single SEAP type to INT 9    | months-years              |
| All 4 SEAP at INT 10 (one path)      | "lottery winner luck or community input" |
| Get one end artifact                 | years (single-player solo)|
| Get all three end artifacts          | `[FILL: ?]` (community-ship target?) |

### 5.1 · Run length  ✓ (your numbers)

| zone  | INT range | target length     |
|-------|-----------|-------------------|
| early | 1-3       | 10-20 min average |
| mid   | 4-6       | 15-30 min         |
| late  | 7-9       | 20-40 min         |
| end   | 10        | 20-45 min (custom rules likely) |

### 5.2 · INT ↔ run difficulty (still open)

You didn't answer: should the source artifact's INT level affect
the run's GENERATED CONTENT (more rooms, harder enemies, denser
corruption in containers), or just the drop table?

- **A. Drop table only** — runs feel similar regardless of equipped INT.
  The variability comes from random room generation. Lower
  implementation cost, simpler to tune.
- **B. Run also scales** — higher INT runs are bigger / harder /
  longer. Aligns with the §5.1 "run length grows with INT" intent.
  More implementation work but matches the difficulty arc.

**[FILL: A or B?]** Recommend **B** — your §5.1 numbers already
imply a length curve that needs B to feel earned.

---

## 6 · END-PATH STRUCTURE  ✓ (your fills locked)

### 6.1 · End A — **Truth Bomb**
- **Theme**: Accidental trigger of a dead-man-switch — release of
  blackmail files for an in-lore character.
- **End-artifact effect**: Unlocks a new playable character.
- **Lore beat**: Message dump — "Meptean files." Fictional document
  release with information on galactic and corporate leaders of the
  Milky Way. Discovery of an entire planet kept hidden from the
  public, plus a named list.
- **Required stems**: `[FILL: stem-S-?, stem-E-?, stem-A-?, stem-P-?]`

### 6.2 · End B — **Asset 0000 Journal**
- **Theme**: Secret journal of a rogue AI living entirely in
  cyber/latent space.
- **End-artifact effect**: New game mode — a "simulation" with
  cyber enemies in cyber space (designed in a later pass).
- **Lore beat**: Alien agent floating like a ghost in the machine,
  willing to help — or maybe exploit.
- **Required stems**: `[FILL: stem-S-?, stem-E-?, stem-A-?, stem-P-?]`

### 6.3 · End C — **Flash Breaker**
- **Theme**: A code that could be the key to reversing the breaker
  virus.
- **End-artifact effect**: Lore dump for now. Later, an addon /
  card-battle game where the "fix" gives players control of the
  Breakers.
- **Lore beat**: Build out later.
- **Required stems**: `[FILL: stem-S-?, stem-E-?, stem-A-?, stem-P-?]`

### 6.4 · Corrupt grouping  ✓ (skipped per your fill)

Per-chain lore is assigned individually (not grouped). Each corrupt
chain gets its own lore beats authored when the chain is defined.

---

## 7 · LORE BEATS  ✓ (your fills locked)

- **Delivery channels**: A + B + C (all three).
  - A: One-line whisper when artifact is slotted into a SEAP slot.
  - B: Hand-off line at end-of-run drop.
  - C: Per-room flavor injection (1 in N rooms during the next run).
- **Authoring level**: `[FILL: pick — recommend per-stem with INT modifier]`
  - per-artifact (480+ lines, highest fidelity, heavy lift)
  - **per-stem with INT modifier** (~120 stem lines × INT modifier
    = 1,200 distinct line generations; templatized)
  - per-stem fragmenting line (~144 lines, lowest authoring cost)

  At our new ~2,700-artifact scale, per-artifact authoring is
  unrealistic. Per-stem with INT modifier is the practical floor.

---

## 8 · OPEN QUESTIONS  ·  status

1. **Variant interpretation** — ✓ resolved by §2 v2 reframe. (12
   real stems = backbone, corrupt is chain-branches.)
2. **Cross-stem drops within real** — ✓ "Yes, random" (your fill).
   Codified in §4.3.
3. **Corrupt identity reveal** — `[FILL: still unanswered. default
   is identical-to-real (no marker, learn through play). confirm or
   override.]`
4. **Default SEAP when no codes equipped** — `[FILL: still
   unanswered. default is random across all 4. confirm or override.]`
5. **End-artifact persistence** — ✓ "Yes, hold off until corruption /
   progression / end features are worked out." Implementation: Pass
   3.30 or later.
6. **Sharing economy** — ✓ default (codes are shareable strings).
7. **Run-source artifact selection** — ✓ default (whichever SEAP
   slot the random roll picks).
8. **Corrupt-only end path** — ✓ noted, defer until corruption is
   locked. Will need a 4th end artifact slot in §6 once added.

---

## 9 · IMPLEMENTATION PHASING

### Pass 3.29 — Progression v0 (LOCAL stub data)
Ships:
- SEAP rename in UI + storage (Schema/Esoterica/Archive/Pack order
  enforced everywhere).
- `progression.js` module with §3 / §4 / §5 constants.
- `artifacts.js` module with code-shape generator (8-char codes).
- `drops.js` end-of-run drop roll using stub artifact data.
- Per-stem lore beat one-liner system (placeholder lines for now).
- Basic end-artifact unlock screen (gated on equipped INT 10s).
- Generates a STUB local artifact dataset so the loop is fully
  playable while Supabase is being provisioned.

### Pass 3.30 — Supabase wiring
Ships:
- Supabase project provisioned (you do this once §2.4 + §3 + §4
  are filled).
- `artifacts` table populated from a one-time generation script that
  runs §2 + §2.4 to produce all real artifacts and corrupt chains.
- Edge Functions: `validate_artifact`, `roll_drop`, `seed_run`.
- `crawler/api.js` thin wrapper module.
- All client calls swap from local stub to Edge Function calls.
- No game-side logic changes from Pass 3.29 — only data source.

### Pass 3.31+ — content authoring
Ships:
- Per-stem lore lines authored for all 12 real stems.
- Per-corrupt-chain lore (one-liner per chain).
- End-artifact unlock screens / payoffs.

---

## 10 · ENCRYPTION & STORAGE  ✓ (A.1 confirmed)

Going with **A.1 — Supabase + server-side validation**.

### When to provision the Supabase project

**Wait until §2.4 + §3 + §4 are fully filled in.** Reasons:

1. The `artifacts` table schema depends on what fields chains carry
   (chain length, anchor stem, anchor INT, etc).
2. The `roll_drop` Edge Function logic depends on §3 / §4 numbers
   being final — those numbers are baked into the function body.
3. The total artifact count (currently ~2,700 example) drives table
   sizing decisions (single table vs partitioned).
4. Pass 3.29 ships fine on stub data — no blocker.

**Trigger to provision**: when this template's "QUICK FILL CHECKLIST"
(§11) reaches 100%. I'll prompt you then with:
- exact schema DDL to run
- the Edge Functions code to deploy
- the one-time `seed_artifacts` script to populate the table
- the Supabase env-var keys to add to your client bundle

Until then: don't create the project (avoids you having a stale
schema sitting around).

### Hybrid option (your call still)

A.1 for code lookup + A.2 (encrypted local JSON) for LORE BEATS so
lore is offline-readable. Adds complexity but reduces Edge Function
calls per run. **[FILL: yes / no?]**

Recommendation: **NO** for v0. Keep everything in Supabase initially.
If lore latency becomes a UX problem, revisit in Pass 3.32.

---

## 11 · QUICK FILL CHECKLIST  ·  v2 status

- [x] §1 vocabulary — confirmed
- [x] §2.1 real backbone — locked (12 stems × 10 INT = 120)
- [x] §2.2 end-artifact stem assignment per end — `[FILL: pick disjoint or shared]`
- [ ] §2.4 chain spawn density per INT level — **8 rows to fill**
- [ ] §2.4 chain length distribution — 3 weights to fill
- [ ] §3 corruption curve — 9 rows to confirm or adjust
- [ ] §4.1 default SEAP rule — confirm
- [ ] §4.2 INT shift weights — 5 weights × 2 (real / corrupt) = 10 cells
- [ ] §4.3 stem rule — confirm (central rule)
- [x] §4.4 trap-fortify curve — confirmed
- [x] §5 run-economy targets — confirmed
- [x] §5.1 run lengths — confirmed
- [ ] §5.2 INT ↔ run difficulty (A or B)
- [ ] §6.1-6.3 required stems per end (3 × 4 stem assignments)
- [x] §6.4 corrupt grouping — skipped (per-chain lore individually)
- [x] §7 lore delivery — A+B+C
- [ ] §7.1 lore authoring level — pick one
- [ ] §8 Q3 corrupt identity reveal — confirm default
- [ ] §8 Q4 default SEAP type — confirm default
- [ ] §10 hybrid lore-data option — confirm "no" or override

---

## APPENDIX · CONCEPTUAL DIAGRAM (text)

```
                    REAL BACKBONE                       CORRUPT CHAINS
                    ─────────────                       ──────────────

Stem S-1 ── INT 1 ─ INT 2 ─ INT 3 ─ INT 4 ─ INT 5 ─ INT 6 ─ … ─ INT 10
                              │             │           │
                              ▼             ▼           ▼
                       chain x1       chain x4    chain x16
                       (length 4-6)    (length 4-6) (length 4-6)
                       all dead-end    all dead-end  all dead-end

Stem S-2 ── INT 1 ─ INT 2 ─ INT 3 ─ INT 4 ─ … ─ INT 10
              (similar branching)

… 12 stems total, each branches independently ─ corrupt chains do not
cross stems, do not contribute to end artifacts, only drop within
themselves (or laterally per §4.3).

   end_artifact_A  =  S-1 INT10  +  E-2 INT10  +  A-1 INT10  +  P-3 INT10
   end_artifact_B  =  S-2 INT10  +  E-1 INT10  +  A-3 INT10  +  P-1 INT10
   end_artifact_C  =  S-3 INT10  +  E-3 INT10  +  A-2 INT10  +  P-2 INT10
                       (specific assignments TBD by you in §6)
```

---

*end · v2 · please mark up directly. ping when §2.4 + §3 + §4 are
filled and I'll trigger the Supabase provisioning checklist.*
