import { UserButton } from '@clerk/clerk-react';
import React, { useState, useRef, useLayoutEffect } from 'react';
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
  onOpenGameHistory: () => void;
  onSetPeriod: (p: number) => void;
  onSwapSides: () => void;
  onNewGame: () => void;
  onEndGame: () => void;
  onOpenAbout: () => void;
  onBackToLanding: () => void;
  onOpenContact: () => void;
}

const Header: React.FC<HeaderProps> = ({
  leftTeam, rightTeam, period,
  onOpenSetup, onOpenManual, onOpenGameHistory, onSetPeriod, onSwapSides,
  onNewGame, onEndGame, onOpenAbout, onBackToLanding, onOpenContact
}) => {
  const periodLabel = getPeriodLabel(period);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const MENU_WIDTH = 240;
  const EDGE_MARGIN = 8;

  const updateMenuPos = () => {
    const el = menuBtnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let right = window.innerWidth - rect.right;
    // Clamp so the panel's left edge never goes past the screen edge
    const maxRight = window.innerWidth - MENU_WIDTH - EDGE_MARGIN;
    right = Math.min(Math.max(EDGE_MARGIN, right), Math.max(EDGE_MARGIN, maxRight));
    setMenuPos({
      top: rect.bottom + 8,
      right,
    });
  };

  const openMenu = () => {
    updateMenuPos();
    setMenuOpen(true);
  };

  useLayoutEffect(() => {
    if (!menuOpen) return;
    updateMenuPos();
    const handle = () => updateMenuPos();
    window.addEventListener('resize', handle);
    window.addEventListener('orientationchange', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('orientationchange', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [menuOpen]);

  const menuAction = (fn: () => void) => { setMenuOpen(false); fn(); };

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
    <>
      <header className="bg-black/95 border-b border-white/10 backdrop-blur-3xl px-0 py-0 pt-safe flex items-center shadow-[0_15px_50px_rgba(0,0,0,0.9)] w-full">
        <div className="w-full flex flex-col">
          <div className="flex flex-col bg-white/5 border-b border-white/10 shadow-inner w-full relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none"></div>

            {/* Top Names Bar */}
            <div className="flex justify-between items-center px-4 sm:px-12 md:px-24 py-1.5 sm:py-3 md:py-4 landscape:py-1 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2 sm:gap-4 flex-1">
                <span className="text-[9px] sm:text-xs md:text-xl font-black text-blue-400 uppercase tracking-widest sm:tracking-[0.3em] truncate max-w-[100px] sm:max-w-none">
                  {leftTeam.name || 'HOME'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 px-2 sm:px-4">
                <button
                  ref={menuBtnRef}
                  onClick={openMenu}
                  className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border font-black text-[9px] sm:text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="hidden sm:inline">Menu</span>
                </button>
                <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-7 h-7 sm:w-8 sm:h-8' } }} />
              </div>

              <div className="flex items-center justify-end gap-2 sm:gap-4 flex-1">
                <span className="text-[9px] sm:text-xs md:text-xl font-black text-red-400 uppercase tracking-widest sm:tracking-[0.3em] truncate max-w-[100px] sm:max-w-none text-right">
                  {rightTeam.name || 'VISITOR'}
                </span>
              </div>
            </div>

            {/* Main Scoreboard Row */}
            <div className="flex items-center px-2 sm:px-8 md:px-16 py-2 sm:py-4 md:py-8 landscape:py-1.5 w-full max-w-7xl mx-auto">
              <div className="flex-[2] flex justify-center min-w-0">
                <TeamScore team={leftTeam} align="left" />
              </div>

              <div className="flex flex-col items-center shrink-0 px-2 sm:px-8 md:px-12 border-l border-r border-white/10">
                <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6">
                  <button onClick={() => onSetPeriod(Math.max(1, period - 1))} className="text-slate-700 hover:text-white transition-all active:scale-75 p-1.5 sm:p-2 bg-white/5 rounded-lg sm:rounded-xl border border-transparent hover:border-white/10">
                    <svg className="w-2.5 h-2.5 sm:w-4 sm:h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="text-center min-w-[30px] sm:min-w-[80px] md:min-w-[140px]">
                    <span className="text-base sm:text-4xl md:text-6xl font-black text-white italic block leading-none tracking-tighter uppercase">{periodLabel}</span>
                    <span className="block text-[7px] sm:text-[10px] md:text-sm font-black text-blue-500 uppercase tracking-widest sm:tracking-[0.5em] mt-0.5 sm:mt-2 md:mt-3">PER</span>
                  </div>
                  <button onClick={() => onSetPeriod(Math.min(8, period + 1))} className="text-slate-700 hover:text-white transition-all active:scale-75 p-1.5 sm:p-2 bg-white/5 rounded-lg sm:rounded-xl border border-transparent hover:border-white/10">
                    <svg className="w-2.5 h-2.5 sm:w-4 sm:h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <button onClick={onSwapSides} className="mt-1 sm:mt-3 md:mt-4 flex items-center gap-1 sm:gap-2 px-2 py-0.5 sm:px-4 sm:py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95 group/swap">
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

            {/* Game Controls Bar — always-visible dedicated buttons */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 landscape:py-1 border-t border-white/5 bg-black/30">
              <button
                onClick={onOpenSetup}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border font-black text-[9px] sm:text-[11px] uppercase tracking-wide transition-all active:scale-95 shadow-md bg-blue-600/15 border-blue-500/30 text-blue-300 hover:bg-blue-600/25 hover:border-blue-400/40"
              >
                <span className="text-sm sm:text-base">➕</span>
                <span>Roster Setup</span>
              </button>
              <button
                onClick={onNewGame}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border font-black text-[9px] sm:text-[11px] uppercase tracking-wide transition-all active:scale-95 shadow-md bg-emerald-600/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/25 hover:border-emerald-400/40"
              >
                <span className="text-sm sm:text-base">🔄</span>
                <span>New Game</span>
              </button>
              <button
                onClick={onEndGame}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border font-black text-[9px] sm:text-[11px] uppercase tracking-wide transition-all active:scale-95 shadow-md bg-amber-600/15 border-amber-500/30 text-amber-300 hover:bg-amber-600/25 hover:border-amber-400/40"
              >
                <span className="text-sm sm:text-base">🏆</span>
                <span>End Game</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Anchored dropdown via portal - renders outside ALL parent elements */}
      {menuOpen && menuPos && createPortal(
        <>
          {/* Invisible click-catcher to close on outside tap */}
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 999998, background: 'transparent' }}
          />
          {/* Dropdown panel, anchored under the menu button */}
          <div style={{
            position: 'fixed', top: menuPos.top, right: menuPos.right, width: '240px',
            maxHeight: 'calc(100vh - ' + menuPos.top + 'px - 16px)',
            zIndex: 999999, background: '#0f1620',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
              {([
                { label: 'User Manual', icon: '📋', action: onOpenManual },
                { label: 'Game History', icon: '📁', action: onOpenGameHistory },
                { label: 'About Us', icon: 'ℹ️', action: onOpenAbout },
                { label: 'Contact Us', icon: '✉️', action: onOpenContact },
                null,
                { label: 'Home', icon: '🏠', action: onBackToLanding },
              ] as any[]).map((item: any, i: number) =>
                item === null ? (
                  <div key={i} style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
                ) : (
                  <button
                    key={item.label}
                    onClick={() => menuAction(item.action)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', borderRadius: '10px', background: 'transparent', border: 'none', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: '18px', width: '24px' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default Header;
