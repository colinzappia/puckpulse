// ============================================================
// scoutedLineupService.ts
// Saves and retrieves scouted lineups from Supabase — a team's
// roster with line/pair assignments, tied to a specific game a
// scout watched (opponent + date, both optional). Separate from
// gameReportService (needs a fully tracked game) and from the
// Team Library (a coach's own reusable roster). Every lineup is
// visible to everyone on the plan automatically — no per-lineup
// sharing toggle, matching how scouting itself works.
// ============================================================

import { supabase } from '../lib/supabaseClient';
import { Player } from '../types';

export interface SavedScoutedLineup {
  id: string;
  scoutUserId: string;
  teamName: string;
  opponent: string;
  gameDate: string;
  roster: Player[];
  logo: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveScoutedLineup(
  scoutUserId: string,
  data: {
    teamName: string;
    opponent?: string;
    gameDate?: string;
    roster: Player[];
    logo?: string;
  }
): Promise<SavedScoutedLineup> {
  const { data: row, error } = await supabase
    .from('scouted_lineups')
    .insert({
      scout_user_id: scoutUserId,
      team_name: data.teamName,
      opponent: data.opponent || null,
      game_date: data.gameDate || null,
      roster: data.roster,
      logo: data.logo || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save lineup: ${error.message}`);
  return mapLineup(row);
}

// ── Every scouted lineup on the plan — always loaded unfiltered,
// since there's no privacy distinction for this data at all.
export async function loadAllScoutedLineups(): Promise<SavedScoutedLineup[]> {
  const { data, error } = await supabase
    .from('scouted_lineups')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []).map(mapLineup);
}

export async function updateScoutedLineup(
  lineupId: string,
  data: {
    teamName?: string;
    opponent?: string;
    gameDate?: string;
    roster?: Player[];
    logo?: string;
  }
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (data.teamName !== undefined) updates.team_name = data.teamName;
  if (data.opponent !== undefined) updates.opponent = data.opponent || null;
  if (data.gameDate !== undefined) updates.game_date = data.gameDate || null;
  if (data.roster !== undefined) updates.roster = data.roster;
  if (data.logo !== undefined) updates.logo = data.logo || null;

  const { error } = await supabase
    .from('scouted_lineups')
    .update(updates)
    .eq('id', lineupId);

  if (error) throw new Error(`Failed to update lineup: ${error.message}`);
}

export async function deleteScoutedLineup(lineupId: string): Promise<void> {
  const { error } = await supabase
    .from('scouted_lineups')
    .delete()
    .eq('id', lineupId);

  if (error) throw new Error(`Failed to delete lineup: ${error.message}`);
}

function mapLineup(row: Record<string, unknown>): SavedScoutedLineup {
  return {
    id: row.id as string,
    scoutUserId: row.scout_user_id as string,
    teamName: (row.team_name as string) || '',
    opponent: (row.opponent as string) || '',
    gameDate: (row.game_date as string) || '',
    roster: (row.roster as Player[]) || [],
    logo: (row.logo as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
