#!/bin/sh
# mock-su -- a drop-in `su` shim for exercising vroot's privileged bridge in
# tests and on ROMs whose `su` is unusual. It is NOT a security tool: it only
# escalates when the caller already can (already root, $MOCK_SU_REAL, or sudo).
#
# It mimics the two `su` flavours vroot supports:
#     su -c "CMD"        # Magisk / Lineage / toybox   (flag style)
#     su [UID] CMD...    # AOSP / emulator             (uid style)
# and, for convenience, a bare script path:  su /path/script.sh
#
# Environment:
#     MOCK_SU_REAL=CMD        escalate via CMD (e.g. "sudo" or "/system/xbin/su")
#     MOCK_SU_ALLOW_NONROOT=1 run directly even without privilege (tests only)
#     MOCK_SU_LOG=FILE        append an invocation log (proves the bridge ran)
#
# Use it as vroot's bridge, e.g.:
#     VROOT_PRIV_BRIDGE=custom VROOT_BRIDGE_CMD=$PWD/scripts/mock-su.sh vroot -python
set -u

log=${MOCK_SU_LOG:-}
[ -n "$log" ] && printf 'mock-su: uid=%s argv=%s\n' "$(id -u 2>/dev/null)" "$*" >>"$log" 2>/dev/null

# --- parse the su-compatible argument forms into a command --------------------
case "${1:-}" in
    -c) shift; set -- sh -c "$*" ;;
    -h|--help) printf 'usage: su [WHO [COMMAND...]]\n'; exit 0 ;;
    -*) printf 'su: invalid option: %s\n' "$1" >&2; exit 1 ;;
    *)
        if [ "$#" -ge 1 ] && printf '%s' "$1" | grep -qE '^[0-9]+$'; then shift; fi
        if [ "$#" -eq 1 ] && [ -f "$1" ]; then set -- sh "$1"; fi
        [ "$#" -eq 0 ] && set -- sh
        ;;
esac

run() {
    [ "$(id -u 2>/dev/null)" = 0 ] && exec "$@"
    if [ -n "${MOCK_SU_REAL:-}" ]; then exec ${MOCK_SU_REAL} "$@"; fi
    if [ "${MOCK_SU_ALLOW_NONROOT:-0}" = 1 ]; then exec "$@"; fi
    command -v sudo >/dev/null 2>&1 && exec sudo "$@"
    # Delegate to a real `su`, as long as it isn't this very script.
    realsu=$(command -v su 2>/dev/null || true)
    if [ -n "$realsu" ]; then
        me=$(readlink -f "$0" 2>/dev/null || printf '%s' "$0")
        rs=$(readlink -f "$realsu" 2>/dev/null || printf '%s' "$realsu")
        if [ "$me" != "$rs" ]; then
            if "$realsu" -c true >/dev/null 2>&1; then exec "$realsu" -c "$*"
            else exec "$realsu" 0 "$@"; fi
        fi
    fi
    printf 'mock-su: cannot escalate; set MOCK_SU_REAL or MOCK_SU_ALLOW_NONROOT=1\n' >&2
    exit 126
}

run "$@"
