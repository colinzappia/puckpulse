// ============================================================
// scoutingReportService.ts
// Saves and retrieves scouting reports from Supabase.
// A report is either tied to a saved game (game_report_id set)
// or fully standalone (is_standalone true, typed-in player and
// team, no auto-filled stats). The hard stats a tied report is
// built around live on the game_reports row itself and are not
// duplicated here.
// ============================================================

import { supabase } from '../lib/supabaseClient';

export interface ScoutRatings {
  skating?: number;
  shot?: number;
  puckSkills?: number;
  playmaking?: number;
  ozHockeySense?: number;
  dzHockeySense?: number;
  compete?: number;
  physicality?: number;
}

export interface SavedScoutingReport {
  id: string;
  gameReportId: string | null;
  teamSide: 'home' | 'away' | null;
  playerNumber: string | null;
  playerName: string;
  teamName: string | null;
  gameDate: string | null;
  isStandalone: boolean;
  scoutUserId: string;
  ratings: ScoutRatings;
  notes: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Save a new scouting report — tied to a game (pass gameReportId
// /teamSide/playerNumber) or standalone (pass teamName/gameDate/
// isStandalone: true instead) ────────────────────────────────
export async function saveScoutingReport(
  scoutUserId: string,
  data: {
    gameReportId?: string;
    teamSide?: 'home' | 'away';
    playerNumber?: string;
    playerName: string;
    teamName?: string;
    gameDate?: string;
    isStandalone?: boolean;
    ratings: ScoutRatings;
    notes: string;
    isShared: boolean;
  }
): Promise<SavedScoutingReport> {
  const { data: report, error } = await supabase
    .from('scouting_reports')
    .insert({
      game_report_id: data.gameReportId || null,
      team_side: data.teamSide || null,
      player_number: data.playerNumber || null,
      player_name: data.playerName,
      team_name: data.teamName || null,
      game_date: data.gameDate || null,
      is_standalone: data.isStandalone ?? false,
      scout_user_id: scoutUserId,
      ratings: data.ratings,
      notes: data.notes,
      is_shared: data.isShared,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save scouting report: ${error.message}`);
  return mapScoutingReport(report);
}

// ── Load all scouting reports for one game ──────────────────
export async function loadReportsForGame(gameReportId: string): Promise<SavedScoutingReport[]> {
  const { data, error } = await supabase
    .from('scouting_reports')
    .select('*')
    .eq('game_report_id', gameReportId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []).map(mapScoutingReport);
}

// ── Load one scout's own reports across all games — includes
// standalone reports too, filter by .isStandalone on the result
// if you need just one kind ──────────────────────────────────
export async function loadMyScoutingReports(scoutUserId: string): Promise<SavedScoutingReport[]> {
  const { data, error } = await supabase
    .from('scouting_reports')
    .select('*')
    .eq('scout_user_id', scoutUserId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []).map(mapScoutingReport);
}

// ── Update an existing scouting report ──────────────────────
export async function updateScoutingReport(
  reportId: string,
  data: {
    playerName?: string;
    teamName?: string;
    gameDate?: string;
    ratings?: ScoutRatings;
    notes?: string;
    isShared?: boolean;
  }
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (data.playerName !== undefined) updates.player_name = data.playerName;
  if (data.teamName !== undefined) updates.team_name = data.teamName;
  if (data.gameDate !== undefined) updates.game_date = data.gameDate;
  if (data.ratings !== undefined) updates.ratings = data.ratings;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.isShared !== undefined) updates.is_shared = data.isShared;

  const { error } = await supabase
    .from('scouting_reports')
    .update(updates)
    .eq('id', reportId);

  if (error) throw new Error(`Failed to update scouting report: ${error.message}`);
}

// ── Delete a scouting report ─────────────────────────────────
export async function deleteScoutingReport(reportId: string): Promise<void> {
  const { error } = await supabase
    .from('scouting_reports')
    .delete()
    .eq('id', reportId);

  if (error) throw new Error(`Failed to delete scouting report: ${error.message}`);
}

function mapScoutingReport(row: Record<string, unknown>): SavedScoutingReport {
  return {
    id: row.id as string,
    gameReportId: (row.game_report_id as string) || null,
    teamSide: (row.team_side as 'home' | 'away') || null,
    playerNumber: (row.player_number as string) || null,
    playerName: (row.player_name as string) || '',
    teamName: (row.team_name as string) || null,
    gameDate: (row.game_date as string) || null,
    isStandalone: (row.is_standalone as boolean) || false,
    scoutUserId: row.scout_user_id as string,
    ratings: (row.ratings as ScoutRatings) || {},
    notes: (row.notes as string) || '',
    isShared: (row.is_shared as boolean) || false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
