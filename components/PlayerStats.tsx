import React, { useState } from 'react';
import { GameEvent, EventType, Team, Player } from '../types';

interface PlayerStatsProps {
  events: GameEvent[];
  homeRoster: Player[];
  awayRoster: Player[];
  homeName: string;
  awayName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface PlayerRow {
  number: string;
  name: string;
  position: string;
  goals: number;
  shots: number;
  assists: number;
  hits: number;
  penalties: number;
  faceoffWins: number;
  faceoffLosses: number;
  blocks: number;
  total: number;
}

function buildPlayerStats(events: GameEvent[], roster: Player[], team: Team): PlayerRow[] {
  const map = new Map<string, PlayerRow>();

  const getPlayerInfo = (num: string) => {
    const p = roster.find(r => r.number === num);
    return { name: p?.name || `#${num}`, position: p?.position || '?' };
  };

  // Only build rows from actual events — never pre-populate from roster
  events.filter(e => e.team === team && e.playerNumber).forEach(e => {
    const num = e.playerNumber!;
    if (!map.has(num)) {
      const info = getPlayerInfo(num);
      map.set(num, {
        number: num, name: info.name, position: info.position,
        goals: 0, shots: 0, assists: 0, hits: 0,
        penalties: 0, faceoffWins: 0, faceoffLosses: 0, blocks: 0, total: 0
      });
    }
    const row = map.get(num)!;
    switch (e.type) {
      case EventType.GOAL: row.goals++; break;
      case EventType.SHOT: row.shots++; break;
      case EventType.HIT: row.hits++; break;
      case EventType.PENALTY: row.penalties++; break;
      case EventType.FACEOFF_WIN: row.faceoffWins++; break;
      case EventType.FACEOFF_LOSS: row.faceoffLosses++; break;
      case EventType.BLOCK: row.blocks++; break;
    }
    row.total = row.goals + row.shots + row.hits + row.blocks;
  });

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total);
}

const StatBadge = ({ value, color }: { value: number; color: string }) => (
  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${value > 0 ? color : 'text-slate-700 bg-transparent'}`}>
    {value === -1 ? '' : value > 0 ? value : '—'}
  </span>
);

const PlayerStats: React.FC<PlayerStatsProps> = ({
  events, homeRoster, awayRoster, homeName, awayName, isOpen, onClose
}) => {
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home');

  if (!isOpen) return null;

  const homeStats = buildPlayerStats(events, homeRoster, Team.HOME);
  const awayStats = buildPlayerStats(events, awayRoster, Team.AWAY);
  const rows = activeTeam === 'home' ? homeStats : awayStats;
  const teamName = activeTeam === 'home' ? homeName : awayName;

  const totalEvents = events.filter(e => e.team === (activeTeam === 'home' ? Team.HOME : Team.AWAY)).length;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Player Stats</h2>
          <p className="text-xs text-slate-500 mt-0.5">{totalEvents} total events logged</p>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg font-bold transition-colors">×</button>
      </div>

      {/* Team tabs */}
      <div className="flex gap-1 p-3 bg-black/20 border-b border-white/5 shrink-0">
        <button
          onClick={() => setActiveTeam('home')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${activeTeam === 'home' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          {homeName} ({homeStats.length})
        </button>
        <button
          onClick={() => setActiveTeam('away')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${activeTeam === 'away' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          {awayName} ({awayStats.length})
        </button>
      </div>

      {/* Stats table */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="text-4xl">📊</div>
            <p className="text-slate-400 text-sm">No events logged for {teamName} yet.</p>
            <p className="text-slate-600 text-xs">Start tracking events on the rink map to see player stats here.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Column headers */}
            <div className="grid grid-cols-[2fr_1fr_repeat(7,1fr)] gap-1 mb-2 px-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Player</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Pos</span>
              <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider text-center">G</span>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider text-center">S</span>
              <span className="text-xs font-bold text-orange-400 uppercase tracking-wider text-center">HIT</span>
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider text-center">PEN</span>
              <span className="text-xs font-bold text-green-400 uppercase tracking-wider text-center">FW</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">FL</span>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider text-center">BLK</span>
            </div>

            <div className="space-y-1.5">
              {rows.map((row, i) => (
                <div
                  key={row.number}
                  className={`grid grid-cols-[2fr_1fr_repeat(7,1fr)] gap-1 items-center px-3 py-2.5 rounded-xl border ${i === 0 ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-white/3 border-white/5'}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-black text-slate-300 shrink-0">
                      {row.number}
                    </span>
                    <span className="text-sm font-semibold text-white truncate">{row.name}</span>
                    {i === 0 && <span className="text-yellow-400 text-xs">⭐</span>}
                  </div>
                  <span className="text-xs text-slate-500 font-bold text-center">{row.position}</span>
                  <StatBadge value={row.goals} color="text-yellow-400 bg-yellow-500/10" />
                  <StatBadge value={row.shots} color="text-blue-400 bg-blue-500/10" />
                  <StatBadge value={row.hits} color="text-orange-400 bg-orange-500/10" />
                  <StatBadge value={row.penalties} color="text-red-400 bg-red-500/10" />
                  <StatBadge value={row.faceoffWins > 0 || row.faceoffLosses > 0 ? row.faceoffWins : -1} color="text-green-400 bg-green-500/10" />
                  <StatBadge value={row.faceoffWins > 0 || row.faceoffLosses > 0 ? row.faceoffLosses : -1} color="text-slate-400 bg-white/5" />
                  <StatBadge value={row.blocks} color="text-cyan-400 bg-cyan-500/10" />
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-6 px-3">
              {[
                { key: 'G', label: 'Goals', color: 'text-yellow-400' },
                { key: 'S', label: 'Shots', color: 'text-blue-400' },
                { key: 'HIT', label: 'Hits', color: 'text-orange-400' },
                { key: 'PEN', label: 'Penalties', color: 'text-red-400' },
                { key: 'FW', label: 'Faceoff Wins', color: 'text-green-400' },
                { key: 'FL', label: 'Faceoff Losses', color: 'text-slate-400' },
                { key: 'BLK', label: 'Blocks', color: 'text-cyan-400' },
              ].map(l => (
                <span key={l.key} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`font-black ${l.color}`}>{l.key}</span>
                  <span>{l.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerStats;
