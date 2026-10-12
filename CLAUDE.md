# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- A **Stop hook** (`.claude/settings.json`) runs `scripts/check-consistency.mjs --hook` when you finish a
  turn. If it blocks, fix what it lists (or explain in your reply why no update is needed) before stopping.
- Use the `/feature` skill (`.claude/skills/feature/SKILL.md`) for any feature work.
- Long tasks: when a decision is the user's, stop and ask; if the user is away, send a notification.
