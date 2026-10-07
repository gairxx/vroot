# Flag catalog

Every flag below is provided by a recipe in [`../recipes/`](../recipes). Run
`vroot recipe list` for the live list — the built-in set is the same as the
list here, and your own recipes in `~/.config/vroot/recipes/` are added on top.

```
vroot -python -node       # combine flags freely; they merge into one env
```

## Languages and runtimes

| Flag | Also known as | Base | What you get |
| --- | --- | --- | --- |
| `-python` | `python3`, `py` | alpine | Python 3, pip |
| `-node` | `nodejs`, `npm`, `js` | alpine | Node.js and npm |
| `-deno` | `typescript`, `ts` | alpine | Deno (built-in TypeScript) |
| `-bun` | | debian | Bun runtime (upstream installer) |
| `-php` | `php8` | alpine | PHP 8.3 with common extensions |
| `-ruby` | `gem`, `irb` | alpine | Ruby and RubyGems |
| `-perl` | `cpan` | alpine | Perl |
| `-lua` | `lua5`, `lua5.4`, `luajit` | alpine | Lua 5.4 and LuaRocks |
| `-r` | `rlang`, `rscript` | alpine | R |
| `-julia` | | debian | Julia (upstream tarball) |
| `-go` | `golang` | alpine | Go toolchain |
| `-rust` | `cargo`, `rustc` | alpine | Rust and Cargo |
| `-zig` | | alpine | Zig |
| `-nim` | `nimble` | alpine | Nim |
| `-crystal` | `shards` | alpine | Crystal |
| `-d` | `dmd`, `ldc`, `dlang` | alpine | D language (LDC + dub) |
| `-swift` | | debian | Swift toolchain (swift.org) |
| `-haskell` | `ghc`, `cabal` | alpine | GHC and Cabal |
| `-elixir` | `mix`, `iex` | alpine | Elixir on Erlang/OTP |
| `-erlang` | `erl`, `escript` | alpine | Erlang/OTP |
| `-ocaml` | `opam`, `dune` | alpine | OCaml, opam, dune |
| `-clojure` | `clj` | debian | Clojure + JVM |
| `-groovy` | | debian | Apache Groovy + JVM |

## JVM

| Flag | Also known as | Base | What you get |
| --- | --- | --- | --- |
| `-java` | `jdk`, `jre`, `javac` | alpine | OpenJDK 17 |
| `-kotlin` | `kotlinc` | debian | Kotlin compiler + JVM |
| `-scala` | `scala3` | debian | Scala 3 + JVM |

## .NET

| Flag | Also known as | Base | What you get |
| --- | --- | --- | --- |
| `-dotnet` | `.net`, `dotnet8`, `csharp`, `c#` | alpine | .NET 8 SDK |
| `-fsharp` | `f#`, `fsc` | alpine | F# on the .NET 8 SDK |

## C / C++ and systems

| Flag | Also known as | Base | What you get |
| --- | --- | --- | --- |
| `-gcc` | `cc`, `g++` | alpine | GCC C/C++ |
| `-clang` | `llvm` | alpine | Clang/LLVM |
| `-cmake` | | alpine | CMake |
| `-gfortran` | `fortran` | alpine | GNU Fortran |
| `-nasm` | `asm` | alpine | NASM assembler |

## Data, servers and tools

| Flag | Also known as | Base | What you get |
| --- | --- | --- | --- |
| `-sqlite` | `sqlite3` | alpine | SQLite CLI |
| `-postgres` | `postgresql`, `psql` | alpine | PostgreSQL server + client |
| `-mysql` | `mariadb` | alpine | MariaDB server + client |
| `-git` | `gh` | alpine | Git + SSH client |
| `-openssh` | `ssh`, `sshd` | alpine | OpenSSH client + server |
| `-curl` | `wget`, `http` | alpine | curl, wget, CA certs |
| `-vim` | `vi`, `editor` | alpine | Vim + Neovim |
| `-base` | `alpine` | alpine | bare Alpine root shell |

## Notes

- **Alpine vs Debian.** Alpine recipes are tiny and build in seconds. Debian
  recipes (`bun`, `clojure`, `groovy`, `julia`, `kotlin`, `scala`, `swift`)
  produce much larger images and require `docker` on the host for the base.
- Aliases are just `provides` entries — `vroot -python3` and `vroot -py` are the
  same environment as `vroot -python`.
- Missing something? It is a two-minute job: see
  [BUILDING.md](BUILDING.md), then `vroot recipe new NAME`.
