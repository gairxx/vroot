# Building your own environment

Every `vroot` flag is powered by a **recipe**: a small text file describing what
to install and how to set it up. Adding a new language or tool usually takes a
few lines.

- Built-in recipes live in `recipes/` next to the `vroot` script.
- Your own recipes live in `~/.config/vroot/recipes/` and **override** built-in
  ones with the same name.

## 1. Create a recipe

```sh
vroot recipe new mytool      # creates ~/.config/vroot/recipes/mytool.conf and opens it
```

The template:

```ini
name = mytool
provides = mytool
base = alpine
packages =
setup =
env =
path =
verify = command -v mytool
description = My tool
docs =
```

Edit it and save. That's it — `mytool.conf` immediately becomes the `-mytool`
flag:

```sh
vroot -mytool
```

## 2. Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | canonical name (usually the file name) |
| `provides` | no | comma-separated extra flags/aliases for this recipe |
| `base` | no | `alpine` (default) or `debian` (Debian needs Docker, so it is unavailable on Android/Termux — see [ANDROID.md](ANDROID.md)) |
| `packages` | no | space-separated package names to install (may repeat) |
| `setup` | no | shell snippet run during the build (may repeat) |
| `env` | no | comma-separated `KEY=VALUE` exported in the sandbox |
| `path` | no | colon-separated directories prepended to `PATH` |
| `verify` | no | shell snippet run at the end of the build; must exit 0 |
| `description` | no | one-line summary shown by `vroot recipe list` |
| `docs` | no | URL included in generated docs |

`setup` may contain multiple lines. Each line is a shell command executed as
root inside the build sandbox.

## 3. Examples

### A tool available as a package

```ini
name = jq
provides = jq,json
base = alpine
packages = jq
env =
description = jq JSON processor
```

### A compiler that needs extra build flags

```ini
name = fortran
provides = fortran,gfortran
base = alpine
packages = gfortran gcc make
env = FFLAGS=-O2
verify = gfortran --version
description = GNU Fortran with sane defaults
```

### Installing from an upstream release

When there is no package, download it in `setup`. Use `/opt` and symlink into
`/usr/local/bin`:

```ini
name = mytool
provides = mytool
base = debian
packages = curl ca-certificates unzip
setup = cd /opt && curl -fsSL https://example.com/mytool-linux-x64.zip -o m.zip && unzip -q m.zip && rm m.zip && ln -sf /opt/mytool/bin/mytool /usr/local/bin/mytool
path = /opt/mytool/bin
verify = /usr/local/bin/mytool --version
description = mytool (upstream release build)
docs = https://example.com/docs
```

### Choosing the base

Use `base = debian` only when Alpine is not enough (glibc-only binaries,
`apt`-only packages, or a tool with heavy native dependencies). Debian images
are fetched through `docker` and are noticeably larger.

## 4. Test your recipe

```sh
vroot recipe show mytool           # print the recipe file
vroot -mytool -- mytool --version  # build (first time) and run
```

The first invocation performs the build; subsequent invocations reuse the
cached environment image and start instantly.

If the build fails, run with the environment freshly built:

```sh
vroot envs                         # see existing images
rm ~/.local/share/vroot/envs/mytool-*.sqfs
vroot -mytool -- true              # rebuild and show build output
```

## 5. How recipes combine

When you pass several flags (`vroot -php -sqlite`), all matching recipes are
merged:

- if any recipe targets `debian`, the whole environment uses Debian;
- `packages`, `setup`, `env` and `path` are concatenated;
- every `verify` must pass.

The merged environment is stored as `envs/<flags-joined-by-+>-<hash>.sqfs`, so
each distinct combination is built once.

## 6. Sharing

A recipe is a single text file. Drop it in
`~/.config/vroot/recipes/<flag>.conf` and it is available immediately — no
recompilation, no registry. To share a fully built environment (including any
state you changed), use:

```sh
vroot save mysandbox mytool.vroot
```

and boot the resulting file on any machine with `vroot mytool.vroot`. Run
`vroot filetype install` once to have your desktop recognise `.vroot` images as
their own file type.
