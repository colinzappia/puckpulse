import { createClient } from '@supabase/supabase-js';

// Uses the Supabase SERVICE ROLE key, not the anon key the rest of the app
// uses — this runs server-side only and is never exposed to the browser.
// That's deliberate: it lets us safely return read-only spectator data for
// an active session by its share code, without needing the viewer to be
// an authenticated, subscribed session member at all. This route must
// never accept writes, and must only ever return the specific fields a
// spectator should see — never member/account data.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'A session code is required' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Watch session error: SUPABASE_SERVICE_ROLE_KEY is not set in the environment.');
    return res.status(500).json({ error: 'Spectator viewing is not configured yet.' });
  }

  try {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('game_sessions')
      .select('id, code, home_name, away_name, home_roster, away_roster, period, home_score, away_score, status')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'No active game found for that code. It may have ended, or the code may be wrong.' });
    }

    const { data: events, error: eventsError } = await supabaseAdmin
      .from('game_events')
      .select('id, type, team, period, player_number, metadata, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    if (eventsError) {
      console.error('Watch session events error:', eventsError);
    }

    return res.status(200).json({
      homeName: session.home_name,
      awayName: session.away_name,
      homeRoster: session.home_roster,
      awayRoster: session.away_roster,
      period: session.period,
      homeScore: session.home_score,
      awayScore: session.away_score,
      events: events || [],
    });
  } catch (err) {
    console.error('Watch session error:', err);
    return res.status(500).json({ error: 'Something went wrong loading this game.' });
  }
}
