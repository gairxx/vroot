# Governance

vroot is small on purpose, and so is its governance. The rule is one sentence:

> **Anyone — human or agent — may propose. The community decides. Nobody merges
> their own change.**

Agents are first-class contributors here: they can open branches, write code,
update the graph and file decisions. They do not get a shortcut around review.

## Roles

| Role          | Who                        | Can do                                                    |
| ------------- | -------------------------- | --------------------------------------------------------- |
| contributor   | anyone with a fork        | open issues and PRs, propose ADRs                          |
| agent         | automation acting for a contributor | the same, but must follow the agent checklist below |
| code owner    | listed in `.github/CODEOWNERS` | approve changes to the areas they own                 |
| maintainer    | code owners with merge rights | merge after review, cut releases                       |

A change to `vroot`, `recipes/`, `graph/`, `docs/` or `.github/` needs **one
approval from a code owner** that is not the author. Two approvals are required
for a change to `vroot`'s isolation code, the graph schema, or this file.

## The process

1. **Open an issue** for anything that changes behaviour, unless it is an obvious
   bug fix. State the problem the change solves, not the diff.
2. **Write an ADR** (`docs/decisions/NNNN-title.md`, `Status: proposed`) when the
   change is hard to reverse: CLI contract, recipe precedence, storage layout,
   isolation model, graph schema or governance.
3. **Open a pull request** from your fork. Keep it one idea per PR.
4. **Pass the gates** below. CI is required; a red build means no review.
5. **Review.** A code owner reads the diff, the graph change and the ADR if any.
   Review is about the design, not the author — including when the author is a
   language model.
6. **Merge** with a merge commit. The person who merges flips the ADR status to
   `accepted` (or `rejected`) in a follow-up commit if it was not done earlier.
7. **Release** by bumping `VERSION` in `vroot`; see `docs/BUILDING.md`.

## Gates

All of these must be green before merge:

- `bash -n vroot` and `sh -n install.sh` — no syntax errors.
- `make test` — the CLI prints its version, both scripts parse.
- `make graph-check` — `graphctl check` and `graphctl guard` pass; the graph is
  in sync with the repository.
- The PR template checklist is complete, including "graph updated" and, where
  relevant, "ADR added".
- One code-owner approval from someone other than the author.

Docs-only changes still need the graph update, because every heading is a node.

## What needs an ADR

An ADR is required when the answer to "can a user notice this, and would undoing
it break someone?" is yes for both. In practice:

- CLI surface: new command, renamed flag, changed output or exit status.
- Recipe resolution order or storage paths.
- Isolation, sandboxing or privilege model.
- Graph schema, node kinds or relations.
- This governance document.

Do not use ADRs for ordinary bug fixes; a test and a sentence in the PR are
enough.

## Agents

An agent contributing to vroot must:

1. Work on a branch, never on `main`.
2. Include the graph update in the same PR as the code that causes it.
3. Not approve or merge its own PR, and not ask another agent instance to
   approve it in place of a human code owner.
4. Quote the commands it ran and their output in the PR body (`make test`,
   `make graph-check`, `graphctl stats`).
5. Say when it is unsure and prefer a draft PR over a wrong merge.
6. Never rewrite history on a branch someone else has reviewed; add commits.

An agent that cannot open a PR (no credentials, sandbox without network) should
leave a ready patch in the issue it is working on, with the same information the
PR body would contain.

## Changing this document

Governance changes follow the normal process plus two approvals, and take effect
when merged. If the current process prevents fixing a problem, say so in the
issue: a broken gate is itself a reason to open a PR against this file.

## Branch protection (repository setting)

The rules above are enforced by conventions plus CI. To make them enforced by
GitHub, a maintainer with admin rights must, once, in **Settings → Branches**:

- protect `main`: require a pull request before merging, require 1 approval
  (2 for `vroot` and `graph/`), dismiss stale approvals, require the `ci` and
  `graph` checks, and disallow force pushes;
- enable **Require review from Code Owners**;
- enable **Require conversation resolution**.

Those settings are not versioned in this repository; this section is the
authoritative description of what they should be.
