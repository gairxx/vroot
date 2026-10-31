# vroot for AI agents

`vroot` exists so an agent can **build without being blocked by the machine it
runs on**: no container daemon to start, no image registry to pull from, no
sudo, no root-owned state to negotiate, and no waiting on a build that another
task already started.

This page is the contract. It is written for the agent, not the human.

## The model

- **One command, one exit code.** `vroot <flags> [name] -- <cmd>` runs `<cmd>`
  as real uid 0 inside an isolated filesystem and returns its exit status.
  stdin/stdout/stderr are passed through, so pipes and redirections work.
- **Nothing is interactive.** No prompts, no TTY requirement, no daemon. The
  banner and logs go to **stderr**; the payload goes to **stdout**.
- **Host is hidden by default.** `/home`, `/root`, `/etc` and the rest of the
  host are not visible unless you opt in with `-v HOST:GUEST`.
- **Disposable by default.** A session without a name leaves no trace. Give it
  a name (`vroot -python job7`) and the writable layer persists across calls.

## Machine-readable output

Add `--json` to management commands; JSON is printed to stdout and nothing
else is:

```console
$ vroot build -python --json
{"env":"/home/u/.local/share/vroot/envs/python-84d0423ed3.sqfs","cached":false}

$ vroot ls --json
[{"name":"job7","env":"python-84d0423ed3","image":"...","bytes":20598,"age_minutes":3}]

$ vroot envs --json
{"images":[{"file":"python-84d0423ed3.sqfs","bytes":48234496}],"bases":[{"name":"alpine","bytes":3301376}]}

$ vroot info job7 --json
{"name":"job7","env":"python-84d0423ed3","image":"...","created":"...","bytes":20598,"changed_files":2,"path":"..."}
```

`cached` tells you whether this call built an image or reused one. Use it to
avoid paying a build twice.

## Parallel agents are safe

- Building the same flag set from N processes produces **one** image: the first
  process builds, the others wait on a lock file and then return
  `"cached": true`. No duplicated downloads, no corrupt squashfs.
- Unpacking an env image into the shared cache is atomic (private temp dir,
  then swap), so concurrent launches never see a half-written tree.
- Distinct envs never contend with each other.

## Checkpoints and forks

Save any named sandbox to a single file and boot it as many times as you want:

```console
$ vroot -python golden -- pip install numpy      # do risky work
$ vroot save golden golden.vroot                 # checkpoint -> one file
$ vroot golden.vroot attempt1 -- pytest          # fork 1 (original untouched)
$ vroot golden.vroot attempt2 -- pytest          # fork 2
$ vroot attempt1 -- git diff                     # re-enter fork 1 later
```

The image file is read-only; every fork writes to its own overlay. A failed
attempt costs you a name (`vroot rm attempt1`), never the golden state.

## Recipes: give the agent more tools, not more constraints

A flag is a small `.conf` recipe; compose any number of them per call:

```sh
vroot -gcc -cmake -ninja -- cmake -S . -B build
vroot -python -git -sqlite -- ./manage.py migrate
vroot -java -maven -- mvn -q test
```

Drop a recipe in `$XDG_CONFIG_HOME/vroot/recipes/<name>.conf` (or
`~/.config/vroot/recipes/`) and it becomes available immediately. User recipes
override built-ins with the same name; a user recipe can also rename a built-in
via `provides=`. See `docs/RECIPES.md`.

## Rules an agent should respect

1. **Never assume the host toolchain.** Ask for what you need with a flag.
2. **Capture the exit code.** `vroot … -- cmd` forwards it; `0` means the
   command inside succeeded.
3. **Parse stdout, never the banner.** Human output is decorated; JSON is not.
4. **Name long-lived work, leave the rest anonymous.** Anonymous sessions are
   garbage-collected with the session; named ones survive until `vroot rm`.
5. **Use `-offline`** when a task must not reach the network.
6. **Prefer a checkpoint over a long-lived sandbox** for multi-step work you may
   have to retry.

## Host contract

Linux with unprivileged user namespaces and `bubblewrap`; `squashfs-tools` to
build images; `docker` only for recipes that declare a Debian base. Run `vroot
doctor` once as a preflight: it reports what is missing and exits non-zero if a
sandbox cannot start.
