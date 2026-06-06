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
  onClose?: () => void;
  isBottomPanel?: boolean;
}

function getFaceoffStats(events: GameEvent[], team: Team) {
  const fo = events.filter(e => e.team === team && (e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS));
  const wins = fo.filter(e => e.type === EventType.FACEOFF_WIN).length;
  const total = fo.length;
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;

  const byDot: Record<string, { wins: number; losses: number }> = {};
  fo.forEach(e => {
    const dot = e.metadata?.faceoffDot || (e.zone === Zone.OFFENSIVE ? 'right' : e.zone === Zone.DEFENSIVE ? 'left' : 'center');
    if (!byDot[dot]) byDot[dot] = { wins: 0, losses: 0 };
    if (e.type === EventType.FACEOFF_WIN) byDot[dot].wins++;
    else byDot[dot].losses++;
  });

  const byCentre: Record<string, { wins: number; losses: number }> = {};
  fo.forEach(e => {
    if (!e.playerNumber) return;
    if (!byCentre[e.playerNumber]) byCentre[e.playerNumber] = { wins: 0, losses: 0 };
    if (e.type === EventType.FACEOFF_WIN) byCentre[e.playerNumber].wins++;
    else byCentre[e.playerNumber].losses++;
  });

  return { wins, total, pct, byDot, byCentre };
}

const DOT_LABELS: Record<string, string> = {
  'center': 'Center Ice',
  'left-top': 'Left Top',
  'left-bottom': 'Left Bottom', 
  'right-top': 'Right Top',
  'right-bottom': 'Right Bottom',
  'neutral-left-top': 'NZ Left Top',
  'neutral-left-bottom': 'NZ Left Bottom',
  'neutral-right-top': 'NZ Right Top',
  'neutral-right-bottom': 'NZ Right Bottom',
};

const FaceoffWidget: React.FC<FaceoffWidgetProps> = ({
  events, homeRoster, awayRoster, homeName, awayName,
  fowHomeCenter, fowAwayCenter, onSetHomeCenter, onSetAwayCenter,
  onLogFaceoff, onClose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'stats'>('stats');

  const homeStats = getFaceoffStats(events, Team.HOME);
  const awayStats = getFaceoffStats(events, Team.AWAY);
  const totalFaceoffs = Math.floor((events.filter(e => e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS).length) / 2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-xl flex flex-col">
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">🏒 Faceoff Stats</h2>
          <p className="text-xs text-slate-500 mt-0.5">{totalFaceoffs} faceoffs tracked</p>
        </div>
        <button onClick={() => { setIsOpen(false); if (onClose) onClose(); }} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg font-bold">×</button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        {totalFaceoffs === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-4xl">🏒</div>
            <p className="text-slate-400 text-sm">No faceoffs logged yet.</p>
            <p className="text-slate-600 text-xs">Use the 🏒 FO button in the toolbar to log faceoffs.</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Team overview */}
            <div className="grid grid-cols-2 gap-4">
              {[{ name: homeName, stats: homeStats, color: 'blue' }, { name: awayName, stats: awayStats, color: 'red' }].map(t => (
                <div key={t.name} className={`bg-${t.color}-900/20 border border-${t.color}-500/20 rounded-2xl p-4 text-center`}>
                  <p className={`text-xs font-black text-${t.color}-400 uppercase tracking-wider mb-1`}>{t.name}</p>
                  <p className="text-4xl font-black text-white">{t.stats.pct}%</p>
                  <p className="text-xs text-slate-400 mt-1">{t.stats.wins}W — {t.stats.total - t.stats.wins}L</p>
                </div>
              ))}
            </div>

            {/* By dot location */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs font-black text-yellow-400 uppercase tracking-wider mb-3">By Faceoff Circle</p>
              {Object.entries(
                events
                  .filter(e => e.team === Team.HOME && (e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS))
                  .reduce((acc: Record<string, {wins: number; losses: number}>, e) => {
                    const dot = e.metadata?.faceoffDot || 'center';
                    if (!acc[dot]) acc[dot] = { wins: 0, losses: 0 };
                    if (e.type === EventType.FACEOFF_WIN) acc[dot].wins++;
                    else acc[dot].losses++;
                    return acc;
                  }, {})
              ).map(([dot, s]) => {
                const total = s.wins + s.losses;
                const pct = total > 0 ? Math.round(s.wins / total * 100) : 0;
                return (
                  <div key={dot} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-slate-400 w-32 shrink-0">{DOT_LABELS[dot] || dot}</span>
                    <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-black text-blue-300 w-10 text-right">{pct}%</span>
                    <span className="text-xs text-slate-500 w-14">{s.wins}W {s.losses}L</span>
                  </div>
                );
              })}
            </div>

            {/* By centre */}
            {[{ name: homeName, stats: homeStats, roster: homeRoster, color: 'blue' }, { name: awayName, stats: awayStats, roster: awayRoster, color: 'red' }].map(t => (
              Object.keys(t.stats.byCentre).length > 0 && (
                <div key={t.name} className={`bg-${t.color}-900/20 border border-${t.color}-500/20 rounded-2xl p-4`}>
                  <p className={`text-xs font-black text-${t.color}-400 uppercase tracking-wider mb-3`}>{t.name} — By Centre</p>
                  {Object.entries(t.stats.byCentre).sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses)).map(([num, s]) => {
                    const pct = s.wins + s.losses > 0 ? Math.round(s.wins / (s.wins + s.losses) * 100) : 0;
                    const player = t.roster.find(p => p.number === num);
                    return (
                      <div key={num} className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold text-white w-24 truncate">#{num} {player?.name.split(' ').pop()}</span>
                        <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden">
                          <div className={`bg-${t.color}-500 h-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-black text-${t.color}-300 w-10 text-right`}>{pct}%</span>
                        <span className="text-xs text-slate-500 w-14">{s.wins}W {s.losses}L</span>
                      </div>
                    );
                  })}
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceoffWidget;
