#!/usr/bin/env python3
"""Claude history canary: prove the native Claude history handoff still works
against the newest Claude Code CLI and Claude Desktop releases before users
auto-update to them.

- Claude Code CLI: resolves the latest release from downloads.claude.ai,
  verifies the manifest checksum, and runs the offline handoff fixtures with
  it (real CLI, macOS sandbox, loopback model endpoint, no account).
- Claude Desktop: resolves the current release from the Squirrel feed, extracts
  the bundle, checks its version against the connection gate mirrored from
  `src-tauri/src/harness_connections/desktop.rs`, reports whether the
  history-prepare pin in `native_app_launch.rs` still matches, and scans the
  app bundle for the catalog contract the handoff depends on.

Nothing here touches ~/.claude, Claude Desktop's data, or ORG2 profiles.
"""
import argparse, hashlib, json, os, pathlib, plistlib, re, shutil, subprocess, sys, tempfile, time, urllib.request, zipfile

USER_AGENT = "ORG2-claude-history-canary/1 (+https://github.com/org2AI/ORG2)"
CLI_BASE = "https://downloads.claude.ai/claude-code-releases"
DESKTOP_FEED = "https://downloads.claude.ai/releases/darwin/universal/RELEASES.json"
ROOT = pathlib.Path(__file__).resolve().parents[2]
HANDOFF = ROOT / "src-tauri/src/agent_sessions/cli/native_materializer/claude_history_handoff"
FIXTURES = ["offline_resume_fixture.py", "offline_completed_tools_fixture.py"]
GATE_SOURCE = ROOT / "src-tauri/src/harness_connections/desktop.rs"
PIN_SOURCE = ROOT / "src-tauri/src/market_connection/native_app_launch.rs"
# Strings Claude Desktop's catalog contract must still carry; the handoff reads
# and writes these keys (see claude_history_handoff/automatic.rs, mod.rs).
CATALOG_MARKERS = ["claude-code-sessions", "cliSessionId", "lastActivityAt", "isArchived",
                   "lastKnownAccountUuid", "profile-origin"]


def log(message):
    print(f"[canary] {message}", flush=True)


def fetch(url, timeout):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=timeout)


def download(url, target, expected_length=None):
    if target.exists() and (not expected_length or target.stat().st_size == expected_length):
        log(f"using cached {target.name}")
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    log(f"downloading {url}")
    partial = target.with_suffix(target.suffix + ".part")
    with fetch(url, 120) as response, open(partial, "wb") as out:
        shutil.copyfileobj(response, out, 1024 * 1024)
    if expected_length and partial.stat().st_size != expected_length:
        raise SystemExit(f"download size {partial.stat().st_size} != expected {expected_length}")
    partial.replace(target)
    return target


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def latest_cli(cache):
    with fetch(f"{CLI_BASE}/latest", 30) as response:
        version = response.read().decode().strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+(-[\w.]+)?", version):
        raise SystemExit(f"unexpected Claude Code version marker {version!r}")
    with fetch(f"{CLI_BASE}/{version}/manifest.json", 30) as response:
        manifest = json.load(response)
    platform = manifest["platforms"]["darwin-arm64"]
    binary = download(f"{CLI_BASE}/{version}/darwin-arm64/{platform['binary']}",
                      cache / "cli" / version / "claude", int(platform.get("size") or 0))
    actual = sha256(binary)
    if actual != platform["checksum"]:
        raise SystemExit(f"Claude Code checksum mismatch: {actual} != {platform['checksum']}")
    binary.chmod(0o755)
    return version, binary, actual


def run_fixture(name, cli, cwd):
    started = time.time()
    env = dict(os.environ, ORG2_CLAUDE_CLI=str(cli))
    result = subprocess.run([sys.executable, str(HANDOFF / name)], cwd=cwd, env=env,
                            capture_output=True, text=True, timeout=600)
    output = (result.stdout + "\n" + result.stderr).strip()
    return {"fixture": name, "passed": result.returncode == 0,
            "seconds": round(time.time() - started, 1),
            "tail": "\n".join(output.splitlines()[-40:])}


def latest_desktop(cache, work):
    with fetch(DESKTOP_FEED, 30) as response:
        feed = json.load(response)
    release = next(r for r in feed["releases"] if r["version"] == feed["currentRelease"])["updateTo"]
    archive = download(release["url"], cache / "desktop" / release["url"].rsplit("/", 1)[-1])
    extract = work / "desktop"
    extract.mkdir(parents=True)
    with zipfile.ZipFile(archive) as bundle:
        bundle.extractall(extract)
    # Helper apps live inside the bundle; only the top-level app is the release.
    apps = [p for p in extract.glob("*.app") if (p / "Contents/Info.plist").is_file()]
    if len(apps) != 1:
        raise SystemExit(f"expected one top-level .app in the archive, found {[a.name for a in apps]}")
    info = plistlib.load(open(apps[0] / "Contents/Info.plist", "rb"))
    asar = apps[0] / "Contents/Resources/app.asar"
    missing = []
    if asar.is_file():
        data = asar.read_bytes()
        missing = [m for m in CATALOG_MARKERS if m.encode() not in data]
    else:
        missing = ["app.asar"]
    return {"version": info.get("CFBundleShortVersionString"), "bundleId": info.get("CFBundleIdentifier"),
            "url": release["url"], "published": release.get("pub_date"),
            "archiveSha256": sha256(archive), "missingCatalogMarkers": missing}


def gate_bounds():
    """Mirror `validate_version` from desktop.rs and the prepare pin from
    native_app_launch.rs by reading the sources, so the canary cannot drift
    from the code silently."""
    gate = GATE_SOURCE.read_text()
    bounds = {int(m.group(1)): tuple(int(x) for x in m.group(2).split(", "))
              for m in re.finditer(r"(\d) => numbers\.as_slice\(\) >= \[(\d+, \d+, \d+)\]", gate)}
    launch = PIN_SOURCE.read_text()
    # Either the audited release line (`CLAUDE_DESKTOP_HISTORY_LINE`) or the
    # older exact-release pin; whichever the checkout carries.
    pin = re.search(r'CLAUDE_DESKTOP_HISTORY_LINE: &str = "(\d+\.\d+)"', launch) or re.search(
        r'== Some\("(\d+\.\d+\.\d+)"\)', launch)
    if not bounds or not pin:
        raise SystemExit("could not read the Claude Desktop gate/pin from the sources")
    return bounds, pin.group(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--claude", type=pathlib.Path, help="local Claude Code binary instead of the latest release")
    parser.add_argument("--skip-desktop", action="store_true", help="do not download Claude Desktop")
    parser.add_argument("--cache", type=pathlib.Path, default=pathlib.Path.home() / ".cache/claude-history-canary")
    parser.add_argument("--summary", type=pathlib.Path, default=pathlib.Path("claude-history-canary.json"))
    args = parser.parse_args()
    if sys.platform != "darwin":
        raise SystemExit("the fixtures need macOS sandbox-exec")
    work = pathlib.Path(tempfile.mkdtemp(prefix="claude-history-canary-"))
    summary = {"started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    try:
        if args.claude:
            cli = args.claude.resolve()
            summary["cli"] = {"source": "local", "path": str(cli)}
        else:
            version, cli, digest = latest_cli(args.cache)
            summary["cli"] = {"source": "release", "version": version, "sha256": digest}
        banner = subprocess.run([str(cli), "--version"], capture_output=True, text=True, timeout=60)
        summary["cli"]["banner"] = (banner.stdout or banner.stderr).strip()
        fixtures = []
        for name in FIXTURES:
            log(f"running {name}")
            fixtures.append(run_fixture(name, cli, work))
            log(f"{name}: {'pass' if fixtures[-1]['passed'] else 'FAIL'} in {fixtures[-1]['seconds']}s")
        summary["fixtures"] = fixtures
        ok = all(f["passed"] for f in fixtures)
        if not args.skip_desktop:
            log("resolving Claude Desktop")
            desktop = latest_desktop(args.cache, work)
            bounds, pin = gate_bounds()
            numbers = tuple(int(x) for x in desktop["version"].split("."))
            desktop["connectionGate"] = "supported" if numbers[0] in bounds and numbers >= bounds[numbers[0]] else "unsupported"
            desktop["historyPreparePin"] = pin
            desktop["historyPreparePinMatches"] = (
                desktop["version"] == pin or desktop["version"].startswith(pin + "."))
            summary["desktop"] = desktop
            if desktop["bundleId"] != "com.anthropic.claudefordesktop":
                raise SystemExit(f"unexpected bundle identifier {desktop['bundleId']}")
            ok = ok and desktop["connectionGate"] == "supported" and not desktop["missingCatalogMarkers"]
            log(f"desktop {desktop['version']}: gate {desktop['connectionGate']}, prepare pin {pin} "
                f"{'matches' if desktop['historyPreparePinMatches'] else 'differs'}, "
                f"missing markers {desktop['missingCatalogMarkers'] or 'none'}")
        summary["ok"] = ok
    except BaseException as error:
        summary["ok"] = False
        summary["error"] = f"{type(error).__name__}: {error}"
        raise
    finally:
        args.summary.write_text(json.dumps(summary, indent=2) + "\n")
        shutil.rmtree(work, ignore_errors=True)
    log(f"summary written to {args.summary}")
    return 0 if summary.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
