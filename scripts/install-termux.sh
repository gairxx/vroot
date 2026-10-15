#!/data/data/com.termux/files/usr/bin/sh
# vroot Termux/Android installer (best-effort).
#
# Installs the runtime dependencies vroot needs and then runs `vroot doctor`.
# It never needs root; the sandbox itself runs through whatever privileged
# bridge (su / ksu / Shizuku) is present, or unprivileged if the kernel allows.
#
# Usage:  sh scripts/install-termux.sh
set -eu

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ok\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31merr\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

[ -n "${TERMUX_VERSION:-}" ] || [ "${PREFIX:-}" = *com.termux* ] \
    || die "this installer is for Termux. On a normal Linux host use your package manager."

VROOT_HOME="${VROOT_HOME:-$PREFIX/var/lib/vroot}"
export VROOT_HOME

say "updating package index"
pkg update -y >/dev/null 2>&1 || warn "pkg update failed; continuing"

# bubblewrap lives in the Termux *root* repository on Android.
say "enabling the Termux root repository"
pkg install -y root-repo >/dev/null 2>&1 && ok "root-repo enabled" \
    || warn "could not enable root-repo; bubblewrap may be unavailable"

say "installing core dependencies"
# bubblewrap is the sandbox runtime; util-linux provides unshare; the rest are
# conveniences used by vroot's hot path.
pkg install -y bubblewrap util-linux coreutils tar gzip xz-utils zstd curl 2>/dev/null \
    && ok "core deps installed" \
    || warn "some core deps failed to install; run 'pkg install bubblewrap util-linux' manually"

# --- squashfs: Termux ships squashfs-tools-ng (gensquashfs/rdsquashfs) --------
# This is all vroot needs: gensquashfs packs envs, rdsquashfs unpacks them.
if have mksquashfs || have gensquashfs || have tar2sqfs; then
    ok "squashfs tools already present"
else
    say "installing squashfs-tools-ng"
    if pkg install -y squashfs-tools-ng >/dev/null 2>&1 \
        && { have gensquashfs || have tar2sqfs; }; then
        ok "squashfs-tools-ng installed from pkg"
    else
        warn "squashfs-tools-ng is unavailable; vroot cannot build or load envs." \
        warn "install it manually: pkg install squashfs-tools-ng"
    fi
fi

# --- fuse-overlayfs is NOT packaged in Termux --------------------------------
if have fuse-overlayfs; then
    ok "fuse-overlayfs present"
else
    warn "fuse-overlayfs is not packaged for Termux (build from source only if needed)."
fi

# /dev/fuse is required by fuse-overlayfs (when present) and squashfuse.
[ -e /dev/fuse ] && ok "/dev/fuse present" || warn "/dev/fuse missing"

say "probing sandbox capabilities"
VROOT_HOME="$VROOT_HOME" "$(dirname "$0")/../vroot" doctor --probe || true

printf '\n'
ok "done. Add vroot to PATH, then try: vroot -python"
printf '  %s\n' "export PATH=\"$(cd "$(dirname "$0")/.." && pwd):\$PATH\""
