// ============================================================
// chlLineupsService.ts
// Reads auto-scraped CHL pre-game lineups from Supabase, written by
// scripts/chl_lineups.py running on a schedule via GitHub Actions.
// Read-only by design — writes only ever happen from that script,
// using the service role key.
// ============================================================

import { supabase } from '../lib/supabaseClient';
import { Player } from '../types';

export interface ChlLineupSide {
  starting_goalie: { number: string; name: string } | null;
  backup_goalie: { number: string; name: string } | null;
  forward_lines: { line: number; players: { number: string; name: string }[] }[];
  defense_pairs: { pair: number; players: { number: string; name: string }[] }[];
}

export interface ChlLineup {
  league: string;
  externalGameId: string;
  gameDate: string;
  homeTeamCode: string | null;
  homeTeamName: string;
  awayTeamCode: string | null;
  awayTeamName: string;
  homeLines: ChlLineupSide | null;
  awayLines: ChlLineupSide | null;
  scrapedAt: string;
}

function mapRow(row: any): ChlLineup {
  return {
    league: row.league,
    externalGameId: row.external_game_id,
    gameDate: row.game_date,
    homeTeamCode: row.home_team_code,
    homeTeamName: row.home_team_name,
    awayTeamCode: row.away_team_code,
    awayTeamName: row.away_team_name,
    homeLines: row.home_lines || null,
    awayLines: row.away_lines || null,
    scrapedAt: row.scraped_at,
  };
}

// Looks up a scraped lineup for one specific game — null if the scraper
// hasn't found/posted one yet (normal before ~1hr pre-game) or the game
// isn't a CHL game at all.
export async function findChlLineup(league: string, externalGameId: string): Promise<ChlLineup | null> {
  const { data, error } = await supabase
    .from('chl_lineups')
    .select('*')
    .eq('league', league)
    .eq('external_game_id', externalGameId)
    .maybeSingle();

  if (error) {
    console.error('[chlLineupsService] Failed to load lineup:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

// Bulk version — everything scraped for a given date in one query,
// keyed by "league-externalGameId" for fast lookup while building a
// list of many games at once, instead of one query per game.
export async function findChlLineupsForDate(gameDate: string): Promise<Map<string, ChlLineup>> {
  const { data, error } = await supabase
    .from('chl_lineups')
    .select('*')
    .eq('game_date', gameDate);

  const map = new Map<string, ChlLineup>();
  if (error) {
    console.error('[chlLineupsService] Failed to load lineups for date:', error);
    return map;
  }
  for (const row of data || []) {
    const lineup = mapRow(row);
    map.set(`${lineup.league}-${lineup.externalGameId}`, lineup);
  }
  return map;
}

// Converts one scraped side (forward lines + defense pairs + goalies)
// into the app's own Player[] roster shape, used everywhere else in
// Scouts Portal (drag-and-drop grids, scouting reports, etc.) — this is
// the one place that translation happens, so nothing else in the app
// needs to know this roster came from a scrape instead of manual entry.
export function chlLineupSideToPlayers(side: ChlLineupSide | null): Player[] {
  if (!side) return [];
  const players: Player[] = [];

  for (const fl of side.forward_lines || []) {
    const positions = ['LW', 'C', 'RW'];
    fl.players.forEach((p, idx) => {
      players.push({ number: p.number, name: p.name, position: positions[idx] || 'F', line: String(fl.line) });
    });
  }

  for (const dp of side.defense_pairs || []) {
    const positions = ['LD', 'RD'];
    dp.players.forEach((p, idx) => {
      players.push({ number: p.number, name: p.name, position: positions[idx] || 'D', line: `P${dp.pair}` });
    });
  }

  if (side.starting_goalie) {
    players.push({ number: side.starting_goalie.number, name: side.starting_goalie.name, position: 'G', line: 'G1' });
  }
  if (side.backup_goalie) {
    players.push({ number: side.backup_goalie.number, name: side.backup_goalie.name, position: 'G', line: 'G2' });
  }

  return players;
}
