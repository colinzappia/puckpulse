import { UserButton } from '@clerk/clerk-react';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getPeriodLabel } from '../utils';

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
  onNewGame: () => void;
  onEndGame: () => void;
  onOpenAbout: () => void;
  onBackToLanding: () => void;
}

const Header: React.FC<HeaderProps> = ({ leftTeam, rightTeam, period, onOpenSetup, onOpenManual, onSetPeriod, onSwapSides, onNewGame, onEndGame, onOpenAbout, onBackToLanding }) => {
  const periodLabel = getPeriodLabel(period);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const openMenu = () => {
    if (menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + window.scrollY + 8, right: window.innerWidth - rect.right });
    }
    setMenuOpen(v => !v);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const menuAction = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  const TeamScore = ({ team, align }: { team: TeamDisplay, align: 'left' | 'right' }) => {
    const isBlue = team.colorClass === 'blue';
    const accentColor = isBlue ? 'blue-500' : 'red-500';
    const borderColor = isBlue ? 'border-blue-500/40' : 'border-red-500/40';
    const glowColor = isBlue ? 'shadow-blue-500/20' : 'shadow-red-500/20';

    return (
      <div className={`flex items-center gap-2 sm:gap-4 md:gap-6 w-full ${align === 'left' ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`relative w-10 h-10 sm:w-16 sm:h-16 md:w-24 md:h-24 rounded-xl sm:rounded-[1.5rem] md:rounded-[2.5rem] border-2 bg-black/60 flex items-center justify-center overflow-hidden shrink-0 transition-all duration-500 ${borderColor} ${glowColor} shadow-xl`}>
          {team.logo ? (
            <img src={team.logo} alt={team.name} className="w-full h-full object-contain p-1.5 sm:p-3 md:p-4" />
          ) : (
            <span className={`text-lg sm:text-3xl md:text-5xl font-black italic text-${accentColor}`}>
              {team.name ? team.name.charAt(0) : (align === 'left' ? 'H' : 'V')}
            </span>
          )}
          <div className={`absolute top-0 ${align === 'left' ? 'left-0' : 'right-0'} w-1.5 h-1.5 bg-${accentColor} opacity-50`}></div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className={`text-3xl sm:text-6xl md:text-8xl font-black tabular-nums tracking-tighter leading-none transition-colors duration-500 text-${accentColor}`}>
            {team.score}
          </span>
        </div>
      </div>
    );
  };

  return (
    <header className="bg-black/95 border-b border-white/10 sticky top-0 z-[110] backdrop-blur-3xl px-0 py-0 pt-safe flex items-center shadow-[0_15px_50px_rgba(0,0,0,0.9)] w-full">
      <div className="w-full flex flex-col">
        <div className="flex flex-col bg-white/5 border-b border-white/10 shadow-inner w-full relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

          {/* Top Names Bar */}
          <div className="flex justify-between items-center px-4 sm:px-12 md:px-24 py-1.5 sm:py-3 md:py-4 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-2 sm:gap-4 flex-1">
              <span className="text-[9px] sm:text-xs md:text-xl font-black text-blue-400 uppercase tracking-widest sm:tracking-[0.3em] truncate max-w-[100px] sm:max-w-none">
                {leftTeam.name || 'HOME'}
              </span>
            </div>

            {/* ── MENU ── */}
            <div className="flex items-center gap-2 shrink-0 px-2 sm:px-4" ref={menuRef}>
              {/* Menu trigger */}
              <div className="relative">
                <button
                  ref={menuBtnRef}
                  onClick={openMenu}
                  className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border font-black text-[9px] sm:text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${menuOpen ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'}`}
                >
                  <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="hidden sm:inline">Menu</span>
                </button>

                {/* Dropdown via portal */}
                {menuOpen && createPortal(
                  <div
                    style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 99999 }}
                    className="w-52 bg-[#0f1620] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    ref={menuRef}
                  >
                    <div className="p-1.5 flex flex-col gap-0.5">
                      <button onClick={() => menuAction(onOpenSetup)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-white hover:bg-blue-600/20 transition-colors text-left w-full">
                        <span className="text-blue-400 text-lg">➕</span><span>Roster Setup</span>
                      </button>
                      <div className="h-px bg-white/5 mx-2" />
                      <button onClick={() => menuAction(onNewGame)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-white hover:bg-green-600/20 transition-colors text-left w-full">
                        <span className="text-green-400 text-lg">🔄</span><span>New Game</span>
                      </button>
                      <button onClick={() => menuAction(onEndGame)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-white hover:bg-red-600/20 transition-colors text-left w-full">
                        <span className="text-red-400 text-lg">🏆</span><span>End Game</span>
                      </button>
                      <div className="h-px bg-white/5 mx-2" />
                      <button onClick={() => menuAction(onOpenManual)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-white hover:bg-slate-600/20 transition-colors text-left w-full">
                        <span className="text-slate-400 text-lg">📋</span><span>User Manual</span>
                      </button>
                      <div className="h-px bg-white/5 mx-2" />
                      <button onClick={() => menuAction(onOpenAbout)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-white hover:bg-slate-600/20 transition-colors text-left w-full">
                        <span className="text-slate-400 text-lg">ℹ️</span><span>About Us</span>
                      </button>
                      <button onClick={() => { setMenuOpen(false); onBackToLanding(); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-white hover:bg-slate-600/20 transition-colors text-left w-full">
                        <span className="text-slate-400 text-lg">🏠</span><span>Back to Home</span>
                      </button>
                    </div>
                  </div>,
                  document.body
                )}
              </div>

              {/* User avatar */}
              <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-7 h-7 sm:w-8 sm:h-8' } }} />
            </div>

            <div className="flex items-center justify-end gap-2 sm:gap-4 flex-1">
              <span className="text-[9px] sm:text-xs md:text-xl font-black text-red-400 uppercase tracking-widest sm:tracking-[0.3em] truncate max-w-[100px] sm:max-w-none text-right">
                {rightTeam.name || 'VISITOR'}
              </span>
            </div>
          </div>

          {/* Main Scoreboard Row */}
          <div className="flex items-center px-2 sm:px-8 md:px-16 py-2 sm:py-4 md:py-8 w-full max-w-7xl mx-auto">
            <div className="flex-[2] flex justify-center min-w-0">
              <TeamScore team={leftTeam} align="left" />
            </div>

            <div className="flex flex-col items-center shrink-0 px-2 sm:px-8 md:px-12 border-l border-r border-white/10">
              <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6">
                <button onClick={() => onSetPeriod(Math.max(1, period - 1))} className="text-slate-700 hover:text-white transition-all active:scale-75 p-1.5 sm:p-2 bg-white/5 rounded-lg sm:rounded-xl border border-transparent hover:border-white/10" title="Previous Period">
                  <svg className="w-2.5 h-2.5 sm:w-4 sm:h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="text-center min-w-[30px] sm:min-w-[80px] md:min-w-[140px]">
                  <span className="text-base sm:text-4xl md:text-6xl font-black text-white italic block leading-none tracking-tighter uppercase">{periodLabel}</span>
                  <span className="block text-[7px] sm:text-[10px] md:text-sm font-black text-blue-500 uppercase tracking-widest sm:tracking-[0.5em] mt-0.5 sm:mt-2 md:mt-3">PER</span>
                </div>

                <button onClick={() => onSetPeriod(Math.min(8, period + 1))} className="text-slate-700 hover:text-white transition-all active:scale-75 p-1.5 sm:p-2 bg-white/5 rounded-lg sm:rounded-xl border border-transparent hover:border-white/10" title="Next Period">
                  <svg className="w-2.5 h-2.5 sm:w-4 sm:h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <button onClick={onSwapSides} className="mt-1 sm:mt-3 md:mt-4 flex items-center gap-1 sm:gap-2 px-2 py-0.5 sm:px-4 sm:py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95 group/swap" title="Switch Ends">
                <svg className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-slate-500 group-hover/swap:text-blue-500 group-hover/swap:rotate-180 transition-all duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span className="hidden sm:inline text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover/swap:text-blue-500 transition-colors">Swap</span>
              </button>
            </div>

            <div className="flex-[2] flex justify-center min-w-0">
              <TeamScore team={rightTeam} align="right" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
