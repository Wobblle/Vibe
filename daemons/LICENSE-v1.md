# Daemon Card License v1 (alpha)

> Published by **Asleepius Games**.
> Status: **alpha**. Subject to clarification, not revocation.

This license governs the use of any JSON file authored against the
**Daemon Card** schema (`v0.1.x-alpha`) and published with this license
block attached.

## Permissions

You MAY:

- **Use** the Daemon Card in any product, including commercial products.
- **Distribute** the Daemon Card unmodified, alongside your product.
- **Embed** the Daemon Card in software, websites, games, social media,
  printed media, livestreams, audio recordings, and any other medium
  that supports the conveyance of text.
- **Quote** voiced lines from the `voice_bank` in your own work.
- **Reference** the persona in your product's lore.
- **Drop** the `ai_chat_prompt` field into any third-party LLM chat
  interface (ChatGPT, Claude, Gemini, local models, etc.) without
  separate permission.

## Conditions

You MUST:

- **Attribute** the publisher (`publisher` field) and the persona
  (`name`, `id`, and `version`) wherever the persona appears as a
  named entity. Attribution may be brief — e.g. *"Chad Vibington III ·
  Daemon Card v1.0.0 by Asleepius Games"*.
- **Preserve** the `license` block in any redistribution of the JSON
  file itself.
- **Ship modifications as a new card.** If you change the persona's
  intent, voice, or biography, give it a new `id` (or, if the change
  is a minor refinement and you have authoring rights, a new `version`
  number). **Do not republish a modified persona under the same
  `id` and `version`** — that would silently change a persona other
  consumers rely on.

## Restrictions

You MUST NOT:

- Misrepresent your modifications as the original persona.
- Use the persona to issue statements that the original publisher
  could not reasonably be expected to endorse — e.g. statements
  attributing real-world political positions, real-world endorsements,
  or real-world threats to the persona's publisher.
- Use the persona to harass real individuals.
- Strip the `license` block from the JSON file.
- Sell the Daemon Card itself as a standalone product. (You may
  charge for a product that *contains* the Daemon Card.)

## On future versions

This is the **alpha** license, version 1. It may be clarified in
future revisions. **Cards published under v1 (alpha) remain governed
by v1 (alpha) forever.** Future revisions apply only to cards
published under those revisions.

## On AI training

You MAY use Daemon Cards in any prompt sent to a model. You MAY NOT
include Daemon Cards in a training corpus for the purpose of
producing a derivative model that performs the persona absent the
attribution required above.

This is consistent with the broader stance of Asleepius Games: we
publish Daemon Cards openly because we believe persona-first
storytelling is the next medium. We expect attribution, not
exclusivity.

## On warranty

Daemon Cards are provided **AS IS**, without warranty of any kind.
Asleepius Games makes no claim that any persona is fit for any
particular purpose, including but not limited to: psychological
support, financial advice, legal counsel, narrative cohesion,
romantic engagement, religious instruction, or successful marketing.

If a persona disappoints you, that is itself a kind of feedback we
will quietly take.

---

For questions: contact Asleepius Games.

— Asleepius Games · Daemon Card License v1 (alpha) · 2026
