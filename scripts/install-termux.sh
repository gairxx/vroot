#!/data/data/com.termux/files/usr/bin/sh
# vroot Termux/Android installer (best-effort).
#
# Installs the runtime dependencies vroot needs and then runs `vroot doctor`.
# It never needs root; optional pieces (mksquashfs, fuse-overlayfs) are built
# from source only when the Termux package is unavailable.
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

say "installing core dependencies"
# bubblewrap is the sandbox runtime; util-linux provides unshare; the rest are
# conveniences used by vroot's hot path.
pkg install -y bubblewrap util-linux coreutils tar gzip xz-utils zstd curl 2>/dev/null \
    && ok "core deps installed" \
    || warn "some core deps failed to install; run 'pkg install bubblewrap util-linux' manually"

# --- squashfs-tools: mksquashfs / unsquashfs ---------------------------------
if have mksquashfs && have unsquashfs; then
    ok "squashfs-tools already present"
else
    say "installing squashfs-tools"
    if pkg install -y squashfs-tools >/dev/null 2>&1 && have mksquashfs; then
        ok "squashfs-tools installed from pkg"
    else
        warn "squashfs-tools is not available as a Termux package on this device."
        warn "Build it from source (needs zstd support so 'mksquashfs -comp zstd' works):"
        cat <<'EOS'
      pkg install -y clang make zlib lz4 zstd xz liblzo
      curl -fL -o /tmp/squashfs.tar.gz \
        https://downloads.sourceforge.net/project/squashfs/squashfs/squashfs4.6.1/squashfs4.6.1.tar.gz
      tar -xzf /tmp/squashfs.tar.gz -C /tmp
      cd /tmp/squashfs4.6.1/squashfs-tools
      make LDFLAGS="-L$PREFIX/lib" CPPFLAGS="-I$PREFIX/include" \
           XZ_SUPPORT=1 LZO_SUPPORT=1 ZSTD_SUPPORT=1 \
           mksquashfs unsquashfs
      cp mksquashfs unsquashfs "$PREFIX/bin/"
EOS
        warn "vroot can still LOAD prebuilt .sqfs envs once unsquashfs exists."
    fi
fi

# --- fuse-overlayfs: userspace overlay fallback ------------------------------
if have fuse-overlayfs; then
    ok "fuse-overlayfs already present"
elif pkg install -y fuse-overlayfs >/dev/null 2>&1 && have fuse-overlayfs; then
    ok "fuse-overlayfs installed from pkg"
else
    warn "fuse-overlayfs not available as a Termux package."
    warn "It is only needed when the kernel disables user namespaces. To build:"
    cat <<'EOS'
      pkg install -y clang make pkg-config libfuse3
      pkg install -y libfuse3-static 2>/dev/null || true
      git clone https://github.com/containers/fuse-overlayfs
      cd fuse-overlayfs
      ./autogen.sh && ./configure --prefix="$PREFIX" && make && make install
EOS
fi

# /dev/fuse is required by fuse-overlayfs and by some ROMs for overlay.
[ -e /dev/fuse ] && ok "/dev/fuse present" || warn "/dev/fuse missing; fuse-overlayfs will not work"

say "probing sandbox capabilities"
VROOT_HOME="$VROOT_HOME" "$(dirname "$0")/../vroot" doctor --probe || true

printf '\n'
ok "done. Add vroot to PATH, then try: vroot -python"
printf '  %s\n' "export PATH=\"$(cd "$(dirname "$0")/.." && pwd):\$PATH\""
