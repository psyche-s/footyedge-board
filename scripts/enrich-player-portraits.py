"""Verify portrait references for exact ESPN IDs bridged to API-Football.

No credentials, face search, or image mirroring. Keeps URL/identity/checksum
metadata only. The checked CC0 identity crosswalk is separate from squad data.
Run from the repository: python3 scripts/enrich-player-portraits.py
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import struct
import urllib.request


def checked_png(url):
    request = urllib.request.Request(url, headers={"Accept": "image/png", "User-Agent": "FootyEdge-portrait-reference-check/1.0"})
    with urllib.request.urlopen(request, timeout=10) as response:
        data = response.read(1_500_001)
        if response.status != 200 or not response.headers.get("Content-Type", "").lower().startswith("image/png"):
            raise ValueError("not an image response")
    if len(data) < 1500 or len(data) > 1_500_000 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("invalid or placeholder-sized image")
    width, height = struct.unpack(">II", data[16:24])
    if min(width, height) < 64:
        raise ValueError("portrait too small")
    return {"url": url, "sha256": hashlib.sha256(data).hexdigest(), "width": width,
            "height": height, "bytes": len(data), "kind": "headshot"}


def main():
    root = Path.cwd()
    refs = json.loads((root / "data/player-photo-refs.json").read_text())
    identities = json.loads((root / "data/player-image-identities.json").read_text())
    existing = {pid for team in refs["teams"].values() for pid in team.get("players", {})}
    requests = {pid: p for pid, p in identities["players"].items()
                if str(p.get("key_api_football", "")).isdigit() and pid not in existing}
    checked = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    progress_file = root / "data/player-portrait-checkpoint.json"
    previous = json.loads(progress_file.read_text()) if progress_file.exists() else {}
    results = {pid: value for pid, value in previous.items() if pid in requests}
    pending = {pid: p for pid, p in requests.items() if pid not in results}

    def check(item):
        pid, bridge = item
        url = "https://media.api-sports.io/football/players/" + bridge["key_api_football"] + ".png"
        try:
            photo = checked_png(url)
            photo.update({"id": pid, "provider": "API-Football", "providerPlayerId": bridge["key_api_football"],
                          "source": "Exact ESPN ID and name matched to the checked CC0 provider crosswalk",
                          "identityRef": bridge["reep_id"], "verifiedAt": checked})
            return pid, photo
        except Exception as exc:
            return pid, {"unavailable": type(exc).__name__}

    print(json.dumps({"requests": len(requests), "remaining": len(pending), "alreadyChecked": len(results)}), flush=True)
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(check, item) for item in pending.items()]
        for count, future in enumerate(as_completed(futures), 1):
            pid, result = future.result()
            results[pid] = result
            if count % 150 == 0:
                progress_file.write_text(json.dumps(results, separators=(",", ":")))
                print(json.dumps({"checked": len(results), "images": sum("url" in x for x in results.values())}), flush=True)
    progress_file.write_text(json.dumps(results, separators=(",", ":")))

    digests = {}
    for pid, photo in results.items():
        if "sha256" in photo:
            digests.setdefault(photo["sha256"], set()).add(identities["players"][pid]["name"].casefold())
    placeholders = {digest for digest, names in digests.items() if len(names) > 1}
    approved = {pid: p for pid, p in results.items() if "url" in p and p["sha256"] not in placeholders}
    for team in refs["teams"].values():
        for pid, person in team.get("roster", {}).items():
            if pid in approved:
                team.setdefault("players", {})[pid] = {**approved[pid], "name": person["name"]}
    refs["portraitEnrichment"] = {"checkedAt": checked, "identitySource": identities["source"],
                                  "candidates": len(requests), "newVerifiedPlayers": len(approved),
                                  "unavailable": len(results) - len(approved), "placeholderDigestsRejected": len(placeholders)}
    refs["policy"] = "Verified source URLs only; no third-party image bytes stored. Exact roster identity and provider-ID crosswalk; no global face or name guessing."
    (root / "data/player-photo-refs.json").write_text(json.dumps(refs, ensure_ascii=False, indent=2) + "\n")
    registry = {}
    index = {}
    for key, team in refs["teams"].items():
        photos = list(team.get("players", {}).values())
        if photos:
            registry[key] = [[p["id"], p["name"], p["url"]] for p in photos]
        for p in photos:
            index[p["id"]] = {"id": p["id"], "name": p["name"], "url": p["url"],
                              "kind": p.get("kind", "cutout"), "provider": p.get("provider", "ESPN"),
                              "verifiedAt": p["verifiedAt"]}
    (root / "assets/player-photo-registry.js").write_text(
        "/* Verified roster identities and checked provider photo URLs. Image bytes remain upstream. */\nwindow.FE_PLAYER_PHOTOS=" +
        json.dumps(registry, ensure_ascii=False, separators=(",", ":")) + ";\n")
    (root / "data/player-photo-index.json").write_text(json.dumps(
        {"schema": "footyedge-player-photo-index-v1", "checkedAt": checked, "players": index},
        ensure_ascii=False, separators=(",", ":")) + "\n")
    report = {"checkedAt": checked, "teams": len(refs["teams"]), "uniquePlayers": len(index),
              "rosterEntries": sum(len(t.get("roster", {})) for t in refs["teams"].values()),
              "imageEntries": sum(len(t.get("players", {})) for t in refs["teams"].values()),
              "newVerifiedPlayers": len(approved), "unavailable": len(results) - len(approved)}
    print(json.dumps(report), flush=True)
    progress_file.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
