// ============================================================
// ScoutingHub.tsx
// Standalone top-level page for all scouting work — reached from
// the main menu, not nested inside Game History.
//
// Two tabs:
//  - Games: today's CHL schedule plus anything else a lineup
//    exists for (minor leagues, other dates). Each game shows
//    whether a lineup is ready (auto-scraped or uploaded) or not
//    — tapping either opens the real lineup, or starts the upload
//    flow for that specific game, so there's one unified list
//    instead of a separate "pick from schedule" step buried
//    inside an upload screen.
//  - My Reports: everything you've personally written, tied to a
//    tracked game or fully standalone — kept separate from Games
//    since it's about reviewing your own past work, not finding
//    something new to scout.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Footer from './Footer';
import ThemedBackground from './ThemedBackground';
import { useUser, useAuth } from '@clerk/clerk-react';
import { SCHEDULE_SYNC_EMAILS } from '../data/adminConfig';
import { SavedGameReport, loadMyReports, loadSharedReports } from '../services/gameReportService';
import { SavedScoutingReport, loadMyScoutingReports } from '../services/scoutingReportService';
import { SavedScoutedLineup, loadAllScoutedLineups } from '../services/scoutedLineupService';
import { LeagueGame, loadLeagueGames } from '../services/leagueGamesService';
import { ChlLineup, findChlLineupsForDate, chlLineupSideToPlayers } from '../services/chlLineupsService';
import { Team } from '../types';
import ScoutingReportModal from './ScoutingReportModal';
import StandaloneScoutingModal from './StandaloneScoutingModal';
import ScoutLineupModal from './ScoutLineupModal';
import ImportScheduleModal from './ImportScheduleModal';
import LineupSheet from './LineupSheet';

interface Props {
  onNavigateHome: () => void;
  onOpenRosterSetup: () => void;
  onOpenGameHistory: () => void;
  onOpenManual: () => void;
  onOpenAbout: () => void;
  onOpenContact: () => void;
  onGoHome: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// "Today" built manually in Eastern time rather than via the device's
// own clock or Intl.DateTimeFormat's formatted output — the same fix
// applied to LeagueGamePicker after a real bug there: a device's local
// timezone, or an inconsistent formatter string, can silently disagree
// with what "today" means for these leagues, which all play Eastern
// (WHL is Pacific/Mountain — a narrow edge case, not fully solved here,
// but still far more correct than UTC or device-local for every league).
function todayEastern(): string {
  const nowInEastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
  return `${nowInEastern.getFullYear()}-${String(nowInEastern.getMonth() + 1).padStart(2, '0')}-${String(nowInEastern.getDate()).padStart(2, '0')}`;
}

interface GameEntry {
  key: string;
  homeTeam: string;
  awayTeam: string;
  gameDate: string;
  gameDatetime: string | null;
  league: string | null;
  externalGameId: string | null;
  status: 'auto' | 'manual' | 'none';
  chlLineup?: ChlLineup;
  scoutedLineup?: SavedScoutedLineup;
}

export default function ScoutingHub({ onNavigateHome, onOpenRosterSetup, onOpenGameHistory, onOpenManual, onOpenAbout, onOpenContact, onGoHome }: Props) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const isAdmin = SCHEDULE_SYNC_EMAILS.includes((user?.primaryEmailAddress?.emailAddress || '').toLowerCase());
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
  const [tab, setTab] = useState<'games' | 'reports'>('games');
  const [reports, setReports] = useState<SavedScoutingReport[]>([]);
  const [games, setGames] = useState<SavedGameReport[]>([]);
  const [lineups, setLineups] = useState<SavedScoutedLineup[]>([]);
  const [todaysGames, setTodaysGames] = useState<LeagueGame[]>([]);
  const [chlLineupsMap, setChlLineupsMap] = useState<Map<string, ChlLineup>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [editingStandalone, setEditingStandalone] = useState<SavedScoutingReport | 'new' | null>(null);
  const [editingLineup, setEditingLineup] = useState<SavedScoutedLineup | 'new' | null>(null);
  const [lineupPrefill, setLineupPrefill] = useState<{ teamAName: string; teamBName: string; gameDate: string; rosterA: any[]; rosterB: any[] } | null>(null);
  const [syncingLeague, setSyncingLeague] = useState<string | null>(null);
  const [showImportSchedule, setShowImportSchedule] = useState(false);
  const [pickingGame, setPickingGame] = useState(false);
  const [pickingPlayerFor, setPickingPlayerFor] = useState<SavedGameReport | null>(null);
  const [gameScoutTarget, setGameScoutTarget] = useState<{ report: SavedGameReport; team: Team; playerNumber: string } | null>(null);

  const syncLeague = async (league: string, label: string) => {
    setSyncingLeague(league);
    try {
      const token = await getToken();
      const res = await fetch('/api/sync-chl-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ league }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed.');
      alert(`${label} sync complete — found ${data.gamesFound} games (${data.dateRangeFound || 'no dates'}), saved ${data.upserted}${data.skippedPast > 0 ? `, skipped ${data.skippedPast} already past` : ''}${data.failures > 0 ? `, ${data.failures} failed` : ''}.`);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncingLeague(null);
    }
  };

  const refresh = () => {
    if (!user) return;
    setLoading(true);
    const today = todayEastern();
    Promise.all([
      loadMyScoutingReports(user.id),
      loadMyReports(user.id),
      loadSharedReports(),
      loadAllScoutedLineups(),
      loadLeagueGames(),
      findChlLineupsForDate(today),
    ])
      .then(([myReports, myGames, sharedGames, allLineups, allLeagueGames, chlMap]) => {
        setReports(myReports);
        const gameMap = new Map<string, SavedGameReport>();
        [...myGames, ...sharedGames].forEach(g => gameMap.set(g.id, g));
        setGames(Array.from(gameMap.values()));
        setLineups(allLineups);
        setTodaysGames(allLeagueGames.filter(g => g.gameDate === today));
        setChlLineupsMap(chlMap);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gamesById = new Map(games.map(g => [g.id, g]));

  // ── Build the unified Games list ──
  // Today's CHL games first (cross-referenced against both an
  // auto-scraped lineup and any manually-uploaded one for the exact
  // same matchup+date), then anything else a lineup exists for that
  // isn't part of today's CHL schedule at all — minor leagues via
  // Excel import, or a lineup uploaded for a different date.
  const findManualPair = (l: SavedScoutedLineup, pool: SavedScoutedLineup[]) =>
    pool.find(o => o.id !== l.id && o.teamName === l.opponent && o.opponent === l.teamName && o.gameDate === l.gameDate);

  const usedLineupIds = new Set<string>();
  const chlEntries: GameEntry[] = todaysGames.map(g => {
    const chlKey = `${g.league}-${g.externalGameId}`;
    const chl = chlLineupsMap.get(chlKey);
    const manual = lineups.find(l =>
      l.gameDate === g.gameDate &&
      ((l.teamName === g.homeTeam && l.opponent === g.awayTeam) || (l.teamName === g.awayTeam && l.opponent === g.homeTeam))
    );
    if (manual) {
      usedLineupIds.add(manual.id);
      const pair = findManualPair(manual, lineups);
      if (pair) usedLineupIds.add(pair.id);
    }
    return {
      key: chlKey,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      gameDate: g.gameDate,
      gameDatetime: g.gameDatetime,
      league: g.league,
      externalGameId: g.externalGameId,
      status: manual ? 'manual' : chl ? 'auto' : 'none',
      chlLineup: chl,
      scoutedLineup: manual,
    } as GameEntry;
  });

  const seenOther = new Set<string>();
  const otherEntries: GameEntry[] = [];
  const todayStr = todayEastern();
  for (const l of lineups) {
    if (usedLineupIds.has(l.id) || seenOther.has(l.id)) continue;
    // Only today-or-future (or genuinely undated, e.g. a minor-league
    // lineup with no specific game date) — a past-dated one is stale
    // and was cluttering this list with old games that already happened.
    if (l.gameDate && l.gameDate < todayStr) continue;
    const pair = findManualPair(l, lineups);
    if (pair) seenOther.add(pair.id);
    seenOther.add(l.id);
    otherEntries.push({
      key: `manual-${l.id}`,
      homeTeam: l.teamName,
      awayTeam: l.opponent || pair?.teamName || '',
      gameDate: l.gameDate || '',
      gameDatetime: null,
      league: null,
      externalGameId: null,
      status: 'manual',
      scoutedLineup: l,
    });
  }

  const allEntries = [...chlEntries, ...otherEntries];
  const gq = searchQuery.trim().toLowerCase();
  const filteredEntries = gq
    ? allEntries.filter(e => `${e.homeTeam} ${e.awayTeam}`.toLowerCase().includes(gq))
    : allEntries;

  // Ready-to-scout games first (a scout opening this wants those before
  // ones needing setup), each group by scheduled time, then home team.
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    const aReady = a.status !== 'none' ? 0 : 1;
    const bReady = b.status !== 'none' ? 0 : 1;
    if (aReady !== bReady) return aReady - bReady;
    const timeA = a.gameDatetime || '';
    const timeB = b.gameDatetime || '';
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return a.homeTeam.localeCompare(b.homeTeam);
  });

  const openGameEntry = (entry: GameEntry) => {
    if (entry.status === 'manual' && entry.scoutedLineup) {
      setEditingLineup(entry.scoutedLineup);
    } else if (entry.status === 'auto' && entry.chlLineup) {
      setLineupPrefill({
        teamAName: entry.chlLineup.homeTeamName,
        teamBName: entry.chlLineup.awayTeamName,
        gameDate: entry.gameDate,
        rosterA: chlLineupSideToPlayers(entry.chlLineup.homeLines),
        rosterB: chlLineupSideToPlayers(entry.chlLineup.awayLines),
      });
      setEditingLineup('new');
    } else {
      setLineupPrefill({ teamAName: entry.homeTeam, teamBName: entry.awayTeam, gameDate: entry.gameDate, rosterA: [], rosterB: [] });
      setEditingLineup('new');
    }
  };

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 350, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 351, display: 'flex', flexDirection: 'column' as const },
    topbar: { background: 'rgba(12,16,24,0.7)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    tabBar: { display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: 'rgba(12,16,24,0.5)', flexShrink: 0 },
    body: { flex: 1, overflowY: 'auto' as const, padding: '16px' },
    btn: (color = '#60a5fa') => ({ padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}12`, color, width: '100%' } as React.CSSProperties),
    search: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, marginBottom: 12 },
    card: { background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 8, cursor: 'pointer' as const },
  };

  let screen: React.ReactNode;

  // ── Sub-screen: pick which player from a chosen tracked game ──
  if (pickingPlayerFor) {
    const g = pickingPlayerFor;
    screen = (
      <>
        <div style={S.overlay} onClick={() => setPickingPlayerFor(null)} />
        <div style={{ ...S.panel, background: '#070a0f' }}>
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
        <div style={{ ...S.panel, background: '#070a0f' }}>
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
    // ── Main page ──
    screen = (
      <ThemedBackground intensity="subtle" className="fixed inset-0 z-[351] flex flex-col">
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
          <button
            onClick={() => setTab('games')}
            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wide transition-all border-b-2 ${tab === 'games' ? 'text-emerald-400 border-emerald-400' : 'text-slate-500 border-transparent'}`}
          >
            Games {sortedEntries.length > 0 && `(${sortedEntries.length})`}
          </button>
          <button
            onClick={() => setTab('reports')}
            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wide transition-all border-b-2 ${tab === 'reports' ? 'text-blue-400 border-blue-400' : 'text-slate-500 border-transparent'}`}
          >
            My Reports {reports.length > 0 && `(${reports.length})`}
          </button>
        </div>

        <div style={S.body}>
          {tab === 'games' ? (
            <>
              {isAdmin && (
                <>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' as const }}>
                    {([
                      { league: 'ohl', label: 'OHL' },
                      { league: 'whl', label: 'WHL' },
                      { league: 'qmjhl', label: 'QMJHL' },
                    ] as const).map(({ league, label }) => (
                      <button
                        key={league}
                        style={{ ...S.btn('#94a3b8'), fontSize: 11, width: 'auto', flex: '1 1 auto' }}
                        disabled={syncingLeague !== null}
                        onClick={() => syncLeague(league, label)}
                      >
                        {syncingLeague === league ? 'Syncing…' : `🔄 Sync ${label}`}
                      </button>
                    ))}
                  </div>
                  <button
                    style={{ ...S.btn('#a78bfa'), fontSize: 11, marginBottom: 8 }}
                    onClick={() => setShowImportSchedule(true)}
                  >
                    📊 Import league schedule from Excel
                  </button>
                </>
              )}

              <button
                style={{ ...S.btn('#34d399'), marginBottom: 12 }}
                onClick={() => { setLineupPrefill(null); setEditingLineup('new'); }}
              >
                + Upload a lineup for a different game
              </button>

              {allEntries.length > 0 && (
                <input
                  style={S.search}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by team…"
                />
              )}

              {loading ? (
                <div className="text-center py-10 text-slate-600 text-sm">Loading…</div>
              ) : sortedEntries.length === 0 ? (
                <div className="text-center py-10 text-slate-600 text-sm leading-relaxed">
                  {gq ? `No games match "${searchQuery.trim()}".` : "No CHL games today, and nothing else uploaded yet."}
                </div>
              ) : (
                sortedEntries.map(entry => (
                  <div
                    key={entry.key}
                    onClick={() => openGameEntry(entry)}
                    className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-2.5 cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="text-[15px] font-black text-white truncate">
                        {entry.awayTeam} <span className="text-slate-600 font-bold">@</span> {entry.homeTeam}
                      </div>
                      {entry.status === 'manual' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Uploaded
                        </span>
                      )}
                      {entry.status === 'auto' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                          Auto lineup
                        </span>
                      )}
                      {entry.status === 'none' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-white/5 text-slate-500 border border-white/10">
                          No lineup yet
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      {entry.league ? `${entry.league.toUpperCase()} · ` : ''}{entry.gameDate || 'No date'}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
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
                <div className="text-center py-10 text-slate-600 text-sm">Loading…</div>
              ) : reports.length === 0 ? (
                <div className="text-center py-10 text-slate-600 text-sm leading-relaxed">No scouting reports yet.</div>
              ) : (() => {
                  const rq = searchQuery.trim().toLowerCase();
                  const filteredReports = rq
                    ? reports.filter(r => {
                        const game = r.gameReportId ? gamesById.get(r.gameReportId) : null;
                        const haystack = [r.playerName, r.teamName, game?.homeName, game?.awayName].filter(Boolean).join(' ').toLowerCase();
                        return haystack.includes(rq);
                      })
                    : reports;
                  return filteredReports.length === 0 ? (
                    <div className="text-center py-10 text-slate-600 text-sm">No reports match "{searchQuery.trim()}".</div>
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
                  );
                })()}
            </>
          )}

          <Footer />
        </div>
      </ThemedBackground>
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
          key={editingLineup === 'new' ? `new-${lineupPrefill?.teamAName || ''}-${lineupPrefill?.gameDate || ''}` : editingLineup.id}
          existing={editingLineup === 'new' ? null : editingLineup}
          allLineups={lineups}
          onOpenExisting={setEditingLineup}
          prefillFromChl={editingLineup === 'new' ? lineupPrefill || undefined : undefined}
          onSaved={refresh}
          onClose={() => { setEditingLineup(null); setLineupPrefill(null); }}
        />
      )}

      {showImportSchedule && (
        <ImportScheduleModal
          getToken={getToken}
          onClose={() => { setShowImportSchedule(false); refresh(); }}
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
                { label: 'Home', icon: '🏠', action: onGoHome },
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
