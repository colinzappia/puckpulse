// ============================================================
// leagueGamesService.ts
// Reads the synced league schedule (currently OHL only) from
// Supabase. Writing to this table only ever happens server-side,
// via api/sync-chl-schedule.js using the service role key — this
// file is read-only by design.
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

export async function loadLeagueGames(league: string = 'ohl'): Promise<LeagueGame[]> {
  const { data, error } = await supabase
    .from('league_games')
    .select('*')
    .eq('league', league)
    .order('game_date', { ascending: true });

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
