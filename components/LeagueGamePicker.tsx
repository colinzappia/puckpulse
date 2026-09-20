// ============================================================
// LeagueGamePicker.tsx
// Browse and search synced league games (OHL, WHL, QMJHL) to
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
  onPickBoth?: (game: { homeTeam: string; awayTeam: string; gameDate: string; league: string; externalGameId: string }) => void;
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
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [choosingSideFor, setChoosingSideFor] = useState<LeagueGame | null>(null);

  // Computed in Eastern time — correct for OHL and QMJHL, both played
  // Eastern. WHL plays Pacific/Mountain, so a very late WHL start could
  // occasionally land on the wrong side of this cutoff right around
  // Eastern midnight — a narrow edge case, not one this attempts to
  // fully solve, but using Eastern time here is still far more correct
  // than UTC or the viewer's own device timezone, either of which would
  // misclassify "today" far more often, for every league, every day.
  //
  // Built manually (convert to Eastern, then read year/month/day off
  // that) rather than via Intl.DateTimeFormat's own formatted output —
  // that formatter's exact string shape (separators, digit padding)
  // isn't perfectly guaranteed identical across every browser engine,
  // which could silently produce a string that never matches a real
  // game_date even though the underlying date is correct. Reading the
  // numeric fields off a real Date object and building the string here
  // by hand sidesteps that entirely.
  const nowInEastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
  const todayStr = `${nowInEastern.getFullYear()}-${String(nowInEastern.getMonth() + 1).padStart(2, '0')}-${String(nowInEastern.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    loadLeagueGames().then(g => {
      setGames(g);
      setLoading(false);
    });
  }, []);

  // Built from whatever leagues actually have games synced, rather than
  // a fixed OHL/WHL/QMJHL list — so a manually-imported league (GTHL,
  // Alliance, etc.) shows up here automatically too, with no code
  // change needed every time a new one gets added.
  const availableLeagues = Array.from(new Set(games.map(g => g.league))).sort();

  const todaysGames = games.filter(g => g.gameDate === todayStr);
  const leagueScoped = leagueFilter === 'all' ? todaysGames : todaysGames.filter(g => g.league === leagueFilter);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? leagueScoped.filter(g => `${g.homeTeam} ${g.awayTeam}`.toLowerCase().includes(q))
    : leagueScoped;

  // League, then start time (if known — games with no time sort first
  // within their league), then home team, so the list reads in a
  // predictable order rather than however Supabase happened to return
  // rows for the same date.
  const sorted = [...filtered].sort((a, b) => {
    if (a.league !== b.league) return a.league.localeCompare(b.league);
    const timeA = a.gameDatetime || '';
    const timeB = b.gameDatetime || '';
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return a.homeTeam.localeCompare(b.homeTeam);
  });

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
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Today's games</span>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
        </div>
        <div style={S.body}>
          {todaysGames.length > 0 && (
            <>
              <select
                value={leagueFilter}
                onChange={e => setLeagueFilter(e.target.value)}
                style={{ ...S.search, cursor: 'pointer' }}
              >
                <option value="all">All leagues ({todaysGames.length})</option>
                {availableLeagues.map(lg => (
                  <option key={lg} value={lg}>
                    {lg.toUpperCase()} ({todaysGames.filter(g => g.league === lg).length})
                  </option>
                ))}
              </select>
              <input
                style={S.search}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by team…"
              />
            </>
          )}

          {loading ? (
            <div style={S.empty}>Loading…</div>
          ) : games.length === 0 ? (
            <div style={S.empty}>
              No games synced yet.{'\n'}Go to the Lineups tab and sync a league's schedule first.
            </div>
          ) : todaysGames.length === 0 ? (
            <div style={S.empty}>No games today.</div>
          ) : filtered.length === 0 ? (
            <div style={S.empty}>
              {q ? `No games match "${query}".` : `No ${leagueFilter.toUpperCase()} games today.`}
            </div>
          ) : (
            sorted.map(g => (
              <div
                key={g.id}
                style={S.card}
                onClick={() => {
                  if (onPickBoth) {
                    onPickBoth({ homeTeam: g.homeTeam, awayTeam: g.awayTeam, gameDate: g.gameDate, league: g.league, externalGameId: g.externalGameId });
                    onClose();
                  } else {
                    setChoosingSideFor(g);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: '#34d399', border: '0.5px solid rgba(52,211,153,0.4)', borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase' as const }}>
                    {g.league}
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    {g.awayTeam} @ {g.homeTeam}
                  </div>
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
