import React, { useState } from 'react';
import { Team, Player } from '../types';

interface NetMark {
  x: number;
  y: number;
  outcome: string;
}

interface GoalieHubProps {
  isOpen: boolean;
  onClose: () => void;
  homeName: string;
  awayName: string;
  homeRoster: Player[];
  awayRoster: Player[];
  startingGoalieHome?: string;
  startingGoalieAway?: string;
  netMarksHome: NetMark[];
  netMarksAway: NetMark[];
  onAddMark: (team: Team, x: number, y: number, outcome: 'save' | 'goal') => void;
  onUndoMark: (team: Team) => void;
  onClearMarks: (team: Team) => void;
  shotsForHome: NetMark[];
  shotsForAway: NetMark[];
  onAddShotFor: (team: Team, x: number, y: number, outcome: 'goal' | 'missed') => void;
  onUndoShotFor: (team: Team) => void;
  onClearShotFor: (team: Team) => void;
}

// Image's natural dimensions, so the viewBox maps 1:1 to its pixels.
const IMG_W = 1408;
const IMG_H = 768;

const NetDiagram: React.FC<{
  marks: NetMark[];
  positiveValue: string;
  onTap: (x: number, y: number) => void;
}> = ({ marks, positiveValue, onTap }) => {
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    // Freeform placement, same as the rink diagram — lands exactly where
    // tapped rather than snapping to a zone centre. The gridlines baked
    // into the image are still there as a visual reference for the coach,
    // just no longer constraining where a mark can actually go.
    onTap(loc.x, loc.y);
  };

  return (
    <svg
      viewBox={`0 0 ${IMG_W} ${IMG_H}`}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      onClick={handleClick}
      className="w-full rounded-xl cursor-crosshair touch-none"
      style={{ background: '#0a1628' }}
    >
      <image href="/goalie-net.png" xlinkHref="/goalie-net.png" x={0} y={0} width={IMG_W} height={IMG_H} />
      {marks.map((m, i) => {
        const isPositive = m.outcome === positiveValue;
        const color = isPositive ? '#22c55e' : '#ef4444';
        const symbol = isPositive ? 'M -5,0 L -1.5,4 L 6,-5' : 'M -5,-5 L 5,5 M 5,-5 L -5,5';
        return (
          <g key={i} transform={`translate(${m.x},${m.y})`}>
            <circle r={9} fill={color} opacity={0.3} />
            <path d={symbol} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
          </g>
        );
      })}
    </svg>
  );
};

// Reusable panel for one net diagram — used twice per team (shots against
// the team's own goalie, and shots for/taken by the team's own shooters),
// with the outcome vocabulary and colour meaning configurable per use,
// since "good" flips (a save is good for shots-against, a goal is good
// for shots-for).
const NetPanel: React.FC<{
  title: string;
  subtitle: string;
  marks: NetMark[];
  positiveValue: string;
  negativeValue: string;
  positiveLabel: string;
  negativeLabel: string;
  positiveStatLabel: string;
  negativeStatLabel: string;
  pctLabel: string;
  onAdd: (x: number, y: number, outcome: string) => void;
  onUndo: () => void;
  onClear: () => void;
}> = ({
  title, subtitle, marks, positiveValue, negativeValue, positiveLabel, negativeLabel,
  positiveStatLabel, negativeStatLabel, pctLabel, onAdd, onUndo, onClear,
}) => {
  const [mode, setMode] = useState<string>(positiveValue);

  const positiveCount = marks.filter(m => m.outcome === positiveValue).length;
  const negativeCount = marks.filter(m => m.outcome === negativeValue).length;
  const total = positiveCount + negativeCount;
  const pct = total > 0 ? `.${Math.round((positiveCount / total) * 1000)}` : '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
          <p className="text-slate-400 text-xs">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={marks.length === 0}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${marks.length === 0 ? 'bg-white/[0.02] border-white/5 text-slate-700 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400'}`}
          >
            Undo
          </button>
          <button onClick={onClear} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-[11px] font-bold transition-all">
            Clear
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setMode(positiveValue)}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${mode === positiveValue ? 'bg-green-500/15 border-green-500 text-green-300' : 'bg-white/5 border-white/15 text-slate-400'}`}
        >
          Tap net = {positiveLabel}
        </button>
        <button
          onClick={() => setMode(negativeValue)}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${mode === negativeValue ? 'bg-red-500/15 border-red-500 text-red-300' : 'bg-white/5 border-white/15 text-slate-400'}`}
        >
          Tap net = {negativeLabel}
        </button>
      </div>

      <NetDiagram marks={marks} positiveValue={positiveValue} onTap={(x, y) => onAdd(x, y, mode)} />
      <p className="text-slate-600 text-[11px] text-center mt-2">Tap anywhere in the net to log a shot placement</p>

      <div className="flex items-center gap-3 mt-4">
        <div className="flex-1 bg-white/5 rounded-xl py-2.5 text-center">
          <p className="text-green-400 text-xl font-black">{positiveCount}</p>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mt-0.5">{positiveStatLabel}</p>
        </div>
        <div className="flex-1 bg-white/5 rounded-xl py-2.5 text-center">
          <p className="text-red-400 text-xl font-black">{negativeCount}</p>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mt-0.5">{negativeStatLabel}</p>
        </div>
        <div className="flex-1 bg-white/5 rounded-xl py-2.5 text-center">
          <p className="text-cyan-400 text-xl font-black">{pct}</p>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mt-0.5">{pctLabel}</p>
        </div>
      </div>
    </div>
  );
};

const GoalieHub: React.FC<GoalieHubProps> = ({
  isOpen, onClose, homeName, awayName, homeRoster, awayRoster,
  startingGoalieHome, startingGoalieAway, netMarksHome, netMarksAway,
  onAddMark, onUndoMark, onClearMarks,
  shotsForHome, shotsForAway, onAddShotFor, onUndoShotFor, onClearShotFor,
}) => {
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home');

  if (!isOpen) return null;

  const team = activeTeam === 'home' ? Team.HOME : Team.AWAY;
  const teamName = activeTeam === 'home' ? homeName : awayName;
  const roster = activeTeam === 'home' ? homeRoster : awayRoster;
  const startingGoalie = activeTeam === 'home' ? startingGoalieHome : startingGoalieAway;
  const goalie = roster.find(p => p.number === startingGoalie);
  const marksAgainst = activeTeam === 'home' ? netMarksHome : netMarksAway;
  const marksFor = activeTeam === 'home' ? shotsForHome : shotsForAway;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Goalie Hub</h2>
          <p className="text-xs text-slate-500 mt-0.5">Visual net placement — separate from the rink log</p>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg font-bold transition-colors">×</button>
      </div>

      {/* Team tabs */}
      <div className="px-4 py-3 bg-black/20 border-b border-white/5 shrink-0">
        <div className="max-w-6xl mx-auto flex gap-1">
          <button
            onClick={() => setActiveTeam('home')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${activeTeam === 'home' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {homeName}
          </button>
          <button
            onClick={() => setActiveTeam('away')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${activeTeam === 'away' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {awayName}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        {(() => {
          const shotsAgainstPanel = (
            <NetPanel
              title="Shots against"
              subtitle={startingGoalie ? `Tracking #${startingGoalie} ${goalie?.name || teamName}` : `No starting goalie set for ${teamName} — set one with the ★ in Roster Setup`}
              marks={marksAgainst}
              positiveValue="save"
              negativeValue="goal"
              positiveLabel="Save"
              negativeLabel="Goal"
              positiveStatLabel="Saves"
              negativeStatLabel="Goals"
              pctLabel="SV%"
              onAdd={(x, y, outcome) => onAddMark(team, x, y, outcome as 'save' | 'goal')}
              onUndo={() => onUndoMark(team)}
              onClear={() => onClearMarks(team)}
            />
          );
          const shotsForPanel = (
            <NetPanel
              title="Shots for"
              subtitle={`${teamName}'s own shots on the opposing net`}
              marks={marksFor}
              positiveValue="goal"
              negativeValue="missed"
              positiveLabel="Goal"
              negativeLabel="Missed"
              positiveStatLabel="Goals"
              negativeStatLabel="Missed"
              pctLabel="Shoot%"
              onAdd={(x, y, outcome) => onAddShotFor(team, x, y, outcome as 'goal' | 'missed')}
              onUndo={() => onUndoShotFor(team)}
              onClear={() => onClearShotFor(team)}
            />
          );
          // Home's tab sits on the left, Away's on the right — so Shots
          // Against (the goalie-focused panel, showing that team's own
          // goalie name) should sit under whichever side the selected
          // team's own banner is on, not always pinned to the left.
          const [leftPanel, rightPanel] = activeTeam === 'home'
            ? [shotsAgainstPanel, shotsForPanel]
            : [shotsForPanel, shotsAgainstPanel];
          return (
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 md:divide-x md:divide-white/10">
              <div className="w-full max-w-md mx-auto">{leftPanel}</div>
              <div className="w-full max-w-md mx-auto md:pl-8">{rightPanel}</div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default GoalieHub;
