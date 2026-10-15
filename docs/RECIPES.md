# Recipe reference

A recipe is a plain text file in `key = value` format that tells `vroot` how to
build a sandbox that provides one flag.

## Locations and lookup

| Location | Purpose |
| --- | --- |
| `<repo>/recipes/*.conf` | built-in recipes |
| `~/.config/vroot/recipes/*.conf` (honors `$VROOT_CONFIG`) | your recipes; override built-ins with the same name |

Lookup order is: user recipes first, then built-ins. A recipe is registered
under its file name **and** under every name listed in `provides`, so
`provides = python,python3,py` makes `-python`, `-python3` and `-py` all work.

Useful commands:

```sh
vroot recipe list              # show all flags
vroot recipe show python       # print a recipe
vroot recipe new mytool        # create + edit a recipe
vroot recipe edit python       # edit an existing recipe
vroot recipe path              # show the recipe directories
```

## Fields

### `name` (required)

The canonical name of the recipe. By convention it matches the file name.

### `provides` (optional)

Comma-separated list of flags/aliases this recipe answers to. If omitted, the
recipe name is used.

```ini
provides = python,python3,py
```

### `base` (optional, default `alpine`)

Which base root filesystem to build on.

- `alpine` — tiny, fast, `apk`; uses musl.
- `debian` — larger, fetched via `docker`; glibc, `apt`; use when a tool is not
  available on Alpine or needs glibc.
- `kali` — Debian-based, fetched via `docker` (`kali-rolling`); glibc, `apt`
  with the Kali repositories; for security tooling.

### Kali versions

`base = kali` is a bare Kali Rolling root shell (no extra tools). Three larger
recipes add tool sets, and the bare `-kali` flag prompts you to pick one:

| flag | adds |
| --- | --- |
| `-kali` | bare rolling rootfs — interactive prompt (default) |
| `-kali-default` | `kali-linux-default` metapackage |
| `-kali-large` | `kali-linux-large` |
| `-kali-everything` | `kali-linux-everything` (multi-GB) |

`-kali` shows an interactive menu when stdin is a TTY; piped/non-interactive
runs fall straight through to the bare base. Set
`VROOT_KALI_VERSION=kali-default` to choose a variant non-interactively. Tool
variants are built on demand the first time they are requested and then cached
like any other env image.

### `packages` (optional, repeatable)

Space-separated package names installed with `apk add` (Alpine) or
`apt-get install` (Debian/Kali). You may repeat the key to keep lines short:

```ini
packages = python3
packages = py3-pip
```

### `setup` (optional, repeatable)

A shell snippet run as root during the build, after `packages`. Use it to
download releases, symlink binaries, generate keys, compile, etc. Multi-line
values are supported.

```ini
setup = cd /opt && curl -fsSL https://example.com/tool.tar.gz | tar -xz
setup = ln -sf /opt/tool/bin/tool /usr/local/bin/tool
```

### `env` (optional)

Comma-separated `KEY=VALUE` pairs written to `/etc/vroot/env` and exported in
every session.

```ini
env = GOPATH=/root/go,GOBIN=/root/go/bin
```

### `path` (optional)

Colon-separated directories prepended to `PATH`.

```ini
path = /root/.cargo/bin:/root/go/bin
```

### `verify` (optional, repeatable)

A shell snippet that must exit `0` at the end of the build, otherwise the build
fails. Put a cheap `command -v something` or `--version` here so broken
recipes fail loudly instead of producing a half-working environment.

```ini
verify = rustc --version
```

### `description` (optional)

One-line description shown by `vroot recipe list`.

### `docs` (optional)

A URL for further reading.

## Merging multiple flags

`vroot -php -sqlite` resolves two recipes and merges them:

- **base** — Debian wins if any recipe requests it.
- **packages / setup / env / path / verify** — concatenated in flag order.
- duplicates are removed where it is safe to do so.

The result is stored as a single image named after the joined flag list plus a
content hash, e.g. `envs/python+sqlite-25db8fe523.sqfs`. Change any recipe and
the hash changes, so the old image is left alone and a new one is built.

## Environment internals

During a build, `vroot` writes:

- `/etc/vroot/env` — the merged `env` values plus `PATH`;
- a line sourcing it is appended to `/etc/profile`.

Inside a sandbox you can inspect the active environment with
`cat /etc/vroot/env` and `echo $VROOT_ENV`.

## Tips

- Keep recipes small and single-purpose; users compose them with flags.
- Prefer aliases via `provides` over duplicating recipes.
- Use `base = debian` or `base = kali` sparingly — they multiply image size.
- Always set `verify`; it is the difference between "worked" and "silently
  broken".
