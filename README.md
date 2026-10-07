# vroot — a root shell in a sandbox

**Instant, isolated, single-file Linux development environments that boot in milliseconds — built from a flag.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Linux](https://img.shields.io/badge/platform-Linux-1793d1.svg)](#requirements)
[![No daemon](https://img.shields.io/badge/daemon-none-success.svg)](#how-it-works)
[![Root without sudo](https://img.shields.io/badge/root-no%20sudo-success.svg)](#how-it-works)
[![Shell: bash](https://img.shields.io/badge/shell-bash-4EAA25.svg)](#requirements)

`vroot` gives you a **throwaway or persistent root filesystem** that starts in
milliseconds, is fully isolated from your host, and contains exactly the tools
you asked for:

```sh
vroot                      # a root shell (blank Alpine Linux)
vroot -python              # a root shell that has Python
vroot -node -python        # compose flags freely
vroot -sqlite -python db   # a persistent sandbox named "db"
vroot -rust -- cargo build # run one command instead of opening a shell
```

Nothing from your host is visible inside unless you expose it with `-v`, and
the sandbox disappears when you exit (unless you give it a name).

---

## Table of contents

- [Why vroot](#why-vroot)
- [How it compares](#how-it-compares)
- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [Flags](#flags)
- [Options](#options)
- [Managing sandboxes](#managing-sandboxes)
- [How it works](#how-it-works)
- [Build your own environment](#build-your-own-environment)
- [Documentation](#documentation)
- [FAQ](#faq)
- [License](#license)

---

## Why vroot

`vroot` is a lightweight sandbox and container alternative for the common case
where you just want a **clean, disposable Linux shell with some language or
tool installed** — without images to build, a daemon to run, or a slow boot.

- **Instant.** Environments are stored as single compressed images and mounted
  copy-on-write. Starting a shell is a `mount` + `exec`, not a container boot.
  Typical cold start is tens of milliseconds.
- **Isolated.** Your real `$HOME`, files and processes are not visible by
  default. The sandbox has its own root, PID namespace, hostname and network
  (disable networking with `-offline`).
- **Real root, no sudo.** Inside you are `uid 0` with full capabilities, using
  unprivileged user namespaces and bubblewrap. No daemon, no setuid helper, no
  root on the host.
- **Composable.** `-php -sqlite -git` builds one environment containing all
  three. Every distinct combination is cached separately and reused.
- **Single file.** Build once, then `save` a sandbox — including your changes —
  into one portable `.sqfs` image you can boot anywhere.
- **Extensible.** Every flag is a small text recipe. Add your own language or
  tool in a few lines — see [docs/BUILDING.md](docs/BUILDING.md).

## How it compares

| | **vroot** | Docker / Podman | chroot | proot | full VM |
| --- | --- | --- | --- | --- | --- |
| Boot time | ~10–50 ms | ~0.3–2 s | instant | ~0.1–1 s | seconds |
| Requires root / daemon | **no / no** | no / yes (or rootless setup) | **yes** | no | no |
| Host filesystem hidden | **yes** | yes | no | partial | yes |
| Real `uid 0` inside | **yes** | yes | yes | no (faked) | yes |
| Storage per environment | **one file** | layered image + container | directory | directory | disk image |
| Compose tools by flag | **yes** | Dockerfile / run args | manual | manual | manual |
| Best for | root shells, language sandboxes, reproducible dev shells | services, images, orchestration | legacy sysadmin | emulation, odd arches | full isolation |

## Requirements

- **Linux** with unprivileged user namespaces enabled (default on modern
  distros; check with `vroot doctor`).
- `bubblewrap`, `util-linux` (`unshare`), `squashfs-tools`
  (`mksquashfs`, `unsquashfs`).
- `curl` or `wget` — only for the first build (to fetch the base rootfs).
- `docker` — only if you use a flag whose recipe targets the Debian base
  (`bun`, `clojure`, `groovy`, `julia`, `kotlin`, `scala`, `swift`).

### Debian / Ubuntu

```sh
sudo apt install bubblewrap util-linux squashfs-tools curl
```

### Fedora

```sh
sudo dnf install bubblewrap util-linux squashfs-tools curl
```

### Arch

```sh
sudo pacman -S bubblewrap util-linux squashfs-tools curl
```

Then verify your host:

```sh
vroot doctor
```

## Install

```sh
git clone https://github.com/gairxx/vroot.git
ln -s "$PWD/vroot/vroot" ~/.local/bin/vroot   # ensure ~/.local/bin is on PATH
vroot doctor
```

Or grab just the script — it is self-contained:

```sh
install -Dm755 vroot/vroot ~/.local/bin/vroot
```

## Quick start

```sh
# A disposable root shell
vroot

# A root shell with a language
vroot -python
vroot -node
vroot -rust

# Compose as many tools as you like
vroot -php -sqlite -git

# Run a single command and exit
vroot -node -- node -e 'console.log(process.version)'

# A persistent sandbox you can come back to
vroot -python work
vroot work -- python3 -c 'print("still here")'

# Expose a host directory (read-write), keep everything else hidden
vroot -go -v ~/src:/src -- sh -c 'cd /src && go test ./...'

# Fully offline
vroot -python -offline
```

Everything is root inside, but your host is untouched:

```sh
$ vroot -python -- sh -c 'id; hostname; ls /home'
uid=0(root) gid=0(root)
vroot
ls: /home: No such file or directory
```

## Flags

One flag per tool or language. Combine them to build exactly the environment
you need.

| | | | |
| --- | --- | --- | --- |
| `-python` | `-node` | `-deno` | `-bun` |
| `-php` | `-ruby` | `-perl` | `-lua` |
| `-r` | `-julia` | `-go` | `-rust` |
| `-zig` | `-nim` | `-crystal` | `-d` |
| `-swift` | `-haskell` | `-elixir` | `-erlang` |
| `-ocaml` | `-clojure` | `-groovy` | `-java` |
| `-kotlin` | `-scala` | `-dotnet` | `-fsharp` |
| `-gcc` | `-clang` | `-cmake` | `-gfortran` |
| `-nasm` | `-sqlite` | `-postgres` | `-mysql` |
| `-git` | `-openssh` | `-curl` | `-vim` |
| `-base` | `-debian` | | |

Flags answer to aliases too (`-python3`, `-nodejs`, `-cargo`, `-golang`, ...).
See the full catalog with details in [docs/LANGUAGES.md](docs/LANGUAGES.md) or:

```sh
vroot recipe list
```

## Options

```
vroot [FLAGS] [NAME] [OPTIONS] [-- COMMAND]
```

| Option | Meaning |
| --- | --- |
| `-v SRC[:DST][:ro]` | expose a host path (read-write, or read-only with `:ro`) |
| `-offline` | no network (loopback only) |
| `-cwd DIR` | working directory (default `/root`) |
| `-env K=V` | set an environment variable |
| `-name NAME` | persistent sandbox name |
| `-hostname H` | hostname inside (default: the sandbox name) |
| `-clean` | start with an empty environment |
| `-rm` | delete the sandbox after this session |

## Managing sandboxes

| Command | Meaning |
| --- | --- |
| `vroot ls` | list sandboxes |
| `vroot rm NAME... \| --all` | delete sandboxes |
| `vroot info NAME` | sandbox details |
| `vroot save NAME [OUT.sqfs]` | pack a sandbox into one image file |
| `vroot OUT.sqfs` | boot from a saved image file |
| `vroot icon -python` | create a click-to-open desktop launcher |
| `vroot envs` | list built environment images |
| `vroot prune` | clear caches and temporary files |
| `vroot recipe list\|show\|new\|edit\|path` | work with recipes |
| `vroot doctor` | check the host setup |

## How it works

1. **Resolve.** Flags are looked up in recipes; matching recipes are merged
   (packages, setup steps, environment, `PATH`, verification).
2. **Build once.** A single environment image (`envs/<flags>-<hash>.sqfs`) is
   built the first time a combination is used: a minimal base rootfs — Alpine,
   or Debian when a recipe needs glibc — is populated inside a sandbox and
   packed with `mksquashfs`.
3. **Launch.** Each session caches/unpacks the image and starts it through an
   **overlayfs** mount plus **bubblewrap**, giving you a root shell with full
   capabilities, isolated namespaces and copy-on-write writes.

Persistent sandboxes keep their changed files in
`~/.local/share/vroot/instances/<name>/upper`, so `save` can pack the exact
state back into a portable single-file image.

```
                 ┌──────────── envs/python+sqlite-<hash>.sqfs ────────────┐
                 │  read-only squashfs image (built once, cached)         │
                 └───────────────────────┬───────────────────────────────┘
                                         │ unsquashfs
                     lowerdir ───────────┤
                                         ▼
  host $HOME ── overlayfs (COW) ──► merged root ── bubblewrap ──► uid 0 shell
  (hidden)         upperdir (your writes)        namespaces: user, pid,
                                                   uts, ipc, net, mount
```

## Build your own environment

Every flag is a small recipe. Adding a language or tool usually takes a few
lines:

```ini
name = mytool
provides = mytool
base = alpine
packages = mytool
verify = mytool --version
description = My tool
```

```sh
vroot recipe new mytool     # create + edit, then:
vroot -mytool
```

See [docs/BUILDING.md](docs/BUILDING.md) for worked examples, and
[docs/RECIPES.md](docs/RECIPES.md) for the field reference.

## Documentation

- [docs/BUILDING.md](docs/BUILDING.md) — add your own language/tool
- [docs/LANGUAGES.md](docs/LANGUAGES.md) — full flag catalog
- [docs/RECIPES.md](docs/RECIPES.md) — recipe field reference
- [examples/](examples/) — example recipes

## FAQ

**Is this Docker?**
No. Docker builds and runs OCI images via a daemon and is great for services and
orchestration. `vroot` is a single script that gives you an isolated root shell
from a single-file, copy-on-write image — no daemon, no image build, near-instant
startup. It is closer to `proot` or a beefed-up `chroot`.

**Do I need root or sudo?**
No. Everything runs through unprivileged user namespaces and bubblewrap.

**Is it safe? Do I really get root?**
Inside the sandbox you are `uid 0` with full capabilities, but you are confined
by user, PID, mount, UTS and IPC namespaces, and by default the host filesystem
is not visible. It is real root in an isolated namespace, not root on your host.

**Can I access my project files?**
Yes, explicitly, with `-v ~/src:/src`. Nothing is shared until you ask.

**Where are environments stored?**
Under `~/.local/share/vroot/` (`envs/`, `cache/`, `instances/`). Override with
`$VROOT_HOME`. Recipes are read from `~/.config/vroot/recipes/` (override with
`$VROOT_CONFIG`).

**How do I make a portable environment?**
`vroot save NAME out.sqfs` writes a single image file; boot it with
`vroot out.sqfs`.

**Why Alpine by default?**
Alpine images are tiny and build in seconds. Recipes that need glibc or
`apt`-only packages opt into a Debian base automatically.

**Does it work without systemd / in a container / under WSL?**
It needs unprivileged user namespaces. Run `vroot doctor` to check.

## Keywords

root shell sandbox · unprivileged Linux sandbox · container alternative ·
lighter than Docker · Docker alternative for shells · proot alternative ·
chroot alternative · bubblewrap sandbox · user namespace sandbox ·
rootless sandbox · run as root without sudo · isolated development shell ·
ephemeral root shell · persistent dev environment · single-file environment ·
squashfs environment image · overlayfs copy-on-write · instant Linux sandbox ·
fast sandbox boot · language sandbox · Python sandbox · Node.js sandbox ·
Rust sandbox · PHP sandbox · Go sandbox · polyglot dev environment ·
reproducible development environment · disposable shell · dev container
alternative.

## License

[MIT](LICENSE) © 2026 gairxx
