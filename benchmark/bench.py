#!/usr/bin/env python3
import json
import statistics
import subprocess
import sys
import time

VROOT = "/home/user/dev/vroot/vroot"
RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 40
WARMUP = 5

CASES = [
    {
        "name": "base (blank Alpine)",
        "vroot": [VROOT, "--", "true"],
        "docker": ["docker", "run", "--rm", "alpine:3.20", "true"],
    },
    {
        "name": "node",
        "vroot": [VROOT, "-node", "--", "true"],
        "docker": ["docker", "run", "--rm", "node:22-alpine", "true"],
    },
    {
        "name": "python",
        "vroot": [VROOT, "-python", "--", "true"],
        "docker": ["docker", "run", "--rm", "python:3.12-alpine", "true"],
    },
    {
        "name": "python+sqlite+git",
        "vroot": [VROOT, "-python", "-sqlite", "-git", "--", "true"],
        "docker": ["docker", "run", "--rm", "python:3.12-alpine", "true"],
    },
    {
        "name": "kali (rolling)",
        "vroot": [VROOT, "-kali", "--", "true"],
        "docker": ["docker", "run", "--rm", "kalilinux/kali-rolling", "true"],
    },
]


def run(cmd):
    t0 = time.perf_counter()
    p = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    dt = (time.perf_counter() - t0) * 1000.0
    if p.returncode != 0:
        raise RuntimeError(f"command failed ({p.returncode}): {' '.join(cmd)}")
    return dt


def stats(s):
    return {
        "min": min(s),
        "median": statistics.median(s),
        "mean": statistics.mean(s),
        "p95": sorted(s)[int(len(s) * 0.95) - 1],
        "stdev": statistics.stdev(s) if len(s) > 1 else 0.0,
        "n": len(s),
    }


def main():
    samples = {(c["name"], impl): [] for c in CASES for impl in ("vroot", "docker")}

    print("warming up ...", file=sys.stderr)
    for c in CASES:
        for impl in ("vroot", "docker"):
            for _ in range(WARMUP):
                run(c[impl])

    print(f"measuring {RUNS} interleaved rounds ...", file=sys.stderr)
    for r in range(RUNS):
        for c in CASES:
            for impl in ("vroot", "docker"):
                samples[(c["name"], impl)].append(run(c[impl]))
        print(f"  round {r + 1}/{RUNS}", file=sys.stderr)

    results = {}
    for c in CASES:
        results[c["name"]] = {
            impl: stats(samples[(c["name"], impl)]) for impl in ("vroot", "docker")
        }
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
