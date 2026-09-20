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

STATUS: the schedule-fetching half of this (season IDs, team codes, PDF
URL construction) is confirmed correct against a real live API response.
The PDF-parsing half (parse_lineup_pdf / _parse_one_team) has been
rewritten to use pdfplumber's table detection, which should handle the
real two-column page layout far better than plain-text regex — but it
has NOT been run against a real, current lineup PDF yet. Test it against
one before trusting it for a real game.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime, timezone
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
                    games.append(g)
        except Exception as exc:
            print(f"  [warn] {league} schedule failed: {exc}", file=sys.stderr)
    return games


# ---------------------------------------------------------------------------
# PDF download
# ---------------------------------------------------------------------------
def build_pdf_url(game: dict) -> str:
    # Confirmed correct: a real game (id 28992, KGN @ PBO, 2026-09-17)
    # produces exactly the URL the league itself uses for that game's
    # actual lineup sheet.
    return (
        f"{PDF_BASE}/{game['_league']}/{game['game_id']}/"
        f"{game['visiting_team_code']}@{game['home_team_code']}_{game['date_played']}.pdf"
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
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if not tables:
                print(f"    [debug] page {page_num}: extract_tables() found nothing")
                print(f"    [debug] page {page_num} raw text (first 500 chars):")
                print("    " + repr((page.extract_text() or "")[:500]))
                continue

            print(f"    [debug] page {page_num}: {len(tables)} table(s) found")
            for t_idx, table in enumerate(tables):
                print(f"    [debug] table {t_idx}: {len(table)} row(s), header={table[0] if table else None}")
                # Full rows for the roster and lines/pairs tables (where
                # the data we actually need lives) — short preview for
                # the rest (scratches, staff, officials).
                header_preview = " ".join((c or "") for c in (table[0] if table else [])).lower()
                is_relevant = "roster" in header_preview or (len(table) > 1 and any(
                    (c or "").strip() in ("LW", "C", "RW", "LD", "RD") for c in table[1]
                ))
                rows_to_show = table if is_relevant else table[:5]
                for r_idx, row in enumerate(rows_to_show):
                    print(f"    [debug]   row {r_idx}: {row}")

            team = _parse_one_team_from_tables(tables)
            if not team:
                print(f"    [debug] page {page_num}: tables found but none matched a roster/lines header — nothing extracted")
                continue

            # Which side this page belongs to: read from the page's own
            # text (the big "HOM"/"VIS" banner), not from table content —
            # that banner is styled page text, not a table cell.
            page_text = page.extract_text() or ""
            first_chunk = page_text[:150].upper()
            if "HOM" in first_chunk:
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
        if not table or not table[0]:
            continue
        header = [(c or "").strip() for c in table[0]]
        header_joined = " ".join(header).lower()

        # --- Roster table: "# | Roster | Status" ---
        # Real row shape confirmed against a live PDF: jersey number and
        # name arrive combined in ONE cell — e.g. row = ['GB', '29 Smith,
        # Royden', None, None] — not as separate columns like the header
        # implies. Split that combined cell with a regex instead of
        # expecting the number alone. Slot ("GB"/"GK"/a line number)
        # doesn't say who's starting in goal; that comes from the
        # "Starting #" / "Substitute #" text in the lines table below,
        # matched back to this same roster_map by jersey number.
        if "roster" in header_joined:
            for row in table[1:]:
                if not row or len(row) < 2:
                    continue
                combined = (row[1] or "").strip()
                m = re.match(r"^(\d+)\s+(.+)$", combined)
                if m:
                    roster_map[m.group(1)] = m.group(2).strip()

        # --- Lines/pairs table: title row ("Forwards lines and
        # defensemen duos") is separate from the actual column-label row
        # (LW/C/RW or LD/RD) right under it — confirmed against a live
        # PDF, so both the first and second rows need checking, not just
        # the first. ---
        elif (
            any(h in header for h in ("LW", "C", "RW", "LD", "RD"))
            or (len(table) > 1 and any((c or "").strip() in ("LW", "C", "RW", "LD", "RD") for c in table[1]))
        ):
            for row in table[1:]:
                if not row or not row[0]:
                    continue
                label = row[0].strip()
                cells = [(c or "").strip() for c in row[1:]]

                if label.lower().startswith("line"):
                    m = re.search(r"\d+", label)
                    nums = [c for c in cells if c.isdigit()]
                    if m and nums:
                        forward_lines.append({
                            "line": int(m.group()),
                            "players": [{"number": n, "name": roster_map.get(n, "???")} for n in nums],
                        })

                elif label.lower().startswith("def"):
                    m = re.search(r"\d+", label)
                    nums = []
                    for c in cells:
                        if c.isdigit():
                            nums.append(c)
                            continue
                        sm = re.search(r"Starting\s*#\s*(\d+)", c)
                        if sm:
                            starting_goalie_num = sm.group(1)
                        bm = re.search(r"Substitute\s*#\s*(\d+)", c)
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
def process_game(game: dict) -> dict | None:
    pdf_url = build_pdf_url(game)
    print(f"  {game['visiting_team_code']} @ {game['home_team_code']}  →  {pdf_url}")

    pdf_bytes = download_pdf(pdf_url)
    if not pdf_bytes:
        print("    PDF not posted yet")
        return None

    parsed = parse_lineup_pdf(pdf_bytes)
    return {
        "game_id": game["game_id"],
        "league": game["_league"],
        "date": game["date_played"],
        "time": game.get("schedule_time"),
        "status": game.get("game_status"),
        "visitor": {
            "code": game["visiting_team_code"],
            "name": game["visiting_team_name"],
            "lines": parsed.get("visitor"),
        },
        "home": {
            "code": game["home_team_code"],
            "name": game["home_team_name"],
            "lines": parsed.get("home"),
        },
        "pdf_url": pdf_url,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


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
        }
        result = process_game(game)
        if result:
            print(json.dumps(result, indent=2))
        return

    target = args.date or date.today().isoformat()
    results = process_date(target)
    print(f"\nDone. {len(results)} lineup files written to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
