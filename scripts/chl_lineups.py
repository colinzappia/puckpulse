#!/usr/bin/env python3
"""
CHL Lineup Scraper
------------------
Pulls official game-day lines (4 forward lines + 3 D pairings + starting/
backup goalie) from the LeagueStat PDF cards for every OHL / WHL / QMJHL
game.

Designed to run on a schedule (GitHub Actions) and write clean JSON files
your Vercel scouts portal can consume.

Usage:
  python chl_lineups.py                  # process today's games
  python chl_lineups.py --date 2026-09-19
  python chl_lineups.py --game 28992     # single known game (OHL)

STATUS: confirmed working end-to-end against a real, completed game
(OHL game 28992, Sept 17 2026, Kingston @ Peterborough). Both team's
starting/backup goalies, all forward lines, and all defense pairs
matched an independent reference (a screenshot of that game's actual
lineup sheet) exactly. Season IDs, team codes, PDF URL construction,
and table-based parsing are all validated — this has not yet been
tested on a large batch of same-day games or wired into the live app.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo
from io import BytesIO
from pathlib import Path

import pdfplumber
import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
KEY = "f1aa699db3d81487"
FEED_BASE = "https://lscluster.hockeytech.com/feed/index.php"
PDF_BASE = "https://cluster.leaguestat.com/game-lineups"

# Confirmed against a real sync of the live schedule API (Sept 2026):
# OHL season_id "88" returned real games with the expected date range.
# WHL and QMJHL use the same platform but their own season_ids, found by
# checking multiple team schedule pages on each league's own site (not
# guessed) — see the app's own sync-chl-schedule.js for the same values.
LEAGUES = {
    "ohl": {"client_code": "ohl", "season_id": "88"},
    "whl": {"client_code": "whl", "season_id": "295"},
    "qmjhl": {"client_code": "lhjmq", "season_id": "214"},
}

OUTPUT_DIR = Path("lineups")


def today_eastern() -> str:
    """"Today" in Eastern time, not the server's own clock — GitHub's
    runners use UTC, which rolls over to the next calendar day while
    it's still evening in North America. Using the server's own date
    here caused this to look for tomorrow's games hours before any of
    tonight's had even started. Eastern isn't exactly right for WHL
    (Pacific/Mountain) either, but it's far closer than UTC for every
    league, every day, the same reasoning already applied on the
    website's own schedule picker."""
    return datetime.now(ZoneInfo("America/Toronto")).date().isoformat()


# ---------------------------------------------------------------------------
# Schedule helpers
# ---------------------------------------------------------------------------
def get_schedule(league: str) -> list[dict]:
    cfg = LEAGUES[league]
    params = {
        "feed": "modulekit",
        "key": KEY,
        "client_code": cfg["client_code"],
        "view": "schedule",
        "season_id": cfg["season_id"],
        "fmt": "json",
        "lang": "en",
    }
    r = requests.get(FEED_BASE, params=params, timeout=30)
    r.raise_for_status()
    return r.json().get("SiteKit", {}).get("Schedule", [])


def get_games_for_date(target_date: str) -> list[dict]:
    games = []
    for league in LEAGUES:
        try:
            for g in get_schedule(league):
                if g.get("date_played") == target_date:
                    g["_league"] = league
                    # The PDF URL needs the platform's own internal client
                    # code (e.g. "lhjmq" for QMJHL), not this script's own
                    # label for the league — confirmed these differ via a
                    # real PDF link, where "qmjhl" (used here before) 404'd
                    # and "lhjmq" was the actual, real path.
                    g["_client_code"] = LEAGUES[league]["client_code"]
                    games.append(g)
        except Exception as exc:
            print(f"  [warn] {league} schedule failed: {exc}", file=sys.stderr)
    return games


# ---------------------------------------------------------------------------
# PDF download
# ---------------------------------------------------------------------------
def build_pdf_url(game: dict) -> str:
    # Confirmed correct for OHL against a real game (id 28992, KGN @ PBO,
    # 2026-09-17). For QMJHL, two things needed fixing after checking a
    # real downloaded PDF's actual source URL: the league segment must be
    # the platform's own client code ("lhjmq"), not this script's label
    # ("qmjhl") — and team codes must be forced uppercase, since the API
    # returned them in a different case ("Cha"/"Cap") than the real PDF
    # URL actually uses ("CHA"/"CAP").
    visitor_code = game["visiting_team_code"].upper()
    home_code = game["home_team_code"].upper()
    return (
        f"{PDF_BASE}/{game['_client_code']}/{game['game_id']}/"
        f"{visitor_code}@{home_code}_{game['date_played']}.pdf"
    )


def download_pdf(url: str) -> bytes | None:
    try:
        r = requests.get(url, timeout=20)
        if r.status_code == 200 and "pdf" in r.headers.get("content-type", "").lower():
            return r.content
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# PDF parsing — rewritten to use pdfplumber's table detection rather than
# plain-text regex. The real lineup sheet has visible grid lines around
# both the roster list and the "Forward lines and defensemen duos" table,
# sitting side by side on the page — extract_tables() is built to detect
# exactly this kind of gridded layout, where linear text extraction can
# scramble two side-by-side tables into one confused stream.
# ---------------------------------------------------------------------------
def parse_lineup_pdf(pdf_bytes: bytes) -> dict:
    """Return {'home': {...}, 'visitor': {...}} with lines/pairs/goalies."""
    result: dict = {"home": None, "visitor": None}

    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables:
                continue

            team = _parse_one_team_from_tables(tables)
            if not team:
                continue

            # Which side this page belongs to: read from the page's own
            # text (the big "HOM"/"VIS" banner), not from table content —
            # that banner is styled page text, not a table cell. QMJHL's
            # sheet uses "LOC" (French "Local") for home instead of
            # "HOM", while "VIS" (Visitor/Visiteur) happens to be
            # identical in both languages — checked explicitly for both
            # home markers rather than assuming "not home = visitor",
            # since silently guessing the wrong side is worse than an
            # occasional genuine tie.
            page_text = page.extract_text() or ""
            first_chunk = page_text[:150].upper()
            if "HOM" in first_chunk or "LOC" in first_chunk:
                result["home"] = team
            else:
                result["visitor"] = team

    return result


def _parse_one_team_from_tables(tables: list[list[list]]) -> dict | None:
    roster_map: dict[str, str] = {}
    forward_lines: list[dict] = []
    defense_pairs: list[dict] = []
    starting_goalie_num: str | None = None
    backup_goalie_num: str | None = None

    for table in tables:
        if not table:
            continue
        # Identify a table by whether ANY of its first few rows contains
        # a recognizable marker, rather than assuming the marker sits in
        # a specific row — OHL's sheet has one header row before the
        # data starts; QMJHL's stacks a French title, an English title,
        # AND a column-label row before its data starts. Checking several
        # rows (not just row 0) and using substring matches (not exact
        # equality) catches both "LW" alone and combined labels like
        # "AG / LW".
        preview_rows = table[:4]
        preview_text = " ".join((c or "") for row in preview_rows for c in row).lower()
        is_roster_table = "roster" in preview_text or "alignement" in preview_text
        is_lines_table = any(marker in preview_text for marker in ("lw", "rw", "ld", "rd"))

        if is_roster_table:
            # Data rows have the jersey number and name combined in one
            # cell (e.g. "29 Smith, Royden") — rather than assuming a
            # fixed number of header rows to skip first, every row is
            # checked and only ones actually matching that shape count;
            # title/label rows (in whatever language, however many of
            # them) simply never match and are silently skipped.
            for row in table:
                if not row or len(row) < 2:
                    continue
                combined = (row[1] or "").strip()
                m = re.match(r"^(\d+)\s+(.+)$", combined)
                if m:
                    roster_map[m.group(1)] = m.group(2).strip()

        elif is_lines_table:
            # Same approach — a data row ("Line 1", "Trio / Line 1",
            # "Def 1", etc.) is identified by containing a digit in its
            # own label, not by its position under however many title
            # and header rows happen to precede it.
            for row in table:
                if not row or not row[0]:
                    continue
                label = row[0].strip()
                label_lower = label.lower()
                if not re.search(r"\d", label):
                    continue
                cells = [(c or "").strip() for c in row[1:]]

                if "line" in label_lower or "trio" in label_lower:
                    m = re.search(r"\d+", label)
                    nums = [c for c in cells if c.isdigit()]
                    if m and nums:
                        forward_lines.append({
                            "line": int(m.group()),
                            "players": [{"number": n, "name": roster_map.get(n, "???")} for n in nums],
                        })

                elif "def" in label_lower:
                    m = re.search(r"\d+", label)
                    nums = []
                    for c in cells:
                        if c.isdigit():
                            nums.append(c)
                            continue
                        # English "Starting" or French "Partant" for the
                        # starter; "Substitut" (no trailing "e") catches
                        # both English "Substitute" and the French
                        # "Substitut(e)" seen on QMJHL's sheet.
                        sm = re.search(r"(?:Starting|Partant)\D*#?\s*(\d+)", c, re.IGNORECASE)
                        if sm:
                            starting_goalie_num = sm.group(1)
                        bm = re.search(r"Substitut\D*#?\s*(\d+)", c, re.IGNORECASE)
                        if bm:
                            backup_goalie_num = bm.group(1)
                    if m and nums:
                        defense_pairs.append({
                            "pair": int(m.group()),
                            "players": [{"number": n, "name": roster_map.get(n, "???")} for n in nums],
                        })

    if not roster_map and not forward_lines:
        return None

    starting_goalie = (
        {"number": starting_goalie_num, "name": roster_map.get(starting_goalie_num, "???")}
        if starting_goalie_num else None
    )
    backup_goalie = (
        {"number": backup_goalie_num, "name": roster_map.get(backup_goalie_num, "???")}
        if backup_goalie_num else None
    )

    return {
        "starting_goalie": starting_goalie,
        "backup_goalie": backup_goalie,
        "forward_lines": forward_lines,
        "defense_pairs": defense_pairs,
    }


# ---------------------------------------------------------------------------
# Process one game or a whole day
# ---------------------------------------------------------------------------
def upload_to_supabase(result: dict) -> bool:
    """Push one game's result into the chl_lineups table. Skips gracefully
    (not an error) if the Supabase credentials aren't configured — that's
    expected when just running a manual test, and only required for the
    real scheduled runs."""
    supabase_url = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    # Defends against the actual root cause found: the secret's stored
    # value already included "/rest/v1" (likely copied from a Supabase
    # dashboard field labeled for that specific endpoint, not the bare
    # project URL) — appending this script's own "/rest/v1/..." on top
    # produced a doubled, invalid path. Stripped here so this works
    # correctly regardless of which form the secret holds, rather than
    # relying on it being pasted exactly one specific way.
    if supabase_url.endswith("/rest/v1"):
        supabase_url = supabase_url[: -len("/rest/v1")]
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        print("    [skip] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — not uploading, only saved locally")
        return False

    row = {
        "league": result["league"],
        "external_game_id": result["game_id"],
        "game_date": result["date"],
        "home_team_code": result["home"]["code"],
        "home_team_name": result["home"]["name"],
        "away_team_code": result["visitor"]["code"],
        "away_team_name": result["visitor"]["name"],
        "home_lines": result["home"]["lines"],
        "away_lines": result["visitor"]["lines"],
    }

    upload_url = f"{supabase_url}/rest/v1/chl_lineups"

    try:
        r = requests.post(
            upload_url,
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            params={"on_conflict": "league,external_game_id"},
            json=row,
            timeout=20,
        )
        if r.status_code not in (200, 201, 204):
            print(f"    [warn] Supabase upload failed ({r.status_code}): {r.text[:300]}")
            return False
        print("    uploaded to Supabase")
        return True
    except Exception as exc:
        print(f"    [warn] Supabase upload error: {exc}")
        return False


def clean_team_name(name: str, league: str) -> str:
    # QMJHL's API returns team names with an embedded comma (e.g.
    # "Halifax, Mooseheads") — scoped to QMJHL specifically, matching
    # the same fix already applied in sync-chl-schedule.js, since other
    # leagues don't have this formatting quirk.
    if league == "qmjhl":
        return re.sub(r",\s*", " ", name)
    return name


def delete_stale_lineup(game: dict) -> None:
    """Removes any existing chl_lineups row for a game whose PDF is no
    longer accessible. Without this, a lineup that was genuinely posted
    and correctly scraped earlier — then later pulled back or changed
    by the league — would sit in the database indefinitely looking
    exactly as current and trustworthy as a lineup scraped five minutes
    ago, since this script previously only ever added or updated rows,
    never reconsidered ones it had already saved. Silently does nothing
    if there was no existing row to remove, or if credentials aren't
    configured (same as upload_to_supabase's own skip behavior)."""
    supabase_url = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    if supabase_url.endswith("/rest/v1"):
        supabase_url = supabase_url[: -len("/rest/v1")]
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        return

    try:
        r = requests.delete(
            f"{supabase_url}/rest/v1/chl_lineups",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Prefer": "return=representation",
            },
            params={
                "league": f"eq.{game['_league']}",
                "external_game_id": f"eq.{game['game_id']}",
            },
            timeout=20,
        )
        if r.status_code == 200 and r.json():
            print(f"    removed stale lineup (was scraped earlier, no longer posted)")
    except Exception as exc:
        print(f"    [warn] failed to check/remove stale lineup: {exc}")


def process_game(game: dict) -> dict | None:
    pdf_url = build_pdf_url(game)
    print(f"  {game['visiting_team_code']} @ {game['home_team_code']}  →  {pdf_url}")

    pdf_bytes = download_pdf(pdf_url)
    if not pdf_bytes:
        print("    PDF not posted yet")
        delete_stale_lineup(game)
        return None

    parsed = parse_lineup_pdf(pdf_bytes)
    result = {
        "game_id": game["game_id"],
        "league": game["_league"],
        "date": game["date_played"],
        "time": game.get("schedule_time"),
        "status": game.get("game_status"),
        "visitor": {
            "code": game["visiting_team_code"],
            "name": clean_team_name(game["visiting_team_name"], game["_league"]),
            "lines": parsed.get("visitor"),
        },
        "home": {
            "code": game["home_team_code"],
            "name": clean_team_name(game["home_team_name"], game["_league"]),
            "lines": parsed.get("home"),
        },
        "pdf_url": pdf_url,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }
    upload_to_supabase(result)
    return result


def process_date(target_date: str, out_dir: Path = OUTPUT_DIR) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    games = get_games_for_date(target_date)
    print(f"Found {len(games)} CHL games on {target_date}\n")

    results = []
    for g in games:
        result = process_game(g)
        if result:
            results.append(result)
            path = out_dir / f"{target_date}-{g['game_id']}.json"
            path.write_text(json.dumps(result, indent=2))
            print(f"    saved → {path}")
    return results


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="CHL game-day lineup scraper")
    parser.add_argument("--date", help="YYYY-MM-DD (default: today)")
    parser.add_argument("--game", help="Single OHL game_id to test")
    parser.add_argument("--out", default="lineups", help="Output directory")
    args = parser.parse_args()

    global OUTPUT_DIR
    OUTPUT_DIR = Path(args.out)

    if args.game:
        # Quick single-game test using the confirmed real OHL example
        # (game 28992, KGN @ PBO) — update the codes/date if testing a
        # different game.
        game = {
            "game_id": args.game,
            "date_played": args.date or "2026-09-17",
            "schedule_time": "",
            "game_status": "",
            "visiting_team_code": "KGN",
            "visiting_team_name": "Kingston Frontenacs",
            "home_team_code": "PBO",
            "home_team_name": "Peterborough Petes",
            "_league": "ohl",
            "_client_code": "ohl",
        }
        result = process_game(game)
        if result:
            print(json.dumps(result, indent=2))
        return

    target = args.date or today_eastern()
    results = process_date(target)
    print(f"\nDone. {len(results)} lineup files written to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
