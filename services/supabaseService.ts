// @ts-ignore
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: any = null;

function getClient() {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!client) client = createClient(supabaseUrl, supabaseKey);
  return client;
}

export interface GameState {
  home_name: string;
  away_name: string;
  current_period: number;
  events: any[];
  home_roster: any[];
  away_roster: any[];
}

export async function saveGameSession(userId: string, state: GameState): Promise<boolean> {
  try {
    const sb = getClient();
    if (!sb) return false;

    const { data: existing } = await sb
      .from('game_sessions')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing?.id) {
      await sb.from('game_sessions').update({
        ...state,
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);
    } else {
      await sb.from('game_sessions').insert({
        user_id: userId,
        ...state
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function loadGameSession(userId: string): Promise<GameState | null> {
  try {
    const sb = getClient();
    if (!sb) return null;

    const { data } = await sb
      .from('game_sessions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) return null;

    return {
      home_name: data.home_name,
      away_name: data.away_name,
      current_period: data.current_period,
      events: data.events || [],
      home_roster: data.home_roster || [],
      away_roster: data.away_roster || [],
    };
  } catch {
    return null;
  }
}

export async function clearGameSession(userId: string): Promise<void> {
  try {
    const sb = getClient();
    if (!sb) return;
    await sb.from('game_sessions').delete().eq('user_id', userId);
  } catch {}
}
