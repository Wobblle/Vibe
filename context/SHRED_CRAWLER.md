# THE SHRED CRAWLER · v0.3 (canonical spec)

> Status: planning complete. Ready for Phase 0 build pending green-light.
> Spec history: v0.1 (initial brainstorm) → v0.2 (Brox/Drakey/Torred/factions/Pack) → v0.3 (INT softened, role correction, doors probabilistic, this file).

A text-based dungeon crawler hidden inside the underground terminal at `/underground.html`. Reached only by completing the Shred Chain (Pass 3.17). Not advertised. No save state. Volatility is the gameplay.

The crawler is launched via a terminal command (proposed: `crawl`, alias `run`). When in-game, the terminal is in **game mode** — same prompt, different parser. `exit` returns to the shell. Closing the page or refreshing ends the run with a "signal disconnected" cut.

---

## 1 · CHARACTERS (in-field, playable)

| | **Drakey** (gadget specialist) | **Torred** (brute) |
|---|---|---|
| HP | 80 | 80 |
| Energy | 200 | 200 |
| Autonode | 40 | 40 |
| Range | **10** | 4 |
| Melee | 3 | **8** |
| INT | 1 (grows from codes) | 1 (grows from codes) |

Drakey is the field gadget operator (tools, scanning, range). Torred is the heavy (close, attrition). Both have one ranged slot + one close slot for weapons.

Sky Scaffold–style but explicitly **not canon**.

---

## 2 · BROX — comms, not playable

The persistent voice on the wire. Player is "on the comms" with Brox regardless of which character they pick. Brox is the actual hacker; Drakey/Torred are the bodies in the field.

Brox is **deep lore in canon — keep mysterious**. Do not over-explain. He briefs the run, narrates scan results, drops flavor as the player moves, signs off when the goal box is opened.

Brox already has a Daemon Card (`brox.daemon.json`). For v0 his lines come from a hardcoded bank in his register. For future passes, Brox can be hot-swapped to a daemon-driven generator via the `narrate()` chokepoint (see §19).

---

## 3 · FACTIONS

Each run takes place inside a single faction's compound. Same characteristics per-faction for v0; per-faction variability is a future pass.

| Faction | Flavor | Compound character |
|---|---|---|
| **Chorus** | Early history. Industrialists. Blue-collar. Strong internal moral code. | Forged-iron, methodical, defensive |
| **Portsman** | New cult. Fanatics worshipping a real-but-unknown alien race they have never met. | Ritual layout, silence, false floors |
| **Breakers** | Hivemind. Hosts whose minds are trapped inside their own bodies, watching themselves act under viral mind-control augments. No leaders. | Wet, twitching, no logic, terrifying |
| **HIGI** | Megacorp on the rise to majority Milky Way control. Compounds run from soft (mining) to hard (army). | Sterile, monitored, scaling difficulty |

Player belongs to **no faction**. Freelance, working with Brox to dismantle and invade compounds. No team name (doesn't fit register).

---

## 4 · ENEMIES

5 grades, applied across all factions with the same multiplier ladder. Specialists are placeholders for v0 (`Specialist A` / `Specialist B`); name them per-faction in a future pass.

| Grade | Stat multiplier | Notes |
|---|---|---|
| Grunt | 1.0× | Numbers |
| Officer | 1.6× | Coordinates posture, longer response window |
| Captain | 2.4× | Resists interrupts |
| Specialist A | 2.0× (+special) | Faction-flavored behavior |
| Specialist B | 2.0× (+special) | Faction-flavored behavior |

In-game they read as `breaker grunt`, `portsman officer`, `higi captain`, `chorus specialist A`, etc.

---

## 5 · STATS

| Stat | Effect |
|---|---|
| **HP** | 0 = signal disconnected. Death is glitch-and-reset, no warning. |
| **Energy** | Drains per tick. **0 = caught with your pants down** (no actions, full vulnerability). Drinks/food restore. **Rest action**: 10 ticks, vulnerable, +20–30 energy. |
| **Autonode** | Mana for hack actions: scans, digital-door breaks, future drones/gadgets. Restored only by **ambient pickups** (`+3 autonode · exochip found`). |
| **Range** | Damage-per-tick on ranged shots. |
| **Melee** | Damage on the damage-tick of close swings. |
| **INT** | Soft signal. Drives dungeon scale + tool success chance. Per-category breakdown visible to player (the deduction tool for spotting Currept). See §6. |

---

## 6 · INT — the feedback loop

INT is **not** a hard gate. It is the player's main visible signal of progression.

### What INT does
- **Dungeon generator** reads combined INT to scale **size, complexity, difficulty**.
- **Tool success chance** is multiplied by an INT-derived multiplier (see §8).
- **Reward artifacts** (drop quality) are based on the *codes the player is using*, not directly on INT — but INT moves with the same codes, so they trend together.

### How INT is built
- INT starts at 1 for both characters.
- Each code in an active slot contributes an INT value based on its tier.
- Combined INT = sum of all 4 slot contributions (one per benign category).
- Per-category contribution is **visible to the player** in the codes panel — this is the Currept detection surface.

Proposed scaling (validate later):

| Code tier | INT contribution |
|---|---|
| Tier 1 | +1 |
| Tier 2 | +2 |
| Tier 3 | +4 |
| Tier 4 | +7 |

### The deduction game
A Currept code in a slot:
- Functions identically on entry (same INT bonus, same nominal effect)
- But during the run, drops in that category have **0% upgrade chance**

Result: a player who runs the same code combination across multiple runs will see three of their four category tiers trend up over time, and one stay flat. The flat one is rotten. They drop it, try a different code, and watch again.

**No panel announces "this is Currept."** The player figures it out by reading the per-category INT trend in their own notebook.

---

## 7 · ITEMS

### Consumables (single-use)
| Item | Effect |
|---|---|
| Fizza | Quick energy |
| Corpo Cola | Hydration · energy regen rate ↑ for N ticks (TBD) |
| Pizza | Small HP |
| Bandage | More HP |
| Stimjection | Large HP |

### Tools (multi-use, can break on lock fail)
| Tool | Used for |
|---|---|
| Prybar | Physical doors, chest force |
| Lockpick | Mechanical locks |
| Crypt Breaker Key | Digital door locks |

### Weapons
- One ranged slot + one close slot per character.
- Weapon-specific tick costs and base damage (TBD per weapon).

### Default loadout (no Pack code)
- 1× basic weapon (TBD: melee or character-aligned, currently flagged "basic for now")
- 1× bandage

---

## 8 · DOORS & LOCKS (probabilistic, no hard gates)

Each door has:
- A primary **lock type**: physical (prybar) / mechanical (lockpick) / digital (cryptkey)
- A **base success chance** (per-door, scales with Archive tier — easier doors closer to spawn, harder near the goal box)

When the player uses a tool on the door:

```
success = clamp( base × intMultiplier, 0, 0.95 )
where intMultiplier = 1 + (combinedINT / 20)        // tunable
```

- **On success**: door opens, tool consumed = no
- **On fail**: tool consumed = yes (it breaks), and the **door freezes** — that door is permanently impassable for the rest of the run

This creates real resource pressure. A failed pick on a hallway door costs you the lockpick you needed for the goal-box-adjacent chest. Plan accordingly. Brox might say something.

---

## 9 · CODES — five categories

The player has **four code slots** (one per benign category), set at run start. Slots persist across runs in-session and only reset on browser refresh. A fifth category exists but no player-facing slot — it's the silent corruption layer (see §10).

| Slot | Category | Function |
|---|---|---|
| 1 | **Schema** | Stat modifiers + occasional bonus item. Tier scales INT. |
| 2 | **Archive** | Difficulty + grid size + drop tier ceiling. Tier scales INT. |
| 3 | **Esoterica** | Gameplay weirdness modifier (variety later). Tier scales INT. |
| 4 | **Pack** | Starting inventory. Includes **challenge packs** (sword-only, no bandage, etc.). Tier scales INT. **No Currept variant.** |
| — | **Currept** | Hidden. Mimics Schema/Archive/Esoterica grammar. Same INT bonus on entry. **0% drop upgrade chance** for its category for the run. |

### Code grammar
- String, prefix matches the slot the code goes into (`SCH-`, `ARC-`, `ESO-`, `PCK-`)
- Currept codes wear the prefix of whichever category they masquerade as
- **Tier and Currept-status are encoded by deterministic hash** of the string — the player can't tell tier or rot from the prefix
- Same exact code always produces the same effect (sharable between players)

### Drop upgrade chances (validated baseline)
- Legit codes: ~25–40% chance per drop to upgrade tier in their own category
- Currept codes: 0%

---

## 10 · CURREPT — the funnel (proposed baseline)

Currept rates by drop tier. This is the bottleneck for late-game progression — the higher the tier you push for, the more rotten the drops become. Only revealed through deduction over many runs.

| Drop tier | % Currept |
|---|---|
| Tier 1 (early) | 30% |
| Tier 2 | 50% |
| Tier 3 | 65% |
| Tier 4 (late) | 80% |

Currept never appears in Pack drops.

---

## 11 · GOAL BOX

- One per run.
- Placed anywhere on the grid by the generator.
- **Surrounding rooms** have heavier security (more enemies, harder doors).
- Requires multiple tools to open (combination scales with Archive tier).
- Drops **1–2 codes** + a reward message in Brox's voice.
- Opening the box ends the run.

---

## 12 · ROOMS & GRID

- Run generates a grid of rooms.
- Grid size + complexity scale with combined INT (via Archive tier seed + INT multiplier).
- Each room is a square with up to 4 door positions (N/S/E/W). Mix of dead ends, 3-ways, all-4s.
- **No map.** Player remembers their location or doesn't.
- Visual: text + simple symbols. Compact rendering above the option list.

Sample sketch (to be tightened in build):

```
┌── ── ── ──┐
│           │
        ▣      ← container
│   @       │  ← player
│           │
└── ┬─ ── ──┘
    ↓ S
```

---

## 13 · TICK SYSTEM

Two states, alternating:

### State A · Static
- Player sees the room, sees an option list (room contents + movement + inventory + scan + comms).
- Player picks one. Game pauses while they choose.

### State B · Tick playback
- Selected action plays out tick-by-tick, one event per line, scrolling.
- Other events (enemy attacks, sounds, comms chatter, item effects) interleave in the same stream.
- Interrupts can cancel mid-action.

Every input has a **tick cost**. Baseline (validated, tunable):

| Action | Tick cost |
|---|---|
| Move room (blind) | 1 |
| Move room (already monitored) | 2 |
| Bandage | 3 |
| Stimjection | 5 |
| Scan (INT-modified, indeterminate) | 2–6 |
| Ranged attack (per shot) | 1–2 |
| Melee swing | 4 ticks total, **damage on tick 3** |
| Rest | 10 (vulnerable) |
| Use tool on door | per-door (TBD) |

Sample playback for a 3-tick bandage with an interrupt:

```
[t1] use bandage  +5hp
[t2] use bandage  +5hp · sound from the left (close)
[t3] use bandage  +5hp · 14hp restored
```

---

## 14 · COMBAT

**Power offset 6:1 in player's favor at start, scaling toward 1:1 at end-game (rare).** The game tries to drain you out, not strike you down.

### No spatial distance — posture-based
Two stances per attacker:

- **Ranged** — fewer ticks per shot, lower damage per shot, **damage applies per tick**. Cooldown starts instantly on enemy ranged attacks.
- **Close** — slower (e.g., 4 ticks), **damage only on the damage tick** (e.g., tick 3). Interrupted on tick 2 = no damage. Cooldown starts on the damage tick.

Both player and enemy attacks resolve **on the same turn** — the tick stream is shared.

### Blindness matrix (the speed-vs-awareness lever)
| You | Them | First strike |
|---|---|---|
| monitored | blind | you, free |
| blind | monitored | them, free (you eat damage during your response time) |
| monitored | monitored | resolves by stat / weapon |
| blind | blind | first to act wins initiative |

### Response time
- Both player and enemy have a tick response window
- For close attacks: response window starts on the **damage tick**
- For ranged: response window starts **instantly** (so ranged is faster but lower DPS)
- During response window, the targeted entity eats incoming damage with no available action

---

## 15 · SCAN

Ticks-cost is indeterminate (`2–6`), reduces variance with INT but never to zero. Two failure modes:

- **No signal** — wasted ticks, no info.
- **Silent alert** — *you* come in blind, *enemies* now have you monitored. Worst-case posture.

Brox's voice carries scan results. Failed scans get a tonal Brox line.

---

## 16 · POWER CURVE

- 6:1 player advantage at run start
- Scales toward 1:1 at end-game (rare to reach, by design)
- Scaling lever = Archive tier, applied to enemy grade multipliers + grid size + goal-box security

---

## 17 · DEATH

No countdown, no farewell. Signal cuts. Brief glitch overlay. "**signal disconnected**" line. Forced restart with defaults. The volatility *is* the gameplay.

---

## 18 · TONE

**Hardcore, mean, unfriendly, arguably fair.** Where this conflicts with anything else in the spec, this wins. Iterate per pass.

---

## 19 · ARCHITECTURE — the AI-daemon escape hatch

Locked architectural rule, even at v0:

**Every line of generated text** in the crawler — Brox's comms, room descriptions, enemy reads, scan results, death messages, drop reward text — passes through one function:

```js
narrate(channel, context) => string
```

- `channel` = `'brox.comms' | 'room.desc' | 'enemy.read' | 'scan.result' | 'death' | 'drop.reward' | ...`
- `context` = the run state slice that line needs (player, room, enemy, code-derived seed, etc.)

For v0 it dispatches to a hardcoded bank per channel. For a future pass it dispatches to a **DaemonNarrator adapter** that takes a Daemon Card (Brox's already exists) and produces output in that persona — same signature, different implementation. Swappable per channel.

No other module touches text generation. No `if-else` strings scattered through combat code. This is the only chokepoint we lock as architectural.

### Other architectural notes
- **Run state is a single object** passed to every system. Easy to seed deterministically from codes. Easy to serialize for daemon-context generation.
- **Tick scheduler is a single queue** with one wall-clock interval (~150ms/tick proposed, tunable). Future daemon calls can be async — the queue can pause for a narration promise and resume.
- **Inventory + room + enemy + door + tool systems** are pure data. UI rendering is a separate layer reading from them.
- **Random run gen is seeded by entered codes** — same code combination always produces the same dungeon. Sharable. Reproducible bug reports.
- **Mode state machine**: `mode = 'shell' | 'crawler-static' | 'crawler-tick' | 'crawler-dead'`.

### File layout (proposed)
```
underground/
  crawler.js           — main game module, lazy-loaded by underground.html
  crawler/
    state.js           — run state shape + seeding from codes
    narrate.js         — narrate() chokepoint + v0 hardcoded banks
    rooms.js           — grid generation, room rendering, navigation
    combat.js          — tick scheduler, posture, blindness, response
    items.js           — inventory, consumables, tools
    doors.js           — probabilistic locks, tool break
    codes.js           — code parsing, tier/currept hash, INT computation
    enemies.js         — grade ladder × faction
    factions.js        — faction tables
underground.html       — host page, wires `crawl` command
```

---

## 20 · BUILD PHASES

### Phase 0 · Foundations (the chokepoint pass)
- `narrate()` interface + the bank-dispatch implementation for v0
- Run state object shape
- Code parser + deterministic tier/Currept hash
- Mode state machine on the terminal
- `crawl` command stub that opens the run-start screen

### Phase 1 · Static loop, single room, no enemies
- Pick character → enter codes → see one room → option list → tick playback → next options
- Inventory (default loadout only), bandage works, energy ticks
- Movement to a "next room" stub
- Validates the loop feels right before any combat

### Phase 2 · Combat — one ranged enemy + one close enemy
- Tick stream with shared resolution
- Posture, blindness, response time
- Death = glitch out

### Phase 3 · Multi-room grid + memory burden
- Generation, rendering, navigation, no map
- Doors with probabilistic locks + tool break

### Phase 4 · Inventory expansion + chests + tools + traps
- Multi-tool chest gating
- Trap chests (damage / enemy spawn)

### Phase 5 · Codes + document drops
- SCH/ARC/ESO/PCK grammar locked in
- Goal box drops 1–2 codes
- INT decomposition surface in codes panel

### Phase 6 · Currept layer
- Hash-based silent corruption
- Drop tier ceiling enforcement
- Per-category INT trend visibility

### Phase 7 · Brox's voice (v0 hardcoded bank)
- Comms briefs, scan responses, asks, sign-offs, tonal failures

### Phase 8 · Esoterica variety
- Actual gameplay modifiers (a rotating set, expandable later)

### Phase 9 · Polish
- Visual symbol set, audio stings on ticks, room rendering refinement, ASCII flourish

---

## 21 · OPEN ITEMS (small, can be answered during build)

- Specialist names per faction (placeholder OK for v0)
- Specific weapon list (basic for v0; expand in a later pass)
- Esoterica modifier list (variety later)
- Per-faction compound variability (same for v0)
- Code prefix display — show the prefix on the entered code in the codes panel? Or hide it for cleaner deduction? (My instinct: show it, since the prefix is real for legit codes; the deduction is about tier, not category.)
- INT contribution display — total only, or per-category breakdown surfaced? (Spec says per-category. Confirm: visible all the time, or only after entering a code?)
- Tick rate — 150ms/tick proposed. Adjustable, but probably needs to feel "alive" enough that interrupt drama lands.

---

## 22 · WHAT THIS IS NOT

- Not a roguelike with persistent meta-progression. Codes are the only persistence and they live in the player's notebook, not in any save file.
- Not a story-driven game. Brox is the narrative engine; the story is what he says about what's happening.
- Not advertised on any visible Vibratur surface. The crawler is reached only by the underground; the underground is reached only by the Shred Chain.
- Not balanced for "fairness" in the conventional sense. Hardcore, mean, unfriendly, arguably fair. Volatility is the gameplay.

---

*Spec v0.3 · Asleepius Games · Pass 3.18 (planning)*
