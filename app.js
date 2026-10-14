/* vroot — interactive browser demo (client-side simulation). */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * flag catalog (mirrors recipes/)
   * ------------------------------------------------------------------ */
  var FLAGS = [
    ["python", "python3,py", "alpine", "Python 3.12.13"],
    ["node", "nodejs,npm,js", "alpine", "v22.11.0"],
    ["deno", "typescript,ts", "alpine", "deno 2.1.4 (stable)"],
    ["bun", "", "debian", "1.1.4"],
    ["php", "php8", "alpine", "PHP 8.3.17"],
    ["ruby", "gem,irb", "alpine", "ruby 3.3.6p150"],
    ["perl", "cpan", "alpine", "This is perl 5, version 38, subversion 2"],
    ["lua", "lua5,lua5.4", "alpine", "Lua 5.4.7"],
    ["r", "rlang,rscript", "alpine", "R version 4.4.2 (2024-10-31)"],
    ["julia", "", "debian", "julia version 1.10.5"],
    ["go", "golang", "alpine", "go version go1.23.4 linux/amd64"],
    ["rust", "cargo,rustc", "alpine", "rustc 1.84.0 (9fc6b4312 2025-01-13)"],
    ["zig", "", "alpine", "0.13.0"],
    ["nim", "nimble", "alpine", "Nim Compiler Version 2.2.0"],
    ["crystal", "shards", "alpine", "Crystal 1.14.0"],
    ["d", "dmd,ldc", "alpine", "LDC - the D language compiler (1.38.0)"],
    ["swift", "", "debian", "Swift version 5.10.1 (swift-5.10.1-RELEASE)"],
    ["haskell", "ghc,cabal", "alpine", "The Glorious Glasgow Haskell Compilation System, version 9.4.8"],
    ["elixir", "mix,iex", "alpine", "Elixir 1.17.3 (compiled with Erlang/OTP 27)"],
    ["erlang", "erl,escript", "alpine", "Erlang/OTP 27"],
    ["ocaml", "opam,dune", "alpine", "The OCaml toplevel, version 4.14.1"],
    ["clojure", "clj,cljs", "debian", "Clojure 1.11.3"],
    ["groovy", "", "debian", "Groovy Version: 4.0.24"],
    ["java", "jdk,jre,javac", "alpine", "openjdk 17.0.13 2024-10-15"],
    ["kotlin", "kotlinc", "debian", "Kotlin version 1.9.24-release"],
    ["scala", "scala3", "debian", "Scala code runner version 3.4.2"],
    ["dotnet", ".net,dotnet8,csharp,c#", "alpine", "8.0.405"],
    ["fsharp", "f#,fsc", "alpine", "8.0.405"],
    ["gcc", "cc,g++", "alpine", "gcc (Alpine 13.2.1_git20240309) 13.2.1 20240309"],
    ["clang", "llvm", "alpine", "clang version 18.1.8"],
    ["cmake", "", "alpine", "cmake version 3.29.3"],
    ["gfortran", "fortran", "alpine", "GNU Fortran (Alpine) 13.2.1 20240309"],
    ["nasm", "asm", "alpine", "NASM version 2.16.03 compiled on Dec 26 2023"],
    ["sqlite", "sqlite3", "alpine", "3.45.3 2024-04-15 13:34:05"],
    ["postgres", "postgresql,psql", "alpine", "psql (PostgreSQL) 16.6"],
    ["mysql", "mariadb", "alpine", "mariadb  Ver 11.4.4-MariaDB"],
    ["git", "gh", "alpine", "git version 2.45.4"],
    ["openssh", "ssh,sshd", "alpine", "OpenSSH_9.7p1, OpenSSL 3.3.2"],
    ["curl", "wget,http", "alpine", "curl 8.9.1"],
    ["vim", "vi,editor", "alpine", "VIM - Vi IMproved 9.1"],
    ["base", "alpine", "alpine", "busybox v1.36.1 (2024-02-01)"],
    ["debian", "deb", "debian", "Debian GNU/Linux 12 (bookworm)"]
  ];

  var CATALOG = {}, ALIAS = {};
  FLAGS.forEach(function (f) {
    CATALOG[f[0]] = { f: f[0], base: f[2], ver: f[3], desc: "" };
    var a = f[1] ? f[1].split(",") : [];
    a.forEach(function (x) { ALIAS[x] = f[0]; });
    ALIAS[f[0]] = f[0];
  });
  var DEBIAN_FLAGS = ["bun", "clojure", "groovy", "julia", "kotlin", "scala", "swift"];

  window.VRootCat = FLAGS;
  var term = document.getElementById("term");
  if (!term) return;

  /* ------------------------------------------------------------------ *
   * state
   * ------------------------------------------------------------------ */
  var S = {
    in: false,
    tools: [],
    tbins: {},
    offline: false,
    pname: null,
    persistent: false,
    saved: [],
    binds: [],
    envs: [],
    cwd: "/root",
    hist: [],
    hi: 0,
    typing: ""
  };

  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function fmtSize(n) { return (n < 10 ? n + ".2" : n) + "M"; }
  function fileSize(flags) { return (flags.length ? 12 + flags.length * 6 : 3) + ((flags.join("").length + hash(flags.join("+")).length) % 5) + 3; }

  function binsSet() {
    var b = {};
    S.tools.forEach(function (t) { b[t] = CATALOG[t].ver; });
    return b;
  }

  /* ------------------------------------------------------------------ *
   * dom
   * ------------------------------------------------------------------ */
  var termEl = term;
  var out = document.getElementById("term-out");
  var promptEl = document.getElementById("term-prompt");
  var inputEl = document.getElementById("term-input");

  function scrollDown() { termEl.scrollTop = termEl.scrollHeight; }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function print(html, cls) {
    var d = document.createElement("div");
    d.className = cls || "";
    d.innerHTML = html;
    out.appendChild(d);
    scrollDown();
  }

  function outLn(txt) { print("<span class='c-fg'>" + esc(txt) + "</span>"); }
  function outMut(txt) { print("<span class='c-mut'>" + esc(txt) + "</span>"); }
  function outOk(txt) { print("<span class='c-grn'>" + esc(txt) + "</span>"); }
  function outErr(txt) { print("<span class='c-red'>" + esc(txt) + "</span>"); }
  function outAcc(txt) { print("<span class='c-acc'>" + esc(txt) + "</span>"); }

  function promptHTML() {
    if (!S.in) return "<span class='c-host'>you@laptop</span><span class='c-mut'>:</span><span class='c-acc'>~</span><span class='c-fg'>$</span>";
    var host = S.pname || "vroot";
    var dir = S.cwd === "/root" ? "~" : S.cwd;
    return "<span class='c-root'>root@" + host + "</span><span class='c-mut'>:</span><span class='c-acc'>" + esc(dir) + "</span><span class='c-fg'>#</span>";
  }
  function refreshPrompt() { promptEl.innerHTML = promptHTML(); }
  function echoHost(line) {
    print("<span class='c-host'>you@laptop</span><span class='c-mut'>:</span><span class='c-acc'>~</span><span class='c-fg'>$</span> <span class='c-fg'>" + esc(line) + "</span>");
  }
  function echoSandbox(line) {
    var host = S.pname || "vroot";
    var dir = S.cwd === "/root" ? "~" : S.cwd;
    print("<span class='c-root'>root@" + host + "</span><span class='c-mut'>:</span><span class='c-acc'>" + esc(dir) + "</span><span class='c-fg'>#</span> <span class='c-fg'>" + esc(line) + "</span>");
  }

  /* ------------------------------------------------------------------ *
   * helpers that build output
   * ------------------------------------------------------------------ */
  function toolNames() { return S.tools.length ? S.tools.join(", ") : "(none)"; }

  function baseOf(flags) {
    for (var i = 0; i < flags.length; i++) if (DEBIAN_FLAGS.indexOf(flags[i]) !== -1) return "debian";
    return "alpine";
  }
  function osLine() { return S.tools.indexOf("debian") !== -1 ? 'PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"' : 'NAME="Alpine Linux"'; }

  function printBanner(flags, name, oneShot, offline) {
    var env = flags.length ? flags.join("+") : "base";
    print("<span class='c-mut'>==&gt; building env '</span><span class='c-acc'>" + esc(env) + "</span><span class='c-mut'>' (base=" + baseOf(flags) + ") ...</span>");
    print("<span class='c-grn'>  ok</span><span class='c-mut'> built env -&gt; envs/</span><span class='c-acc'>" + esc(env + "-" + hash(env) + ".sqfs") + "</span><span class='c-mut'> (" + fmtSize(fileSize(flags)) + ")</span>");
    outMut("");
    var sandbox = name || "(throwaway)";
    print("<span class='c-acc'>vroot 2.1.0</span> <span class='c-mut'>sandbox:</span> <span class='c-fg'>" + esc(sandbox) + "</span>" +
      "  <span class='c-mut'>base=" + baseOf(flags) + "</span>" +
      "  <span class='c-mut'>tools=</span><span class='c-fg'>" + esc(toolNames()) + "</span>");
    print("<span class='c-mut'>  network: </span><span class='" + (offline ? "c-red" : "c-grn") + "'>" + (offline ? "OFF (unshared)" : "on") + "</span>" +
      "  <span class='c-mut'>| host /$HOME: </span><span class='c-red'>hidden</span>  " +
      "<span class='c-mut'>| uid:</span> <span class='c-fg'>0(root)</span>  <span class='c-mut'>caps: FULL</span>");
    if (oneShot) outMut("");
    else outMut("(type <exit> to leave the sandbox)");
  }

  function lsRoot() {
    return "<span class='c-acc'>/</span>\n  <span class='c-fg'>bin  boot  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var</span>";
  }
  function lsHome() {
    var parts = [".profile", ".bashrc"];
    if (S.tools.indexOf("python") !== -1) parts.push(".local");
    if (S.tools.indexOf("node") !== -1) parts.push(".npm");
    if (S.tools.indexOf("rust") !== -1) parts.push(".cargo");
    if (S.tools.indexOf("go") !== -1) parts.push("go");
    if (S.binds.length) parts.push("src");
    return "<span class='c-acc'>/root</span>\n  <span class='c-fg'>" + esc(parts.join("  ")) + "</span>";
  }
  function lsEtc() {
    return "<span class='c-acc'>/etc</span>\n  <span class='c-fg'>alpine-release  apk  profile  resolv.conf  vroot  group  passwd  hosts  hostname</span>";
  }
  function lsTmp() { return "<span class='c-acc'>/tmp</span>\n  <span class='c-fg'>(empty)</span>"; }
  function lsUsrLocal() { return "<span class='c-acc'>/usr/local</span>\n  <span class='c-fg'>bin  lib  share</span>"; }

  function lsAt(p) {
    p = p || S.cwd;
    if (p === "/root" || p === "~" || p === "") return lsHome();
    if (p === "/") return lsRoot();
    if (p === "/etc") return lsEtc();
    if (p === "/tmp") return lsTmp();
    if (p === "/usr/local") return lsUsrLocal();
    return "<span class='c-mut'>ls: cannot access '" + esc(p) + "': No such file or directory</span>";
  }
  function catAt(p) {
    if (p === "/etc/os-release") return "<span class='c-fg'>" + esc(osLine()) + "</span>\n<span class='c-fg'>ID=" + (S.tools.indexOf("debian") !== -1 ? "debian" : "alpine") + "</span>";
    if (p === "/etc/vroot/env") {
      var lines = ["export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"];
      S.envs.forEach(function (e) { lines.push("export " + e); });
      return "<span class='c-fg'>" + esc(lines.join("\n")) + "</span>";
    }
    if (p === "/root/.profile") return "<span class='c-fg'>[ -r /etc/vroot/env ] &amp;&amp; . /etc/vroot/env</span>";
    if (p === "/etc/alpine-release") return "<span class='c-fg'>3.20.3</span>";
    if (p === "/etc/debian_version") return "<span class='c-fg'>12.7</span>";
    return "<span class='c-mut'>cat: " + esc(p) + ": No such file or directory</span>";
  }

  /* simple evaluation for python3 -c / node -e print(...) */
  function evalPrint(expr) {
    var m = expr.match(/^(['"])([\s\S]*)\1$/);
    var body = m ? m[2] : expr;
    var pm = body.match(/(?:print|console\.log)\(\s*(['"])(.*?)\1\s*\)/);
    if (pm) return pm[2];
    var am = body.match(/(?:print|console\.log)\(\s*([\d\s+\-*/()%]+)\s*\)/);
    if (am) {
      try {
        var spelled = { "*": "*", x: "x" };
        var expr2 = am[1].replace(/x/g, "*");
        return String(Function("return (" + expr2 + ")")());
      } catch (e) { return "4"; }
    }
    return "(no output)";
  }

  /* ------------------------------------------------------------------ *
   * sandbox shell
   * ------------------------------------------------------------------ */
  function sandbox(line, oneShot) {
    var toks = line.trim().split(/\s+/);
    var cmd = toks[0] || "";
    var arg = line.replace(/^\s*\S+\s*/, "");
    var bins = binsSet();

    function bin(c) {
      var prim = ALIAS[c];
      if (!prim) return null;
      return S.tools.indexOf(prim) !== -1 ? prim : null;
    }

    switch (cmd) {
      case "": return;
      case "exit":
        echoSandbox(line);
        S.in = false;
        if (S.persistent && S.pname) {
          outOk("state saved to instances/" + S.pname + "/upper (copy-on-write)");
          outMut("back on the host — reuse it any time with: vroot " + S.pname);
        } else {
          outMut("throwaway sandbox discarded (tmpfs upper layer removed)");
        }
        refreshPrompt();
        return;
      case "clear": out.innerHTML = ""; if (!oneShot) echoSandbox(line); return;
      case "pwd": echoSandbox(line); outLn(S.cwd); if (oneShot) backToHost(); return;
      case "whoami": echoSandbox(line); outLn("root"); return;
      case "id": echoSandbox(line); outLn("uid=0(root) gid=0(root) groups=0(root),65534(nobody)"); return;
      case "hostname": echoSandbox(line); outLn(S.pname || "vroot"); return;
      case "uname": echoSandbox(line); outLn("Linux " + (S.pname || "vroot") + " 6.8.0-138-generic #1 SMP x86_64 GNU/Linux"); return;
      case "os-release":
      case "uname": break;
      case "ls":
        echoSandbox(line);
        print(lsAt(arg));
        return;
      case "ll":
        echoSandbox(line);
        outMut("total 12");
        print(lsAt(arg));
        return;
      case "cat":
        echoSandbox(line);
        print(catAt(arg.trim()));
        return;
      case "cd":
        echoSandbox(line);
        arg = arg.trim() || "/root";
        if (arg === "~" || arg === "/root") S.cwd = "/root";
        else if (arg === "/" ) S.cwd = "/";
        else if (arg === "..") S.cwd = S.cwd === "/" ? "/" : "/root";
        else if (arg === ".") {}
        else {
          outErr("sh: cd: " + arg + ": No such file or directory");
          break;
        }
        refreshPrompt();
        return;
      case "echo": echoSandbox(line); outLn(arg); return;
      case "env":
        echoSandbox(line);
        outLn("HOME=/root");
        outLn("PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
        outLn("TERM=xterm-256color");
        outLn("VROOT_ENV=" + (S.tools.length ? S.tools.join("+") : "base"));
        S.envs.forEach(function (e) { outLn(e); });
        return;
      case "which":
        echoSandbox(line);
        var wc = arg.trim().split(/\s+/)[0];
        var wprim = ALIAS[wc];
        if (wprim && S.tools.indexOf(wprim) !== -1) outLn(wc.indexOf("/") === -1 ? "/usr/bin/" + wc : wc);
        else outErr(wc + " not found");
        return;
      case "apt":
      case "apk":
        echoSandbox(line);
        outMut("package manager is available inside the sandbox as root");
        outOk("OK: 39 packages installed (" + toolNames() + " environment)");
        return;
      case "vroot":
        echoSandbox(line);
        outMut("you are already inside a sandbox — vroot is a host command. type <exit> to leave.");
        return;
      case "help":
        echoSandbox(line);
        outMut("try: ls, cat /etc/os-release, which <tool>, <tool> -V, pwd, env, id, echo hi, tmp, exit");
        return;
      case "ping":
        echoSandbox(line);
        if (S.offline) outErr("ping: connect: Network is unreachable (-offline enabled)");
        else print("<span class='c-fg'>PING " + esc(arg + " (93.184.216.34)") + ": 56 data bytes</span>\n<span class='c-fg'>64 bytes from 93.184.216.34: icmp_seq=0 ttl=51 time=21.4 ms</span>\n<span class='c-fg'>--- " + esc(arg + " ping statistics") + " ---</span>\n<span class='c-fg'>2 packets transmitted, 2 packets received, 0% packet loss</span>");
        return;
      default:
        break;
    }

    /* binary/version match */
    var prim = bin(cmd);
    if (prim) {
      echoSandbox(line);
      if (arg.indexOf("-c") === 0 || arg.indexOf("--version") === 0 || arg.indexOf("-V") === 0 || arg.indexOf("-v") === 0 || arg.indexOf("--help") === 0) {
        outLn(CATALOG[prim].ver);
      } else {
        outMut("usage: " + cmd + " [options]    (" + CATALOG[prim].ver + ")");
      }
      if (oneShot) backToHost();
      return;
    }
    /* python3 -c / node -e evaluation */
    var m = line.match(/^(python3?|node|deno|bun)\s+(-c|-e|=)\s*(.*)$/);
    if (m && ALIAS[m[1]] && S.tools.indexOf(ALIAS[m[1]]) !== -1) {
      echoSandbox(line);
      outLn(evalPrint(m[3]));
      if (oneShot) backToHost();
      return;
    }
    /* pip / npm installs */
    var pk = line.match(/^(pip|pip3|npm) (install|i)\s+(.*)$/);
    if (pk) {
      var pm = ALIAS[pk[1]];
      if (pm && S.tools.indexOf(pm) !== -1) {
        echoSandbox(line);
        outMut("Collecting " + pk[3]);
        outOk("Successfully installed " + pk[3] + " (inside the sandbox only)");
        return;
      }
    }
    echoSandbox(line);
    outErr("sh: " + cmd + ": not found");
  }

  function backToHost() {
    S.in = false;
    S.cwd = "/root";
    refreshPrompt();
  }

  /* ------------------------------------------------------------------ *
   * host: vroot command
   * ------------------------------------------------------------------ */
  function recipeList() {
    var rows = [];
    FLAGS.forEach(function (f) {
      rows.push("<tr><td><code>-" + f[0] + "</code></td><td><code>" + esc(f[1]) + "</code></td><td>" + f[2] + "</td><td class='mono' style='color:var(--muted)'>" + esc(f[3]) + "</td></tr>");
    });
    return "<table><thead><tr><th>flag</th><th>aliases</th><th>base</th><th>shipped version</th></tr></thead><tbody>" + rows.join("") + "</tbody></table>";
  }

  function cmdVroot(arg) {
    var toks = arg.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) { enterSandbox([], null, false); return; }

    if (toks[0] === "ls" || toks[0] === "list") {
      if (!S.saved.length) { outMut("no sandboxes yet — try: vroot -python work"); return; }
      outLn("SANDBOX    ENV                          SIZE");
      S.saved.forEach(function (n) {
        outLn(String(n).padEnd(10) + "  " + String(n + "-" + hash(n + "!")).slice(0, 28).padEnd(28) + "  " + (6 + n.length) + "M");
      });
      return;
    }
    if (toks[0] === "recipe" && toks[1] === "list") {
      print(recipeList());
      return;
    }
    if (toks[0] === "recipe") {
      outMut("recipe list|show NAME|new NAME|edit NAME|path");
      return;
    }
    if (toks[0] === "envs" || toks[0] === "images") {
      outLn("ENV IMAGE                          SIZE");
      var envs = S.saved.length ? S.saved : [];
      if (S.tools.length) envs = envs.concat([S.tools.join("+")]);
      if (!envs.length) envs.push("base");
      envs.forEach(function (e) { outLn(String(e + "-" + hash(e + "@") + ".sqfs").padEnd(28) + "  " + fmtSize(fileSize(e.split("+")))); });
      return;
    }
    if (toks[0] === "doctor") {
      outOk("bwrap: bubblewrap 0.10.0      unshare: present");
      outOk("mksquashfs: present           unsquashfs: present");
      outOk("unprivileged overlayfs: supported (copy-on-write sandboxes)");
      return;
    }
    if (toks[0] === "rm" && toks[1]) {
      var idx = S.saved.indexOf(toks[1]);
      if (idx === -1) { outErr("no such sandbox: " + toks[1]); return; }
      S.saved.splice(idx, 1);
      outOk("removed sandbox '" + toks[1] + "'");
      return;
    }
    if (toks[0] === "help") {
      outMut("vroot FLAGS [NAME] [OPTIONS] [-- COMMAND]");
      outMut("  try:  vroot -python          vroot -node -sqlite          vroot -python -- python3 -c \"print(2+2)\"");
      outMut("        vroot -python work     vroot work -- id             vroot -offline");
      outMut("  manage: vroot save work out.vroot    vroot out.vroot    vroot filetype install");
      return;
    }
    if (toks[0] === "save") {
      outOk("saved -> " + toks[1] + ".vroot  (" + (8 + toks[1].length) + "M)");
      return;
    }
    if (toks[0] === "filetype") {
      if (toks[1] === "uninstall") { outOk("file type removed: application/x-vroot-image"); return; }
      if (toks[1] === "status") {
        outLn("vroot file type");
        outLn("  type:     application/x-vroot-image");
        outLn("  globs:    *.vroot  *.sqfs");
        outLn("  mime:     ~/.local/share/mime/packages/vroot.xml [present]");
        outLn("  handler:  ~/.local/share/applications/vroot-image.desktop [present]");
        outLn("  detected: application/x-vroot-image");
        return;
      }
      outOk("file type installed: application/x-vroot-image (*.vroot, *.sqfs)");
      outOk("handler: ~/.local/share/applications/vroot-image.desktop");
      return;
    }
    if (toks[0] === "version") { outLn("vroot 2.1.0"); return; }

    /* parse flags + name + -- command */
    var flags = [], name = null, cmdTokens = null, offline = S.offline, binds = [];
    var i = 0;
    for (; i < toks.length; i++) {
      var t = toks[i];
      if (t === "--") { cmdTokens = toks.slice(i + 1); break; }
      if (t[0] === "-") {
        var opt = t.slice(1);
        if (opt === "offline" || opt === "o") { offline = true; continue; }
        if (opt === "net") { offline = false; continue; }
        if (opt === "name") { name = toks[++i]; if (name === undefined) { outErr("-name needs a value"); return; } continue; }
        if (opt === "cwd") { i++; continue; }
        if (opt === "hostname") { i++; continue; }
        if (opt === "env") { var v = toks[++i]; if (v) S.envs.push(v); continue; }
        if (opt === "v") { var bd = toks[++i]; if (bd) binds.push(bd); continue; }
        if (opt === "clean") { continue; }
        if (opt === "rm") { continue; }
        var prim = ALIAS[opt];
        if (!prim) { outErr("err unknown flag -" + opt + " (no recipe). try: vroot recipe list"); return; }
        if (flags.indexOf(prim) === -1) flags.push(prim);
        continue;
      }
      if (!/^[A-Za-z0-9._-]+$/.test(t)) { outErr("err unexpected argument: " + t); return; }
      name = t;
    }

    if (!flags.length && !name) { /* bare vroot */ }

    S.binds = binds;
    enterSandbox(flags, name, false, offline, cmdTokens);
  }

  function enterSandbox(flags, name, doneFlag, offline, cmdTokens) {
    offline = offline !== undefined ? offline : S.offline;
    var oneShot = !!cmdTokens;

    /* persistent? */
    if (name) {
      if (S.saved.indexOf(name) !== -1) {
        var ex = S.saved.join(",").split(",");
        S.persistent = true; S.pname = name;
      } else {
        S.saved.push(name);
        S.persistent = true; S.pname = name;
      }
    } else {
      S.persistent = false; S.pname = null;
    }
    S.tools = flags.slice();
    S.offline = offline;

    echoHost(S.lastLine);
    printBanner(flags, name, oneShot, offline);
    if (S.binds.length) {
      S.binds.forEach(function (b) {
        var bd = b.split(":")[1] || b.split(":")[0];
        outMut("  -v " + b + "  -> host path mounted at /" + (bd.split(":")[0] === "" ? b.split(":")[0] : (bd.split(":")[0])));
      });
    }

    if (oneShot) {
      S.in = true;
      S.cwd = "/root";
      var line = cmdTokens.join(" ");
      /* run the command with a one-shot, capturing echo, then return to host */
      S.in = true; refreshPrompt();
      sandbox(line, true);
      S.in = false; refreshPrompt();
      outMut("");
    } else {
      S.in = true;
      S.cwd = "/root";
      refreshPrompt();
    }
  }

  /* ------------------------------------------------------------------ *
   * host dispatch
   * ------------------------------------------------------------------ */
  function host(line) {
    var t = line.trim();
    if (!t) return;
    if (/^vroot(\s|$)/.test(t)) {
      S.lastLine = t;
      var rest = t.replace(/^vroot\s*/, "");
      cmdVroot(rest);
      return;
    }
    if (t === "clear") { out.innerHTML = ""; S.hist = []; return; }
    if (t === "help" || t === "man vroot") {
      outMut("host commands: vroot [flags] [NAME] [-- cmd], vroot ls, vroot recipe list, vroot envs, clear");
      return;
    }
    echoHost(t);
    outErr(tokens0(t) + ": command not found  (try: vroot -python — the host is isolated by default)");
  }
  function tokens0(x) { return x.split(/\s+/)[0]; }

  window.__vrootDemo = {
    run: function (line) {
      var printLine = line;
      if (S.in) {
        S.hist.push(line);
        sandbox(line);
      } else {
        S.hist.push(line);
        host(line);
      }
      S.hist.push = S.hist.push; // keep
      S.hi = S.hist.length;
      refreshPrompt();
      inputEl.value = "";
    }
  };

  /* ------------------------------------------------------------------ *
   * input handling
   * ------------------------------------------------------------------ */
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      var line = inputEl.value;
      if (line.trim()) {
        S.hist.push(line);
        S.hi = S.hist.length;
        window.__vrootDemo.run(line);
      } else {
        refreshPrompt();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (S.hi > 0) { S.hi--; inputEl.value = S.hist[S.hi] || ""; }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (S.hi < S.hist.length - 1) { S.hi++; inputEl.value = S.hist[S.hi] || ""; }
      else { S.hi = S.hist.length; inputEl.value = ""; }
    }
  });

  term.addEventListener("click", function () { inputEl.focus(); });
  document.addEventListener("keydown", function (e) {
    if (document.activeElement !== inputEl && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
      inputEl.focus();
    }
  });

  /* intro */
  outMut("vroot 2.1.0 — interactive demo (simulated; runs entirely in your browser)");
  outMut("");
  outLn("A root shell in a sandbox, built from a flag. Millisecond boot.");
  outLn("");
  outMut("Try typing one of these (or click a chip below):");
  outMut("  vroot                           vroot -python -- python3 -c \"print(2+2)\"");
  outMut("  vroot -node -sqlite             vroot -python work -- id");
  outMut("  vroot -php -sqlite -git         vroot -offline -- ping example.com");
  outMut("");
  refreshPrompt();
})();