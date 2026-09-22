#!/usr/bin/env python3
"""Codex history canary: prove the native history handoff still works against
the newest Codex Desktop release before users auto-update to it.

Resolves the latest release from the Sparkle appcast (or takes --codex), builds
the Rust probe engine, and runs every native probe scenario in disposable homes
with a loopback model endpoint. Nothing here touches ~/.codex or ORG2 profiles.

Exit status is non-zero when any scenario fails; a JSON summary is written to
--summary for the workflow to attach and to open an issue from.
"""
import argparse, hashlib, json, os, pathlib, plistlib, shutil, subprocess, sys, tempfile, time, urllib.request, zipfile
import xml.etree.ElementTree as ET

APPCAST = "https://persistent.oaistatic.com/codex-app-prod/appcast.xml"
SPARKLE = "{http://www.andymatuschak.org/xml-namespaces/sparkle}"
SCENARIOS = ["--live-writers", "--fork", "--cold-target"]
ROOT = pathlib.Path(__file__).resolve().parents[2]
PROBE = ROOT / "src-tauri/crates/agent-cli/examples/codex_history_native_probe.py"


def log(message):
    print(f"[canary] {message}", flush=True)


USER_AGENT = "ORG2-codex-history-canary/1 (+https://github.com/org2AI/ORG2)"


def fetch(url, timeout):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=timeout)


def latest_release(appcast_url):
    with fetch(appcast_url, 60) as response:
        data = response.read()
    root = ET.fromstring(data)
    best = None
    for item in root.iter("item"):
        enclosure = item.find("enclosure")
        if enclosure is None:
            continue
        url = enclosure.get("url") or ""
        version = (enclosure.get(SPARKLE + "shortVersionString")
                   or (item.findtext("title") or "").strip())
        if not url.endswith(".zip") or "darwin-arm64" not in url or not version:
            continue
        key = tuple(int(part) for part in version.split(".") if part.isdigit())
        if best is None or key > best[0]:
            best = (key, version, url, int(enclosure.get("length") or 0))
    if best is None:
        raise SystemExit("appcast has no darwin-arm64 zip enclosure")
    return best[1], best[2], best[3]


def download(url, expected_length, cache_dir):
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_dir / url.rsplit("/", 1)[-1]
    if target.exists() and (not expected_length or target.stat().st_size == expected_length):
        log(f"using cached {target.name}")
        return target
    log(f"downloading {url}")
    partial = target.with_suffix(".part")
    with fetch(url, 120) as response, open(partial, "wb") as out:
        shutil.copyfileobj(response, out, 1024 * 1024)
    if expected_length and partial.stat().st_size != expected_length:
        raise SystemExit(f"download size {partial.stat().st_size} != appcast length {expected_length}")
    partial.replace(target)
    return target


def extract_codex(archive, work_dir):
    extract_dir = work_dir / "app"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir(parents=True)
    with zipfile.ZipFile(archive) as bundle:
        bundle.extractall(extract_dir)
    apps = list(extract_dir.glob("*.app"))
    if len(apps) != 1:
        raise SystemExit(f"expected one .app in the archive, found {[a.name for a in apps]}")
    app = apps[0]
    info = plistlib.load(open(app / "Contents/Info.plist", "rb"))
    codex = app / "Contents/Resources/codex"
    if not codex.is_file():
        raise SystemExit("bundled codex binary missing from the release")
    codex.chmod(0o755)
    subprocess.run(["xattr", "-dr", "com.apple.quarantine", str(app)], check=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return codex, info.get("CFBundleShortVersionString"), info.get("CFBundleIdentifier")


def build_engine():
    log("building codex_history_probe")
    subprocess.run(["cargo", "build", "--manifest-path", str(ROOT / "src-tauri/Cargo.toml"),
                    "-p", "agent_cli", "--example", "codex_history_probe"], check=True)
    engine = ROOT / "src-tauri/target/debug/examples/codex_history_probe"
    if not engine.is_file():
        raise SystemExit("probe engine was not built")
    return engine


def run_scenario(flag, engine, codex, cwd):
    started = time.time()
    result = subprocess.run([sys.executable, str(PROBE), "--engine", str(engine), "--codex", str(codex), flag],
                            cwd=cwd, capture_output=True, text=True, timeout=900)
    output = (result.stdout + "\n" + result.stderr).strip()
    return {
        "scenario": flag.lstrip("-"),
        "passed": result.returncode == 0,
        "seconds": round(time.time() - started, 1),
        "tail": "\n".join(output.splitlines()[-40:]),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--codex", type=pathlib.Path, help="bundled codex binary to test instead of the appcast release")
    parser.add_argument("--engine", type=pathlib.Path, help="prebuilt codex_history_probe example")
    parser.add_argument("--appcast", default=APPCAST)
    parser.add_argument("--cache", type=pathlib.Path, default=pathlib.Path.home() / ".cache/codex-history-canary")
    parser.add_argument("--summary", type=pathlib.Path, default=pathlib.Path("codex-history-canary.json"))
    args = parser.parse_args()
    if sys.platform != "darwin":
        raise SystemExit("the native probe needs macOS")
    work = pathlib.Path(tempfile.mkdtemp(prefix="codex-history-canary-"))
    summary = {"appcast": args.appcast, "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    try:
        if args.codex:
            codex = args.codex.resolve()
            summary.update(release={"source": "local", "codex": str(codex)})
        else:
            version, url, length = latest_release(args.appcast)
            archive = download(url, length, args.cache)
            codex, bundle_version, bundle_id = extract_codex(archive, work)
            summary.update(release={"source": "appcast", "version": version, "url": url,
                                    "bundleVersion": bundle_version, "bundleId": bundle_id,
                                    "archiveSha256": hashlib.sha256(archive.read_bytes()).hexdigest()})
            if bundle_id != "com.openai.codex":
                raise SystemExit(f"unexpected bundle identifier {bundle_id}")
        cli_version = subprocess.run([str(codex), "--version"], capture_output=True, text=True, timeout=60)
        summary["cliVersion"] = (cli_version.stdout or cli_version.stderr).strip()
        engine = args.engine.resolve() if args.engine else build_engine()
        summary["engineSha256"] = hashlib.sha256(engine.read_bytes()).hexdigest()
        runs = []
        for flag in SCENARIOS:
            log(f"running {flag}")
            runs.append(run_scenario(flag, engine, codex, work))
            log(f"{flag}: {'pass' if runs[-1]['passed'] else 'FAIL'} in {runs[-1]['seconds']}s")
        summary["scenarios"] = runs
        summary["ok"] = all(run["passed"] for run in runs)
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
