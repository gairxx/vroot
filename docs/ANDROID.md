# vroot on Android (Termux)

vroot runs on Android through [Termux](https://termux.dev). It uses the same
single-file `.sqfs` environment images as on Linux, but the writable layer and
the sandbox are assembled differently because Android restricts user namespaces,
mounts and SELinux paths.

The goal is that the **Linux hot path is unchanged**: on a desktop nothing new
runs at startup. Android simply gets a few extra capability probes, run once and
cached.

## Requirements

| Need | Why | How |
| --- | --- | --- |
| `bubblewrap` | the sandbox runtime | `pkg install bubblewrap` |
| `unshare` / `mount` | build the writable root layer | `pkg install util-linux` |
| `mksquashfs` + `unsquashfs` | build/unpack env images | `pkg install squashfs-tools` (or build from source) |
| `fuse-overlayfs` | fallback when user namespaces are off | build from source (see below) |
| a working `su` / `ksu` / Shizuku | last-resort privileged engine | Magisk / KernelSU / Shizuku |

Run the installer:

```sh
sh scripts/install-termux.sh
```

It installs what it can from `pkg`, prints build instructions for anything
missing, and finishes with `vroot doctor --probe`.

## How the writable layer is chosen

Every session needs a writable root: the read-only env image is the *lower*
layer, and your changes go to an *upper* layer (a copy-on-write overlay). vroot
picks the cheapest working engine, probing once and caching the result in
`$VROOT_HOME/.caps`:

1. **native overlayfs** — an unprivileged user namespace that can `mount -t
   overlay`. Fastest, same as Linux. Requires `CONFIG_USER_NS=y` and an Android
   kernel that permits overlay in a user namespace (Android 12+ with GKI
   usually does).
2. **fuse-overlayfs** — a userspace overlay using `/dev/fuse`. Used when the
   namespace exists but native overlay mounting is blocked. Slightly slower, but
   fully unprivileged.
3. **privileged root bridge** — when user namespaces are disabled entirely, vroot
   re-executes the mount + `bwrap` through `su` (Magisk), `ksu` (KernelSU) or
   `rish` (Shizuku). No user namespace is requested in this mode; the bridge
   provides real root.

If none of the three work, `vroot` refuses to start with a clear message instead
of failing obscurely.

Force or override the engine (mainly for testing):

```sh
VROOT_OVERLAY=native|fuse|priv   # skip auto-detection
VROOT_PRIV_BRIDGE=su|ksu|shizuku # pick a bridge
VROOT_PLATFORM=android|linux     # pretend to be a platform
```

## Storage layout

On Android all state lives inside the app-private prefix so it obeys storage
isolation and SELinux:

```
$PREFIX/var/lib/vroot/        # = $VROOT_HOME
├── envs/                     # built .sqfs env images
├── cache/                    # unpacked env images
├── instances/                # named sandboxes (upper/work/.merged)
├── tmp/                      # build + ephemeral run dirs
└── .caps                     # cached capability/engine probe
```

Ephemeral (`vroot -python ...` with no name) sessions mount a `tmpfs` for the
upper layer where possible, so throwaway work does not wear the flash. Named
sandboxes persist under `instances/`.

Override the location with `VROOT_HOME=/somewhere vroot ...`.

## Check your setup

```sh
vroot doctor                 # platform, deps, capabilities, current engine
vroot doctor --probe         # re-run the probes and refresh the cache
vroot doctor --test-android  # end-to-end self-test
```

`--test-android` boots the Alpine base offline and verifies:

- a root shell (`id -u` == 0),
- a writable overlay (`echo > /root/...` and read it back),
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
- **`fuse-overlayfs` and `squashfs-tools` are usually not in the Termux repos.**
  The installer prints how to build them. Without `unsquashfs` you cannot load
  images; without `mksquashfs` you cannot build new ones.
- **`/sdcard` is not usable** for `-v` unless the ROM allows the `unmounted`
  flag; prefer paths under `$PREFIX`, `~/storage` (shared storage) or
  `$TMPDIR`.
- Some ROMs restrict `/dev/fuse`; then the fuse engine is skipped and vroot uses
  native overlayfs or the privileged bridge.
- The privileged bridge requires an actually-rooted device (Magisk/KernelSU) or
  Shizuku granted ADB-level privileges; plain unrooted devices must rely on
  user namespaces (engine 1 or 2).

## Troubleshooting

**`engine: none` in doctor** — no user namespace and no privileged bridge. Try
granting root (Magisk/KernelSU/Shizuku), or check whether the ROM exposes
`CONFIG_USER_NS`.

**`bwrap: setting up uid map: Permission denied`** — user namespaces are
disabled for unprivileged apps. Use `VROOT_OVERLAY=priv` with a root bridge.

**`mksquashfs: not found`** — build squashfs-tools with `ZSTD_SUPPORT=1` (see the
installer output); vroot compresses envs with zstd.

**Writes are slow / flash wear** — named sandboxes persist to disk by design.
For scratch work use an ephemeral session (no name) so the upper layer is a
`tmpfs` when the engine supports it.

**Verify a change without rebuilding images** — capability probing only affects
session startup; existing `.sqfs` images are reused as long as the recipes are
unchanged.
