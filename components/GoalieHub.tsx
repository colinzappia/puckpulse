import React, { useState } from 'react';
import { Team, Player } from '../types';

interface NetMark {
  x: number;
  y: number;
  outcome: 'save' | 'goal';
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
  onClearMarks: (team: Team) => void;
}

// Net interior bounds, in the diagram's own coordinate space (viewBox
// 0 0 300 200). Kept as named constants since the grid math and the
// click-to-zone math both depend on staying in sync with these.
const NET_X = 20;
const NET_Y = 20;
const NET_W = 260;
const NET_H = 160;
const COLS = 3;
const ROWS = 3;
const CELL_W = NET_W / COLS;
const CELL_H = NET_H / ROWS;

// Nine genuinely equal zones, drawn as their own bordered rectangles
// (not just crossing lines) so the grid reads unambiguously as nine
// same-size cells rather than something that merely looks gridded.
const NetGrid: React.FC = () => {
  const cells: React.ReactElement[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={NET_X + col * CELL_W}
          y={NET_Y + row * CELL_H}
          width={CELL_W}
          height={CELL_H}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
        />
      );
    }
  }
  return <>{cells}</>;
};

// Goalie silhouette dimensions, sized to preserve its own aspect ratio
// (roughly square) rather than being stretched to fill the wide net
// rectangle — fit to net height with a small margin, centred horizontally.
const GOALIE_ASPECT = 500 / 510;
const GOALIE_H = NET_H - 10;
const GOALIE_W = GOALIE_H * GOALIE_ASPECT;
const GOALIE_X = NET_X + (NET_W - GOALIE_W) / 2;
const GOALIE_Y = NET_Y + (NET_H - GOALIE_H) / 2;

const NetDiagram: React.FC<{
  marks: NetMark[];
  mode: 'save' | 'goal';
  onTap: (x: number, y: number) => void;
}> = ({ marks, mode, onTap }) => {
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    // Snap to the centre of whichever of the 9 zones was tapped, rather
    // than the raw pixel — these are meant to function as discrete target
    // zones (e.g. "top far corner", "five hole"), not freeform placement.
    const col = Math.min(COLS - 1, Math.max(0, Math.floor((loc.x - NET_X) / CELL_W)));
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor((loc.y - NET_Y) / CELL_H)));
    const cx = NET_X + col * CELL_W + CELL_W / 2;
    const cy = NET_Y + row * CELL_H + CELL_H / 2;
    onTap(cx, cy);
  };

  return (
    <svg
      viewBox="0 0 300 200"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      onClick={handleClick}
      className="w-full rounded-xl cursor-crosshair touch-none"
      style={{ background: '#0a1628' }}
    >
      <defs>
        <pattern id="netMesh" width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M0,9 L9,0" stroke="rgba(200,205,215,0.35)" strokeWidth={0.6} />
          <path d="M-2.25,2.25 L2.25,-2.25" stroke="rgba(200,205,215,0.35)" strokeWidth={0.6} />
          <path d="M6.75,11.25 L11.25,6.75" stroke="rgba(200,205,215,0.35)" strokeWidth={0.6} />
        </pattern>
      </defs>
      {/* Netting mesh, clipped to the frame's interior */}
      <rect x={NET_X + 3} y={NET_Y + 3} width={NET_W - 6} height={NET_H - 6} fill="url(#netMesh)" rx={NET_Y} />
      {/* Red net frame — arched top corners like a real net, straight sides */}
      <rect x={NET_X} y={NET_Y} width={NET_W} height={NET_H} fill="none" stroke="#dc2626" strokeWidth={7} strokeLinejoin="round" rx={NET_Y} />
      <image href="/goalie-silhouette.png" xlinkHref="/goalie-silhouette.png" x={GOALIE_X} y={GOALIE_Y} width={GOALIE_W} height={GOALIE_H} opacity={0.85} />
      <NetGrid />
      {marks.map((m, i) => {
        const color = m.outcome === 'save' ? '#22c55e' : '#ef4444';
        const symbol = m.outcome === 'save' ? 'M -5,0 L -1.5,4 L 6,-5' : 'M -5,-5 L 5,5 M 5,-5 L -5,5';
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

const GoalieHub: React.FC<GoalieHubProps> = ({
  isOpen, onClose, homeName, awayName, homeRoster, awayRoster,
  startingGoalieHome, startingGoalieAway, netMarksHome, netMarksAway,
  onAddMark, onClearMarks,
}) => {
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home');
  const [mode, setMode] = useState<'save' | 'goal'>('save');

  if (!isOpen) return null;

  const team = activeTeam === 'home' ? Team.HOME : Team.AWAY;
  const teamName = activeTeam === 'home' ? homeName : awayName;
  const roster = activeTeam === 'home' ? homeRoster : awayRoster;
  const startingGoalie = activeTeam === 'home' ? startingGoalieHome : startingGoalieAway;
  const goalie = roster.find(p => p.number === startingGoalie);
  const marks = activeTeam === 'home' ? netMarksHome : netMarksAway;

  const saves = marks.filter(m => m.outcome === 'save').length;
  const goals = marks.filter(m => m.outcome === 'goal').length;
  const total = saves + goals;
  const svPct = total > 0 ? `.${Math.round((saves / total) * 1000)}` : '—';

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
      <div className="flex gap-1 p-3 bg-black/20 border-b border-white/5 shrink-0">
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

      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="max-w-lg mx-auto">
          {!startingGoalie ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <div className="text-4xl">🥅</div>
              <p className="text-slate-400 text-sm">No starting goalie set for {teamName}.</p>
              <p className="text-slate-600 text-xs">Set one with the ★ in Roster Setup to start tracking here.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tracking</p>
                  <p className="text-white font-black text-lg">#{startingGoalie} {goalie?.name || teamName}</p>
                </div>
                <button onClick={() => onClearMarks(team)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-[11px] font-bold transition-all">
                  Clear
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setMode('save')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${mode === 'save' ? 'bg-green-500/15 border-green-500 text-green-300' : 'bg-white/5 border-white/15 text-slate-400'}`}
                >
                  Tap net = Save
                </button>
                <button
                  onClick={() => setMode('goal')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${mode === 'goal' ? 'bg-red-500/15 border-red-500 text-red-300' : 'bg-white/5 border-white/15 text-slate-400'}`}
                >
                  Tap net = Goal
                </button>
              </div>

              <NetDiagram marks={marks} mode={mode} onTap={(x, y) => onAddMark(team, x, y, mode)} />
              <p className="text-slate-600 text-[11px] text-center mt-2">Tap anywhere in the net to log a shot placement</p>

              <div className="flex items-center gap-3 mt-4">
                <div className="flex-1 bg-white/5 rounded-xl py-2.5 text-center">
                  <p className="text-green-400 text-xl font-black">{saves}</p>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mt-0.5">Saves</p>
                </div>
                <div className="flex-1 bg-white/5 rounded-xl py-2.5 text-center">
                  <p className="text-red-400 text-xl font-black">{goals}</p>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mt-0.5">Goals</p>
                </div>
                <div className="flex-1 bg-white/5 rounded-xl py-2.5 text-center">
                  <p className="text-cyan-400 text-xl font-black">{svPct}</p>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mt-0.5">SV%</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalieHub;
