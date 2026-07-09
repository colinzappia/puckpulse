// ============================================================
// sessionService.ts
// Handles creating, joining, and managing game sessions.
// All multi-user session data lives in Supabase.
// ============================================================
 
import { supabase } from '../lib/supabaseClient';
import { Player } from '../types';
 
export type SessionRole = 'admin' | 'logger' | 'viewer';
 
export interface SessionMember {
  userId: string;
  role: SessionRole;
  displayName: string;
}
 
export interface GameSession {
  id: string;
  code: string;
  homeName: string;
  awayName: string;
  homeRoster: Player[];
  awayRoster: Player[];
  period: number;
  homeScore: number;
  awayScore: number;
  status: 'active' | 'ended';
  createdBy: string;
  createdAt: string;
}
 
// ── Generate a human-readable session code ──────────────────
function generateCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (confusing)
  const digits = '0123456789';
  const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const suffix = Array.from({ length: 4 }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
  return `${prefix}-${suffix}`;
}
 
// ── Create a new session ────────────────────────────────────
export async function createSession(
  userId: string,
  homeName: string,
  awayName: string,
  homeRoster: Player[],
  awayRoster: Player[],
  memberRoles: Record<string, SessionRole>,
  displayName: string = 'Admin',
): Promise<GameSession> {
  // Try up to 3 times in case of code collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
 
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        code,
        home_name: homeName,
        away_name: awayName,
        home_roster: homeRoster,
        away_roster: awayRoster,
        period: 1,
        home_score: 0,
        away_score: 0,
        status: 'active',
        created_by: userId,
        user_id: userId,
      })
      .select()
      .single();
 
    if (sessionError) {
      if (sessionError.code === '23505') continue; // duplicate code, retry
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }
 
    // Add admin as first member
    const members: { session_id: string; user_id: string; role: SessionRole; display_name: string }[] = [
      { session_id: session.id, user_id: userId, role: 'admin', display_name: displayName },
    ];
 
    // Add other invited members
    for (const [memberId, role] of Object.entries(memberRoles)) {
      if (memberId !== userId) {
        members.push({ session_id: session.id, user_id: memberId, role });
      }
    }
 
    const { error: memberError } = await supabase.from('session_members').insert(members);
    if (memberError) throw new Error(`Failed to add members: ${memberError.message}`);
 
    return mapSession(session);
  }
 
  throw new Error('Failed to generate unique session code. Please try again.');
}
 
// ── Join an existing session by code ───────────────────────
export async function joinSession(
  userId: string,
  code: string,
  displayName: string = 'User',
): Promise<{ session: GameSession; role: SessionRole }> {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('status', 'active')
    .single();
 
  if (sessionError || !session) {
    throw new Error('Session not found. Check the code and try again.');
  }
 
  // Check if user already has a role in this session
  const { data: existing } = await supabase
    .from('session_members')
    .select('role')
    .eq('session_id', session.id)
    .eq('user_id', userId)
    .single();
 
  if (existing) {
    // Update display name in case it changed
    await supabase.from('session_members').update({ display_name: displayName })
      .eq('session_id', session.id).eq('user_id', userId);
    return { session: mapSession(session), role: existing.role as SessionRole };
  }
 
  // New user joining — default to viewer
  const { error: memberError } = await supabase
    .from('session_members')
    .insert({ session_id: session.id, user_id: userId, role: 'viewer', display_name: displayName });
 
  if (memberError) throw new Error(`Failed to join session: ${memberError.message}`);
 
  return { session: mapSession(session), role: 'viewer' };
}
 
// ── Get session by ID ───────────────────────────────────────
export async function getSession(sessionId: string): Promise<GameSession | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
 
  if (error || !data) return null;
  return mapSession(data);
}
 
// ── Get current user's role in a session ───────────────────
export async function getMyRole(sessionId: string, userId: string): Promise<SessionRole | null> {
  const { data } = await supabase
    .from('session_members')
    .select('role')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .single();
 
  return data ? (data.role as SessionRole) : null;
}
 
// ── Update a member's role (admin only) ────────────────────
export async function updateMemberRole(
  sessionId: string,
  targetUserId: string,
  newRole: SessionRole,
): Promise<void> {
  const { error } = await supabase
    .from('session_members')
    .update({ role: newRole })
    .eq('session_id', sessionId)
    .eq('user_id', targetUserId);
 
  if (error) throw new Error(`Failed to update role: ${error.message}`);
}
 
// ── Update session game state (score, period, rosters) ─────
export async function updateSessionState(
  sessionId: string,
  updates: Partial<{
    period: number;
    homeScore: number;
    awayScore: number;
    homeRoster: Player[];
    awayRoster: Player[];
    homeName: string;
    awayName: string;
  }>,
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.period !== undefined) dbUpdates.period = updates.period;
  if (updates.homeScore !== undefined) dbUpdates.home_score = updates.homeScore;
  if (updates.awayScore !== undefined) dbUpdates.away_score = updates.awayScore;
  if (updates.homeRoster !== undefined) dbUpdates.home_roster = updates.homeRoster;
  if (updates.awayRoster !== undefined) dbUpdates.away_roster = updates.awayRoster;
  if (updates.homeName !== undefined) dbUpdates.home_name = updates.homeName;
  if (updates.awayName !== undefined) dbUpdates.away_name = updates.awayName;
 
  const { error } = await supabase
    .from('game_sessions')
    .update(dbUpdates)
    .eq('id', sessionId);
 
  if (error) throw new Error(`Failed to update session: ${error.message}`);
}
 
// ── End a session (admin only) ─────────────────────────────
export async function endSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('game_sessions')
    .update({ status: 'ended' })
    .eq('id', sessionId);
 
  if (error) throw new Error(`Failed to end session: ${error.message}`);
}
 
// ── Fetch all members of a session ─────────────────────────
export async function fetchSessionMembers(sessionId: string): Promise<SessionMember[]> {
  const { data, error } = await supabase
    .from('session_members')
    .select('user_id, role, display_name')
    .eq('session_id', sessionId);
 
  if (error || !data) return [];
  return data.map(m => ({
    userId: m.user_id,
    role: m.role as SessionRole,
    displayName: m.display_name || 'User',
  }));
}
 
// ── Map DB row to GameSession type ─────────────────────────
function mapSession(row: Record<string, unknown>): GameSession {
  return {
    id: row.id as string,
    code: row.code as string,
    homeName: row.home_name as string,
    awayName: row.away_name as string,
    homeRoster: (row.home_roster as Player[]) || [],
    awayRoster: (row.away_roster as Player[]) || [],
    period: row.period as number,
    homeScore: row.home_score as number,
    awayScore: row.away_score as number,
    status: row.status as 'active' | 'ended',
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}
 
