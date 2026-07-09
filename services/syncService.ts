    .order('created_at', { ascending: true });
  if (error) return [];
  return (data || []).map(mapEvent);
}
 
export function subscribeToSession(
  sessionId: string,
  callbacks: {
    onEventAdded: (event: GameEvent) => void;
    onEventDeleted: (eventId: string) => void;
    onSessionUpdated: (session: Partial<GameSession>) => void;
  }
): () => void {
  const eventsChannel = supabase
    .channel(`session-events-${sessionId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_events', filter: `session_id=eq.${sessionId}` },
      (payload) => callbacks.onEventAdded(mapEvent(payload.new as Record<string, unknown>)))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_events', filter: `session_id=eq.${sessionId}` },
      (payload) => callbacks.onEventDeleted((payload.old as Record<string, unknown>).id as string))
    .subscribe();
 
  const sessionChannel = supabase
    .channel(`session-state-${sessionId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        callbacks.onSessionUpdated({
          period: row.period as number,
          homeScore: row.home_score as number,
          awayScore: row.away_score as number,
          homeRoster: row.home_roster as [],
          awayRoster: row.away_roster as [],
          status: row.status as 'active' | 'ended',
        });
      })
    .subscribe();
 
  return () => {
    supabase.removeChannel(eventsChannel);
    supabase.removeChannel(sessionChannel);
  };
}
 
function mapEvent(row: Record<string, unknown>): GameEvent {
  return {
    id: row.id as string,
    timestamp: new Date(row.created_at as string).getTime(),
    gameTime: (row.game_time as string) || '0:00',
    period: row.period as number,
    type: row.type as EventType,
    team: row.team as Team,
    zone: (row.zone as Zone) || Zone.NEUTRAL,
    playerNumber: (row.player_number as string) || undefined,
    coordinates: (row.coordinates as { x: number; y: number }) || undefined,
    metadata: (row.metadata as Record<string, unknown>) || undefined,
  };
}
