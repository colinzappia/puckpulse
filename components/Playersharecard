import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { SavedGameReport } from '../services/gameReportService';
import { buildPlayerStats } from './playerstats';
import { Team } from '../types';

interface PlayerShareCardProps {
  report: SavedGameReport;
  team: Team;
  playerNumber: string;
  onClose: () => void;
}

const PlayerShareCard: React.FC<PlayerShareCardProps> = ({ report, team, playerNumber, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const isHome = team === Team.HOME;
  const roster = isHome ? report.homeRoster : report.awayRoster;
  const teamName = isHome ? report.homeName : report.awayName;
  const opponentName = isHome ? report.awayName : report.homeName;
  const teamLogo = isHome ? report.homeLogo : report.awayLogo;

  const rows = buildPlayerStats(report.events, roster, team);
  const player = rows.find(r => r.number === playerNumber);

  const dateStr = new Date(report.playedAt || report.createdAt).toLocaleDateString('en-CA', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#05070a', scale: 2, useCORS: true });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${player?.name.replace(/\s+/g, '-') || 'player'}-vs-${opponentName.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      setDownloadError("Couldn't generate the image — this can happen if the team logo is blocking cross-origin downloads. Try again, or remove the logo and re-save if it keeps failing.");
    } finally {
      setDownloading(false);
    }
  };

  if (!player) return null;

  const statBlocks = [
    { label: 'Goals', value: player.goals },
    { label: 'Assists', value: player.assists },
    { label: 'Points', value: player.goals + player.assists },
    { label: 'Shots', value: player.shotsOnNet },
    { label: 'Hits', value: player.hits },
    { label: '+/-', value: player.plusMinus > 0 ? `+${player.plusMinus}` : player.plusMinus },
  ];

  return (
    <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div
          ref={cardRef}
          style={{ background: 'linear-gradient(135deg, #05070a 0%, #0a1628 100%)' }}
          className="rounded-3xl p-8 border border-white/10"
        >
          <div className="flex items-center justify-between mb-6">
            {teamLogo ? (
              <img src={teamLogo} alt="" className="h-10 w-10 object-contain" crossOrigin="anonymous" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white font-black text-xs">
                {teamName.charAt(0)}
              </div>
            )}
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{dateStr}</p>
          </div>

          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-1">{teamName} vs {opponentName}</p>
          <h2 className="text-3xl font-black text-white leading-tight mb-1">#{player.number} {player.name}</h2>
          <p className="text-xs text-slate-500 mb-6">{player.position === 'G' ? 'Goaltender' : 'Skater'}</p>

          <div className="grid grid-cols-3 gap-3">
            {statBlocks.map(s => (
              <div key={s.label} className="bg-white/5 rounded-2xl py-4 text-center">
                <p className="text-2xl font-black text-white">{s.value}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-1.5">
            <span className="text-xs">🏒</span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Top Cheese Hockey</span>
          </div>
        </div>

        {downloadError && (
          <p className="text-red-400 text-xs text-center mt-3">{downloadError}</p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-white/10 hover:border-white/20 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black rounded-xl text-sm transition-colors"
          >
            {downloading ? 'Generating…' : '⬇ Download Image'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerShareCard;
