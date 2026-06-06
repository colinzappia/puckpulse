import React, { useState } from 'react';
import { GameEvent, EventType, Team, Zone, Player } from '../types';

interface FaceoffWidgetProps {
  events: GameEvent[];
  homeRoster: Player[];
  awayRoster: Player[];
  homeName: string;
  awayName: string;
  fowHomeCenter: string;
  fowAwayCenter: string;
  onSetHomeCenter: (num: string) => void;
  onSetAwayCenter: (num: string) => void;
  onLogFaceoff: (win: boolean) => void;
  mapPlotType: EventType;
  onSetPlotType: (type: EventType) => void;
}

interface ZoneStats { wins: number; losses: number; }

function getFaceoffStats(events: GameEvent[], team: Team) {
  const fo = events.filter(e => e.team === team && (e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS));
  const wins = fo.filter(e => e.type === EventType.FACEOFF_WIN).length;
  const total = fo.length;
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;

  const byZone: Record<string, ZoneStats> = {
    [Zone.OFFENSIVE]: { wins: 0, losses: 0 },
    [Zone.NEUTRAL]: { wins: 0, losses: 0 },
    [Zone.DEFENSIVE]: { wins: 0, losses: 0 },
  };
  fo.forEach(e => {
    if (e.zone && byZone[e.zone]) {
      if (e.type === EventType.FACEOFF_WIN) byZone[e.zone].wins++;
      else byZone[e.zone].losses++;
    }
  });

  const byCentre: Record<string, ZoneStats> = {};
  fo.forEach(e => {
    if (e.playerNumber) {
      if (!byCentre[e.playerNumber]) byCentre[e.playerNumber] = { wins: 0, losses: 0 };
      if (e.type === EventType.FACEOFF_WIN) byCentre[e.playerNumber].wins++;
      else byCentre[e.playerNumber].losses++;
    }
  });

  return { wins, total, pct, byZone, byCentre };
}

function getMatchupStats(events: GameEvent[], homeRoster: Player[], awayRoster: Player[]) {
  const faceoffs = events.filter(e => e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS);
  
  // Group by timestamp pairs (home + away events logged together)
  const matchups: Record<string, {
    homeNum: string; awayNum: string;
    homeWins: number; awayWins: number;
    byZone: Record<string, { homeWins: number; awayWins: number }>;
    bySide: { left: { homeWins: number; awayWins: number }; right: { homeWins: number; awayWins: number } };
  }> = {};

  // Find paired events (logged within 2ms of each other)
  const homeEvents = faceoffs.filter(e => e.team === Team.HOME);
  homeEvents.forEach(he => {
    const paired = faceoffs.find(e => 
      e.team === Team.AWAY && 
      Math.abs(e.timestamp - he.timestamp) <= 2 &&
      e.playerNumber
    );
    if (!paired || !he.playerNumber || !paired.playerNumber) return;

    const key = `${he.playerNumber}-vs-${paired.playerNumber}`;
    if (!matchups[key]) {
      matchups[key] = {
        homeNum: he.playerNumber,
        awayNum: paired.playerNumber,
        homeWins: 0, awayWins: 0,
        byZone: {
          [Zone.OFFENSIVE]: { homeWins: 0, awayWins: 0 },
          [Zone.NEUTRAL]: { homeWins: 0, awayWins: 0 },
          [Zone.DEFENSIVE]: { homeWins: 0, awayWins: 0 },
        },
        bySide: {
          left: { homeWins: 0, awayWins: 0 },
          right: { homeWins: 0, awayWins: 0 },
        }
      };
    }
    const m = matchups[key];
    const homeWon = he.type === EventType.FACEOFF_WIN;
    if (homeWon) m.homeWins++; else m.awayWins++;
    
    const zone = he.zone || Zone.NEUTRAL;
    if (m.byZone[zone]) {
      if (homeWon) m.byZone[zone].homeWins++; else m.byZone[zone].awayWins++;
    }
    
    const side = he.coordinates && he.coordinates.y < 42.5 ? 'left' : 'right';
    if (homeWon) m.bySide[side].homeWins++; else m.bySide[side].awayWins++;
  });

  return Object.values(matchups).sort((a, b) => (b.homeWins + b.awayWins) - (a.homeWins + a.awayWins));
}

const FaceoffWidget: React.FC<FaceoffWidgetProps> = ({
  events, homeRoster, awayRoster, homeName, awayName,
  fowHomeCenter, fowAwayCenter, onSetHomeCenter, onSetAwayCenter,
  onLogFaceoff, mapPlotType, onSetPlotType
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'log' | 'stats'>('log');

  const homeStats = getFaceoffStats(events, Team.HOME);
  const awayStats = getFaceoffStats(events, Team.AWAY);
  const totalFaceoffs = homeStats.total;

  const centres = (roster: Player[]) => roster.filter(p =>
    ['C', 'LW', 'RW', 'F'].includes(p.position?.toUpperCase())
  );

  const getPlayerName = (num: string, roster: Player[]) => {
    const p = roster.find(r => r.number === num);
    return p ? p.name.split(' ').pop() : `#${num}`;
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-4 left-4 sm:bottom-12 sm:left-12 flex items-center gap-2 bg-yellow-600/90 hover:bg-yellow-500 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-full shadow-xl border border-yellow-400/30 transition-all active:scale-95 backdrop-blur-sm"
      >
        <span>🏒</span>
        <span>Faceoffs {totalFaceoffs > 0 ? `· ${homeStats.pct}%` : ''}</span>
      </button>

      {/* Slide-in panel */}
      {isOpen && (
        <div className="fixed inset-0 z-[250] pointer-events-none">
          {/* Backdrop - only covers rink area, allows scrolling */}
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setIsOpen(false)} />
          
          {/* Panel slides in from right */}
          <div className="absolute top-0 right-0 h-full w-full max-w-sm bg-[#0a0e14] border-l border-white/10 shadow-2xl flex flex-col pointer-events-auto animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="px-4 py-4 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">🏒 Faceoff Hub</h2>
              <p className="text-xs text-slate-500 mt-0.5">{totalFaceoffs} faceoffs tracked</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg font-bold">×</button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-2 bg-black/20 border-b border-white/5 shrink-0">
            <button onClick={() => setView('log')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${view === 'log' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Log
            </button>
            <button onClick={() => setView('stats')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${view === 'stats' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Breakdown
            </button>
          </div>

          <div className="flex-1 overflow-auto px-3 py-3">

            {/* LOG VIEW */}
            {view === 'log' && (
              <div className="max-w-xl mx-auto space-y-5">
                {/* Live win % bar */}
                {totalFaceoffs > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-black text-blue-400">{homeName} {homeStats.pct}%</span>
                      <span className="text-xs font-black text-red-400">{awayStats.pct}% {awayName}</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden">
                      <div className="bg-blue-600 transition-all duration-500" style={{ width: `${homeStats.pct}%` }} />
                      <div className="bg-red-600 transition-all duration-500" style={{ width: `${awayStats.pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-slate-500">{homeStats.wins}W {homeStats.total - homeStats.wins}L</span>
                      <span className="text-xs text-slate-500">{awayStats.wins}W {awayStats.total - awayStats.wins}L</span>
                    </div>
                  </div>
                )}

                {/* Home centre select */}
                <div className="bg-blue-900/20 border border-blue-500/20 rounded-2xl p-4">
                  <p className="text-xs font-black text-blue-400 uppercase tracking-wider mb-3">{homeName} Centre</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {centres(homeRoster).map(p => (
                      <button
                        key={p.number}
                        onClick={() => onSetHomeCenter(p.number)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${fowHomeCenter === p.number ? 'bg-blue-600 text-white border-blue-400' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}
                      >
                        #{p.number} {p.name.split(' ').pop()}
                      </button>
                    ))}
                  </div>
                  {fowHomeCenter && (
                    <p className="text-xs text-blue-300 font-bold">
                      {getPlayerName(fowHomeCenter, homeRoster)}: {
                        (() => { const s = homeStats.byCentre[fowHomeCenter]; return s ? `${s.wins}W ${s.losses}L (${s.wins + s.losses > 0 ? Math.round(s.wins/(s.wins+s.losses)*100) : 0}%)` : '0W 0L'; })()
                      }
                    </p>
                  )}
                </div>

                {/* Away centre select */}
                <div className="bg-red-900/20 border border-red-500/20 rounded-2xl p-4">
                  <p className="text-xs font-black text-red-400 uppercase tracking-wider mb-3">{awayName} Centre</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {centres(awayRoster).map(p => (
                      <button
                        key={p.number}
                        onClick={() => onSetAwayCenter(p.number)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${fowAwayCenter === p.number ? 'bg-red-600 text-white border-red-400' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}
                      >
                        #{p.number} {p.name.split(' ').pop()}
                      </button>
                    ))}
                  </div>
                  {fowAwayCenter && (
                    <p className="text-xs text-red-300 font-bold">
                      {getPlayerName(fowAwayCenter, awayRoster)}: {
                        (() => { const s = awayStats.byCentre[fowAwayCenter]; return s ? `${s.wins}W ${s.losses}L (${s.wins + s.losses > 0 ? Math.round(s.wins/(s.wins+s.losses)*100) : 0}%)` : '0W 0L'; })()
                      }
                    </p>
                  )}
                </div>

                {/* Win / Loss buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => { onSetPlotType(EventType.FACEOFF_WIN); onLogFaceoff(true); }}
                    disabled={!fowHomeCenter || !fowAwayCenter}
                    className={`py-6 rounded-2xl text-lg font-black uppercase tracking-widest transition-all active:scale-95 ${!fowHomeCenter || !fowAwayCenter ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-900/30'}`}
                  >
                    ✓ WIN
                  </button>
                  <button
                    onClick={() => { onSetPlotType(EventType.FACEOFF_LOSS); onLogFaceoff(false); }}
                    disabled={!fowHomeCenter || !fowAwayCenter}
                    className={`py-6 rounded-2xl text-lg font-black uppercase tracking-widest transition-all active:scale-95 ${!fowHomeCenter || !fowAwayCenter ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white shadow-lg'}`}
                  >
                    ✗ LOSS
                  </button>
                </div>
                {(!fowHomeCenter || !fowAwayCenter) && (
                  <p className="text-xs text-slate-500 text-center">Select both centres above to log a faceoff</p>
                )}
              </div>
            )}

            {/* STATS VIEW */}
            {view === 'stats' && (
              <div className="max-w-2xl mx-auto space-y-5">
                {totalFaceoffs === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="text-4xl">🏒</div>
                    <p className="text-slate-400 text-sm">No faceoffs logged yet.</p>
                  </div>
                ) : (
                  <>
                    {/* Team overview */}
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { name: homeName, stats: homeStats, color: 'blue' },
                        { name: awayName, stats: awayStats, color: 'red' },
                      ].map(t => (
                        <div key={t.name} className={`bg-${t.color}-900/20 border border-${t.color}-500/20 rounded-2xl p-4 text-center`}>
                          <p className={`text-xs font-black text-${t.color}-400 uppercase tracking-wider mb-1`}>{t.name}</p>
                          <p className="text-4xl font-black text-white">{t.stats.pct}%</p>
                          <p className="text-xs text-slate-400 mt-1">{t.stats.wins}W — {t.stats.total - t.stats.wins}L</p>
                        </div>
                      ))}
                    </div>

                    {/* Zone breakdown */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-xs font-black text-yellow-400 uppercase tracking-wider mb-3">By Zone</p>
                      {[Zone.OFFENSIVE, Zone.NEUTRAL, Zone.DEFENSIVE].map(zone => {
                        const hw = homeStats.byZone[zone]?.wins || 0;
                        const hl = homeStats.byZone[zone]?.losses || 0;
                        const aw = awayStats.byZone[zone]?.wins || 0;
                        const al = awayStats.byZone[zone]?.losses || 0;
                        const label = zone === Zone.OFFENSIVE ? 'O-Zone' : zone === Zone.DEFENSIVE ? 'D-Zone' : 'Neutral';
                        return (
                          <div key={zone} className="flex items-center gap-3 mb-2">
                            <span className="text-xs text-slate-500 w-14 text-right">{hw}W {hl}L</span>
                            <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-white/5">
                              <div className="bg-blue-600" style={{ width: `${(hw+hl) > 0 ? hw/(hw+hl)*100 : 50}%` }} />
                              <div className="bg-red-600" style={{ width: `${(aw+al) > 0 ? aw/(aw+al)*100 : 50}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 w-14">{aw}W {al}L</span>
                            <span className="text-xs font-bold text-slate-400 w-12 text-center">{label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Centre breakdown - Home */}
                    {Object.keys(homeStats.byCentre).length > 0 && (
                      <div className="bg-blue-900/20 border border-blue-500/20 rounded-2xl p-4">
                        <p className="text-xs font-black text-blue-400 uppercase tracking-wider mb-3">{homeName} — By Centre</p>
                        {Object.entries(homeStats.byCentre).sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses)).map(([num, s]) => {
                          const pct = s.wins + s.losses > 0 ? Math.round(s.wins / (s.wins + s.losses) * 100) : 0;
                          const player = homeRoster.find(p => p.number === num);
                          return (
                            <div key={num} className="flex items-center gap-3 mb-2">
                              <span className="text-xs font-bold text-white w-24 truncate">#{num} {player?.name.split(' ').pop()}</span>
                              <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-black text-blue-300 w-10 text-right">{pct}%</span>
                              <span className="text-xs text-slate-500 w-14">{s.wins}W {s.losses}L</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Centre breakdown - Away */}
                    {Object.keys(awayStats.byCentre).length > 0 && (
                      <div className="bg-red-900/20 border border-red-500/20 rounded-2xl p-4">
                        <p className="text-xs font-black text-red-400 uppercase tracking-wider mb-3">{awayName} — By Centre</p>
                        {Object.entries(awayStats.byCentre).sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses)).map(([num, s]) => {
                          const pct = s.wins + s.losses > 0 ? Math.round(s.wins / (s.wins + s.losses) * 100) : 0;
                          const player = awayRoster.find(p => p.number === num);
                          return (
                            <div key={num} className="flex items-center gap-3 mb-2">
                              <span className="text-xs font-bold text-white w-24 truncate">#{num} {player?.name.split(' ').pop()}</span>
                              <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden">
                                <div className="bg-red-500 h-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-black text-red-300 w-10 text-right">{pct}%</span>
                              <span className="text-xs text-slate-500 w-14">{s.wins}W {s.losses}L</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Head-to-head matchups */}
                    {(() => {
                      const matchups = getMatchupStats(events, homeRoster, awayRoster);
                      if (matchups.length === 0) return null;
                      return (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                          <p className="text-xs font-black text-yellow-400 uppercase tracking-wider mb-3">Head-to-Head Matchups</p>
                          {matchups.map((m, i) => {
                            const hp = homeRoster.find(p => p.number === m.homeNum);
                            const ap = awayRoster.find(p => p.number === m.awayNum);
                            const homeName2 = hp ? `#${m.homeNum} ${hp.name.split(' ').pop()}` : `#${m.homeNum}`;
                            const awayName2 = ap ? `#${m.awayNum} ${ap.name.split(' ').pop()}` : `#${m.awayNum}`;
                            const total = m.homeWins + m.awayWins;
                            const homePct = total > 0 ? Math.round(m.homeWins / total * 100) : 50;
                            return (
                              <div key={i} className="mb-4 pb-4 border-b border-white/5 last:border-0 last:mb-0 last:pb-0">
                                <div className="flex justify-between items-center mb-1.5">
                                  <span className="text-xs font-black text-blue-300">{homeName2}</span>
                                  <span className="text-xs text-slate-500">{total} FO</span>
                                  <span className="text-xs font-black text-red-300">{awayName2}</span>
                                </div>
                                <div className="flex h-2.5 rounded-full overflow-hidden mb-1.5">
                                  <div className="bg-blue-500 transition-all" style={{ width: `${homePct}%` }} />
                                  <div className="bg-red-500 transition-all" style={{ width: `${100 - homePct}%` }} />
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-500 mb-2">
                                  <span>{m.homeWins}W ({homePct}%)</span>
                                  <span>{m.awayWins}W ({100 - homePct}%)</span>
                                </div>
                                <div className="grid grid-cols-5 gap-1 text-center">
                                  {[Zone.OFFENSIVE, Zone.NEUTRAL, Zone.DEFENSIVE].map(zone => {
                                    const zs = m.byZone[zone];
                                    const zt = zs.homeWins + zs.awayWins;
                                    const label = zone === Zone.OFFENSIVE ? 'O-Zone' : zone === Zone.DEFENSIVE ? 'D-Zone' : 'Neutral';
                                    return (
                                      <div key={zone} className="bg-white/5 rounded-lg p-1.5 col-span-1">
                                        <p className="text-[9px] text-slate-500">{label}</p>
                                        <p className="text-[10px] font-black text-blue-300">{zs.homeWins}–{zs.awayWins}</p>
                                      </div>
                                    );
                                  })}
                                  <div className="bg-white/5 rounded-lg p-1.5">
                                    <p className="text-[9px] text-slate-500">Left</p>
                                    <p className="text-[10px] font-black text-slate-300">{m.bySide.left.homeWins}–{m.bySide.left.awayWins}</p>
                                  </div>
                                  <div className="bg-white/5 rounded-lg p-1.5">
                                    <p className="text-[9px] text-slate-500">Right</p>
                                    <p className="text-[10px] font-black text-slate-300">{m.bySide.right.homeWins}–{m.bySide.right.awayWins}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FaceoffWidget;
