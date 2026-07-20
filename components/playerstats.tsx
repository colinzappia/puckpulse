import React, { useState } from 'react';
import { GameEvent, EventType, Team, Player } from '../types';

interface PlayerStatsProps {
  events: GameEvent[];
  homeRoster: Player[];
  awayRoster: Player[];
  homeName: string;
  awayName: string;
  startingGoalieHome?: string;
  startingGoalieAway?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface PlayerRow {
  number: string;
  name: string;
  position: string;
  goals: number;
  shots: number;
  shotsOnNet: number;
  shotsMissed: number;
  ppShots: number;
  pkShots: number;
  assists: number;
  hits: number;
  penalties: number;
  faceoffWins: number;
  faceoffLosses: number;
  blocks: number;
  plusMinus: number;
  total: number;
}

function buildPlayerStats(events: GameEvent[], roster: Player[], team: Team): PlayerRow[] {
  const map = new Map<string, PlayerRow>();

  // Initialize from roster
  roster.forEach(p => {
    map.set(p.number, {
      number: p.number,
      name: p.name,
      position: p.position,
      goals: 0, shots: 0, shotsOnNet: 0, shotsMissed: 0, ppShots: 0, pkShots: 0, assists: 0, hits: 0,
      penalties: 0, faceoffWins: 0, faceoffLosses: 0, blocks: 0, plusMinus: 0, total: 0
    });
  });

  // Count events
  events.filter(e => e.team === team && e.playerNumber).forEach(e => {
    const num = e.playerNumber!;
    if (!map.has(num)) {
      map.set(num, {
        number: num, name: `#${num}`, position: '?',
        goals: 0, shots: 0, shotsOnNet: 0, shotsMissed: 0, ppShots: 0, pkShots: 0, assists: 0, hits: 0,
        penalties: 0, faceoffWins: 0, faceoffLosses: 0, blocks: 0, plusMinus: 0, total: 0
      });
    }
    const row = map.get(num)!;
    switch (e.type) {
      case EventType.GOAL: row.goals++; break;
      case EventType.SHOT:
        row.shots++;
        if (e.metadata?.onNet === false) row.shotsMissed++; else row.shotsOnNet++;
        if (e.metadata?.strength === 'PP') row.ppShots++;
        else if (e.metadata?.strength === 'PK') row.pkShots++;
        break;
      case EventType.HIT: row.hits++; break;
      case EventType.PENALTY: row.penalties++; break;
      case EventType.FACEOFF_WIN: row.faceoffWins++; break;
      case EventType.FACEOFF_LOSS: row.faceoffLosses++; break;
      case EventType.BLOCK: row.blocks++; break;
    }
    row.total = row.goals + row.shots + row.hits + row.faceoffWins + row.blocks;
  });

  // Plus/minus — checked across ALL goals (not just this team's own events),
  // since a player can be a -1 on a goal that belongs to the OTHER team.
  // `playersOnIce` holds whichever team's on-ice group was picked as the
  // "scoring" side in the goal popup (in single-team mode this is always
  // the tracked team, for or against; in both-team mode it's specifically
  // the team that scored), and `againstPlayersOnIce` holds the defending
  // side (only ever populated in both-team mode). Checking both against
  // this roster's numbers handles either mode correctly without needing
  // to know which mode the data came from.
  //
  // Only even-strength (ES) and shorthanded (SH) goals count toward +/-,
  // matching standard convention — power play goals never affect +/- for
  // either side, and empty-net / penalty-shot goals are excluded too since
  // they're not a reflection of full-strength on-ice play. Goals logged
  // before strength tracking existed have no `strength` field at all —
  // those are treated as ES so old games aren't silently zeroed out.
  events.filter(e => {
    if (e.type !== EventType.GOAL) return false;
    const s = e.metadata?.strength;
    return !s || s === 'ES' || s === 'SH';
  }).forEach(e => {
    const onIce: string[] = e.metadata?.playersOnIce || [];
    const onIceAgainst: string[] = e.metadata?.againstPlayersOnIce || [];
    roster.forEach(p => {
      const row = map.get(p.number);
      if (!row) return;
      if (onIce.includes(p.number)) {
        row.plusMinus += e.team === team ? 1 : -1;
      } else if (onIceAgainst.includes(p.number)) {
        row.plusMinus -= 1;
      }
    });
  });

  // Assists — credited from each goal's metadata.assists list, separate
  // from the main per-player loop above since an assist belongs to a
  // different player than whoever the event's playerNumber (scorer) is.
  events.filter(e => e.team === team && e.type === EventType.GOAL && e.metadata?.assists).forEach(e => {
    (e.metadata!.assists as string[]).forEach(num => {
      const row = map.get(num);
      if (row) { row.assists++; row.total++; }
    });
  });

  return Array.from(map.values())
    .filter(r => r.total > 0 || r.goals > 0 || r.shots > 0 || r.plusMinus !== 0 || r.assists > 0)
    .sort((a, b) => b.total - a.total);
}

// Saves are derived, not logged directly — shots on net against minus
// goals against. No separate "SAVE" event needed; this just reads the
// same shot/goal data already being tracked, from the opposing team's
// perspective.
function computeGoalieStats(events: GameEvent[], goalieNumber: string, goalieTeam: Team, roster: Player[]) {
  const goalie = roster.find(p => p.number === goalieNumber);
  if (!goalie) return null;
  const opposingTeam = goalieTeam === Team.HOME ? Team.AWAY : Team.HOME;
  const shotsAgainst = events.filter(e => e.team === opposingTeam && e.type === EventType.SHOT && e.metadata?.onNet !== false).length;
  const goalsAgainst = events.filter(e => e.team === opposingTeam && e.type === EventType.GOAL).length;
  const saves = Math.max(0, shotsAgainst - goalsAgainst);
  const savePct = shotsAgainst > 0 ? (saves / shotsAgainst) : null;
  return { name: goalie.name, number: goalie.number, shotsAgainst, goalsAgainst, saves, savePct };
}

const StatBadge = ({ value, color }: { value: number; color: string }) => (
  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${value > 0 ? color : 'text-slate-700 bg-transparent'}`}>
    {value > 0 ? value : '—'}
  </span>
);

const PlusMinusBadge = ({ value }: { value: number }) => {
  const color = value > 0 ? 'text-green-400 bg-green-500/10' : value < 0 ? 'text-red-400 bg-red-500/10' : 'text-slate-700 bg-transparent';
  const label = value > 0 ? `+${value}` : value < 0 ? `${value}` : '—';
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${color}`}>
      {label}
    </span>
  );
};

const PlayerStats: React.FC<PlayerStatsProps> = ({
  events, homeRoster, awayRoster, homeName, awayName, startingGoalieHome, startingGoalieAway, isOpen, onClose
}) => {
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home');

  if (!isOpen) return null;

  const homeStats = buildPlayerStats(events, homeRoster, Team.HOME);
  const awayStats = buildPlayerStats(events, awayRoster, Team.AWAY);
  const rows = activeTeam === 'home' ? homeStats : awayStats;
  const teamName = activeTeam === 'home' ? homeName : awayName;

  const activeGoalieNumber = activeTeam === 'home' ? startingGoalieHome : startingGoalieAway;
  const activeGoalieTeam = activeTeam === 'home' ? Team.HOME : Team.AWAY;
  const activeRoster = activeTeam === 'home' ? homeRoster : awayRoster;
  const goalieStats = activeGoalieNumber ? computeGoalieStats(events, activeGoalieNumber, activeGoalieTeam, activeRoster) : null;

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
        {goalieStats && (
          <div className="max-w-5xl mx-auto mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap">
            <span className="text-lg">🥅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white truncate">#{goalieStats.number} {goalieStats.name} <span className="text-yellow-400 text-[10px] font-black uppercase tracking-wider ml-1">Starting Goalie</span></p>
            </div>
            <div className="flex items-center gap-4 text-center shrink-0">
              <div><p className="text-lg font-black text-white">{goalieStats.saves}</p><p className="text-[9px] font-bold text-slate-500 uppercase">Saves</p></div>
              <div><p className="text-lg font-black text-white">{goalieStats.goalsAgainst}</p><p className="text-[9px] font-bold text-slate-500 uppercase">GA</p></div>
              <div><p className="text-lg font-black text-white">{goalieStats.shotsAgainst}</p><p className="text-[9px] font-bold text-slate-500 uppercase">SA</p></div>
              <div><p className="text-lg font-black text-yellow-400">{goalieStats.savePct !== null ? `.${Math.round(goalieStats.savePct * 1000)}` : '—'}</p><p className="text-[9px] font-bold text-slate-500 uppercase">SV%</p></div>
            </div>
          </div>
        )}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="text-4xl">📊</div>
            <p className="text-slate-400 text-sm">No events logged for {teamName} yet.</p>
            <p className="text-slate-600 text-xs">Start tracking events on the rink map to see player stats here.</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto overflow-x-auto">
            <div style={{ minWidth: '760px' }}>
            {/* Column headers */}
            <div className="grid grid-cols-[2fr_1fr_repeat(12,1fr)] gap-1 mb-2 px-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Player</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Pos</span>
              <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider text-center">G</span>
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider text-center">A</span>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider text-center">SOG</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">MISS</span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider text-center">PP</span>
              <span className="text-xs font-bold text-pink-400 uppercase tracking-wider text-center">PK</span>
              <span className="text-xs font-bold text-orange-400 uppercase tracking-wider text-center">HIT</span>
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider text-center">PEN</span>
              <span className="text-xs font-bold text-green-400 uppercase tracking-wider text-center">FW</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">FL</span>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider text-center">BLK</span>
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider text-center">+/-</span>
            </div>

            <div className="space-y-1.5">
              {rows.map((row, i) => (
                <div
                  key={row.number}
                  className={`grid grid-cols-[2fr_1fr_repeat(12,1fr)] gap-1 items-center px-3 py-2.5 rounded-xl border ${i === 0 ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-white/3 border-white/5'}`}
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
                  <StatBadge value={row.assists} color="text-sky-400 bg-sky-500/10" />
                  <StatBadge value={row.shotsOnNet} color="text-cyan-400 bg-cyan-500/10" />
                  <StatBadge value={row.shotsMissed} color="text-slate-400 bg-white/5" />
                  <StatBadge value={row.ppShots} color="text-amber-400 bg-amber-500/10" />
                  <StatBadge value={row.pkShots} color="text-pink-400 bg-pink-500/10" />
                  <StatBadge value={row.hits} color="text-orange-400 bg-orange-500/10" />
                  <StatBadge value={row.penalties} color="text-red-400 bg-red-500/10" />
                  <StatBadge value={row.faceoffWins} color="text-green-400 bg-green-500/10" />
                  <StatBadge value={row.faceoffLosses} color="text-slate-400 bg-white/5" />
                  <StatBadge value={row.blocks} color="text-cyan-400 bg-cyan-500/10" />
                  <PlusMinusBadge value={row.plusMinus} />
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-6 px-3">
              {[
                { key: 'G', label: 'Goals', color: 'text-yellow-400' },
                { key: 'A', label: 'Assists', color: 'text-sky-400' },
                { key: 'SOG', label: 'Shots on Goal', color: 'text-cyan-400' },
                { key: 'MISS', label: 'Missed/Blocked Attempts', color: 'text-slate-400' },
                { key: 'PP', label: 'Power Play Shots', color: 'text-amber-400' },
                { key: 'PK', label: 'Penalty Kill Shots', color: 'text-pink-400' },
                { key: 'HIT', label: 'Hits', color: 'text-orange-400' },
                { key: 'PEN', label: 'Penalties', color: 'text-red-400' },
                { key: 'FW', label: 'Faceoff Wins', color: 'text-green-400' },
                { key: 'FL', label: 'Faceoff Losses', color: 'text-slate-400' },
                { key: 'BLK', label: 'Blocks', color: 'text-cyan-400' },
                { key: '+/-', label: 'Plus/Minus (even strength & shorthanded only)', color: 'text-purple-400' },
              ].map(l => (
                <span key={l.key} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`font-black ${l.color}`}>{l.key}</span>
                  <span>{l.label}</span>
                </span>
              ))}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerStats;
