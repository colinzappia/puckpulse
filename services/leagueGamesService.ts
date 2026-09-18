
// ============================================================
// leagueGamesService.ts
// Reads the synced/imported league schedule from Supabase — any
// league that's been either auto-synced (OHL, WHL, QMJHL) or
// manually imported from Excel (GTHL, Alliance, OMHA, HEO, NOHA,
// or any future one). Writing to this table only ever happens
// server-side, via api/sync-chl-schedule.js or
// api/import-league-games.js, both using the service role key —
// this file is read-only by design.
// ============================================================

import { supabase } from '../lib/supabaseClient';

export interface LeagueGame {
  id: string;
  league: string;
  externalGameId: string;
  gameDate: string;
  gameDatetime: string | null;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  venueLocation: string | null;
  status: string | null;
}

// No default league list — returns every league currently in the table,
// so a newly imported one (via Excel) shows up automatically without
// needing this file edited every time a new league gets added. Pass an
// explicit list only when the caller genuinely wants to narrow it.
export async function loadLeagueGames(leagues?: string[]): Promise<LeagueGame[]> {
  let query = supabase
    .from('league_games')
    .select('*')
    .order('game_date', { ascending: true });

  if (leagues && leagues.length > 0) {
    query = query.in('league', leagues);
  }

  const { data, error } = await query;

  if (error) {
    // Log rather than silently returning an empty list — an empty list
    // here looks identical in the UI to "nothing synced yet," which
    // made a real query failure indistinguishable from an empty table.
    console.error('[leagueGamesService] Failed to load league games:', error);
    return [];
  }
  return (data || []).map(mapGame);
}

function mapGame(row: Record<string, unknown>): LeagueGame {
  return {
    id: row.id as string,
    league: row.league as string,
    externalGameId: row.external_game_id as string,
    gameDate: row.game_date as string,
    gameDatetime: (row.game_datetime as string) || null,
    homeTeam: row.home_team as string,
    awayTeam: row.away_team as string,
    venue: (row.venue as string) || null,
    venueLocation: (row.venue_location as string) || null,
    status: (row.status as string) || null,
  };
}
