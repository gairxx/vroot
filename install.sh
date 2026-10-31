#!/bin/sh
# vroot installer — one line, no sudo, no daemon.
#
#   curl -fsSL https://raw.githubusercontent.com/gairxx/vroot/main/install.sh | sh
#
# Installs the launcher and its recipe catalogue under ~/.local by default.
# Run with --help for options.
set -eu

REPO="gairxx/vroot"
REF="${VROOT_VERSION:-main}"
PREFIX="${VROOT_PREFIX:-${HOME}/.local}"
UNINSTALL=0

die() { printf 'vroot: %s\n' "$*" >&2; exit 1; }
say() { printf '%s\n' "$*"; }

usage() {
	cat <<'EOF'
vroot installer

Usage: install.sh [options]

  --prefix DIR     install under DIR (default: $HOME/.local)
  --version REF    git branch or tag to install (default: main)
  --uninstall      remove the installed copy (keeps sandboxes/images)
  -h, --help       show this help

Environment: VROOT_PREFIX, VROOT_VERSION
EOF
}

while [ $# -gt 0 ]; do
	case "$1" in
		--prefix)
			[ $# -ge 2 ] || die "--prefix needs a directory"
			PREFIX="$2"; shift 2 ;;
		--prefix=*) PREFIX="${1#*=}"; shift ;;
		--version)
			[ $# -ge 2 ] || die "--version needs a branch or tag"
			REF="$2"; shift 2 ;;
		--version=*) REF="${1#*=}"; shift ;;
		--uninstall) UNINSTALL=1; shift ;;
		-h|--help) usage; exit 0 ;;
		*) die "unknown option: $1 (try --help)" ;;
	esac
done

DEST="${PREFIX}/lib/vroot"
BINDIR="${PREFIX}/bin"

if [ "$UNINSTALL" = 1 ]; then
	rm -f "${BINDIR}/vroot"
	rm -rf "$DEST"
	say "vroot removed from ${PREFIX}"
	say "sandboxes and images were kept in \${VROOT_HOME:-\$HOME/.local/share/vroot}"
	exit 0
fi

command -v tar >/dev/null 2>&1 || die "tar is required"

download() { # url dest
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$1" -o "$2"
	elif command -v wget >/dev/null 2>&1; then
		wget -qO "$2" "$1"
	else
		die "need curl or wget to download vroot"
	fi
}

tmp=$(mktemp -d 2>/dev/null || mktemp -d -t vroot) || die "cannot create temp dir"
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

pkg="$tmp/pkg"
mkdir -p "$pkg"

# Install the working tree when the script sits in a checkout; otherwise fetch
# a tarball from the repository.
self=$(CDPATH= cd -- "$(dirname -- "$0")" 2>/dev/null && pwd || true)
if [ -n "${self:-}" ] && [ -f "$self/vroot" ] && [ -d "$self/recipes" ]; then
	say "installing from ${self}"
	src="$self"
else
	case "$REF" in
		v[0-9]*) kind=refs/tags ;;
		*)       kind=refs/heads ;;
	esac
	url="https://codeload.github.com/${REPO}/tar.gz/${kind}/${REF}"
	say "downloading ${REPO}@${REF}"
	download "$url" "$tmp/src.tar.gz" || die "download failed: ${url}"
	mkdir -p "$tmp/x"
	tar -xzf "$tmp/src.tar.gz" -C "$tmp/x" || die "could not unpack archive"
	src=$(find "$tmp/x" -mindepth 1 -maxdepth 1 -type d | head -n 1)
	[ -n "$src" ] && [ -d "$src" ] || die "unexpected archive layout"
fi

for f in vroot install.sh recipes docs examples LICENSE README.md; do
	[ -e "${src}/${f}" ] || continue
	cp -R "${src}/${f}" "$pkg/"
done

[ -f "$pkg/vroot" ] || die "install failed: vroot not found in package"
[ -d "$pkg/recipes" ] || die "install failed: recipes/ missing"
chmod 755 "$pkg/vroot"
[ -f "$pkg/install.sh" ] && chmod 755 "$pkg/install.sh"

mkdir -p "${PREFIX}/lib" "$BINDIR"
rm -rf "$DEST"
mv "$pkg" "$DEST" || die "cannot write to ${DEST}"
ln -sfn "$DEST/vroot" "${BINDIR}/vroot"

say ""
say "vroot installed: ${BINDIR}/vroot"
case ":${PATH}:" in
	*":${BINDIR}:"*) ;;
	*) say "add it to PATH:  export PATH=\"${BINDIR}:\$PATH\"" ;;
esac
say "try:   vroot -python"
say "check: vroot doctor"
