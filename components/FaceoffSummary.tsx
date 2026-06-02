import React from 'react';
import { GameEvent, EventType, Team, Zone } from '../types';

interface FaceoffSummaryProps {
  events: GameEvent[];
  homeName: string;
  awayName: string;
}

const FaceoffSummary: React.FC<FaceoffSummaryProps> = ({ events, homeName, awayName }) => {
  const faceoffEvents = events.filter(e => 
    e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS
  );

  const calculateTeamStats = (team: Team) => {
    const teamEvents = faceoffEvents.filter(e => e.team === team);
    const wins = teamEvents.filter(e => e.type === EventType.FACEOFF_WIN).length;
    const losses = teamEvents.filter(e => e.type === EventType.FACEOFF_LOSS).length;
    const total = wins + losses;
    const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

    const zones = {
      [Zone.DEFENSIVE]: teamEvents.filter(e => e.zone === Zone.DEFENSIVE).length,
      [Zone.NEUTRAL]: teamEvents.filter(e => e.zone === Zone.NEUTRAL).length,
      [Zone.OFFENSIVE]: teamEvents.filter(e => e.zone === Zone.OFFENSIVE).length,
    };

    const sides = {
      left: teamEvents.filter(e => e.coordinates && e.coordinates.y < 42.5).length,
      right: teamEvents.filter(e => e.coordinates && e.coordinates.y >= 42.5).length,
    };

    return { wins, losses, total, winPct, zones, sides };
  };

  const homeStats = calculateTeamStats(Team.HOME);
  const awayStats = calculateTeamStats(Team.AWAY);

  if (homeStats.total === 0 && awayStats.total === 0) return null;

  const StatBlock = ({ team, stats, name, colorClass }: { team: Team, stats: any, name: string, colorClass: string }) => (
    <div className={`flex-1 bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4 transition-all hover:border-white/10 ${colorClass === 'blue' ? 'shadow-[0_0_20px_rgba(37,99,235,0.05)]' : 'shadow-[0_0_20px_rgba(220,38,38,0.05)]'}`}>
      <div className="flex justify-between items-end">
        <div>
          <span className={`text-[10px] font-black uppercase tracking-widest ${colorClass === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>{name}</span>
          <div className="text-3xl sm:text-4xl font-black text-white italic leading-none">{stats.winPct}%</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-slate-500 uppercase">W-L Record</div>
          <div className="text-sm font-black text-white">{stats.wins} - {stats.losses}</div>
        </div>
      </div>

      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${colorClass === 'blue' ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]'}`} 
          style={{ width: `${stats.winPct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Object.entries(stats.zones).map(([zone, count]) => (
          <div key={zone} className="bg-white/5 rounded-xl py-2 flex flex-col items-center border border-white/5">
            <span className="text-lg font-black text-white">{count as number}</span>
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">
              {zone === Zone.DEFENSIVE ? 'D-Zone' : zone === Zone.OFFENSIVE ? 'O-Zone' : 'Neutral'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
        <div className="flex-1 text-center border-r border-white/10">
          <div className="text-sm font-black text-white">{stats.sides.left}</div>
          <div className="text-[7px] font-black text-slate-500 uppercase">Left Side</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-sm font-black text-white">{stats.sides.right}</div>
          <div className="text-[7px] font-black text-slate-500 uppercase">Right Side</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full px-4 py-6 bg-[#05070a] border-t border-white/5 space-y-4 shrink-0">
      <div className="flex justify-between items-center">
        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-yellow-500 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></span>
          Team Faceoff Summary
        </h3>
        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Zone & Side Analysis</span>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <StatBlock team={Team.HOME} stats={homeStats} name={homeName} colorClass="blue" />
        <StatBlock team={Team.AWAY} stats={awayStats} name={awayName} colorClass="red" />
      </div>
    </div>
  );
};

export default FaceoffSummary;