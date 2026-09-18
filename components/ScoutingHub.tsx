// ============================================================
// ScoutingHub.tsx
// Standalone top-level page for all scouting work — reached
// from the main menu, not nested inside Game History. Lists
// every report you've made (tied to a tracked game, or fully
// standalone), and offers two ways to start a new one: pick a
// tracked game to auto-fill stats from, or write a freeform
// report with no game behind it.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Footer from './Footer';
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
  onNavigateHome: () => void;
  onOpenRosterSetup: () => void;
  onOpenGameHistory: () => void;
  onOpenManual: () => void;
  onOpenAbout: () => void;
  onOpenContact: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function ScoutingHub({ onNavigateHome, onOpenRosterSetup, onOpenGameHistory, onOpenManual, onOpenAbout, onOpenContact }: Props) {
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    const el = menuBtnRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const MENU_WIDTH = 220;
      const EDGE_MARGIN = 8;
      let right = window.innerWidth - rect.right;
      const maxRight = window.innerWidth - MENU_WIDTH - EDGE_MARGIN;
      right = Math.min(Math.max(EDGE_MARGIN, right), Math.max(EDGE_MARGIN, maxRight));
      setMenuPos({ top: rect.bottom + 8, right });
    }
    setMenuOpen(true);
  };

  const menuAction = (fn: () => void) => { setMenuOpen(false); fn(); };
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'reports' | 'lineups'>('lineups');
  const [reports, setReports] = useState<SavedScoutingReport[]>([]);
  const [games, setGames] = useState<SavedGameReport[]>([]);
  const [lineups, setLineups] = useState<SavedScoutedLineup[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingStandalone, setEditingStandalone] = useState<SavedScoutingReport | 'new' | null>(null);
  const [editingLineup, setEditingLineup] = useState<SavedScoutedLineup | 'new' | null>(null);
  const [syncingSchedule, setSyncingSchedule] = useState(false);
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

  // Now a real page, mounted fresh every time you navigate here — so a
  // plain run-once-on-mount effect is enough for both of these; no more
  // need to gate on an isOpen flag that no longer exists.
  useEffect(() => {
    refresh();
    setEditingLineup('new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Two lineups uploaded for the same game (each naming the other as its
  // opponent, same date) are two separate saved rows, but they represent
  // one game to a scout browsing the list — collapse them into a single
  // row rather than showing the same game twice.
  const findPair = (l: SavedScoutedLineup) =>
    filteredLineups.find(o => o.id !== l.id && o.teamName === l.opponent && o.opponent === l.teamName && o.gameDate === l.gameDate);
  const dedupedLineups = (() => {
    const seen = new Set<string>();
    const result: SavedScoutedLineup[] = [];
    for (const l of filteredLineups) {
      if (seen.has(l.id)) continue;
      const pair = findPair(l);
      if (pair) seen.add(pair.id);
      seen.add(l.id);
      result.push(l);
    }
    return result;
  })();

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
            <span onClick={() => setPickingPlayerFor(null)} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
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
            <span onClick={() => setPickingGame(false)} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
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
    // ── Main list — a real page now, not an overlay on top of anything,
    // so there's no backdrop to dim and no "X" to close it — leaving it
    // means navigating elsewhere, via the menu below or the browser's
    // own back button.
    screen = (
      <>
        <div style={S.panel}>
          <div style={S.topbar}>
            <div className="flex items-center gap-3">
              <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-7 w-auto" />
              <span className="text-white font-black uppercase tracking-widest text-sm">Scouts Portal</span>
            </div>
            <button
              ref={menuBtnRef}
              onClick={openMenu}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Menu</span>
            </button>
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
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button style={S.btn('#34d399')} onClick={() => setEditingLineup('new')}>+ Upload lineup</button>
                  <button
                    style={S.btn('#94a3b8')}
                    disabled={syncingSchedule}
                    onClick={async () => {
                      setSyncingSchedule(true);
                      try {
                        const res = await fetch('/api/sync-chl-schedule', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ league: 'ohl' }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Sync failed.');
                        alert(`OHL sync complete — found ${data.gamesFound} games, saved ${data.upserted}${data.failures > 0 ? `, ${data.failures} failed` : ''}.`);
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Sync failed.');
                      } finally {
                        setSyncingSchedule(false);
                      }
                    }}
                  >
                    {syncingSchedule ? 'Syncing…' : '🔄 Sync OHL Schedule'}
                  </button>
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
                ) : dedupedLineups.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    No lineups match "{searchQuery.trim()}".
                  </div>
                ) : (
                  dedupedLineups.map(l => {
                    const pair = findPair(l);
                    return (
                      <div key={l.id} style={S.card} onClick={() => setEditingLineup(l)}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                          {pair ? `${l.teamName} vs ${pair.teamName}` : l.teamName}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                          {l.gameDate || (pair ? undefined : l.opponent && `vs ${l.opponent}`) || `${l.roster.length} players`}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            <Footer />
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
          // Keyed on identity so switching from a blank "new" lineup to
          // an already-saved one (or between two different saved ones)
          // actually remounts this component — otherwise its internal
          // team/roster state, set up once on first mount, would just
          // keep showing whatever was there before the switch.
          key={editingLineup === 'new' ? 'new' : editingLineup.id}
          existing={editingLineup === 'new' ? null : editingLineup}
          allLineups={lineups}
          onOpenExisting={setEditingLineup}
          onSaved={refresh}
          onClose={() => setEditingLineup(null)}
        />
      )}

      {/* Nav menu — same destinations as the main app's menu, so leaving
          Scouts Portal for another page never means being forced back to
          the rink specifically. Anchored under the Menu button via a
          portal, same approach as Header.tsx's own dropdown. */}
      {menuOpen && menuPos && createPortal(
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 999998, background: 'transparent' }}
          />
          <div style={{
            position: 'fixed', top: menuPos.top, right: menuPos.right, width: '220px',
            maxHeight: 'calc(100vh - ' + menuPos.top + 'px - 16px)',
            zIndex: 999999, background: '#0f1620',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
              {([
                { label: 'Back to rink', icon: '🏒', action: onNavigateHome },
                { label: 'Roster Setup', icon: '➕', action: onOpenRosterSetup },
                { label: 'Game History', icon: '📁', action: onOpenGameHistory },
                null,
                { label: 'User Manual', icon: '📋', action: onOpenManual },
                { label: 'About Us', icon: 'ℹ️', action: onOpenAbout },
                { label: 'Contact Us', icon: '✉️', action: onOpenContact },
              ] as any[]).map((item: any, i: number) =>
                item === null ? (
                  <div key={i} style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
                ) : (
                  <button
                    key={item.label}
                    onClick={() => menuAction(item.action)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', borderRadius: '10px', background: 'transparent', border: 'none', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: '18px', width: '24px' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
