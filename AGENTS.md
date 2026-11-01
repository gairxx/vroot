# vroot — agent entry point

vroot turns a flag into an isolated Linux root shell (`vroot -python`), built
from a single-file squashfs image with bubblewrap + overlayfs. No daemon, no
sudo, no image build step.

This file is a pointer. The canonical, versioned contract is:

- https://github.com/gairxx/vroot/blob/main/docs/AGENTS.md
- raw: https://raw.githubusercontent.com/gairxx/vroot/main/docs/AGENTS.md

Machine-readable artifacts on this site:

- https://gairxx.github.io/vroot/llms.txt — compact index and quick start
- https://gairxx.github.io/vroot/llms-full.txt — full plain-text reference
- https://gairxx.github.io/vroot/flags.json — all 42 flags with aliases and base
- https://gairxx.github.io/vroot/agents.html — human-readable overview of the same

## Fast path

    curl -fsSL https://raw.githubusercontent.com/gairxx/vroot/main/install.sh | sh
    vroot build -python --json
    # {"env":"/home/u/.local/share/vroot/envs/python-84d0423ed3.sqfs","cached":false}
    vroot -python -- python3 -c 'print(1)'

## Contract essentials

1. `--json` is supported by `build`, `ls`, `envs`, `info`. JSON goes to stdout,
   one value per invocation; logs go to stderr.
2. Exit codes: 0 success, 1 error (unknown flag, missing sandbox, build
   failure). With `-- CMD`, vroot forwards CMD's exit status.
3. Env images are content-addressed: `<flags>-<10-hex>.sqfs`. Identical inputs
   reuse one file. Parallel builds of the same env serialise on a lock.
4. Unnamed sandboxes are ephemeral. Name one for state that must survive.
   `vroot save NAME out.vroot` produces one immutable file; boot copies of it
   to fork independent sandboxes.
5. The host filesystem is invisible until bound with `-v`. `-offline` removes
   the network namespace.

Run `vroot doctor` once per host before diagnosing anything else.
