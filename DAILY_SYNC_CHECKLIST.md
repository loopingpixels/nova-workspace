# Daily Sync Checklist

Use this for scheduled review/sync runs.

## Goal
Review recent work and conversation state, capture durable learnings, and keep the workspace synced to GitHub.

## Review window
- Focus on recent sessions, today/yesterday memory files, and current workspace changes.
- Prefer high-signal updates only: new workflows, standing preferences, important decisions, new tracked tasks, meaningful scripts, and real completed work.

## Required actions
1. Review recent session activity relevant to Roshan's current work.
2. Identify any durable workflow/rule/preference/task that should be captured.
3. Update:
   - `memory/YYYY-MM-DD.md`
   - `MEMORY.md` when something belongs in long-term memory
   - any relevant workflow/checklist file if a new repeatable pattern emerged
4. Check git status across the entire workspace (including `managed-agents/`).
5. Commit all durable changes from the workspace (including `managed-agents/`) with clear commit messages.
6. Push to GitHub if there are committed changes and a configured remote.

## Do not do
- Do not invent progress.
- Do not log low-value chat fluff.
- Do not overwrite memory files; append or make targeted edits.
- Do not commit transient artifacts, caches, venvs, logs, or secrets.

## Output rule
- If nothing durable changed and nothing needed syncing, reply with exactly `NO_REPLY`.
- If something was updated, send a short proof-based summary with:
  - what was captured
  - which files changed
  - commit ids / push result if any
