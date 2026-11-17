---
name: project-journal
description: Maintain OnlyPlans work, decisions and used modes/skills/plugins in one versioned journal, grouped by participant.
---

Read docs/logging.md. Use scripts/journal.mjs from repository root. The ONLY journal is logs/, split into work, decisions and usage, then participant. One start creates three records sharing one ID and updates readable README pages. Never create a parallel analytics or PowerShell record.

Start before work for the confirmed participant GitHub handle; git author name is not proof of their handle. Ask if unknown. Do not reuse another chat's session. Write real decisions and actual capability use as it occurs, including this skill and known mode. Installed is not used. Unknown versions stay unknown. An empty decision array is valid; explain it in the result. Record context, choice, alternatives, reason and consequences.

Before final handoff review all three parts and close. Further work starts a new session. Before PR run check and include JSON plus generated pages. After merging concurrent changes rerun render. Do not publish without authorization. Do not store full chats, secrets or private data.

Reported tokens require an actual usage source scoped to this session. When usage is unavailable, estimate automatically: pipe available user/assistant/tool text into observe SESSION EVENT_ID input|output|tool|context. Persist only character counters, never raw text. Stable per-message event IDs replace previous observations, preventing double counting on retries. Observe the final reply before closing. Do not fabricate text or count cumulative context snapshots as new messages. Hidden/repeated model context may be missing: visible-text estimates are not billed usage. With no observed conversation, close falls back to journal_only, explicitly described as the amount of journal text, not session consumption. Backfill old sessions with estimate-history, preserving archived originals. Exact usage always takes precedence. Duration includes waiting. Do not invent historical ends for abandoned sessions. Preserve original_sources and migration.json: immutable migration evidence, not logs to maintain.
