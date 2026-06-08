import React, { useState } from 'react';
import { GameEvent, EventType, Player, Team, Zone } from '../types';

interface CenterAnalyticsProps {
  events: GameEvent[];
  rosters: { home: Player[]; away: Player[] };
  homeName: string;
  awayName: string;
}

interface PlayerFOStats {
  number: string;
  name: string;
  team: Team;
  wins: number;
  losses: number;
  total: number;
  pct: number;
  byZone: Record<string, { wins: number; losses: number }>;
  bySide: { left: { wins: number; losses: number }; right: { wins: number; losses: number } };
}

function buildFOStats(events: GameEvent[], roster: Player[], team: Team): PlayerFOStats[] {
  // Start with ALL centres from roster
  const centres = roster.filter(p => p.position?.toUpperCase() === 'C');
  const map = new Map<string, PlayerFOStats>();

  // Pre-populate all centres
  centres.forEach(p => {
    map.set(p.number, {
      number: p.number,
      name: p.name,
      team,
      wins: 0, losses: 0, total: 0, pct: 0,
      byZone: {
        [Zone.OFFENSIVE]: { wins: 0, losses: 0 },
        [Zone.NEUTRAL]: { wins: 0, losses: 0 },
        [Zone.DEFENSIVE]: { wins: 0, losses: 0 },
      },
      bySide: { left: { wins: 0, losses: 0 }, right: { wins: 0, losses: 0 } }
    });
  });

  // Process faceoff events for this team
  const foEvents = events.filter(e =>
    e.team === team &&
    (e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS) &&
    e.playerNumber
  );

  foEvents.forEach(e => {
    const num = e.playerNumber!;
    // If player not in map yet (non-centre who took a faceoff), add them
    if (!map.has(num)) {
      const p = roster.find(r => r.number === num);
      map.set(num, {
        number: num,
        name: p?.name || `#${num}`,
        team,
        wins: 0, losses: 0, total: 0, pct: 0,
        byZone: {
          [Zone.OFFENSIVE]: { wins: 0, losses: 0 },
          [Zone.NEUTRAL]: { wins: 0, losses: 0 },
          [Zone.DEFENSIVE]: { wins: 0, losses: 0 },
        },
        bySide: { left: { wins: 0, losses: 0 }, right: { wins: 0, losses: 0 } }
      });
    }

    const row = map.get(num)!;
    const isWin = e.type === EventType.FACEOFF_WIN;
    if (isWin) row.wins++; else row.losses++;

    const zone = e.zone || Zone.NEUTRAL;
    if (row.byZone[zone]) {
      if (isWin) row.byZone[zone].wins++; else row.byZone[zone].losses++;
    }

    const side = e.coordinates && e.coordinates.y < 42.5 ? 'left' : 'right';
    if (isWin) row.bySide[side].wins++; else row.bySide[side].losses++;
  });

  // Calculate pct and total
  return Array.from(map.values()).map(r => ({
    ...r,
    total: r.wins + r.losses,
    pct: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : 0
  })).sort((a, b) => b.total - a.total);
}

function buildMatchups(events: GameEvent[], homeRoster: Player[], awayRoster: Player[]) {
  const matchups: Record<string, { homeNum: string; awayNum: string; homeWins: number; awayWins: number }> = {};

  const homeEvents = events.filter(e =>
    e.team === Team.HOME &&
    (e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS) &&
    e.playerNumber
  );

  homeEvents.forEach(he => {
    const paired = events.find(e =>
      e.team === Team.AWAY &&
      (e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS) &&
      Math.abs(e.timestamp - he.timestamp) <= 2 &&
      e.playerNumber
    );
    if (!paired) return;

    const key = `${he.playerNumber}-vs-${paired.playerNumber}`;
    if (!matchups[key]) matchups[key] = { homeNum: he.playerNumber!, awayNum: paired.playerNumber!, homeWins: 0, awayWins: 0 };
    if (he.type === EventType.FACEOFF_WIN) matchups[key].homeWins++;
    else matchups[key].awayWins++;
  });

  return Object.values(matchups)
    .map(m => {
      const hp = homeRoster.find(p => p.number === m.homeNum);
      const ap = awayRoster.find(p => p.number === m.awayNum);
      return {
        ...m,
        homeName: hp ? `#${m.homeNum} ${hp.name.split(' ').pop()}` : `#${m.homeNum}`,
        awayName: ap ? `#${m.awayNum} ${ap.name.split(' ').pop()}` : `#${m.awayNum}`,
        total: m.homeWins + m.awayWins
      };
    })
    .filter(m => m.total > 0)
    .sort((a, b) => b.total - a.total);
}

const ZoneBadge = ({ label, wins, losses }: { label: string; wins: number; losses: number }) => {
  const total = wins + losses;
  const pct = total > 0 ? Math.round(wins / total * 100) : null;
  return (
    <div className="bg-black/40 rounded-xl p-2.5 text-center border border-white/5">
      <div className={`text-base font-black ${pct !== null ? (pct >= 50 ? 'text-cyan-400' : 'text-white') : 'text-slate-700'}`}>
        {pct !== null ? `${pct}%` : '—'}
      </div>
      <div className="text-[7px] font-black text-slate-600 uppercase tracking-tight mt-0.5">{label}</div>
      {total > 0 && <div className="text-[7px] text-slate-700 mt-0.5">{wins}-{losses}</div>}
    </div>
  );
};

const CenterAnalytics: React.FC<CenterAnalyticsProps> = ({ events, rosters, homeName, awayName }) => {
  const [view, setView] = useState<'players' | 'matchups'>('players');

  const homeStats = buildFOStats(events, rosters.home, Team.HOME);
  const awayStats = buildFOStats(events, rosters.away, Team.AWAY);
  const matchups = buildMatchups(events, rosters.home, rosters.away);

  const totalFO = Math.floor(events.filter(e => e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS).length / 2);

  if (homeStats.length === 0 && awayStats.length === 0) return null;

  const renderPlayer = (s: PlayerFOStats, isHome: boolean) => (
    <div key={`${s.team}-${s.number}`} className={`bg-black/40 border ${isHome ? 'border-blue-500/20' : 'border-red-500/20'} rounded-2xl p-4 mb-3`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border ${isHome ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-red-600/10 border-red-500/30 text-red-400'}`}>
            {s.number}
          </div>
          <div>
            <div className="text-xs font-black text-white uppercase">{s.name}</div>
            <div className={`text-[9px] font-black uppercase tracking-widest ${isHome ? 'text-blue-500' : 'text-red-500'}`}>
              {isHome ? homeName : awayName}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black italic ${s.total > 0 && s.pct >= 50 ? 'text-cyan-400' : s.total > 0 ? 'text-white' : 'text-slate-700'}`}>
            {s.total > 0 ? `${s.pct}%` : '—'}
          </div>
          <div className="text-[8px] text-slate-600 uppercase">{s.wins}W {s.losses}L</div>
        </div>
      </div>

      {s.total > 0 && (
        <>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <ZoneBadge label="D-Zone" wins={s.byZone[Zone.DEFENSIVE]?.wins || 0} losses={s.byZone[Zone.DEFENSIVE]?.losses || 0} />
            <ZoneBadge label="Neutral" wins={s.byZone[Zone.NEUTRAL]?.wins || 0} losses={s.byZone[Zone.NEUTRAL]?.losses || 0} />
            <ZoneBadge label="O-Zone" wins={s.byZone[Zone.OFFENSIVE]?.wins || 0} losses={s.byZone[Zone.OFFENSIVE]?.losses || 0} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <ZoneBadge label="Left Circle" wins={s.bySide.left.wins} losses={s.bySide.left.losses} />
            <ZoneBadge label="Right Circle" wins={s.bySide.right.wins} losses={s.bySide.right.losses} />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] p-5 flex flex-col gap-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.6)]"></div>
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white italic">Faceoff Summary</h3>
        </div>
        <span className="text-[10px] font-black text-slate-500 bg-black/40 px-3 py-1 rounded-full border border-white/5">{totalFO} draws</span>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-black/30 p-1 rounded-xl border border-white/5">
        <button onClick={() => setView('players')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${view === 'players' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-white'}`}>By Player</button>
        <button onClick={() => setView('matchups')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${view === 'matchups' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-white'}`}>C vs C</button>
      </div>

      {view === 'players' && (
        <div className="max-h-[700px] overflow-y-auto scrollbar-none">
          {/* Home team label */}
          {homeStats.length > 0 && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{homeName} Centres</span>
            </div>
          )}
          {homeStats.map(s => renderPlayer(s, true))}

          {/* Away team label */}
          {awayStats.length > 0 && (
            <div className="flex items-center gap-2 mb-2 mt-2 px-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{awayName} Centres</span>
            </div>
          )}
          {awayStats.map(s => renderPlayer(s, false))}
        </div>
      )}

      {view === 'matchups' && (
        <div className="max-h-[700px] overflow-y-auto scrollbar-none">
          {matchups.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-sm">No head-to-head matchup data yet</div>
          ) : (
            matchups.map((m, i) => {
              const total = m.homeWins + m.awayWins;
              const homePct = Math.round(m.homeWins / total * 100);
              return (
                <div key={i} className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black text-blue-300">{m.homeName}</span>
                    <span className="text-[10px] text-slate-600">{total} draws</span>
                    <span className="text-xs font-black text-red-300">{m.awayName}</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden mb-1.5">
                    <div className="bg-blue-500 transition-all" style={{ width: `${homePct}%` }} />
                    <div className="bg-red-500 transition-all" style={{ width: `${100 - homePct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] font-black">
                    <span className="text-blue-400">{m.homeWins}W ({homePct}%)</span>
                    <span className="text-red-400">{m.awayWins}W ({100 - homePct}%)</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default CenterAnalytics;
