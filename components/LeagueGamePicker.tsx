// ============================================================
// LeagueGamePicker.tsx
// Browse and search synced league games (currently OHL only) to
// pick a specific one instead of typing team names and a date by
// hand. Two modes:
//   - onPickBoth: picking a game immediately fills both team
//     names + date (used when creating a two-team lineup).
//   - onPickOne: picking a game shows a follow-up step asking
//     which side the player is on, then fills one team name +
//     date (used for a single-player scouting report).
// Exactly one of the two should be passed by the parent.
// ============================================================

import React, { useEffect, useState } from 'react';
import { LeagueGame, loadLeagueGames } from '../services/leagueGamesService';

interface Props {
  onPickBoth?: (game: { homeTeam: string; awayTeam: string; gameDate: string }) => void;
  onPickOne?: (result: { teamName: string; gameDate: string }) => void;
  onClose: () => void;
}

function formatGameDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default function LeagueGamePicker({ onPickBoth, onPickOne, onClose }: Props) {
  const [games, setGames] = useState<LeagueGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [choosingSideFor, setChoosingSideFor] = useState<LeagueGame | null>(null);

  useEffect(() => {
    loadLeagueGames('ohl').then(g => {
      setGames(g);
      setLoading(false);
    });
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? games.filter(g => `${g.homeTeam} ${g.awayTeam}`.toLowerCase().includes(q))
    : games;

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 370, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 371, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { flex: 1, overflowY: 'auto' as const, padding: 16 },
    search: { width: '100%', background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' as const },
    card: { background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 8, cursor: 'pointer' as const },
    empty: { textAlign: 'center' as const, padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.7 },
    btn: (color = '#60a5fa') => ({ padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}12`, color, width: '100%' } as React.CSSProperties),
  };

  // ── Follow-up step for onPickOne: which team is the player on? ──
  if (choosingSideFor) {
    const g = choosingSideFor;
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.panel} onClick={e => e.stopPropagation()}>
          <div style={S.topbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span onClick={() => setChoosingSideFor(null)} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>←</span>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Which team is the player on?</span>
            </div>
            <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
          </div>
          <div style={S.body}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
              {g.awayTeam} @ {g.homeTeam} · {formatGameDate(g.gameDate)}
            </div>
            <button
              style={{ ...S.btn('#60a5fa'), marginBottom: 8 }}
              onClick={() => { onPickOne?.({ teamName: g.homeTeam, gameDate: g.gameDate }); onClose(); }}
            >
              {g.homeTeam} (home)
            </button>
            <button
              style={S.btn('#f87171')}
              onClick={() => { onPickOne?.({ teamName: g.awayTeam, gameDate: g.gameDate }); onClose(); }}
            >
              {g.awayTeam} (away)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={S.topbar}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Pick an OHL game</span>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
        </div>
        <div style={S.body}>
          {games.length > 0 && (
            <input
              style={S.search}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by team…"
            />
          )}

          {loading ? (
            <div style={S.empty}>Loading…</div>
          ) : games.length === 0 ? (
            <div style={S.empty}>
              No games synced yet.{'\n'}Go to the Lineups tab and tap "🔄 Sync OHL Schedule" first.
            </div>
          ) : filtered.length === 0 ? (
            <div style={S.empty}>No games match "{query}".</div>
          ) : (
            filtered.map(g => (
              <div
                key={g.id}
                style={S.card}
                onClick={() => {
                  if (onPickBoth) {
                    onPickBoth({ homeTeam: g.homeTeam, awayTeam: g.awayTeam, gameDate: g.gameDate });
                    onClose();
                  } else {
                    setChoosingSideFor(g);
                  }
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                  {g.awayTeam} @ {g.homeTeam}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  {formatGameDate(g.gameDate)}{g.venue ? ` · ${g.venue}` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
