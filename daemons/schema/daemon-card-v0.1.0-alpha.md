# Daemon Card Schema · v0.1.0-alpha

> A portable persona-card format for AI-narrative storytelling.
> Published by **Asleepius Games**.
> Status: **alpha**. Forward-compatible. Older versions remain valid forever.

---

## What is a Daemon Card?

A **Daemon Card** is a JSON file describing a single persona — its intent,
personality, history, strengths, weaknesses, voice, and a bank of voiced
sample lines. It is designed to be **portable across mediums**:

- Drop it into a video game and let an in-engine narrative system consume it.
- Drop it into a website and let the site speak in that persona's voice.
- Drop the `ai_chat_prompt` field into any LLM chat (ChatGPT, Claude, Gemini,
  local models) to instantly summon the persona.
- Embed the capsule on a social post, a Steam page, or a portfolio.

Daemons are **persona-first**. They do not contain plots. They contain
identities. The storytelling emerges as the persona responds to inputs.
This is the architectural opposite of plot-first AI writing tools.

---

## Versioning policy

### Schema version

The `schemaVersion` field stamps the card with the format it was authored
against. The current version is `v0.1.0-alpha`.

A runtime that supports `v0.1.0-alpha` MUST accept any card stamped with
`v0.1.x-alpha`. Future schema versions will document compatibility
explicitly. **Older cards never become invalid.** If you author a card today
under `v0.1.0-alpha`, it will continue to work in any future runtime that
respects this contract.

### Card version

The `version` field is the persona's own semver. When you revise a persona,
ship a new card file with an incremented version. **Do not overwrite** the
old file. Users may prefer the version they first encountered.

By convention, persona files are addressed as
`/daemons/cards/<id>@<version>.daemon.json` for explicit versioning, or
`/daemons/cards/<id>.daemon.json` for the latest. Both forms are valid.

### Deprecation

A card MAY set `metadata.deprecated: true` and optionally point at a newer
card via `metadata.supersededBy: "<id>@<version>"`. **Deprecation does not
remove the card**; it advises new consumers to prefer the newer version.

---

## Required fields

| Field                       | Type    | Notes |
|----------------------------|---------|-------|
| `$schema`                   | string  | URL of the schema this card was authored against. |
| `schemaVersion`             | string  | e.g. `"v0.1.0-alpha"`. |
| `kind`                      | string  | Must be `"daemon-card"`. |
| `id`                        | string  | Stable, kebab-case persona ID (e.g. `"chad-vibington-iii"`). |
| `version`                   | string  | Persona semver (e.g. `"1.0.0"`). |
| `name`                      | string  | Display name. |
| `publisher`                 | string  | Human-readable publisher (e.g. `"Asleepius Games"`). |
| `publisherId`               | string  | Stable kebab-case publisher ID. |
| `license`                   | object  | `{ name, url, summary }`. |
| `capsule`                   | object  | Display surface — `title`, `subtitle`, `summary`, `tags`, `art`. |
| `persona`                   | object  | The persona definition (see below). |
| `voice_bank`                | object  | Pools of pre-written voiced lines, keyed by event/state. |
| `ai_chat_prompt`            | string  | A complete drop-in system prompt for any LLM chat. |
| `compatibility`             | object  | `{ products[], minRuntime, preferredRuntime }`. |
| `metadata`                  | object  | `{ createdAt, lastModified, deprecated, supersededBy?, notes }`. |

## The `persona` block

```jsonc
{
  "intent":            "single-line statement of what the persona is trying to do",
  "personality":       "two-to-five-sentence character sketch",
  "history":           "the persona's relevant past, in prose",
  "strengths":         ["array", "of", "strings"],
  "weaknesses":        ["array", "of", "strings"],
  "tone_keywords":     ["3-7 keywords describing voice"],
  "vocabulary":        ["words this persona reaches for"],
  "catchphrases":      ["phrases this persona repeats"],
  "forbidden_topics":  ["topic — handling instruction"],
  "speaking_style":    "one-line summary of how they speak"
}
```

## The `voice_bank` block

```jsonc
{
  "current_state":  ["short status lines used by activity widgets"],
  "quotes":         ["full sentences in this persona's voice"],
  "on_<event>":     ["lines used when <event> happens (e.g. on_cancel, on_purchase)"]
}
```

`current_state` is reserved. Other event keys are persona-specific. The
runtime MUST gracefully return `null` (or fall through to a fallback) when a
requested event key is missing, so consumers can experiment freely.

## The `ai_chat_prompt` field

A single string designed to be pasted directly into any LLM chat as a system
prompt. The runtime exposes this verbatim via `Daemons.copyPrompt(id)`.
Authors SHOULD include:

1. A clear opening (`You are <Name>, ...`).
2. The persona block in human-readable form.
3. Voice / vocabulary guidance.
4. Forbidden topics with handling instructions.
5. Sample lines (3-5).
6. Stay-in-character instructions.
7. Attribution + version footer.

## License

Cards are published under the **Daemon Card License v1 (alpha)**:

- Free use, including commercial.
- Attribution required: include the publisher name and the card ID/version.
- Modifications: ship as a new card file with a new ID or new version.
  Do not retroactively edit a published version.
- The license travels with the card; do not remove the `license` block.

See `/daemons/LICENSE-v1.md` for full text.

---

## Minimal example

```json
{
  "$schema": "https://vibratur.vip/daemons/schema/daemon-card-v0.1.0-alpha.json",
  "schemaVersion": "v0.1.0-alpha",
  "kind": "daemon-card",
  "id": "example-persona",
  "version": "1.0.0",
  "name": "Example Persona",
  "publisher": "Asleepius Games",
  "publisherId": "asleepius-games",
  "license": {
    "name": "Daemon Card License v1 (alpha)",
    "url": "https://vibratur.vip/daemons/LICENSE-v1.md",
    "summary": "Free use with attribution."
  },
  "capsule": {
    "title": "Example Persona",
    "subtitle": "A demo daemon",
    "summary": "A minimal example for illustrating the schema.",
    "tags": ["example"],
    "art": { "icon": "🌀", "color": "#888888", "colorAccent": "#ffffff" }
  },
  "persona": {
    "intent": "demonstrate the schema",
    "personality": "neutral, helpful, brief",
    "history": "created on 2026-05-01 as a schema example",
    "strengths": ["clarity"],
    "weaknesses": ["depth"],
    "tone_keywords": ["neutral"],
    "vocabulary": ["example", "demonstration"],
    "catchphrases": ["for example"],
    "forbidden_topics": [],
    "speaking_style": "short and clear"
  },
  "voice_bank": {
    "current_state": ["existing as an example"],
    "quotes": ["This is an example. For example."]
  },
  "ai_chat_prompt": "You are Example Persona, a minimal demo daemon. Speak briefly and neutrally.",
  "compatibility": {
    "products": ["any"],
    "minRuntime": "0.1.0-alpha",
    "preferredRuntime": "0.1.0-alpha"
  },
  "metadata": {
    "createdAt": "2026-05-01",
    "lastModified": "2026-05-01",
    "deprecated": false,
    "notes": "Example only."
  }
}
```

---

## Design philosophy

The schema is intentionally human-authored and human-readable. **Do not
generate Daemon Cards with LLMs without curation.** The point of the format
is that the persona is a stable, deliberate artifact. Generated personas
drift; authored personas hold their voice across years.

Daemon Cards are persona-first storytelling primitives. The plot is whatever
the persona does in the situation. The situation is whatever the consuming
product gives it.

— Asleepius Games · Daemon Cards · alpha
