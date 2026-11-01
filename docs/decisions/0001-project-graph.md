# ADR 0001: Track the project in a reviewable graph

Status: accepted
Date: 2026-10-31

## Context

vroot is built for agents: the CLI speaks JSON, builds are parallel-safe, and
snapshots are forkable. The repository, however, was only readable as prose and
shell. An agent asked to change one recipe could not answer "what else depends on
this?" without grepping, and reviewers could not see the blast radius of a patch.

## Decision

Keep the project graph in two line-delimited JSON files tracked in git:

- `graph/nodes.jsonl` — one node per line: `{id, kind, attrs}`
- `graph/edges.jsonl` — one edge per line: `{src, rel, dst, attrs}`

`tools/graphctl` reads and writes them, rebuilds them from the repository with
`ingest`, validates them with `check`, and derives a disposable SQLite index for
ad-hoc queries. The files are the source of truth because they diff cleanly in a
pull request and need no server.

JSONL and SQLite were chosen over an embedded or hosted graph database: review
happens in the diff, and CI must be able to verify the graph with `python3` and
no extra service. A graph server can later be projected from the same files.

## Consequences

- Every change that adds, removes or renames a recipe, flag, command, doc
  section or ADR must update the graph; CI runs `graphctl guard` and fails on
  drift.
- Queries are explicit and cheap: `impact`, `query`, `path`, `sql`.
- Binary artifacts (`graph/index.sqlite`) stay out of git.
- Tools that need Cypher can add a projection later without changing the source
  of truth.
