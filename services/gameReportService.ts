// ============================================================
// gameReportService.ts
// Saves and retrieves game reports from Supabase.
// Stores raw game data so reports can be regenerated
// on demand without storing large files.
// ============================================================
 
import { supabase } from '../lib/supabaseClient';
import { GameEvent, Player } from '../types';
 
export interface SavedGameReport {
  id: string;
  userId: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homeLogo: string;
  awayLogo: string;
  periods: number;
  events: GameEvent[];
  homeRoster: Player[];
  awayRoster: Player[];
  isShared: boolean;
  playedAt: string;
  createdAt: string;
}
 
// ── Save a game report ──────────────────────────────────────
export async function saveGameReport(
  userId: string,
  data: {
    homeName: string;
    awayName: string;
    homeScore: number;
    awayScore: number;
    homeLogo: string;
    awayLogo: string;
    periods: number;
    events: GameEvent[];
    homeRoster: Player[];
    awayRoster: Player[];
    isShared: boolean;
  }
): Promise<SavedGameReport> {
  const { data: report, error } = await supabase
    .from('game_reports')
    .insert({
      user_id: userId,
      home_name: data.homeName,
      away_name: data.awayName,
      home_score: data.homeScore,
      away_score: data.awayScore,
      home_logo: data.homeLogo,
      away_logo: data.awayLogo,
      periods: data.periods,
      events: data.events,
      home_roster: data.homeRoster,
      away_roster: data.awayRoster,
      is_shared: data.isShared,
      played_at: new Date().toISOString(),
    })
    .select()
    .single();
 
  if (error) throw new Error(`Failed to save report: ${error.message}`);
  return mapReport(report);
}
 
// ── Load my game reports ────────────────────────────────────
export async function loadMyReports(userId: string): Promise<SavedGameReport[]> {
  const { data, error } = await supabase
    .from('game_reports')
    .select('*')
    .eq('user_id', userId)
    .order('played_at', { ascending: false });
 
  if (error) return [];
  return (data || []).map(mapReport);
}
 
// ── Load shared game reports ────────────────────────────────
export async function loadSharedReports(): Promise<SavedGameReport[]> {
  const { data, error } = await supabase
    .from('game_reports')
    .select('*')
    .eq('is_shared', true)
    .order('played_at', { ascending: false });
 
  if (error) return [];
  return (data || []).map(mapReport);
}
 
// ── Toggle shared status ────────────────────────────────────
export async function toggleReportShared(reportId: string, isShared: boolean): Promise<void> {
  const { error } = await supabase
    .from('game_reports')
    .update({ is_shared: isShared })
    .eq('id', reportId);
 
  if (error) throw new Error(`Failed to update report: ${error.message}`);
}
 
// ── Delete a game report ────────────────────────────────────
export async function deleteGameReport(reportId: string): Promise<void> {
  const { error } = await supabase
    .from('game_reports')
    .delete()
    .eq('id', reportId);
 
  if (error) throw new Error(`Failed to delete report: ${error.message}`);
}
 
function mapReport(row: Record<string, unknown>): SavedGameReport {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    homeName: row.home_name as string,
    awayName: row.away_name as string,
    homeScore: row.home_score as number,
    awayScore: row.away_score as number,
    homeLogo: (row.home_logo as string) || '',
    awayLogo: (row.away_logo as string) || '',
    periods: (row.periods as number) || 3,
    events: (row.events as GameEvent[]) || [],
    homeRoster: (row.home_roster as Player[]) || [],
    awayRoster: (row.away_roster as Player[]) || [],
    isShared: (row.is_shared as boolean) || false,
    playedAt: row.played_at as string,
    createdAt: row.created_at as string,
  };
}
 
