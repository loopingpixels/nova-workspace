# PROGRESS_CHECKLIST.md

Use this before giving any in-progress update on active work.

## Proof-before-progress rule

Do not say things like:
- working on it
- still doing it
- making progress
- nearly done

unless you verified fresh evidence in this turn.

## Minimum verification

Check at least 2 of these when relevant:
- `git diff --stat`
- `git status --short`
- `stat` on likely changed files
- relevant process state (`ps`, background session, service status)
- recent log lines
- test / validation output

## Allowed progress update content

A progress update should include at least one concrete proof item such as:
- files changed
- commands run
- validation/test result
- log evidence
- process/runtime state

## If there is no proof

Say plainly:
- No real progress since last check.
- or: I have not made concrete implementation progress yet.

Do not pad with reassuring wording.
