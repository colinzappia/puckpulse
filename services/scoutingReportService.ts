// ============================================================
// scoutingReportService.ts
// Saves and retrieves scouting reports from Supabase.
// A scouting report is one scout's evaluation (ratings + notes)
// of one player from an already-saved game report. The hard
// stats it's built around live on the game_reports row itself
// and are not duplicated here.
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
  gameReportId: string;
  teamSide: 'home' | 'away';
  playerNumber: string;
  playerName: string;
  scoutUserId: string;
  ratings: ScoutRatings;
  notes: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Save a new scouting report ──────────────────────────────
export async function saveScoutingReport(
  scoutUserId: string,
  data: {
    gameReportId: string;
    teamSide: 'home' | 'away';
    playerNumber: string;
    playerName: string;
    ratings: ScoutRatings;
    notes: string;
    isShared: boolean;
  }
): Promise<SavedScoutingReport> {
  const { data: report, error } = await supabase
    .from('scouting_reports')
    .insert({
      game_report_id: data.gameReportId,
      team_side: data.teamSide,
      player_number: data.playerNumber,
      player_name: data.playerName,
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

// ── Load one scout's own reports across all games ───────────
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
    ratings?: ScoutRatings;
    notes?: string;
    isShared?: boolean;
  }
): Promise<void> {
  const updates: Record<string, unknown> = {};
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
    gameReportId: row.game_report_id as string,
    teamSide: row.team_side as 'home' | 'away',
    playerNumber: row.player_number as string,
    playerName: (row.player_name as string) || '',
    scoutUserId: row.scout_user_id as string,
    ratings: (row.ratings as ScoutRatings) || {},
    notes: (row.notes as string) || '',
    isShared: (row.is_shared as boolean) || false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
