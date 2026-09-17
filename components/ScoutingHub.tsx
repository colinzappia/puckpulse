// ============================================================
// ScoutingHub.tsx
// Standalone top-level page for all scouting work — reached
// from the main menu, not nested inside Game History. Lists
// every report you've made (tied to a tracked game, or fully
// standalone), and offers two ways to start a new one: pick a
// tracked game to auto-fill stats from, or write a freeform
// report with no game behind it.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { SavedGameReport, loadMyReports, loadSharedReports } from '../services/gameReportService';
import { SavedScoutingReport, loadMyScoutingReports } from '../services/scoutingReportService';
import { SavedScoutedLineup, loadAllScoutedLineups } from '../services/scoutedLineupService';
import { Team } from '../types';
import ScoutingReportModal from './ScoutingReportModal';
import StandaloneScoutingModal from './StandaloneScoutingModal';
import ScoutLineupModal from './ScoutLineupModal';
import LineupSheet from './LineupSheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function ScoutingHub({ isOpen, onClose }: Props) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'reports' | 'lineups'>('reports');
  const [reports, setReports] = useState<SavedScoutingReport[]>([]);
  const [games, setGames] = useState<SavedGameReport[]>([]);
  const [lineups, setLineups] = useState<SavedScoutedLineup[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingStandalone, setEditingStandalone] = useState<SavedScoutingReport | 'new' | null>(null);
  const [editingLineup, setEditingLineup] = useState<SavedScoutedLineup | 'new' | null>(null);
  const [pickingGame, setPickingGame] = useState(false);
  const [pickingPlayerFor, setPickingPlayerFor] = useState<SavedGameReport | null>(null);
  const [gameScoutTarget, setGameScoutTarget] = useState<{ report: SavedGameReport; team: Team; playerNumber: string } | null>(null);

  const refresh = () => {
    if (!user) return;
    setLoading(true);
    Promise.all([loadMyScoutingReports(user.id), loadMyReports(user.id), loadSharedReports(), loadAllScoutedLineups()])
      .then(([myReports, myGames, sharedGames, allLineups]) => {
        setReports(myReports);
        const gameMap = new Map<string, SavedGameReport>();
        [...myGames, ...sharedGames].forEach(g => gameMap.set(g.id, g));
        setGames(Array.from(gameMap.values()));
        setLineups(allLineups);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  if (!isOpen) return null;

  const gamesById = new Map(games.map(g => [g.id, g]));

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 350, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 351, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    tabBar: { display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: '#0c1018', flexShrink: 0 },
    tab: (active: boolean) => ({ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const, color: active ? '#60a5fa' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent' } as React.CSSProperties),
    body: { flex: 1, overflowY: 'auto' as const, padding: '16px' },
    card: { background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 8, cursor: 'pointer' as const },
    btn: (color = '#60a5fa') => ({ padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}12`, color, width: '100%' } as React.CSSProperties),
    search: { width: '100%', background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, marginBottom: 12 },
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredReports = q
    ? reports.filter(r => {
        const game = r.gameReportId ? gamesById.get(r.gameReportId) : null;
        const haystack = [
          r.playerName,
          r.teamName,
          game?.homeName,
          game?.awayName,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
    : reports;
  const filteredLineups = q
    ? lineups.filter(l => [l.teamName, l.opponent].filter(Boolean).join(' ').toLowerCase().includes(q))
    : lineups;

  let screen: React.ReactNode;

  // ── Sub-screen: pick which player from a chosen tracked game ──
  if (pickingPlayerFor) {
    const g = pickingPlayerFor;
    screen = (
      <>
        <div style={S.overlay} onClick={() => setPickingPlayerFor(null)} />
        <div style={S.panel}>
          <div style={S.topbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span onClick={() => setPickingPlayerFor(null)} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>←</span>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Pick a player</span>
            </div>
            <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
          </div>
          <div style={S.body}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
              {g.homeName} vs {g.awayName} · {formatDate(g.playedAt)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <LineupSheet roster={g.homeRoster} teamName={g.homeName} accent="#60a5fa" />
              <LineupSheet roster={g.awayRoster} teamName={g.awayName} accent="#f87171" />
            </div>

            <select
              defaultValue=""
              onChange={e => {
                if (!e.target.value) return;
                const [teamStr, number] = e.target.value.split('|');
                setGameScoutTarget({ report: g, team: teamStr === 'home' ? Team.HOME : Team.AWAY, playerNumber: number });
                setPickingPlayerFor(null);
              }}
              style={{ width: '100%', background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12, fontWeight: 600 }}
            >
              <option value="">Pick a player…</option>
              <optgroup label={g.homeName}>
                {g.homeRoster.map(p => (
                  <option key={`home-${p.number}`} value={`home|${p.number}`}>#{p.number} {p.name}</option>
                ))}
              </optgroup>
              <optgroup label={g.awayName}>
                {g.awayRoster.map(p => (
                  <option key={`away-${p.number}`} value={`away|${p.number}`}>#{p.number} {p.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </>
    );
  } else if (pickingGame) {
    // ── Sub-screen: pick which tracked game to scout from ──
    screen = (
      <>
        <div style={S.overlay} onClick={() => setPickingGame(false)} />
        <div style={S.panel}>
          <div style={S.topbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span onClick={() => setPickingGame(false)} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>←</span>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Pick a tracked game</span>
            </div>
            <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
          </div>
          <div style={S.body}>
            {games.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                No tracked games available yet.
              </div>
            ) : (
              games.map(g => (
                <div key={g.id} style={S.card} onClick={() => { setPickingGame(false); setPickingPlayerFor(g); }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{g.homeName} vs {g.awayName}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{formatDate(g.playedAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    );
  } else {
    // ── Main list ──
    screen = (
      <>
        <div style={S.overlay} onClick={onClose} />
        <div style={S.panel}>
          <div style={S.topbar}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Scouting Reports</span>
            <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>×</span>
          </div>

          <div style={S.tabBar}>
            <button style={S.tab(tab === 'reports')} onClick={() => setTab('reports')}>
              Reports {reports.length > 0 && `(${reports.length})`}
            </button>
            <button style={S.tab(tab === 'lineups')} onClick={() => setTab('lineups')}>
              Lineups {lineups.length > 0 && `(${lineups.length})`}
            </button>
          </div>

          <div style={S.body}>
            {tab === 'reports' ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button style={S.btn('#34d399')} onClick={() => setEditingStandalone('new')}>+ New standalone</button>
                  <button style={S.btn()} onClick={() => setPickingGame(true)}>+ From a tracked game</button>
                </div>

                {reports.length > 0 && (
                  <input
                    style={S.search}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by player or team…"
                  />
                )}

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Loading…</div>
                ) : reports.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.7 }}>
                    No scouting reports yet.
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    No reports match "{searchQuery.trim()}".
                  </div>
                ) : (
                  filteredReports.map(r => {
                    const game = r.gameReportId ? gamesById.get(r.gameReportId) : null;
                    return (
                      <div
                        key={r.id}
                        style={S.card}
                        onClick={() => {
                          if (r.isStandalone) {
                            setEditingStandalone(r);
                          } else if (game && r.teamSide && r.playerNumber) {
                            setGameScoutTarget({ report: game, team: r.teamSide === 'home' ? Team.HOME : Team.AWAY, playerNumber: r.playerNumber });
                          } else {
                            alert("This report's original game can't be found — it may have been deleted from Game History.");
                          }
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{r.playerName}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                          {game
                            ? `${game.homeName} vs ${game.awayName} · ${formatDate(game.playedAt)}`
                            : [r.teamName, r.gameDate].filter(Boolean).join(' · ') || (r.isStandalone ? 'No team or date noted' : 'Game not found')}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <button style={S.btn('#34d399')} onClick={() => setEditingLineup('new')}>+ Upload lineup</button>
                </div>

                {lineups.length > 0 && (
                  <input
                    style={S.search}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by team…"
                  />
                )}

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Loading…</div>
                ) : lineups.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.7 }}>
                    No lineups uploaded yet.{'\n'}Visible to everyone on your plan once you add one.
                  </div>
                ) : filteredLineups.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    No lineups match "{searchQuery.trim()}".
                  </div>
                ) : (
                  filteredLineups.map(l => (
                    <div key={l.id} style={S.card} onClick={() => setEditingLineup(l)}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{l.teamName}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        {[l.opponent && `vs ${l.opponent}`, l.gameDate].filter(Boolean).join(' · ') || `${l.roster.length} players`}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {screen}

      {editingStandalone !== null && (
        <StandaloneScoutingModal
          existing={editingStandalone === 'new' ? null : editingStandalone}
          existingReports={reports}
          onSaved={refresh}
          onClose={() => setEditingStandalone(null)}
        />
      )}

      {gameScoutTarget && (
        <ScoutingReportModal
          report={gameScoutTarget.report}
          team={gameScoutTarget.team}
          playerNumber={gameScoutTarget.playerNumber}
          onClose={() => { setGameScoutTarget(null); refresh(); }}
        />
      )}

      {editingLineup !== null && (
        <ScoutLineupModal
          existing={editingLineup === 'new' ? null : editingLineup}
          onSaved={refresh}
          onClose={() => setEditingLineup(null)}
        />
      )}
    </>
  );
}
