import React from 'react';
import { GameEvent, EventType, Player, Team, Zone } from '../types';

interface CenterAnalyticsProps {
  events: GameEvent[];
  rosters: { home: Player[]; away: Player[] };
  homeName: string;
  awayName: string;
}

const CenterAnalytics: React.FC<CenterAnalyticsProps> = ({ events, rosters, homeName, awayName }) => {
  // Filter for all faceoff-related events
  const faceoffEvents = events.filter(e => 
    e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS
  );

  // Identify all centermen (explicitly listed as 'C')
  const homeCenters = rosters.home.filter(p => p.position?.toUpperCase().includes('C'));
  const awayCenters = rosters.away.filter(p => p.position?.toUpperCase().includes('C'));
  
  // Identify any other players who took faceoffs (fill-ins)
  const drawTakers = Array.from(new Set(faceoffEvents.map(e => e.playerNumber))).filter(Boolean) as string[];
  
  // Combine into a master list of players to show
  // We prioritize centers, then add any non-center who has events.
  const allTargetNumbers = Array.from(new Set([
    ...homeCenters.map(p => p.number),
    ...awayCenters.map(p => p.number),
    ...drawTakers
  ]));

  const stats = allTargetNumbers.map(playerNum => {
    // Find player info from rosters or create a placeholder
    const playerInfo = [...rosters.home, ...rosters.away].find(p => p.number === playerNum) || { 
      number: playerNum, 
      name: 'Roster Player', 
      position: 'C' 
    };

    const playerEvents = faceoffEvents.filter(e => e.playerNumber === playerNum);
    const wins = playerEvents.filter(e => e.type === EventType.FACEOFF_WIN).length;
    const losses = playerEvents.filter(e => e.type === EventType.FACEOFF_LOSS).length;
    const total = wins + losses;
    const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Detailed breakdown by Zone (W-L per zone)
    const getZoneStats = (zone: Zone) => {
      const zEvents = playerEvents.filter(e => e.zone === zone);
      const zWins = zEvents.filter(e => e.type === EventType.FACEOFF_WIN).length;
      const zLosses = zEvents.filter(e => e.type === EventType.FACEOFF_LOSS).length;
      const zTotal = zEvents.length;
      const zPct = zTotal > 0 ? Math.round((zWins / zTotal) * 100) : 0;
      return { wins: zWins, losses: zLosses, total: zTotal, pct: zPct };
    };

    const zones = {
      [Zone.DEFENSIVE]: getZoneStats(Zone.DEFENSIVE),
      [Zone.NEUTRAL]: getZoneStats(Zone.NEUTRAL),
      [Zone.OFFENSIVE]: getZoneStats(Zone.OFFENSIVE),
    };

    // Detailed breakdown by Side (W-L per side)
    const getSideStats = (isLeft: boolean) => {
      const sEvents = playerEvents.filter(e => e.coordinates && (isLeft ? e.coordinates.y < 42.5 : e.coordinates.y >= 42.5));
      const sWins = sEvents.filter(e => e.type === EventType.FACEOFF_WIN).length;
      const sLosses = sEvents.filter(e => e.type === EventType.FACEOFF_LOSS).length;
      const sTotal = sEvents.length;
      const sPct = sTotal > 0 ? Math.round((sWins / sTotal) * 100) : 0;
      return { wins: sWins, losses: sLosses, total: sTotal, pct: sPct };
    };

    const sides = {
      left: getSideStats(true),
      right: getSideStats(false),
    };

    const isHome = rosters.home.some(p => p.number === playerNum);

    // Performance tiering
    let tier = 'ACTIVE';
    if (total >= 5 && winPct >= 60) tier = 'ELITE';
    else if (total >= 3 && winPct >= 50) tier = 'PRO';

    return {
      player: playerInfo,
      team: isHome ? Team.HOME : Team.AWAY,
      wins,
      losses,
      total,
      winPct,
      zones,
      sides,
      tier,
      isCenter: playerInfo.position?.toUpperCase().includes('C')
    };
  })
  // Sort: Home Centers, Away Centers, Others
  .sort((a, b) => {
    if (a.team !== b.team) return a.team === Team.HOME ? -1 : 1;
    if (a.isCenter !== b.isCenter) return a.isCenter ? -1 : 1;
    return parseInt(a.player.number) - parseInt(b.player.number);
  });

  if (stats.length === 0) return null;

  return (
    <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] p-6 flex flex-col gap-6 overflow-hidden shadow-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] animate-pulse"></div>
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white italic">Individual Faceoff Summary</h3>
        </div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
          Full Center Rotation
        </div>
      </div>

      <div className="flex flex-col gap-6 max-h-[800px] overflow-y-auto scrollbar-none pr-1">
        {stats.map((s, idx) => {
          // Add a team separator if needed
          const showTeamHeader = idx === 0 || stats[idx - 1].team !== s.team;
          
          return (
            <React.Fragment key={`player-fo-frag-${s.player.number}`}>
              {showTeamHeader && (
                <div className={`mt-2 mb-4 flex items-center gap-3 px-4 py-2 rounded-xl bg-black/40 border border-white/5`}>
                  <div className={`w-2 h-2 rounded-full ${s.team === Team.HOME ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${s.team === Team.HOME ? 'text-blue-400' : 'text-red-400'}`}>
                    {s.team === Team.HOME ? homeName : awayName} CENTERS
                  </span>
                </div>
              )}
              <div 
                className={`bg-black/40 border ${s.team === Team.HOME ? 'border-blue-500/20' : 'border-red-500/20'} rounded-[2rem] p-6 flex flex-col gap-5 hover:bg-black/60 transition-all shadow-xl group mb-4 last:mb-0`}
              >
                {/* Player Identity Row */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black border-2 ${s.team === Team.HOME ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-red-600/10 border-red-500/30 text-red-400'}`}>
                      {s.player.number}
                    </div>
                    <div>
                      <div className="text-xs font-black text-white uppercase tracking-tight flex items-center gap-2">
                        {s.player.name}
                        {s.tier === 'ELITE' && s.total > 0 && <span className="text-[7px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 px-1.5 py-0.5 rounded tracking-[0.2em]">ELITE</span>}
                        {s.tier === 'PRO' && s.total > 0 && <span className="text-[7px] bg-cyan-500/20 text-cyan-500 border border-cyan-500/40 px-1.5 py-0.5 rounded tracking-[0.2em]">PRO</span>}
                        {!s.isCenter && <span className="text-[7px] bg-slate-500/20 text-slate-500 border border-white/10 px-1.5 py-0.5 rounded tracking-[0.2em]">WING</span>}
                      </div>
                      <div className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${s.team === Team.HOME ? 'text-blue-500' : 'text-red-500'}`}>
                        {s.team === Team.HOME ? homeName : awayName}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-black italic tabular-nums leading-none ${s.winPct >= 50 ? 'text-cyan-400' : 'text-white'}`}>{s.winPct}%</div>
                    <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">Win Success</div>
                  </div>
                </div>

                {/* Core Stats Overview */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 rounded-xl p-3 flex justify-between items-center px-4 border border-white/5">
                    <span className="text-[9px] font-black text-slate-500 uppercase">WINS</span>
                    <span className={`text-lg font-black ${s.wins > 0 ? 'text-green-500' : 'text-slate-700'}`}>{s.wins}</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 flex justify-between items-center px-4 border border-white/5">
                    <span className="text-[9px] font-black text-slate-500 uppercase">LOSSES</span>
                    <span className={`text-lg font-black ${s.losses > 0 ? 'text-red-500' : 'text-slate-700'}`}>{s.losses}</span>
                  </div>
                </div>

                {/* Detailed Zone Success */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Zone Performance</span>
                    <span className="text-[8px] font-bold text-slate-600 uppercase italic">Draws won by area</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'D-Zone', key: Zone.DEFENSIVE },
                      { label: 'Neutral', key: Zone.NEUTRAL },
                      { label: 'O-Zone', key: Zone.OFFENSIVE }
                    ].map(z => {
                      const zData = (s.zones as any)[z.key];
                      return (
                        <div key={z.key} className="bg-black/60 rounded-xl p-3 flex flex-col items-center justify-center border border-white/5 hover:border-white/10 transition-colors">
                          <span className={`text-base font-black ${zData.total > 0 ? (zData.pct >= 50 ? 'text-white' : 'text-slate-400') : 'text-slate-800'}`}>
                            {zData.total > 0 ? `${zData.pct}%` : '—'}
                          </span>
                          <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter mt-1">{z.label}</span>
                          <span className="text-[7px] font-bold text-slate-700 mt-0.5">{zData.wins}-{zData.losses}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Side Analysis */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ice Side Advantage</span>
                    <span className="text-[8px] font-bold text-slate-600 uppercase italic">L vs R Success</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {/* Left Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-black uppercase px-1">
                        <span className="text-slate-500">Left Circle</span>
                        <span className={s.sides.left.total > 0 ? "text-white" : "text-slate-700"}>
                          {s.sides.left.pct}% ({s.sides.left.wins}-{s.sides.left.losses})
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-cyan-500 transition-all duration-700 ease-out" 
                          style={{ width: `${s.sides.left.pct}%` }}
                        />
                      </div>
                    </div>
                    {/* Right Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-black uppercase px-1">
                        <span className="text-slate-500">Right Circle</span>
                        <span className={s.sides.right.total > 0 ? "text-white" : "text-slate-700"}>
                          {s.sides.right.pct}% ({s.sides.right.wins}-{s.sides.right.losses})
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-cyan-500 transition-all duration-700 ease-out" 
                          style={{ width: `${s.sides.right.pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default CenterAnalytics;