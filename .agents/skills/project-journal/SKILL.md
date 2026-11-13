---
name: project-journal
description: Maintain OnlyPlans personal work sessions, decisions, and used modes/skills/plugins in versioned analytics files during project work.
---

Read docs/analytics.md and use scripts/journal.mjs from repository root. Start a new session for this participant and chat before substantive work; never reuse another chat's open session. Ask for participant handle if unknown. Record actual decisions when made and capabilities when used, including this skill and the agent's mode. Record only observed use; installed or available does not mean used. Repeat use of the same capability in one session can share one entry; explain its purpose. Unknown versions stay unknown.

Write files during work, not in a hidden conversational buffer. Never store full chats, secrets or private data. Summarize task and outcome. Decisions need context, choice, alternatives, reason and consequences; an empty array is valid if no meaningful decisions occurred. Before every final handoff, check both logs and close the session; further work starts a new session. Before commit/PR run check and include your session files with the work. Do not commit/push unless authorized.

Use exact token totals only with an actual usage source scoped to this session. Never sum cumulative snapshots. When unavailable, leave null; if the user requests estimation, label estimated and document scope and method. Character counts of visible chat cannot measure full billed usage. Wall duration includes waiting; it is not active work time. Do not invent historical timestamps. Mark abandoned sessions interrupted using recovery rules in docs/analytics.md.
