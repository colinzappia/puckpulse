import React, { useMemo, useState } from 'react';
import { SavedGameReport } from '../services/gameReportService';
import { buildPlayerStats, computeGoalieStats, PlayerRow } from './playerstats';
import { Team, EventType } from '../types';

interface SeasonStatsProps {
  reports: SavedGameReport[];
}

interface SeasonPlayerRow {
  number: string;
  name: string;
  position: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  shotsOnNet: number;
  hits: number;
  penalties: number;
  faceoffWins: number;
  faceoffLosses: number;
  blocks: number;
  plusMinus: number;
}

interface SeasonGoalieRow {
  number: string;
  name: string;
  gamesPlayed: number;
  shotsAgainst: number;
  goalsAgainst: number;
  saves: number;
  savePct: number | null;
}

interface GameSvPoint {
  date: string;
  opponent: string;
  shotsAgainst: number;
  goalsAgainst: number;
  saves: number;
  savePct: number | null;
}

// A coach's own team can be listed as either "home" or "away" depending
// on the game — the opponent changes every game, but the coach's own
// team name should recur across nearly every saved game. Using whichever
// name appears most often is a reliable, no-setup way to guess which
// side is "my team" by default.
function guessMyTeamName(reports: SavedGameReport[]): string {
  const counts: Record<string, number> = {};
  reports.forEach(r => {
    counts[r.homeName] = (counts[r.homeName] || 0) + 1;
    counts[r.awayName] = (counts[r.awayName] || 0) + 1;
  });
  let best = '';
  let bestCount = 0;
  Object.entries(counts).forEach(([name, count]) => {
    if (count > bestCount) { best = name; bestCount = count; }
  });
  return best;
}

const SeasonStats: React.FC<SeasonStatsProps> = ({ reports }) => {
  const teamNames = useMemo(() => {
    const set = new Set<string>();
    reports.forEach(r => { set.add(r.homeName); set.add(r.awayName); });
    return Array.from(set).sort();
  }, [reports]);

  const [myTeam, setMyTeam] = useState(() => guessMyTeamName(reports));
  const [sortKey, setSortKey] = useState<keyof SeasonPlayerRow>('points');

  const { seasonRows, seasonGoalieRows, svTrend, gamesForTeam, undattributedGames } = useMemo(() => {
    const relevant = reports.filter(r => r.homeName === myTeam || r.awayName === myTeam);
    const byNumber: Record<string, SeasonPlayerRow> = {};
    const goaliesByNumber: Record<string, SeasonGoalieRow> = {};
    const svPoints: GameSvPoint[] = [];
    let unattributed = 0;

    relevant.forEach(report => {
      const isHome = report.homeName === myTeam;
      const team = isHome ? Team.HOME : Team.AWAY;
      const opponent = isHome ? report.awayName : report.homeName;
      const roster = isHome ? report.homeRoster : report.awayRoster;
      const goalieHistory = isHome ? report.goalieHistoryHome : report.goalieHistoryAway;

      const gameRows: PlayerRow[] = buildPlayerStats(report.events, roster, team);
      gameRows.forEach(row => {
        if (!byNumber[row.number]) {
          byNumber[row.number] = {
            number: row.number, name: row.name, position: row.position,
            gamesPlayed: 0, goals: 0, assists: 0, points: 0, shotsOnNet: 0,
            hits: 0, penalties: 0, faceoffWins: 0, faceoffLosses: 0, blocks: 0, plusMinus: 0,
          };
        }
        const acc = byNumber[row.number];
        if (row.total > 0) acc.gamesPlayed += 1;
        acc.goals += row.goals;
        acc.assists += row.assists;
        acc.points += row.goals + row.assists;
        acc.shotsOnNet += row.shotsOnNet;
        acc.hits += row.hits;
        acc.penalties += row.penalties;
        acc.faceoffWins += row.faceoffWins;
        acc.faceoffLosses += row.faceoffLosses;
        acc.blocks += row.blocks;
        acc.plusMinus += row.plusMinus;
      });

      // Real per-goalie attribution when this game has goalie history
      // saved (splits correctly across a mid-game swap, same as the live
      // Player Stats view does). Older saved games won't have this —
      // they still count toward the overall trend below, just can't be
      // attributed to one specific goalie's individual season line.
      if (goalieHistory && goalieHistory.length > 0) {
        const stints = computeGoalieStats(report.events, goalieHistory, team, roster);
        stints.forEach(stint => {
          if (!goaliesByNumber[stint.number]) {
            goaliesByNumber[stint.number] = { number: stint.number, name: stint.name, gamesPlayed: 0, shotsAgainst: 0, goalsAgainst: 0, saves: 0, savePct: null };
          }
          const g = goaliesByNumber[stint.number];
          if (stint.shotsAgainst > 0) g.gamesPlayed += 1;
          g.shotsAgainst += stint.shotsAgainst;
          g.goalsAgainst += stint.goalsAgainst;
          g.saves += stint.saves;
        });
      } else {
        unattributed += 1;
      }

      // Team-level SV% per game, for the overall trend strip — this
      // includes every game regardless of whether goalie history exists,
      // since it's not trying to attribute to one goalie specifically.
      const opponentTeam = isHome ? Team.AWAY : Team.HOME;
      const shotsAgainst = report.events.filter(e => e.team === opponentTeam && e.type === EventType.SHOT && e.metadata?.onNet !== false).length;
      const goalsAgainst = report.events.filter(e => e.team === opponentTeam && e.type === EventType.GOAL).length;
      const saves = Math.max(0, shotsAgainst - goalsAgainst);
      svPoints.push({
        date: report.playedAt || report.createdAt,
        opponent,
        shotsAgainst, goalsAgainst, saves,
        savePct: shotsAgainst > 0 ? saves / shotsAgainst : null,
      });
    });

    svPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    Object.values(goaliesByNumber).forEach(g => { g.savePct = g.shotsAgainst > 0 ? g.saves / g.shotsAgainst : null; });

    return {
      seasonRows: Object.values(byNumber),
      seasonGoalieRows: Object.values(goaliesByNumber).sort((a, b) => b.saves - a.saves),
      svTrend: svPoints,
      gamesForTeam: relevant.length,
      undattributedGames: unattributed,
    };
  }, [reports, myTeam]);

  const sortedRows = useMemo(() => {
    return [...seasonRows].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  }, [seasonRows, sortKey]);

  const seasonShotsAgainst = svTrend.reduce((s, p) => s + p.shotsAgainst, 0);
  const seasonGoalsAgainst = svTrend.reduce((s, p) => s + p.goalsAgainst, 0);
  const seasonSaves = svTrend.reduce((s, p) => s + p.saves, 0);
  const seasonSvPct = seasonShotsAgainst > 0 ? (seasonSaves / seasonShotsAgainst) : null;

  const columns: { key: keyof SeasonPlayerRow; label: string }[] = [
    { key: 'gamesPlayed', label: 'GP' },
    { key: 'goals', label: 'G' },
    { key: 'assists', label: 'A' },
    { key: 'points', label: 'PTS' },
    { key: 'shotsOnNet', label: 'SOG' },
    { key: 'hits', label: 'HIT' },
    { key: 'penalties', label: 'PEN' },
    { key: 'blocks', label: 'BLK' },
    { key: 'plusMinus', label: '+/-' },
  ];

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <div className="text-4xl">📅</div>
        <p className="text-slate-400 text-sm">No saved games yet.</p>
        <p className="text-slate-600 text-xs">Save games to History and they'll roll up here automatically.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">My Team</label>
        <select
          value={myTeam}
          onChange={e => setMyTeam(e.target.value)}
          className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-white/20"
        >
          {teamNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <span className="text-[10px] text-slate-600">{gamesForTeam} game{gamesForTeam !== 1 ? 's' : ''} found</span>
      </div>

      {/* Season goalie totals — real per-goalie attribution */}
      {seasonGoalieRows.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Season Goalie Totals</p>
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-3 text-[9px] font-black text-slate-500 uppercase">Goalie</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black text-slate-500 uppercase">GP</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black text-slate-500 uppercase">SA</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black text-slate-500 uppercase">GA</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black text-slate-500 uppercase">SV</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black text-cyan-400 uppercase">SV%</th>
                </tr>
              </thead>
              <tbody>
                {seasonGoalieRows.map(g => (
                  <tr key={g.number} className="border-b border-white/5">
                    <td className="py-2 pr-3 font-bold text-white whitespace-nowrap">#{g.number} {g.name}</td>
                    <td className="text-center py-2 px-2 font-bold text-slate-300">{g.gamesPlayed}</td>
                    <td className="text-center py-2 px-2 font-bold text-slate-300">{g.shotsAgainst}</td>
                    <td className="text-center py-2 px-2 font-bold text-red-400">{g.goalsAgainst}</td>
                    <td className="text-center py-2 px-2 font-bold text-green-400">{g.saves}</td>
                    <td className="text-center py-2 px-2 font-black text-cyan-400">{g.savePct !== null ? `.${Math.round(g.savePct * 1000)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {undattributedGames > 0 && (
            <p className="text-[9px] text-slate-600 mt-2">
              {undattributedGames} game{undattributedGames > 1 ? 's' : ''} saved before per-goalie tracking existed — included in the trend below, not in the table above.
            </p>
          )}
        </div>
      )}

      {/* Overall team SV% trend — always available regardless of attribution */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
          {seasonGoalieRows.length > 0 ? 'Team SV% Trend (all goalies combined)' : 'Season Save %'}
        </p>
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-white/5 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-black text-cyan-400">{seasonSvPct !== null ? `.${Math.round(seasonSvPct * 1000)}` : '—'}</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">SV%</p>
          </div>
          <div className="bg-white/5 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-black text-green-400">{seasonSaves}</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">Saves</p>
          </div>
          <div className="bg-white/5 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-black text-red-400">{seasonGoalsAgainst}</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">GA</p>
          </div>
        </div>
        {seasonGoalieRows.length === 0 && (
          <p className="text-[9px] text-slate-600 mb-2">These games predate per-goalie tracking, so this is team-level, not split by individual goalie.</p>
        )}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {svTrend.map((pt, i) => (
            <div key={i} className="shrink-0 w-16 bg-white/5 rounded-lg p-2 text-center" title={`vs ${pt.opponent}`}>
              <p className={`text-xs font-black ${pt.savePct === null ? 'text-slate-700' : pt.savePct >= 0.9 ? 'text-green-400' : pt.savePct >= 0.8 ? 'text-cyan-400' : 'text-red-400'}`}>
                {pt.savePct !== null ? `.${Math.round(pt.savePct * 1000)}` : '—'}
              </p>
              <p className="text-[7px] text-slate-600 uppercase truncate mt-0.5">{pt.opponent}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Season Skater Totals</p>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-3 text-[9px] font-black text-slate-500 uppercase sticky left-0 bg-[#0f1620]">Player</th>
                {columns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => setSortKey(col.key)}
                    className={`text-center py-2 px-2 text-[9px] font-black uppercase cursor-pointer whitespace-nowrap ${sortKey === col.key ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(row => (
                <tr key={row.number} className="border-b border-white/5">
                  <td className="py-2 pr-3 font-bold text-white whitespace-nowrap sticky left-0 bg-[#0f1620]">#{row.number} {row.name}</td>
                  {columns.map(col => (
                    <td key={col.key} className={`text-center py-2 px-2 font-bold ${col.key === 'plusMinus' ? (row.plusMinus > 0 ? 'text-green-400' : row.plusMinus < 0 ? 'text-red-400' : 'text-slate-500') : 'text-slate-300'}`}>
                      {col.key === 'plusMinus' && row.plusMinus > 0 ? '+' : ''}{row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SeasonStats;
