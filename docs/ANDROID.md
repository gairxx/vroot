# vroot on Android (Termux)

vroot runs on Android through [Termux](https://termux.dev). It uses the same
single-file `.sqfs` environment images as on Linux, but the writable layer and
the sandbox are assembled differently because Android restricts namespaces,
overlayfs and SELinux paths.

The **Linux hot path is unchanged**: on a desktop nothing new runs at startup.
Android just gets a few extra capability probes, run once and cached.

## Requirements

| Need | Why | How |
| --- | --- | --- |
| `bubblewrap` | the sandbox runtime | `pkg install root-repo && pkg install bubblewrap` |
| `unshare` / `mount` | build the writable root layer | `pkg install util-linux` |
| `squashfs-tools-ng` | build/unpack env images | `pkg install squashfs-tools-ng` |
| a working `su` / `ksu` / Shizuku | privileged engine (typical on Android) | Magisk / KernelSU / Shizuku |

Run the installer:

```sh
sh scripts/install-termux.sh
```

It enables the Termux root repository, installs the packages above, and finishes
with `vroot doctor --probe`.

## How the writable layer is chosen

A session needs a writable root. vroot picks the cheapest working engine,
probing once and caching the result in `$VROOT_HOME/.caps`:

1. **native overlayfs** — an unprivileged user namespace that can `mount -t
   overlay`. Fastest and identical to Linux. Requires `CONFIG_USER_NS=y` *and* a
   kernel that permits overlay in a user namespace.
2. **fuse-overlayfs** — a userspace overlay using `/dev/fuse`, for kernels that
   allow user namespaces but block native overlay. **Not packaged for Termux**;
   only usable if you build it yourself.
3. **root mount-namespace** — when user namespaces are unavailable (most stock
   ROMs, and **Android 11** as tested), vroot re-executes `bubblewrap` through a
   privileged bridge (`su`, `ksu`, or `rish`). bubblewrap creates only a **mount
   and a UTS namespace** — Android returns `EINVAL` for user, PID and IPC
   namespaces even as root.

Android's kernel **blocks overlayfs entirely**, even for root (the upper *and*
lower filesystems are rejected with `overlayfs: filesystem ... not supported`).
So the root engine does not use an overlay: instead each session **seeds a real
writable directory** from the read-only env cache (a copy), then bind-mounts it
as `/`. Named sandboxes keep that directory on disk (persistence); ephemeral
sessions seed into `tmp/` and remove it afterwards.

If none of the engines work, `vroot` refuses to start with a clear message
instead of failing obscurely.

Force or override the engine (mainly for testing):

```sh
VROOT_OVERLAY=native|fuse|priv   # skip auto-detection
VROOT_PRIV_BRIDGE=su|ksu|shizuku|custom  # pick a bridge
VROOT_SU_STYLE=flag|uid          # su -c CMD  |  su UID CMD
VROOT_PLATFORM=android|linux     # pretend to be a platform
```

`su` comes in two shapes and vroot auto-detects which is present:

- Magisk/LineageOS/toybox: `su -c "CMD"` (`VROOT_SU_STYLE=flag`)
- AOSP / emulator: `su UID CMD` (`VROOT_SU_STYLE=uid`)

### Custom / mock bridge

For unusual ROMs, CI or testing you can plug in your own su-compatible
escalator instead of relying on a system `su`:

```sh
VROOT_PRIV_BRIDGE=custom \
VROOT_BRIDGE_CMD=/path/to/scripts/mock-su.sh \
  vroot -python
```

`VROOT_BRIDGE_CMD` is invoked as `<cmd> 0 sh <script>` (the AOSP `su UID CMD`
form). A custom bridge is never cached, so supply the two variables on every run.

`scripts/mock-su.sh` is a small drop-in `su` shim for exactly this. It accepts
both flavours (`su -c "CMD"` and `su [UID] CMD...`) plus a bare script path, and
escalates only if it already can:

- root (`id -u` == 0) → runs directly;
- `MOCK_SU_REAL="sudo"` (or any escalator) → delegates;
- `MOCK_SU_ALLOW_NONROOT=1` → runs the command as-is (tests only);
- otherwise it delegates to a real `su` if one is on `PATH`.

Set `MOCK_SU_LOG=/tmp/mock.log` to record every invocation, which is handy for
proving the privileged path was actually used:

```sh
$ MOCK_SU_ALLOW_NONROOT=1 sh scripts/mock-su.sh 0 sh -c 'id -u'
0
```

When an escalator is available (root, sudo, or a real `su`), this lets you
exercise the root mount-namespace engine end-to-end — `vroot doctor
--test-android` — while `MOCK_SU_LOG` proves the bridge really was called.

## Storage layout

On Android all state lives inside the app-private prefix so it obeys storage
isolation and SELinux:

```
$PREFIX/var/lib/vroot/        # = $VROOT_HOME
├── envs/                     # built .sqfs env images
├── cache/                    # unpacked env images (read-only lower)
├── instances/                # named sandboxes
│   └── NAME/
│       ├── root/             # writable root (root engine)
│       ├── upper/ work/      # copy-on-write layers (overlay engines)
│       ├── .seeded           # marker: root/ has been populated
│       └── meta              # env name + creation time
├── tmp/                      # build + ephemeral run dirs
├── resolv.conf               # synthesised DNS for Android
└── .caps                     # cached capability/engine probe
```

Override the location with `VROOT_HOME=/somewhere vroot ...`.

## Networking

Android ships no `/etc/resolv.conf`. vroot synthesises one from the system DNS
properties (`net.dns1`…`net.dns4`) and bind-mounts it into each sandbox, so
`apk`, `curl`, `git`, etc. resolve names during a build or run.

## Check your setup

```sh
vroot doctor                 # platform, deps, capabilities, current engine
vroot doctor --probe         # re-run the probes and refresh the cache
vroot doctor --test-android  # end-to-end self-test
```

`--test-android` boots the Alpine base offline and verifies:

- a root shell (`id -u` == 0),
- a writable root (write `/root/...` and read it back),
- persistence across two sessions with the same sandbox name.

It exits non-zero if any check fails.

## Guest architecture

`vroot` downloads the Alpine minirootfs matching the device CPU (`aarch64` on
almost all modern phones). The x86_64 image keeps its pinned checksum; other
arches verify against the checksum published next to the download. You can
override the guest arch with `VROOT_ALPINE_ARCH=` if needed.

## Limitations

- **Debian-based recipes need Docker**, which Termux does not provide. Use
  Alpine-based recipes (`base = alpine`, the default). vroot fails fast with a
  clear message if a Debian recipe is requested.
- **overlayfs is unavailable on Android**, so the root engine copies the env
  into a writable directory instead of using copy-on-write. This is correct but
  not instant for large envs.
- **`fuse-overlayfs` is not packaged for Termux**; engine 2 only exists if you
  build it.
- **`/sdcard` is not usable** for `-v` unless the ROM allows it; prefer paths
  under `$PREFIX`, `~/storage` or `$TMPDIR`.
- The privileged bridge requires a rooted device (Magisk/KernelSU) or Shizuku
  granted ADB-level privileges. Plain unrooted devices must rely on user
  namespaces (engine 1 or 2).

## Troubleshooting

**`engine: none` in doctor** — no user namespace and no privileged bridge. Grant
root (Magisk/KernelSU/Shizuku), or check whether the ROM exposes `CONFIG_USER_NS`.

**`engine: root mount-namespace (no overlay; bridge=su)`** — the normal Android
case: userns is off, so vroot uses `su` + bubblewrap with a seeded root dir.

**`bwrap: execvp /bin/sh: Permission denied`** — the unpacked files lost their
executable bit. Termux's `rdsquashfs` only restores permissions with `--chmod`;
vroot passes it automatically. If you unpack manually, add `-C`.

**`bwrap: execvp bwrap: inaccessible or not found`** — the privileged shell's
`PATH` lacks `$PREFIX/bin`. vroot resolves bubblewrap to an absolute path before
handing it to `su`; make sure `bubblewrap` is installed (root-repo).

**`no privileged bridge available`** — no `su`/`ksu`/`rish`, or `su` is not
granted. Confirm `su -c true` (Magisk) or `su 0 true` (AOSP) works.

**`Cannot run 'pkg'/'apt' as root`** — run vroot as the normal Termux user, not
as root; it escalates only for the sandbox itself.

**Files in a sandbox are owned by root** — the root engine runs payloads as root.
vroot hands the sandbox back to your user after each run (via the bridge), so
`save`, `rm` and the next run keep working.

**Verify a change without rebuilding images** — capability probing only affects
session startup; existing `.sqfs` images are reused as long as the recipes are
unchanged.
