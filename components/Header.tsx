import { UserButton } from '@clerk/clerk-react';
import React from 'react';
import { getPeriodLabel } from '../App';

interface TeamDisplay {
  name: string;
  score: number;
  logo?: string;
  colorClass: string;
}

interface HeaderProps {
  leftTeam: TeamDisplay;
  rightTeam: TeamDisplay;
  period: number;
  onOpenSetup: () => void;
  onOpenManual: () => void;
  onSetPeriod: (p: number) => void;
  onSwapSides: () => void;
}

const Header: React.FC<HeaderProps> = ({ leftTeam, rightTeam, period, onOpenSetup, onOpenManual, onSetPeriod, onSwapSides }) => {
  const periodLabel = getPeriodLabel(period);

  const TeamScore = ({ team, align }: { team: TeamDisplay, align: 'left' | 'right' }) => {
    const isBlue = team.colorClass === 'blue';
    const accentColor = isBlue ? 'blue-500' : 'red-500';
    const borderColor = isBlue ? 'border-blue-500/40' : 'border-red-500/40';
    const glowColor = isBlue ? 'shadow-blue-500/20' : 'shadow-red-500/20';

    return (
      <div className={`flex items-center gap-2 sm:gap-4 md:gap-6 w-full ${align === 'left' ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Logo Container */}
        <div className={`relative w-10 h-10 sm:w-16 sm:h-16 md:w-24 md:h-24 rounded-xl sm:rounded-[1.5rem] md:rounded-[2.5rem] border-2 bg-black/60 flex items-center justify-center overflow-hidden shrink-0 transition-all duration-500 ${borderColor} ${glowColor} shadow-xl`}>
          {team.logo ? (
            <img 
              src={team.logo} 
              alt={team.name} 
              className="w-full h-full object-contain p-1.5 sm:p-3 md:p-4" 
            />
          ) : (
            <span className={`text-lg sm:text-3xl md:text-5xl font-black italic text-${accentColor}`}>
              {team.name ? team.name.charAt(0) : (align === 'left' ? 'H' : 'V')}
            </span>
          )}
          <div className={`absolute top-0 ${align === 'left' ? 'left-0' : 'right-0'} w-1.5 h-1.5 bg-${accentColor} opacity-50`}></div>
        </div>

        {/* Score Display */}
        <div className="flex-1 flex items-center justify-center">
          <span className={`text-3xl sm:text-6xl md:text-8xl font-black tabular-nums tracking-tighter leading-none transition-colors duration-500 text-${accentColor}`}>
            {team.score}
          </span>
        </div>
      </div>
    );
  };

  return (
    <header className="bg-black/95 border-b border-white/10 sticky top-0 z-[110] backdrop-blur-3xl px-0 py-0 pt-safe flex items-center shadow-[0_15px_50px_rgba(0,0,0,0.9)] overflow-hidden w-full">
      <div className="w-full flex flex-col">
        {/* Pro Broadcast Scoreboard */}
        <div className="flex flex-col bg-white/5 border-b border-white/10 shadow-inner w-full relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

          {/* Top Names Bar */}
          <div className="flex justify-between items-center px-4 sm:px-12 md:px-24 py-1.5 sm:py-3 md:py-4 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-2 sm:gap-4 flex-1">
              <span className="text-[9px] sm:text-xs md:text-xl font-black text-blue-400 uppercase tracking-widest sm:tracking-[0.3em] truncate max-w-[150px] sm:max-w-none">
                {leftTeam.name || 'HOME'}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-6 shrink-0 px-4">
              <button 
                onClick={onOpenManual} 
                className="p-1.5 sm:p-2 bg-blue-900/40 hover:bg-blue-800/60 rounded-lg border border-blue-500/30 text-blue-400 active:scale-90 transition-all shadow-xl group hover:border-blue-400"
                title="User Manual"
              >
                <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              <div className="w-px h-3 sm:h-4 bg-white/10"></div>

              <button 
                onClick={onOpenSetup} 
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-500 rounded-lg border border-blue-400/50 text-white active:scale-95 transition-all shadow-lg flex items-center gap-2 group"
                title="Roster Setup"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest">Roster Setup</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 sm:gap-4 flex-1">
              <span className="text-[9px] sm:text-xs md:text-xl font-black text-red-400 uppercase tracking-widest sm:tracking-[0.3em] truncate max-w-[150px] sm:max-w-none text-right">
                {rightTeam.name || 'VISITOR'}
              </span>
            </div>
          </div>

          {/* Main Scoreboard Row */}
          <div className="flex items-center px-2 sm:px-8 md:px-16 py-2 sm:py-4 md:py-8 w-full max-w-7xl mx-auto">
            {/* Left Team Box */}
            <div className="flex-[2] flex justify-center min-w-0">
              <TeamScore team={leftTeam} align="left" />
            </div>
            
            {/* Central Period Indicator & Controls */}
            <div className="flex flex-col items-center shrink-0 px-2 sm:px-8 md:px-12 border-l border-r border-white/10">
               <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6">
                 <button 
                   onClick={() => onSetPeriod(Math.max(1, period - 1))} 
                   className="text-slate-700 hover:text-white transition-all active:scale-75 p-1.5 sm:p-2 bg-white/5 rounded-lg sm:rounded-xl border border-transparent hover:border-white/10"
                   title="Previous Period"
                 >
                   <svg className="w-2.5 h-2.5 sm:w-4 sm:h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M15 19l-7-7 7-7" />
                   </svg>
                 </button>
                 
                 <div className="text-center min-w-[30px] sm:min-w-[80px] md:min-w-[140px]">
                   <span className="text-base sm:text-4xl md:text-6xl font-black text-white italic block leading-none tracking-tighter uppercase">{periodLabel}</span>
                   <span className="block text-[7px] sm:text-[10px] md:text-sm font-black text-blue-500 uppercase tracking-widest sm:tracking-[0.5em] mt-0.5 sm:mt-2 md:mt-3">PER</span>
                 </div>

                 <button 
                   onClick={() => onSetPeriod(Math.min(8, period + 1))} 
                   className="text-slate-700 hover:text-white transition-all active:scale-75 p-1.5 sm:p-2 bg-white/5 rounded-lg sm:rounded-xl border border-transparent hover:border-white/10"
                   title="Next Period"
                 >
                   <svg className="w-2.5 h-2.5 sm:w-4 sm:h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M9 5l7 7-7 7" />
                   </svg>
                 </button>
               </div>
               
               {/* Switch Sides Action */}
               <button 
                  onClick={onSwapSides}
                  className="mt-1 sm:mt-3 md:mt-4 flex items-center gap-1 sm:gap-2 px-2 py-0.5 sm:px-4 sm:py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95 group/swap"
                  title="Switch Ends"
               >
                  <svg className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-slate-500 group-hover/swap:text-blue-500 group-hover/swap:rotate-180 transition-all duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span className="hidden sm:inline text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover/swap:text-blue-500 transition-colors">Swap</span>
               </button>
            </div>

            {/* Right Team Box */}
            <div className="flex-[2] flex justify-center min-w-0">
              <TeamScore team={rightTeam} align="right" />
            </div>
          </div>
        </div>
      </div>
    <div className="absolute top-2 right-2 z-50">
        <UserButton afterSignOutUrl="/" appearance={{
          elements: {
            avatarBox: 'w-8 h-8',
          }
        }} />
      </div>
    </header>
  );
};

export default Header;
