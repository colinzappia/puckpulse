// ============================================================
// syncService.ts
// Handles real-time sync of game events and session state
// via Supabase real-time subscriptions.
// ============================================================
 
import { supabase } from '../lib/supabaseClient';
import { GameEvent, EventType, Team, Zone } from '../types';
import { GameSession } from './sessionService';
 
// ── Push a new event to Supabase ────────────────────────────
export async function broadcastEvent(
  sessionId: string,
  event: GameEvent,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('game_events').insert({
    id: event.id,
    session_id: sessionId,
    type: event.type,
    team: event.team,
    zone: event.zone,
    period: event.period,
    game_time: event.gameTime,
    player_number: event.playerNumber || null,
    coordinates: event.coordinates || null,
    metadata: event.metadata || null,
    logged_by: userId,
  });
