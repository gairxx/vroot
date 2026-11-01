# ADR 0002: Agent-first machine interface

Status: accepted
Date: 2026-10-31

## Context

Agents and CI scripts were parsing human output: coloured logs, tables and
banners on stdout. Failures were indistinguishable from success, and two agents
building the same environment could race on the same image path.

## Decision

- `--json` on `build`, `ls`, `envs` and `info`; JSON on stdout, one value per
  invocation, logs on stderr.
- Errors are a single `err …` line on stderr with exit status 1. With `-- CMD`,
  the command's exit status is forwarded unchanged.
- Environment images are content-addressed (`<slug>-<10-hex>.sqfs`), so the same
  recipe set always resolves to the same file.
- Building the same environment serialises on a directory lock; cache unpacking
  is swapped in atomically, so concurrent launches cannot corrupt each other.
- `vroot save` produces one immutable image; booting copies of it forks
  independent sandboxes.

## Consequences

- The published contract lives in `docs/AGENTS.md` and is mirrored for machines
  at `/llms.txt`, `/llms-full.txt` and `/flags.json`.
- Adding a new user-facing command means adding a JSON shape and documenting it
  there.
- Anything that changes stdout without `--json` is allowed to stay human-facing,
  but must not be the only way to get the data.
