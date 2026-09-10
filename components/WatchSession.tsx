import React, { useState, useEffect, useRef } from 'react';
import ThemedBackground from './ThemedBackground';

interface WatchEvent {
  id: string;
  type: string;
  team: 'HOME' | 'AWAY';
  period: number;
  player_number?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface WatchData {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  period: number;
  events: WatchEvent[];
}

const EVENT_LABELS: Record<string, string> = {
  GOAL: '🚨 Goal',
  PENALTY: '⚠️ Penalty',
  SHOT: 'Shot',
};

const getPeriodLabel = (p: number): string => {
  if (p === 1) return '1st';
  if (p === 2) return '2nd';
  if (p === 3) return '3rd';
  if (p === 4) return 'OT';
  if (p >= 5) return `OT${p - 3}`;
  return String(p);
};

// Public, no-account spectator view — anyone with the code can watch a
// game's live score and event feed without signing up or subscribing.
// Read-only by design: this component never writes anything back, and the
// API route behind it (api/watch-session.js) only ever returns the
// specific fields a spectator should see, using the Supabase service role
// key server-side rather than exposing broader access to the browser.
const WatchSession: React.FC<{ code: string; onClose: () => void }> = ({ code, onClose }) => {
  const [data, setData] = useState<WatchData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/watch-session?code=${encodeURIComponent(code)}`);
        const json = await response.json();
        if (!response.ok) { setError(json.error || 'Could not load this game.'); setData(null); }
        else { setData(json); setError(''); }
      } catch {
        setError('Could not connect. Check your internet connection.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    pollRef.current = setInterval(fetchData, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [code]);

  const goalsAndPenalties = data?.events.filter(e => e.type === 'GOAL' || e.type === 'PENALTY').slice().reverse() || [];

  return (
    <ThemedBackground intensity="subtle">
      <div className="min-h-screen flex flex-col items-center px-4 py-10">
        <button onClick={onClose} className="fixed top-5 right-5 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center text-sm z-10">✕</button>

        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 mb-2">🏒 Watching live</p>

        {loading && <p className="text-slate-400 text-sm mt-8">Loading game...</p>}

        {error && !loading && (
          <div className="max-w-sm text-center mt-8 bg-red-900/20 border border-red-500/20 rounded-2xl p-6">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {data && !error && (
          <>
            <div className="flex items-center gap-10 mt-4 mb-8">
              <div className="text-center">
                <p className="text-xs font-black text-blue-400 uppercase tracking-wide mb-1">{data.homeName}</p>
                <p className="text-6xl font-black text-white">{data.homeScore}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{getPeriodLabel(data.period)} Period</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-black text-red-400 uppercase tracking-wide mb-1">{data.awayName}</p>
                <p className="text-6xl font-black text-white">{data.awayScore}</p>
              </div>
            </div>

            <div className="w-full max-w-md bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Live updates</p>
              {goalsAndPenalties.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No goals or penalties yet — check back soon.</p>
              ) : (
                <div className="space-y-2">
                  {goalsAndPenalties.map(e => (
                    <div key={e.id} className="flex items-center justify-between text-sm bg-white/5 rounded-xl px-3 py-2.5">
                      <span className={e.team === 'HOME' ? 'text-blue-400 font-bold' : 'text-red-400 font-bold'}>
                        {e.team === 'HOME' ? data.homeName : data.awayName}
                      </span>
                      <span className="text-white">
                        {EVENT_LABELS[e.type] || e.type}{e.player_number ? ` — #${e.player_number}` : ''}
                      </span>
                      <span className="text-slate-500 text-xs">{getPeriodLabel(e.period)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-slate-600 text-[10px] mt-6">Updates automatically every few seconds</p>
          </>
        )}
      </div>
    </ThemedBackground>
  );
};

export default WatchSession;
