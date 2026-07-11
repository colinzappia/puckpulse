// ============================================================
// teamLibraryService.ts
// Saves and retrieves team rosters from Supabase.
// Each user has private teams + can access shared org teams.
// ============================================================
 
import { supabase } from '../lib/supabaseClient';
import { Player } from '../types';
 
export interface SavedTeam {
  id: string;
  userId: string;
  name: string;
  league: string;
  roster: Player[];
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}
 
// ── Save a new team ─────────────────────────────────────────
export async function saveTeam(
  userId: string,
  name: string,
  league: string,
  roster: Player[],
  isShared: boolean,
): Promise<SavedTeam> {
  const { data, error } = await supabase
    .from('teams')
    .insert({ user_id: userId, name, league, roster, is_shared: isShared })
    .select()
    .single();
 
  if (error) throw new Error(`Failed to save team: ${error.message}`);
  return mapTeam(data);
}
 
// ── Update an existing team ─────────────────────────────────
export async function updateTeam(
  teamId: string,
  updates: Partial<{ name: string; league: string; roster: Player[]; isShared: boolean }>,
): Promise<void> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.league !== undefined) dbUpdates.league = updates.league;
  if (updates.roster !== undefined) dbUpdates.roster = updates.roster;
  if (updates.isShared !== undefined) dbUpdates.is_shared = updates.isShared;
 
  const { error } = await supabase.from('teams').update(dbUpdates).eq('id', teamId);
  if (error) throw new Error(`Failed to update team: ${error.message}`);
}
 
// ── Delete a team ───────────────────────────────────────────
export async function deleteTeam(teamId: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw new Error(`Failed to delete team: ${error.message}`);
}
 
// ── Load my teams ───────────────────────────────────────────
export async function loadMyTeams(userId: string): Promise<SavedTeam[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
 
  if (error) return [];
  return (data || []).map(mapTeam);
}
 
// ── Load shared teams (visible to all users) ────────────────
export async function loadSharedTeams(): Promise<SavedTeam[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('is_shared', true)
    .order('name', { ascending: true });
 
  if (error) return [];
  return (data || []).map(mapTeam);
}
 
// ── Check if a team with this name already exists ───────────
export async function findExistingTeam(
  userId: string,
  name: string,
): Promise<SavedTeam | null> {
  const { data } = await supabase
    .from('teams')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', name.trim())
    .single();
 
  return data ? mapTeam(data) : null;
}
 
function mapTeam(row: Record<string, unknown>): SavedTeam {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    league: (row.league as string) || '',
    roster: (row.roster as Player[]) || [],
    isShared: (row.is_shared as boolean) || false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
 
