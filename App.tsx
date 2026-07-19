import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameEvent, EventType, Team, TeamStats, Zone, Player, PenaltyType, DumpInSubtype } from './types';
import Header from './components/Header'; // v2
import RinkChart from './components/RinkChart';
import PlayByPlay from './components/PlayByPlay';
import CenterAnalytics from './components/CenterAnalytics';
import UserManual from './components/UserManual';
import LandingPage from './components/LandingPage';
import AdBanner from './components/AdBanner';
import PlayerStats from './components/playerstats';
import AuthGate from './components/AuthGate';
import PricingGate from './components/PricingGate';
import LegalPages from './components/LegalPages';
import ContactPage from './components/ContactPage';
import AboutPage from './components/AboutPage';
import AdvertisePage from './components/AdvertisePage';
import ThemedBackground from './components/ThemedBackground';
import SessionSetup from './components/SessionSetup';
import SessionJoin from './components/SessionJoin';
import SessionBanner from './components/SessionBanner';
import SaveTeamPrompt from './components/SaveTeamPrompt';
import TeamLibrary from './components/TeamLibrary';
import EventAttachmentPanel from './components/EventAttachmentPanel';
import GameHistory from './components/GameHistory';
import { saveGameReport, SavedGameReport } from './services/gameReportService';
import { useAuth, UserButton, useClerk, useUser } from '@clerk/clerk-react';
import { generateNarrative, fetchRosterByAI } from './services/geminiService';
import { downloadPDFReport, downloadExcelReport, downloadHTMLExport } from './services/exportService';
import { GameSession, SessionRole, endSession as endSessionDB } from './services/sessionService';
import { broadcastEvent, deleteEvent, loadSessionEvents, subscribeToSession } from './services/syncService';
import { Toaster, toast } from 'sonner';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Ad banner (top/bottom) and the "Advertise With Us" page are switched off
// while building up the paid user base. Flip this back to `true` to bring
// both back — no other changes needed.
const ADS_ENABLED = false;

const getPeriodLabel = (p: number) => {
  if (p === 1) return '1st';
  if (p === 2) return '2nd';
  if (p === 3) return '3rd';
  if (p === 4) return 'OT';
  if (p >= 5) return `OT${p - 3}`;
  return `${p}`;
};

const DraggablePlayer: React.FC<{ p: Player, team: Team, isHome: boolean, isSelected: boolean, onSelect: (num: string, team: Team) => void }> = ({ p, team, isHome, isSelected, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `player-${team}-${p.number}`,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <button 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(p.number, team)}
      className={`relative h-10 rounded-xl font-black flex flex-col items-center justify-center transition-all border group active:scale-95 touch-none ${isSelected ? (isHome ? 'bg-blue-600 border-blue-400 shadow-blue-500/40 shadow-xl' : 'bg-red-600 border-red-400 shadow-red-500/40 shadow-xl') : 'bg-black/30 border-white/5 text-slate-400 hover:bg-white/10'}`}
    >
      <span className="text-[11px] font-black leading-none truncate w-full text-center px-1">
        #{p.number} {p.name.split(' ').pop()}
      </span>
      <div className={`absolute top-0.5 right-0.5 px-0.5 rounded text-[5px] font-black border ${p.position === 'C' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500' : 'bg-black/40 border-white/5 text-slate-600'}`}>
        {p.position}
      </div>
    </button>
  );
};

const DroppableSlot: React.FC<{ id: string, children: React.ReactNode, label: string, cols?: number, className?: string }> = ({ id, children, label, cols = 1, className = "" }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div 
      ref={setNodeRef}
      className={`relative min-h-10 rounded-xl transition-all border border-dashed ${isOver ? 'bg-white/10 border-white/30 ring-2 ring-white/10' : 'bg-black/20 border-white/5'} ${className}`}
    >
      <div className={`grid gap-0.5 p-0.5 h-full`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {children}
      </div>
      {!React.Children.count(children) && !isOver && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <span className="text-[6px] font-black uppercase tracking-widest text-slate-600">{label}</span>
        </div>
      )}
    </div>
  );
};

// ── GOAL LINE POPUP ──────────────────────────────────────────
type GoalStrength = 'ES' | 'PP' | 'SH' | 'EN' | 'PS';

interface GoalLinePopupProps {
  pendingGoal: { team: any; playerNumber: string; x: number; y: number };
  homeName: string;
  awayName: string;
  homeRoster: Player[];
  awayRoster: Player[];
  myTeam: Team | 'NEUTRAL';
  onConfirm: (line?: string, playersOnIce?: string[], againstPlayersOnIce?: string[], strength?: GoalStrength) => void;
  onCancel: () => void;
}

const GoalLinePopup: React.FC<GoalLinePopupProps> = ({ pendingGoal, homeName, awayName, homeRoster, awayRoster, myTeam, onConfirm, onCancel }) => {
  const scoringTeam = pendingGoal.team;
  const scoringTeamName = scoringTeam === Team.HOME ? homeName : awayName;
  const isHome = scoringTeam === Team.HOME;
  const isNeutral = myTeam === 'NEUTRAL';

  // In single team mode, we only ever show the user's own team
  // whether it's a goal for or against
  const trackingTeam = myTeam === 'NEUTRAL' ? null : myTeam;
  const trackingRoster = trackingTeam === Team.HOME ? homeRoster : trackingTeam === Team.AWAY ? awayRoster : null;
  const trackingTeamName = trackingTeam === Team.HOME ? homeName : trackingTeam === Team.AWAY ? awayName : null;

  // For the scoring team side
  const scoringRoster = isHome ? homeRoster : awayRoster;
  // For the defending team side (neutral mode only)
  const defendingTeam = isHome ? Team.AWAY : Team.HOME;
  const defendingRoster = isHome ? awayRoster : homeRoster;
  const defendingTeamName = isHome ? awayName : homeName;

  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [againstPlayers, setAgainstPlayers] = useState<string[]>([]);
  const [step, setStep] = useState<'line' | 'confirm' | 'override' | 'against'>('line');
  const [strength, setStrength] = useState<GoalStrength>('ES');

  // Forward line and defense pair are picked independently so a full 5-man
  // group (3 forwards + 2 D) can be built from one screen, instead of being
  // forced to choose only a line OR only a pair.
  const [selectedFwdKey, setSelectedFwdKey] = useState<string | null>(null);
  const [selectedDefKey, setSelectedDefKey] = useState<string | null>(null);
  const toggleFwdKey = (key: string) => setSelectedFwdKey(prev => prev === key ? null : key);
  const toggleDefKey = (key: string) => setSelectedDefKey(prev => prev === key ? null : key);

  const handleLineContinue = (teamNameForLabel: string, roster: Player[]) => {
    const fwdPlayers = selectedFwdKey ? roster.filter(p => p.line === selectedFwdKey).map(p => p.number) : [];
    const defPlayers = selectedDefKey ? roster.filter(p => p.line === selectedDefKey).map(p => p.number) : [];
    const combined = Array.from(new Set([...fwdPlayers, ...defPlayers]));
    const labelParts: string[] = [];
    if (selectedFwdKey) labelParts.push(`Line ${selectedFwdKey}`);
    if (selectedDefKey) labelParts.push(`Pair ${selectedDefKey.replace('P', '')}`);
    setSelectedLine(labelParts.length > 0 ? `${teamNameForLabel} ${labelParts.join(' + ')}` : teamNameForLabel);
    setSelectedPlayers(combined);
    setStep('confirm');
  };

  const togglePlayer = (number: string, side: 'scoring' | 'defending') => {
    if (side === 'scoring') {
      setSelectedPlayers(prev => prev.includes(number) ? prev.filter(n => n !== number) : [...prev, number]);
    } else {
      setAgainstPlayers(prev => prev.includes(number) ? prev.filter(n => n !== number) : [...prev, number]);
    }
  };

  // What happens after the scoring team's on-ice players are confirmed —
  // neutral mode still needs to pick the defending team, single-team mode
  // is done at this point.
  const proceedAfterScoringSelection = () => {
    if (isNeutral) setStep('against');
    else onConfirm(selectedLine || undefined, selectedPlayers, undefined, strength);
  };

  const lineGroups = [
    { label: 'Line 1', key: '1' }, { label: 'Line 2', key: '2' },
    { label: 'Line 3', key: '3' }, { label: 'Line 4', key: '4' },
  ];
  const pairGroups = [
    { label: 'Pair 1', key: 'P1' }, { label: 'Pair 2', key: 'P2' }, { label: 'Pair 3', key: 'P3' },
  ];

  // In single team mode — determine if this is a goal for or against
  const isGoalFor = trackingTeam === scoringTeam;
  const singleTeamRoster = trackingRoster || [];

  // Roster to show/toggle for the scoring side's confirm+override steps —
  // differs by mode since neutral mode tracks both full rosters, while
  // single-team mode only has the one roster being tracked.
  const scoringSideRoster = isNeutral ? scoringRoster : singleTeamRoster;

  const renderPlayerList = (roster: Player[], selected: string[], side: 'scoring' | 'defending') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '200px', overflowY: 'auto', marginBottom: '0.75rem' }}>
      {roster.filter(p => p.position !== 'G').map(p => {
        const on = selected.includes(p.number);
        return (
          <button key={p.number} onClick={() => togglePlayer(p.number, side)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: `1px solid ${on ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`, background: on ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: on ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: on ? '#22c55e' : '#64748b', flexShrink: 0 }}>
              #{p.number}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: on ? '#fff' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{p.position} · Line {p.line}</div>
            </div>
            {on && <span style={{ color: '#22c55e', fontSize: '0.9rem', flexShrink: 0 }}>✓</span>}
          </button>
        );
      })}
    </div>
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f1620', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '1.25rem', padding: '1.5rem', width: '100%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 30px 60px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto 0.75rem' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#dc2626', opacity: 0.35, animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }} />
            <div style={{ position: 'absolute', inset: '5px', borderRadius: '50%', background: '#ef4444', animation: 'spin 0.75s linear infinite' }} />
            <div style={{ position: 'absolute', inset: '14px', borderRadius: '50%', background: '#fca5a5' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'white' }} />
            </div>
          </div>
          <div style={{ color: 'white', fontWeight: 900, fontSize: '1.4rem', marginBottom: '0.25rem' }}>GOAL!</div>
          <div style={{ display: 'inline-block', padding: '0.2rem 0.875rem', borderRadius: '999px', background: isHome ? '#2563eb' : '#dc2626', color: 'white', fontSize: '0.75rem', fontWeight: 900 }}>
            {scoringTeamName}
          </div>
        </div>

        {step === 'line' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748b', textAlign: 'center', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Strength</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem' }}>
              {([
                { key: 'ES', label: 'ES' },
                { key: 'PP', label: 'PP' },
                { key: 'SH', label: 'SH' },
                { key: 'EN', label: 'EN' },
                { key: 'PS', label: 'PS' },
              ] as { key: GoalStrength; label: string }[]).map(({ key, label }) => {
                const on = strength === key;
                return (
                  <button key={key} onClick={() => setStrength(key)}
                    style={{ padding: '0.5rem 0.25rem', borderRadius: '0.625rem', fontSize: '0.7rem', fontWeight: 900, border: `1px solid ${on ? '#a855f7' : 'rgba(255,255,255,0.08)'}`, background: on ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.03)', color: on ? '#fff' : '#64748b', cursor: 'pointer' }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SINGLE TEAM MODE */}
        {!isNeutral && step === 'line' && (
          <>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', marginBottom: '0.875rem' }}>
              {isGoalFor ? `Which ${trackingTeamName} line scored?` : `Which ${trackingTeamName} line was on ice against?`}
            </div>

            <div style={{ fontSize: '0.68rem', color: '#64748b', textAlign: 'center', marginBottom: '0.4rem' }}>Pick a forward line and/or a defense pair — both combine into one group</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {lineGroups.map(({ label, key }) => {
                const on = selectedFwdKey === key;
                return (
                  <button key={key} onClick={() => toggleFwdKey(key)}
                    style={{ padding: '0.875rem 0.5rem', background: on ? 'rgba(34,197,94,0.4)' : 'rgba(21,128,61,0.25)', border: `1px solid ${on ? '#22c55e' : 'rgba(34,197,94,0.35)'}`, color: 'white', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    {on ? '✓ ' : ''}{label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {pairGroups.map(({ label, key }) => {
                const on = selectedDefKey === key;
                return (
                  <button key={key} onClick={() => toggleDefKey(key)}
                    style={{ padding: '0.75rem 0.25rem', background: on ? 'rgba(59,130,246,0.4)' : 'rgba(29,78,216,0.25)', border: `1px solid ${on ? '#3b82f6' : 'rgba(59,130,246,0.35)'}`, color: 'white', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                    {on ? '✓ ' : ''}{label}
                  </button>
                );
              })}
            </div>
            <button
              disabled={!selectedFwdKey && !selectedDefKey}
              onClick={() => handleLineContinue(trackingTeamName || '', singleTeamRoster)}
              style={{ width: '100%', padding: '0.875rem', background: (selectedFwdKey || selectedDefKey) ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${(selectedFwdKey || selectedDefKey) ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.06)'}`, color: (selectedFwdKey || selectedDefKey) ? '#22c55e' : '#475569', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.875rem', cursor: (selectedFwdKey || selectedDefKey) ? 'pointer' : 'not-allowed', marginBottom: '0.5rem' }}>
              Continue
            </button>
            <button onClick={() => onConfirm(undefined, undefined, undefined, strength)}
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontWeight: 700, borderRadius: '0.875rem', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}>
              Skip
            </button>
          </>
        )}

        {/* SCORING TEAM confirm/override — shared by both modes, so either
            can manually pick the exact 5 players instead of being locked
            to whatever the roster's line assignment says */}
        {step === 'confirm' && (
          <>
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '0.875rem', padding: '0.75rem', marginBottom: '0.75rem', textAlign: 'center' }}>
              <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.2rem' }}>{selectedLine}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                {selectedPlayers.length > 0
                  ? selectedPlayers.map(n => { const p = scoringSideRoster.find(r => r.number === n); return p ? `#${n} ${p.name.split(' ').pop()}` : `#${n}`; }).join(' · ')
                  : 'No players assigned to this line'}
              </div>
            </div>
            {isNeutral && (
              <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', marginBottom: '0.75rem' }}>
                Next: select {defendingTeamName} players on ice against
              </div>
            )}
            <button onClick={() => setStep('override')}
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontWeight: 700, borderRadius: '0.875rem', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
              Override players on ice
            </button>
            <button onClick={proceedAfterScoringSelection}
              style={{ width: '100%', padding: '0.875rem', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
              Confirm
            </button>
            <button onClick={() => setStep('line')}
              style={{ width: '100%', padding: '0.625rem', background: 'transparent', color: '#64748b', fontWeight: 600, borderRadius: '0.875rem', fontSize: '0.75rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)' }}>
              ← Back
            </button>
          </>
        )}

        {step === 'override' && (
          <>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.625rem', textAlign: 'center' }}>Tap to toggle players who were actually on ice</div>
            {renderPlayerList(scoringSideRoster, selectedPlayers, 'scoring')}
            <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', marginBottom: '0.625rem' }}>{selectedPlayers.length} player{selectedPlayers.length !== 1 ? 's' : ''} selected</div>
            <button onClick={proceedAfterScoringSelection}
              style={{ width: '100%', padding: '0.875rem', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
              Confirm {selectedPlayers.length} players
            </button>
            <button onClick={() => setStep('confirm')}
              style={{ width: '100%', padding: '0.625rem', background: 'transparent', color: '#64748b', fontWeight: 600, borderRadius: '0.875rem', fontSize: '0.75rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)' }}>
              ← Back
            </button>
          </>
        )}

        {/* NEUTRAL MODE — both teams */}
        {isNeutral && (
          <>
            {step === 'line' && (
              <>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                  Which {scoringTeamName} line scored?
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', textAlign: 'center', marginBottom: '0.4rem' }}>Pick a forward line and/or a defense pair — both combine into one group</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {lineGroups.map(({ label, key }) => {
                    const on = selectedFwdKey === key;
                    return (
                      <button key={key} onClick={() => toggleFwdKey(key)}
                        style={{ padding: '0.875rem 0.5rem', background: on ? 'rgba(34,197,94,0.4)' : 'rgba(21,128,61,0.25)', border: `1px solid ${on ? '#22c55e' : 'rgba(34,197,94,0.35)'}`, color: 'white', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                        {on ? '✓ ' : ''}{label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {pairGroups.map(({ label, key }) => {
                    const on = selectedDefKey === key;
                    return (
                      <button key={key} onClick={() => toggleDefKey(key)}
                        style={{ padding: '0.75rem 0.25rem', background: on ? 'rgba(59,130,246,0.4)' : 'rgba(29,78,216,0.25)', border: `1px solid ${on ? '#3b82f6' : 'rgba(59,130,246,0.35)'}`, color: 'white', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                        {on ? '✓ ' : ''}{label}
                      </button>
                    );
                  })}
                </div>
                <button
                  disabled={!selectedFwdKey && !selectedDefKey}
                  onClick={() => handleLineContinue(scoringTeamName, scoringRoster)}
                  style={{ width: '100%', padding: '0.875rem', background: (selectedFwdKey || selectedDefKey) ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${(selectedFwdKey || selectedDefKey) ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.06)'}`, color: (selectedFwdKey || selectedDefKey) ? '#22c55e' : '#475569', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.875rem', cursor: (selectedFwdKey || selectedDefKey) ? 'pointer' : 'not-allowed', marginBottom: '0.5rem' }}>
                  Continue
                </button>
                <button onClick={() => onConfirm(undefined, undefined, undefined, strength)}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontWeight: 700, borderRadius: '0.875rem', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Skip
                </button>
              </>
            )}

            {step === 'against' && (
              <>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', marginBottom: '0.625rem' }}>
                  <span style={{ color: '#22c55e' }}>{selectedLine}</span> scored<br />
                  Now select {defendingTeamName} players on ice against:
                </div>
                {renderPlayerList(defendingRoster, againstPlayers, 'defending')}
                <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', marginBottom: '0.625rem' }}>{againstPlayers.length} defender{againstPlayers.length !== 1 ? 's' : ''} selected</div>
                <button onClick={() => onConfirm(selectedLine, selectedPlayers, againstPlayers, strength)}
                  style={{ width: '100%', padding: '0.875rem', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                  Confirm
                </button>
                <button onClick={() => setStep('confirm')}
                  style={{ width: '100%', padding: '0.625rem', background: 'transparent', color: '#64748b', fontWeight: 600, borderRadius: '0.875rem', fontSize: '0.75rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)' }}>
                  ← Back
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── FACEOFF POPUP ────────────────────────────────────────────
interface FaceoffPopupProps {
  pendingFaceoff: { x: number; y: number };
  homeName: string;
  awayName: string;
  homeRoster: Player[];
  awayRoster: Player[];
  myTeam: Team | 'NEUTRAL';
  onConfirm: (homeCenter: string, awayCenter: string, winner: Team) => void;
  onCancel: () => void;
}

const FaceoffPopup: React.FC<FaceoffPopupProps> = ({ homeName, awayName, homeRoster, awayRoster, myTeam, onConfirm, onCancel }) => {
  const [homeCenter, setHomeCenter] = useState('');
  const [awayCenter, setAwayCenter] = useState('');
  const [winner, setWinner] = useState<Team | null>(null);

  const homeCentres = homeRoster.filter(p => p.position?.toUpperCase() === 'C');
  const awayCentres = awayRoster.filter(p => p.position?.toUpperCase() === 'C');
  const homeOthers = homeRoster.filter(p => p.position?.toUpperCase() !== 'C' && p.position?.toUpperCase() !== 'G');
  const awayOthers = awayRoster.filter(p => p.position?.toUpperCase() !== 'C' && p.position?.toUpperCase() !== 'G');

  // In single-team mode, only the tracked team's centre is required — the
  // opposing centre is optional (you often don't have their roster loaded,
  // or just don't care to track it), so it can't block logging the draw.
  const isSingleTeam = myTeam !== 'NEUTRAL';
  const canConfirm = isSingleTeam
    ? (myTeam === Team.HOME ? !!homeCenter : !!awayCenter) && winner !== null
    : !!homeCenter && !!awayCenter && winner !== null;

  const renderCentreGroup = (
    label: string, accent: string, accentBg: string,
    centres: Player[], others: Player[], selected: string, onSelect: (num: string) => void,
    optional?: boolean
  ) => (
    <div style={{ marginBottom: '1rem' }}>
      <p style={{ fontSize: '0.7rem', fontWeight: 900, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
        {label} Centre{optional && <span style={{ color: '#64748b', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}> (optional)</span>}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {centres.map(p => (
          <button key={p.number} onClick={() => onSelect(p.number)}
            style={{ padding: '0.4rem 0.7rem', borderRadius: '0.6rem', fontSize: '0.75rem', fontWeight: 900, border: `1px solid ${selected === p.number ? accent : 'rgba(255,255,255,0.08)'}`, background: selected === p.number ? accentBg : 'rgba(255,255,255,0.03)', color: selected === p.number ? '#fff' : '#94a3b8', cursor: 'pointer' }}>
            #{p.number} {p.name.split(' ').pop()}
          </button>
        ))}
        {centres.length === 0 && <span style={{ fontSize: '0.7rem', color: '#475569' }}>No centres found</span>}
      </div>
      {others.length > 0 && (
        <select value="" onChange={e => e.target.value && onSelect(e.target.value)}
          style={{ marginTop: '0.4rem', width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: '#94a3b8' }}>
          <option value="">Other player...</option>
          {others.map(p => <option key={p.number} value={p.number}>#{p.number} {p.name} ({p.position})</option>)}
        </select>
      )}
    </div>
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f1620', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '1.25rem', padding: '1.5rem', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 30px 60px rgba(0,0,0,0.9)' }}>

        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eab308', margin: '0 auto 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🏒</div>
          <div style={{ color: 'white', fontWeight: 900, fontSize: '1.25rem' }}>Faceoff</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>Who's taking this draw?</div>
        </div>

        {renderCentreGroup(homeName, '#60a5fa', '#2563eb', homeCentres, homeOthers, homeCenter, setHomeCenter, isSingleTeam && myTeam !== Team.HOME)}
        {renderCentreGroup(awayName, '#f87171', '#dc2626', awayCentres, awayOthers, awayCenter, setAwayCenter, isSingleTeam && myTeam !== Team.AWAY)}

        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', textAlign: 'center' }}>Who won the draw?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <button onClick={() => setWinner(Team.HOME)}
              style={{ padding: '0.9rem', borderRadius: '0.75rem', fontWeight: 900, fontSize: '0.85rem', border: `2px solid ${winner === Team.HOME ? '#60a5fa' : 'rgba(255,255,255,0.08)'}`, background: winner === Team.HOME ? 'rgba(37,99,235,0.35)' : 'rgba(255,255,255,0.03)', color: winner === Team.HOME ? '#fff' : '#94a3b8', cursor: 'pointer' }}>
              ✓ {homeName}
            </button>
            <button onClick={() => setWinner(Team.AWAY)}
              style={{ padding: '0.9rem', borderRadius: '0.75rem', fontWeight: 900, fontSize: '0.85rem', border: `2px solid ${winner === Team.AWAY ? '#f87171' : 'rgba(255,255,255,0.08)'}`, background: winner === Team.AWAY ? 'rgba(220,38,38,0.35)' : 'rgba(255,255,255,0.03)', color: winner === Team.AWAY ? '#fff' : '#94a3b8', cursor: 'pointer' }}>
              ✓ {awayName}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontWeight: 800, fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button disabled={!canConfirm} onClick={() => canConfirm && onConfirm(homeCenter, awayCenter, winner!)}
            style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', background: canConfirm ? '#eab308' : 'rgba(234,179,8,0.2)', color: canConfirm ? '#000' : '#78716c', fontWeight: 900, fontSize: '0.85rem', border: 'none', cursor: canConfirm ? 'pointer' : 'not-allowed' }}>
            Log Faceoff
          </button>
        </div>
      </div>
    </div>
  );
};

// ── ZONE ENTRY POPUP ─────────────────────────────────────────
interface EntryPopupProps {
  pendingEntry: { x: number; y: number };
  onConfirm: (entryType: EventType, dumpSubtype?: DumpInSubtype) => void;
  onCancel: () => void;
}

const EntryPopup: React.FC<EntryPopupProps> = ({ onConfirm, onCancel }) => {
  const [entryType, setEntryType] = useState<EventType | null>(null);
  const [dumpSubtype, setDumpSubtype] = useState<DumpInSubtype | ''>('');

  const typeOptions: { type: EventType; label: string; icon: string; color: string; bg: string }[] = [
    { type: EventType.ZONE_ENTRY_CARRY, label: 'Carry-in', icon: '▲', color: '#818cf8', bg: 'rgba(79,70,229,0.35)' },
    { type: EventType.ZONE_ENTRY_DUMP, label: 'Dump-in', icon: '■', color: '#fbbf24', bg: 'rgba(217,119,6,0.35)' },
    { type: EventType.ZONE_ENTRY_PASS, label: 'Pass', icon: '◆', color: '#38bdf8', bg: 'rgba(14,165,233,0.35)' },
    { type: EventType.ZONE_ENTRY_DENIED, label: 'Denied', icon: '✕', color: '#fb7185', bg: 'rgba(225,29,72,0.35)' },
  ];

  const canConfirm = entryType !== null;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f1620', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '1.25rem', padding: '1.5rem', width: '100%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 30px 60px rgba(0,0,0,0.9)' }}>

        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#4f46e5', margin: '0 auto 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>⛸</div>
          <div style={{ color: 'white', fontWeight: 900, fontSize: '1.25rem' }}>Zone Entry</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>How did they enter the zone?</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: entryType === EventType.ZONE_ENTRY_DUMP ? '1rem' : '1.25rem' }}>
          {typeOptions.map(opt => (
            <button key={opt.type} onClick={() => setEntryType(opt.type)}
              style={{ padding: '0.9rem 0.5rem', borderRadius: '0.75rem', fontWeight: 900, fontSize: '0.8rem', border: `2px solid ${entryType === opt.type ? opt.color : 'rgba(255,255,255,0.08)'}`, background: entryType === opt.type ? opt.bg : 'rgba(255,255,255,0.03)', color: entryType === opt.type ? '#fff' : '#94a3b8', cursor: 'pointer' }}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>

        {entryType === EventType.ZONE_ENTRY_DUMP && (
          <div style={{ marginBottom: '1.25rem', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: '0.75rem', padding: '0.75rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Dump-in type</span><span style={{ color: '#64748b', fontWeight: 600, textTransform: 'none' }}>optional</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              {Object.values(DumpInSubtype).map(subtype => (
                <button key={subtype} onClick={() => setDumpSubtype(prev => prev === subtype ? '' : subtype)}
                  style={{ padding: '0.4rem 0.4rem', borderRadius: '0.5rem', fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${dumpSubtype === subtype ? 'rgba(217,119,6,0.6)' : 'rgba(255,255,255,0.06)'}`, background: dumpSubtype === subtype ? 'rgba(217,119,6,0.3)' : 'rgba(255,255,255,0.03)', color: dumpSubtype === subtype ? '#fed7aa' : '#94a3b8', cursor: 'pointer' }}>
                  {subtype}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontWeight: 800, fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button disabled={!canConfirm} onClick={() => canConfirm && onConfirm(entryType!, dumpSubtype || undefined)}
            style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', background: canConfirm ? '#4f46e5' : 'rgba(79,70,229,0.2)', color: canConfirm ? '#fff' : '#78716c', fontWeight: 900, fontSize: '0.85rem', border: 'none', cursor: canConfirm ? 'pointer' : 'not-allowed' }}>
            Log Entry
          </button>
        </div>
      </div>
    </div>
  );
};

// ── PENALTY POPUP ────────────────────────────────────────────
interface PenaltyPopupProps {
  pendingPenalty: { x: number; y: number; team: Team; playerNumber?: string };
  homeName: string;
  awayName: string;
  homeRoster: Player[];
  awayRoster: Player[];
  onConfirm: (playerNumber: string, penaltyType: string, minutes: number) => void;
  onCancel: () => void;
}

const PENALTY_DURATIONS: { label: string; minutes: number }[] = [
  { label: '2 MIN', minutes: 2 },
  { label: '4 MIN', minutes: 4 },
  { label: '5 MIN', minutes: 5 },
  { label: '10 MIN', minutes: 10 },
  { label: 'GM', minutes: 0 },
];

const PenaltyPopup: React.FC<PenaltyPopupProps> = ({ pendingPenalty, homeName, awayName, homeRoster, awayRoster, onConfirm, onCancel }) => {
  const isHome = pendingPenalty.team === Team.HOME;
  const teamName = isHome ? homeName : awayName;
  const roster = isHome ? homeRoster : awayRoster;
  const accent = isHome ? '#60a5fa' : '#f87171';
  const accentBg = isHome ? '#2563eb' : '#dc2626';

  const [playerNumber, setPlayerNumber] = useState(pendingPenalty.playerNumber || '');
  const [penaltyType, setPenaltyType] = useState<PenaltyType | 'OTHER' | null>(null);
  const [customInfraction, setCustomInfraction] = useState('');
  const [minutes, setMinutes] = useState<number>(2);

  const canConfirm = !!playerNumber && (
    (penaltyType !== null && penaltyType !== 'OTHER') ||
    (penaltyType === 'OTHER' && customInfraction.trim() !== '')
  );
  const finalInfraction = penaltyType === 'OTHER' ? customInfraction.trim() : (penaltyType || '');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f1620', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '1.25rem', padding: '1.25rem', width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 30px 60px rgba(0,0,0,0.9)' }}>

        <div style={{ textAlign: 'center', marginBottom: '0.85rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#ef4444', margin: '0 auto 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🚨</div>
          <div style={{ color: 'white', fontWeight: 900, fontSize: '1.1rem' }}>Penalty</div>
          <div style={{ display: 'inline-block', marginTop: '0.3rem', padding: '0.15rem 0.75rem', borderRadius: '999px', background: accentBg, color: 'white', fontSize: '0.7rem', fontWeight: 900 }}>
            {teamName}
          </div>
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 900, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Who took the penalty?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {roster.map(p => (
              <button key={p.number} onClick={() => setPlayerNumber(p.number)}
                style={{ width: '2.1rem', height: '2.1rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 900, border: `1px solid ${playerNumber === p.number ? accent : 'rgba(255,255,255,0.08)'}`, background: playerNumber === p.number ? accentBg : 'rgba(255,255,255,0.03)', color: playerNumber === p.number ? '#fff' : '#94a3b8', cursor: 'pointer' }}>
                {p.number}
              </button>
            ))}
            {roster.length === 0 && <span style={{ fontSize: '0.7rem', color: '#475569' }}>No roster loaded</span>}
          </div>
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Infraction</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.3rem' }}>
            {Object.values(PenaltyType).map(pt => {
              const on = penaltyType === pt;
              return (
                <button key={pt} onClick={() => setPenaltyType(pt)}
                  style={{ padding: '0.4rem 0.35rem', borderRadius: '0.5rem', fontSize: '0.66rem', fontWeight: 800, border: `1px solid ${on ? '#fbbf24' : 'rgba(255,255,255,0.08)'}`, background: on ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.03)', color: on ? '#fde68a' : '#94a3b8', cursor: 'pointer', textAlign: 'center', lineHeight: 1.15 }}>
                  {pt}
                </button>
              );
            })}
            <button onClick={() => setPenaltyType('OTHER')}
              style={{ padding: '0.4rem 0.35rem', borderRadius: '0.5rem', fontSize: '0.66rem', fontWeight: 800, border: `1px solid ${penaltyType === 'OTHER' ? '#fbbf24' : 'rgba(255,255,255,0.08)'}`, background: penaltyType === 'OTHER' ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.03)', color: penaltyType === 'OTHER' ? '#fde68a' : '#94a3b8', cursor: 'pointer', textAlign: 'center' }}>
              Other…
            </button>
          </div>
          {penaltyType === 'OTHER' && (
            <input
              type="text"
              value={customInfraction}
              onChange={e => setCustomInfraction(e.target.value)}
              placeholder="Type the infraction..."
              autoFocus
              style={{ marginTop: '0.4rem', width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '0.5rem', padding: '0.5rem 0.65rem', fontSize: '0.78rem', color: '#fde68a', outline: 'none', boxSizing: 'border-box' }}
            />
          )}
        </div>

        <div style={{ marginBottom: '0.9rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 900, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Duration</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.3rem' }}>
            {PENALTY_DURATIONS.map(({ label, minutes: m }) => {
              const on = minutes === m;
              return (
                <button key={label} onClick={() => setMinutes(m)}
                  style={{ padding: '0.4rem 0.2rem', borderRadius: '0.5rem', fontSize: '0.66rem', fontWeight: 900, border: `1px solid ${on ? '#a855f7' : 'rgba(255,255,255,0.08)'}`, background: on ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.03)', color: on ? '#fff' : '#64748b', cursor: 'pointer' }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontWeight: 800, fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button disabled={!canConfirm} onClick={() => canConfirm && onConfirm(playerNumber, finalInfraction, minutes)}
            style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', background: canConfirm ? '#ef4444' : 'rgba(239,68,68,0.2)', color: canConfirm ? '#fff' : '#78716c', fontWeight: 900, fontSize: '0.85rem', border: 'none', cursor: canConfirm ? 'pointer' : 'not-allowed' }}>
            Log Penalty
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showLanding, setShowLanding] = useState(() => {
    return sessionStorage.getItem('tch_launched') !== 'true';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | null>(null);
  const [showPlayerStats, setShowPlayerStats] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { isSignedIn, userId, isLoaded: authLoaded } = useAuth();
  const { user } = useClerk();
  const { user: currentUser } = useUser();

  React.useEffect(() => {
    if (!isSignedIn || !user?.primaryEmailAddress?.emailAddress) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscribed') === 'true') {
      setIsSubscribed(true);
      setShowLanding(false);
      window.history.replaceState({}, '', '/');
      return;
    }
    const checkSub = async () => {
      setCheckingSubscription(true);
      try {
        const response = await fetch('/api/check-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, email: user.primaryEmailAddress.emailAddress }),
        });
        const data = await response.json();
        if (data.isSubscribed) setIsSubscribed(true);
      } catch (err) {
        console.error('Subscription check failed:', err);
      } finally {
        setCheckingSubscription(false);
      }
    };
    checkSub();
  }, [isSignedIn, user]);

  const [events, setEvents] = useState<GameEvent[]>([]);

  // ── Game history state ─────────────────────────────────────
  const [showGameHistory, setShowGameHistory] = useState(false);
  const [savingReport, setSavingReport] = useState(false);

  const handleSaveReport = async (isShared = false) => {
    if (!user) return;
    setSavingReport(true);
    try {
      await saveGameReport(user.id, {
        homeName, awayName, homeScore, awayScore,
        homeLogo, awayLogo,
        periods: currentPeriod,
        events, homeRoster, awayRoster, isShared,
      });
      toast.success('Game saved to history!');
    } catch (e) {
      toast.error('Failed to save game');
    } finally {
      setSavingReport(false);
    }
  };

  const handleDownloadFromHistory = (report: SavedGameReport, format: 'pdf' | 'excel' | 'html') => {
    // Restore report data temporarily and trigger download
    if (format === 'pdf') downloadPDFReport(report.events, report.homeRoster, report.awayRoster, report.homeName, report.awayName, report.homeScore, report.awayScore, null);
    else if (format === 'excel') downloadExcelReport(report.events, report.homeRoster, report.awayRoster, report.homeName, report.awayName);
    else if (format === 'html') downloadHTMLExport(report.events, report.homeRoster, report.awayRoster, report.homeName, report.awayName, report.homeScore, report.awayScore);
  };
  const [attachmentEvent, setAttachmentEvent] = useState<GameEvent | null>(null);
  const [showTeamLibrary, setShowTeamLibrary] = useState(false);
  const [teamLibrarySide, setTeamLibrarySide] = useState<'home' | 'away'>('home');
  const [savePrompt, setSavePrompt] = useState<{ teamName: string; roster: Player[]; logo: string; side: 'home' | 'away' } | null>(null);

  const handleLoadFromLibrary = (side: 'home' | 'away') => {
    setTeamLibrarySide(side);
    setShowTeamLibrary(true);
  };

  const handleLibraryTeamLoaded = (name: string, roster: Player[], logo: string) => {
    if (teamLibrarySide === 'home') { setHomeName(name); setHomeRoster(roster); setHomeLogo(logo); }
    else { setAwayName(name); setAwayRoster(roster); setAwayLogo(logo); }
    setShowTeamLibrary(false);
  };
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [mySessionRole, setMySessionRole] = useState<SessionRole | null>(null);
  const [showSessionSetup, setShowSessionSetup] = useState(false);
  const [showSessionJoin, setShowSessionJoin] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const isSessionActive = !!activeSession;
  const canLogEvents = !isSessionActive || mySessionRole === 'admin' || mySessionRole === 'logger';

  // Subscribe to real-time updates when session is active
  useEffect(() => {
    if (!activeSession) return;

    // Load existing events first
    loadSessionEvents(activeSession.id).then(loaded => {
      setEvents(loaded);
    });

    // Subscribe to live updates
    const unsub = subscribeToSession(activeSession.id, {
      onEventAdded: (event) => {
        setEvents(prev => {
          // Avoid duplicates (our own broadcast comes back too)
          if (prev.find(e => e.id === event.id)) return prev;
          return [...prev, event];
        });
      },
      onEventDeleted: (eventId) => {
        setEvents(prev => prev.filter(e => e.id !== eventId));
      },
      onSessionUpdated: (updates) => {
        if (updates.status === 'ended' && mySessionRole !== 'admin') {
          toast.info('The admin has ended this session.');
          handleLeaveSession();
          return;
        }
        setActiveSession(prev => prev ? { ...prev, ...updates } : null);
        if (updates.period !== undefined) setCurrentPeriod(updates.period);
        if (updates.homeName) setHomeName(updates.homeName);
        if (updates.awayName) setAwayName(updates.awayName);
        if (updates.homeRoster) setHomeRoster(updates.homeRoster);
        if (updates.awayRoster) setAwayRoster(updates.awayRoster);
      },
    });

    unsubscribeRef.current = unsub;
    return () => unsub();
  }, [activeSession?.id]);

  const handleSessionCreated = (session: GameSession) => {
    setActiveSession(session);
    setMySessionRole('admin');
    setShowSessionSetup(false);
    toast.success(`Session ${session.code} created! Share the code with your team.`);
  };

  const handleSessionJoined = (session: GameSession, role: SessionRole) => {
    setActiveSession(session);
    setMySessionRole(role);
    setShowSessionJoin(false);
    // Load session's rosters and state
    setHomeName(session.homeName);
    setAwayName(session.awayName);
    setHomeRoster(session.homeRoster);
    setAwayRoster(session.awayRoster);
    setCurrentPeriod(session.period);
    toast.success(`Joined session ${session.code} as ${role}`);
  };

  const handleLeaveSession = () => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    setActiveSession(null);
    setMySessionRole(null);
    setEvents([]);
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      await endSessionDB(activeSession.id);
      toast.success('Session ended.');
    } catch (e) {
      console.error(e);
    }
    handleLeaveSession();
  };
  const [activeTeam, setActiveTeam] = useState<Team>(Team.HOME);
  const [playerNumber, setPlayerNumber] = useState('');
  const [currentPeriod, setCurrentPeriod] = useState(1);
  const [breakdownFilter, setBreakdownFilter] = useState<number | 'total'>(1);
  const [summaries, setSummaries] = useState<Record<string, string>>({ 'total': "Game tracking active. Generate coaching analysis after logging more events." });
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isSyncingHome, setIsSyncingHome] = useState(false);
  const [isSyncingAway, setIsSyncingAway] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [pasteRosterHome, setPasteRosterHome] = useState('');
  const [pasteRosterAway, setPasteRosterAway] = useState('');
  const [isPasteSyncing, setIsPasteSyncing] = useState(false);
  const [rosterTab, setRosterTab] = useState<'url' | 'paste'>('url');
  const [activeDragPlayer, setActiveDragPlayer] = useState<{player: Player, team: Team} | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragStart = (event: any) => {
    const { active } = event;
    const [type, team, number] = active.id.split('-');
    const roster = team === Team.HOME ? homeRoster : awayRoster;
    const player = roster.find(p => p.number === number);
    if (player) setActiveDragPlayer({ player, team: team as Team });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragPlayer(null);
    const { active, over } = event;
    if (!over) return;
    const [activeType, activeTeam, activeNumber] = (active.id as string).split('-');
    const [overType, overTeam, overLine, overPos] = (over.id as string).split('-');
    if (activeTeam !== overTeam) return;
    const roster = activeTeam === Team.HOME ? homeRoster : awayRoster;
    const setRoster = activeTeam === Team.HOME ? setHomeRoster : setAwayRoster;
    const updatedRoster = roster.map(p => {
      if (p.number === activeNumber) {
        const updates: Partial<Player> = { line: overLine };
        if (overPos) updates.position = overPos;
        return { ...p, ...updates };
      }
      return p;
    });
    setRoster(updatedRoster);
    toast.success(`Moved #${activeNumber} to ${overLine}${overPos ? ` (${overPos})` : ''}`);
  };

  const [showSetup, setShowSetup] = useState(() => sessionStorage.getItem('tch_showSetup') === 'true');
  useEffect(() => {
    try { sessionStorage.setItem('tch_showSetup', String(showSetup)); } catch {}
  }, [showSetup]);

  // Don't persist legalPage - reset on reload is fine

  const [showFeed, setShowFeed] = useState(true);
  const [showLineups, setShowLineups] = useState(true);
  const [visibleTypes, setVisibleTypes] = useState<EventType[]>([]);
  const [shotResultFilter, setShotResultFilter] = useState<'ALL' | 'onNet' | 'attempt'>('ALL');
  const [shotStrengthFilter, setShotStrengthFilter] = useState<'ALL' | 'pp' | 'pk'>('ALL');
  const [shotFilterExpanded, setShotFilterExpanded] = useState(false);
  const [homeName, setHomeName] = useState(() => {
    try { return sessionStorage.getItem('tch_homeName') || 'HOME'; } catch { return 'HOME'; }
  });
  const [awayName, setAwayName] = useState(() => {
    try { return sessionStorage.getItem('tch_awayName') || 'AWAY'; } catch { return 'AWAY'; }
  });
  // Which side the coach using this app is actually with — tailors AI tactical
  // intel to give advice from this team's perspective rather than a neutral summary.
  // 'NEUTRAL' covers broadcasters, scouts, or fans tracking without taking a side —
  // the AI then gives a balanced two-team breakdown instead of one-sided advice.
  const [myTeam, setMyTeam] = useState<Team | 'NEUTRAL'>(() => {
    try {
      const stored = sessionStorage.getItem('tch_myTeam');
      if (stored === Team.HOME || stored === Team.AWAY || stored === 'NEUTRAL') return stored as Team | 'NEUTRAL';
      return 'NEUTRAL';
    } catch { return 'NEUTRAL'; }
  });
  const [homeLogo, setHomeLogo] = useState(() => {
    try { return sessionStorage.getItem('tch_homeLogo') || ''; } catch { return ''; }
  });
  const [awayLogo, setAwayLogo] = useState(() => {
    try { return sessionStorage.getItem('tch_awayLogo') || ''; } catch { return ''; }
  });
  const [homeRosterUrl, setHomeRosterUrl] = useState("");
  const [awayRosterUrl, setAwayRosterUrl] = useState("");
  const [homeRoster, setHomeRoster] = useState<Player[]>(() => {
    try { const s = sessionStorage.getItem('tch_homeRoster'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [awayRoster, setAwayRoster] = useState<Player[]>(() => {
    try { const s = sessionStorage.getItem('tch_awayRoster'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [homeSources, setHomeSources] = useState<{ uri: string; title: string }[]>([]);
  const [awaySources, setAwaySources] = useState<{ uri: string; title: string }[]>([]);
  const [manualHome, setManualHome] = useState({ number: '', name: '', pos: 'F', line: '1' });
  const [manualAway, setManualAway] = useState({ number: '', name: '', pos: 'F', line: '1' });
  const [mapPlotType, setMapPlotType] = useState<EventType>(EventType.SHOT);
  const [lastEvent, setLastEvent] = useState<{type: EventType; playerNumber: string; team: Team} | null>(null);
  const [plotFlash, setPlotFlash] = useState(false);
  const [showEndGame, setShowEndGame] = useState(false);
  const [pendingGoal, setPendingGoal] = useState<{x: number; y: number; team: Team; playerNumber: string} | null>(null);
  const [pendingFaceoff, setPendingFaceoff] = useState<{x: number; y: number} | null>(null);
  const [pendingEntry, setPendingEntry] = useState<{x: number; y: number} | null>(null);
  const [pendingPenalty, setPendingPenalty] = useState<{x: number; y: number; team: Team; playerNumber?: string} | null>(null);
  const [taggingEvent, setTaggingEvent] = useState<string | null>(null);
  const [playerTagDismissed, setPlayerTagDismissed] = useState(false);
  const [isRosterSwapped, setIsRosterSwapped] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);

  const toolbarButtons = useMemo(() => [
    { type: EventType.SHOT, label: 'SHOT', color: 'bg-cyan-600', dotColor: '#06b6d4' },
    { type: EventType.GOAL, label: 'GOAL', color: 'bg-green-600', dotColor: '#22c55e' },
    { type: EventType.BLOCK, label: 'BLOCK', color: 'bg-slate-600', dotColor: '#94a3b8' },
    { type: EventType.GIVEAWAY, label: 'GIVE', color: 'bg-orange-600', dotColor: '#f97316' },
    { type: EventType.TAKEAWAY, label: 'TAKE', color: 'bg-teal-600', dotColor: '#14b8a6' },
    { type: EventType.PENALTY, label: 'PIM', color: 'bg-red-600', dotColor: '#ef4444' },
    { type: EventType.HIT, label: 'HIT', color: 'bg-purple-600', dotColor: '#a855f7' },
  ], []);

  useEffect(() => {
    if (!visibleTypes.includes(mapPlotType)) setVisibleTypes(prev => [...prev, mapPlotType]);
  }, [mapPlotType]);

  useEffect(() => {
    setTaggingEvent(null);
    setPlayerTagDismissed(false);
  }, [mapPlotType]);

  // Keep breakdown filter in sync with current period
  useEffect(() => {
    setBreakdownFilter(currentPeriod);
  }, [currentPeriod]);

  useEffect(() => {
    try { sessionStorage.setItem('tch_homeRoster', JSON.stringify(homeRoster)); } catch {}
  }, [homeRoster]);

  useEffect(() => {
    try { sessionStorage.setItem('tch_awayRoster', JSON.stringify(awayRoster)); } catch {}
  }, [awayRoster]);

  useEffect(() => {
    try { sessionStorage.setItem('tch_homeLogo', homeLogo); } catch {}
  }, [homeLogo]);

  useEffect(() => {
    try { sessionStorage.setItem('tch_awayLogo', awayLogo); } catch {}
  }, [awayLogo]);

  useEffect(() => {
    try {
      sessionStorage.setItem('tch_homeName', homeName);
      sessionStorage.setItem('tch_awayName', awayName);
    } catch {}
  }, [homeName, awayName]);

  useEffect(() => {
    try { sessionStorage.setItem('tch_myTeam', myTeam); } catch {}
  }, [myTeam]);

  const sortByNumber = (roster: Player[]) => [...roster].sort((a, b) => {
    const aIsG = a.position?.toUpperCase() === 'G' ? 0 : 1;
    const bIsG = b.position?.toUpperCase() === 'G' ? 0 : 1;
    if (aIsG !== bIsG) return aIsG - bIsG;
    return (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0);
  });

  // Converts "Last, First" (and "Last, First Middle") into "First Last" order.
  // Backstops the AI prompt for roster imports, and also cleans up names
  // typed directly in "Last, First" form via the quick-add field.
  const normalizeName = (raw: string): string => {
    const name = (raw || '').trim();
    if (!name.includes(',')) return name;
    const [last, rest] = name.split(',', 2).map(s => s.trim());
    if (!last || !rest) return name;
    return `${rest} ${last}`.replace(/\s+/g, ' ').trim();
  };

  const centers = useMemo(() => ({
    home: homeRoster.filter(p => p.position?.toUpperCase().includes('C')),
    away: awayRoster.filter(p => p.position?.toUpperCase().includes('C'))
  }), [homeRoster, awayRoster]);

  const getStatsForRange = useCallback((team: Team, periodFilter?: number | 'total'): TeamStats & { giveaways: number, takeaways: number, faceoffLosses: number, penaltiesCount: number, entriesCarry: number, entriesDump: number, entriesPass: number, entriesDenied: number } => {
    const teamEvents = events.filter(e => e.team === team && (periodFilter === 'total' || periodFilter === undefined || e.period === periodFilter));
    return {
      name: team === Team.HOME ? homeName : awayName,
      goals: teamEvents.filter(e => e.type === EventType.GOAL).length,
      shots: teamEvents.filter(e =>
        e.type === EventType.GOAL ||
        e.type === EventType.PP_SHOT_FOR ||
        (e.type === EventType.SHOT && e.metadata?.onNet !== false)
      ).length,
      saves: teamEvents.filter(e => e.type === EventType.SAVE).length,
      hits: teamEvents.filter(e => e.type === EventType.HIT).length,
      pim: teamEvents.filter(e => e.type === EventType.PENALTY).reduce((sum, e) => sum + (typeof e.metadata?.minutes === 'number' ? e.metadata.minutes : 2), 0),
      faceoffWins: teamEvents.filter(e => e.type === EventType.FACEOFF_WIN).length,
      faceoffLosses: teamEvents.filter(e => e.type === EventType.FACEOFF_LOSS).length,
      giveaways: teamEvents.filter(e => e.type === EventType.GIVEAWAY).length,
      takeaways: teamEvents.filter(e => e.type === EventType.TAKEAWAY).length,
      entriesCarry: teamEvents.filter(e => e.type === EventType.ZONE_ENTRY_CARRY).length,
      entriesDump: teamEvents.filter(e => e.type === EventType.ZONE_ENTRY_DUMP).length,
      entriesPass: teamEvents.filter(e => e.type === EventType.ZONE_ENTRY_PASS).length,
      entriesDenied: teamEvents.filter(e => e.type === EventType.ZONE_ENTRY_DENIED).length,
      blocks: teamEvents.filter(e => e.type === EventType.BLOCK).length,
      penaltiesCount: teamEvents.filter(e => e.type === EventType.PENALTY).length,
      roster: team === Team.HOME ? homeRoster : awayRoster
    };
  }, [events, homeName, awayName, homeRoster, awayRoster]);

  const stats = useMemo(() => ({ home: getStatsForRange(Team.HOME), away: getStatsForRange(Team.AWAY) }), [getStatsForRange]);

  const isCurrentlySwapped = useMemo(() => {
    const periodFlip = currentPeriod % 2 === 0;
    return isRosterSwapped ? !periodFlip : periodFlip;
  }, [isRosterSwapped, currentPeriod]);

  const leftTeamDisplay = useMemo(() => {
    if (isCurrentlySwapped) return { name: awayName, score: stats.away.goals, logo: awayLogo, colorClass: 'red' };
    return { name: homeName, score: stats.home.goals, logo: homeLogo, colorClass: 'blue' };
  }, [isCurrentlySwapped, homeName, awayName, stats, homeLogo, awayLogo]);

  const rightTeamDisplay = useMemo(() => {
    if (isCurrentlySwapped) return { name: homeName, score: stats.home.goals, logo: homeLogo, colorClass: 'blue' };
    return { name: awayName, score: stats.away.goals, logo: awayLogo, colorClass: 'red' };
  }, [isCurrentlySwapped, homeName, awayName, stats, homeLogo, awayLogo]);

  // ── getTeamZone defined at component level so confirmGoal can use it ──
  const getTeamZone = useCallback((team: Team, xCoord: number) => {
    const isHomeOnLeft = !isCurrentlySwapped;
    const isLeft = (team === Team.HOME && isHomeOnLeft) || (team === Team.AWAY && !isHomeOnLeft);
    if (isLeft) {
      if (xCoord < 75) return Zone.DEFENSIVE;
      if (xCoord > 125) return Zone.OFFENSIVE;
      return Zone.NEUTRAL;
    } else {
      if (xCoord > 125) return Zone.DEFENSIVE;
      if (xCoord < 75) return Zone.OFFENSIVE;
      return Zone.NEUTRAL;
    }
  }, [isCurrentlySwapped]);

  const getShotQuality = (x: number, y: number, team: Team): 'high' | 'medium' | 'low' => {
    const attackingLeft = (team === Team.HOME && !isCurrentlySwapped) || (team === Team.AWAY && isCurrentlySwapped);
    const goalX = attackingLeft ? 11 : 189;
    const distFromGoal = Math.abs(x - goalX);
    const distFromCenter = Math.abs(y - 42.5);
    if (distFromGoal < 30 && distFromCenter < 15) return 'high';
    if (distFromGoal < 55 && distFromCenter < 25) return 'medium';
    return 'low';
  };

  const confirmGoal = useCallback((lineOnIce?: string, playersOnIce?: string[], againstPlayersOnIce?: string[], strength?: 'ES' | 'PP' | 'SH' | 'EN' | 'PS') => {
    if (!pendingGoal) return;
    const { x, y, team, playerNumber: pNum } = pendingGoal;
    const quality = getShotQuality(x, y, team);
    const newEvent: GameEvent = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      gameTime: '20:00',
      period: currentPeriod,
      type: EventType.GOAL,
      team,
      zone: getTeamZone(team, x),
      playerNumber: pNum || undefined,
      coordinates: { x, y },
      metadata: { shotQuality: quality, lineOnIce, playersOnIce, againstPlayersOnIce, strength: strength || 'ES' }
    };
    setEvents(prev => [...prev, newEvent]);
    if (activeSession && user) broadcastEvent(activeSession.id, newEvent, user.id).catch(console.error);
    setLastEvent({ type: EventType.GOAL, playerNumber: pNum, team });
    setPendingGoal(null);
  }, [pendingGoal, currentPeriod, getTeamZone, activeSession, user]);

  const confirmPenalty = useCallback((playerNum: string, penaltyType: string, minutes: number) => {
    if (!pendingPenalty) return;
    const { x, y, team } = pendingPenalty;
    const newEvent: GameEvent = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      gameTime: '20:00',
      period: currentPeriod,
      type: EventType.PENALTY,
      team,
      zone: getTeamZone(team, x),
      playerNumber: playerNum,
      coordinates: { x, y },
      metadata: { penaltyType, minutes, isPowerPlay: true }
    };
    setEvents(prev => [...prev, newEvent]);
    if (activeSession && user) broadcastEvent(activeSession.id, newEvent, user.id).catch(console.error);
    setLastEvent({ type: EventType.PENALTY, playerNumber: playerNum, team });
    setPendingPenalty(null);
  }, [pendingPenalty, currentPeriod, getTeamZone, activeSession, user]);

  const confirmFaceoff = useCallback((homeCenter: string, awayCenter: string, winner: Team) => {
    if (!pendingFaceoff) return;
    const { x, y } = pendingFaceoff;
    const homeWins = winner === Team.HOME;
    const newFaceoffEvents: GameEvent[] = [
      { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), gameTime: '20:00', period: currentPeriod, type: homeWins ? EventType.FACEOFF_WIN : EventType.FACEOFF_LOSS, team: Team.HOME, zone: getTeamZone(Team.HOME, x), playerNumber: homeCenter, coordinates: { x, y } },
      { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() + 1, gameTime: '20:00', period: currentPeriod, type: homeWins ? EventType.FACEOFF_LOSS : EventType.FACEOFF_WIN, team: Team.AWAY, zone: getTeamZone(Team.AWAY, x), playerNumber: awayCenter, coordinates: { x, y } }
    ];
    setEvents(prev => [...prev, ...newFaceoffEvents]);
    if (activeSession && user) {
      newFaceoffEvents.forEach(ev => broadcastEvent(activeSession.id, ev, user.id).catch(console.error));
    }
    setLastEvent({ type: winner === Team.HOME ? EventType.FACEOFF_WIN : EventType.FACEOFF_LOSS, playerNumber: homeCenter, team: Team.HOME });
    setPendingFaceoff(null);
  }, [pendingFaceoff, currentPeriod, getTeamZone, activeSession, user]);

  const confirmEntry = useCallback((entryType: EventType, dumpSubtype?: DumpInSubtype) => {
    if (!pendingEntry) return;
    const { x, y } = pendingEntry;
    const metadata = (entryType === EventType.ZONE_ENTRY_DUMP && dumpSubtype) ? { dumpSubtype } : undefined;
    const newEvent: GameEvent = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      gameTime: '20:00',
      period: currentPeriod,
      type: entryType,
      team: activeTeam,
      zone: getTeamZone(activeTeam, x),
      playerNumber: playerNumber || undefined,
      coordinates: { x, y },
      metadata
    };
    setEvents(prev => [...prev, newEvent]);
    setLastEvent({ type: entryType, playerNumber, team: activeTeam });
    if (activeSession && user) {
      broadcastEvent(activeSession.id, newEvent, user.id).catch(console.error);
    }
    setPendingEntry(null);
  }, [pendingEntry, currentPeriod, getTeamZone, activeTeam, playerNumber, activeSession, user]);

  const handlePlot = useCallback((x: number, y: number) => {
    setTaggingEvent(null);
    setPlayerTagDismissed(false);

    if (mapPlotType === EventType.FACEOFF_WIN || mapPlotType === EventType.FACEOFF_LOSS) {
      // Location comes first — centres and the winner are chosen in the
      // popup that appears next (see FaceoffPopup / confirmFaceoff).
      setPendingFaceoff({ x, y });
      return;
    }

    const zoneEntryTypes = [EventType.ZONE_ENTRY_CARRY, EventType.ZONE_ENTRY_DUMP, EventType.ZONE_ENTRY_PASS, EventType.ZONE_ENTRY_DENIED];
    if (zoneEntryTypes.includes(mapPlotType)) {
      // Same idea as faceoffs — location first, then the popup asks how
      // the entry happened (see EntryPopup / confirmEntry).
      setPendingEntry({ x, y });
      return;
    }

    if (mapPlotType === EventType.GOAL) {
      setPendingGoal({ x, y, team: activeTeam, playerNumber: playerNumber || '' });
      return;
    }

    if (mapPlotType === EventType.PENALTY) {
      // Same idea as goals/faceoffs/entries — location first, then the
      // popup asks who took it, the infraction, and the duration. If a
      // player from this team is already selected in the lineup grid,
      // pre-fill them (still changeable in the popup).
      const activeRoster = activeTeam === Team.HOME ? homeRoster : awayRoster;
      const preselect = playerNumber && activeRoster.some(p => p.number === playerNumber) ? playerNumber : undefined;
      setPendingPenalty({ x, y, team: activeTeam, playerNumber: preselect });
      return;
    }

    const quality = mapPlotType === EventType.SHOT ? getShotQuality(x, y, activeTeam) : undefined;
    const metadata = mapPlotType === EventType.SHOT
      ? { shotQuality: quality, onNet: true, strength: 'ES' as const }
      : undefined;
    const newEvent: GameEvent = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      gameTime: '20:00',
      period: currentPeriod,
      type: mapPlotType,
      team: activeTeam,
      zone: getTeamZone(activeTeam, x),
      playerNumber: playerNumber || undefined,
      coordinates: { x, y },
      metadata
    };
    setEvents(prev => [...prev, newEvent]);
    setLastEvent({ type: mapPlotType, playerNumber: playerNumber, team: activeTeam });
    // Dot is already plotted — this just offers a quick way to tag/retag
    // who it belongs to, without holding up the plot itself.
    setTaggingEvent(newEvent.id);
    setPlayerTagDismissed(false);
    // Broadcast to session if active
    if (activeSession && user) {
      broadcastEvent(activeSession.id, newEvent, user.id).catch(console.error);
    }
  }, [mapPlotType, activeTeam, playerNumber, currentPeriod, getTeamZone]);

  const confirmPlayerTag = useCallback((eventId: string, num: string, playerTeam: Team) => {
    setEvents(prev => prev.map(e => {
      if (e.id !== eventId) return e;
      if (e.team === playerTeam || !e.coordinates) {
        // Same team as originally plotted — just attach the player.
        return { ...e, playerNumber: num };
      }
      // Tapped a player from the OTHER team than the event was originally
      // plotted for. The dot's location doesn't move, but zone (and shot
      // quality, for shots) are relative to which team the event belongs
      // to — since each team attacks the opposite end — so both need to be
      // recomputed, not just the player number.
      const newZone = getTeamZone(playerTeam, e.coordinates.x);
      const newMetadata = e.type === EventType.SHOT
        ? { ...e.metadata, shotQuality: getShotQuality(e.coordinates.x, e.coordinates.y, playerTeam) }
        : e.metadata;
      return { ...e, playerNumber: num, team: playerTeam, zone: newZone, metadata: newMetadata };
    }));
    setPlayerTagDismissed(true);
  }, [getTeamZone, getShotQuality]);

  // Quick, non-blocking updates for a shot's result (on net vs. attempt)
  // and strength (ES/PP/PK) — tapped from the strip alongside the player
  // tag bar, never holding up the plot itself.
  const updateShotMeta = useCallback((eventId: string, patch: { onNet?: boolean; strength?: 'ES' | 'PP' | 'PK' }) => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, metadata: { ...e.metadata, ...patch } } : e));
  }, []);

  const handleManageSubscription = async () => {
    const email = currentUser?.primaryEmailAddress?.emailAddress;
    if (!email) return;
    try {
      const response = await fetch('/api/customer-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Could not open subscription portal.');
    } catch { alert('Could not open subscription portal. Please contact support.'); }
  };

  const handleNewGame = () => setShowNewGameConfirm(true);

  const confirmNewGame = () => {
    setEvents([]);
    setCurrentPeriod(1);
    setHomeName('HOME');
    setAwayName('AWAY');
    setHomeRoster([]);
    setAwayRoster([]);
    setHomeRosterUrl('');
    setAwayRosterUrl('');
    setHomeLogo('');
    setAwayLogo('');
    setSummaries({ 'total': 'Game tracking active. Generate coaching analysis after logging more events.' });
    localStorage.removeItem('tch_game_state');
    try { ['tch_homeRoster','tch_awayRoster','tch_homeName','tch_awayName','tch_homeLogo','tch_awayLogo'].forEach(k => sessionStorage.removeItem(k)); } catch {}
    sessionStorage.setItem('tch_launched', 'true');
    setShowNewGameConfirm(false);
  };

  const handleMoveEvent = (eventId: string, x: number, y: number) => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, coordinates: { x, y } } : e));
  };

  const handlePasteSync = async (team: Team) => {
    const isHome = team === Team.HOME;
    const pasteText = isHome ? pasteRosterHome : pasteRosterAway;
    const teamName = isHome ? homeName : awayName;
    if (!pasteText.trim()) { alert('Please paste your roster text first.'); return; }
    if (!teamName.trim()) { alert('Please enter a team name first.'); return; }
    setIsPasteSyncing(true);
    setSyncMessage('Reading pasted roster...');
    try {
      const result = await fetchRosterByAI({ teamName, rosterUrl: '', pasteText });
      if (result.status === 'ERROR') throw new Error(result.reason || 'Could not parse roster');
      const players: Player[] = (result.players || []).map((p: any) => ({
        number: p.number || '00', name: normalizeName(p.name), position: p.position || 'F',
        line: p.line || (p.position === 'G' ? 'G1' : p.position === 'D' ? 'P1' : '1'),
      }));
      if (players.length === 0) throw new Error('No players found in pasted text');
      const sortedPlayers = sortByNumber(players);
      if (isHome) { setHomeRoster(sortedPlayers); setPasteRosterHome(''); }
      else { setAwayRoster(sortedPlayers); setPasteRosterAway(''); }
      setSyncMessage('');
      setSavePrompt({ teamName: teamName.trim(), roster: sortedPlayers, logo: isHome ? homeLogo : awayLogo, side: isHome ? 'home' : 'away' });
    } catch (err: any) {
      alert(`Paste Sync Error: ${err.message}`);
    } finally {
      setIsPasteSyncing(false);
      setSyncMessage('');
    }
  };

  const handleGenerateInsights = async () => {
    setIsGeneratingInsights(true);
    try {
      const hStats = getStatsForRange(Team.HOME, breakdownFilter);
      const aStats = getStatsForRange(Team.AWAY, breakdownFilter);

      // Build rich shot quality breakdown
      const periodEvents = breakdownFilter === 'total'
        ? events
        : events.filter(e => e.period === breakdownFilter);

      const getShotQualityBreakdown = (team: Team) => {
        const shots = periodEvents.filter(e => e.team === team && (e.type === EventType.SHOT || e.type === EventType.GOAL));
        return {
          high: shots.filter(e => e.metadata?.shotQuality === 'high').length,
          medium: shots.filter(e => e.metadata?.shotQuality === 'medium').length,
          low: shots.filter(e => e.metadata?.shotQuality === 'low').length,
        };
      };

      const getFaceoffZoneBreakdown = (team: Team) => {
        const wins = periodEvents.filter(e => e.team === team && e.type === EventType.FACEOFF_WIN);
        const losses = periodEvents.filter(e => e.team === team && e.type === EventType.FACEOFF_LOSS);
        return {
          offensiveWins: wins.filter(e => e.zone === Zone.OFFENSIVE).length,
          offensiveLosses: losses.filter(e => e.zone === Zone.OFFENSIVE).length,
          defensiveWins: wins.filter(e => e.zone === Zone.DEFENSIVE).length,
          defensiveLosses: losses.filter(e => e.zone === Zone.DEFENSIVE).length,
          neutralWins: wins.filter(e => e.zone === Zone.NEUTRAL).length,
          neutralLosses: losses.filter(e => e.zone === Zone.NEUTRAL).length,
        };
      };

      const getGoalLines = () => {
        return periodEvents
          .filter(e => e.type === EventType.GOAL)
          .map(e => ({
            team: e.team === Team.HOME ? homeName : awayName,
            player: e.playerNumber ? `#${e.playerNumber}` : 'unknown',
            line: e.metadata?.lineOnIce || null,
            quality: e.metadata?.shotQuality || null,
          }));
      };

      const richData = {
        homeName, awayName,
        homeStats: hStats,
        awayStats: aStats,
        homeShotQuality: getShotQualityBreakdown(Team.HOME),
        awayShotQuality: getShotQualityBreakdown(Team.AWAY),
        homeFaceoffZones: getFaceoffZoneBreakdown(Team.HOME),
        awayFaceoffZones: getFaceoffZoneBreakdown(Team.AWAY),
        goals: getGoalLines(),
        periodFilter: breakdownFilter,
        totalEvents: periodEvents.length,
        myTeam: myTeam === 'NEUTRAL' ? null : myTeam,
        myTeamName: myTeam === 'NEUTRAL' ? null : (myTeam === Team.HOME ? homeName : awayName),
        opponentTeamName: myTeam === 'NEUTRAL' ? null : (myTeam === Team.HOME ? awayName : homeName),
      };

      const narrative = await generateNarrative(breakdownFilter, hStats, aStats, richData);
      setSummaries(prev => ({ ...prev, [breakdownFilter]: narrative }));
    } catch (err) { console.error(err); } finally { setIsGeneratingInsights(false); }
  };

  const prepareExportData = () => {
    const maxPeriod = Math.max(...events.map(e => e.period), currentPeriod);
    return { homeName, awayName, homeLogo, awayLogo, events, stats: { home: getStatsForRange(Team.HOME), away: getStatsForRange(Team.AWAY) }, summaries, maxPeriod };
  };

  const handleExportPDF = () => downloadPDFReport(prepareExportData());
  const handleExportExcel = () => downloadExcelReport(prepareExportData());
  const handleExportHTML = () => downloadHTMLExport(prepareExportData());
  const handleEndGame = () => setShowEndGame(true);
  const handleConfirmEndGame = () => {
    // Clear all game data
    setEvents([]);
    setCurrentPeriod(1);
    setHomeName('HOME');
    setAwayName('AWAY');
    setHomeRoster([]);
    setAwayRoster([]);
    setHomeLogo('');
    setAwayLogo('');
    setSummaries({ 'total': 'Game tracking active. Generate coaching analysis after logging more events.' });
    setLastEvent(null);
    setPendingGoal(null);
    setPendingFaceoff(null);
    setPendingEntry(null);
    setPendingPenalty(null);
    setTaggingEvent(null);
    setPlayerTagDismissed(false);
    try { ['tch_homeRoster','tch_awayRoster','tch_homeName','tch_awayName','tch_homeLogo','tch_awayLogo'].forEach(k => sessionStorage.removeItem(k)); } catch {}
    localStorage.removeItem('tch_game_state');
    setShowEndGame(false);
  };

  const handleRepeatLast = () => {
    if (!lastEvent) return;
    const lastLogged = [...events].reverse().find(e => e.type === lastEvent.type && e.team === lastEvent.team);
    const coords = lastLogged?.coordinates || { x: 100, y: 42.5 };
    setEvents(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), gameTime: '20:00',
      period: currentPeriod, type: lastEvent.type, team: lastEvent.team, zone: Zone.NEUTRAL,
      playerNumber: lastEvent.playerNumber || undefined, coordinates: coords
    }]);
  };

  const getPlayerFOStats = (num: string) => {
    const playerEvents = events.filter(e => e.playerNumber === num && (e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS));
    const wins = playerEvents.filter(e => e.type === EventType.FACEOFF_WIN).length;
    const total = playerEvents.length;
    return total > 0 ? Math.round((wins / total) * 100) : 0;
  };

  const handleUndo = () => {
    const last = events[events.length - 1];
    if (last && activeSession) deleteEvent(last.id).catch(console.error);
    setEvents(prev => prev.slice(0, -1));
  };
  const handleRemoveEvent = (id: string) => {
    if (activeSession) deleteEvent(id).catch(console.error);
    setEvents(prev => prev.filter(e => e.id !== id));
  };
  const handleUpdateEvent = (id: string, updates: Partial<GameEvent>) => setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  const selectPlayer = (num: string, team: Team) => { setActiveTeam(team); setPlayerNumber(num === playerNumber && activeTeam === team ? '' : num); };
  const toggleVisibleType = (type: EventType) => setVisibleTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  const toggleAllFilters = () => {
    const allTrackedTypes = [...toolbarButtons.map(b => b.type), EventType.FACEOFF_WIN, EventType.ZONE_ENTRY_CARRY, EventType.ZONE_ENTRY_DUMP, EventType.ZONE_ENTRY_PASS, EventType.ZONE_ENTRY_DENIED];
    const showingAll = allTrackedTypes.every(t => visibleTypes.includes(t));
    if (showingAll) setVisibleTypes(prev => prev.filter(t => !allTrackedTypes.includes(t)));
    else setVisibleTypes(prev => Array.from(new Set([...prev, ...allTrackedTypes])));
  };

  const handleUpdatePlayerInline = (team: Team, index: number, field: keyof Player, value: string) => {
    const updateFn = team === Team.HOME ? setHomeRoster : setAwayRoster;
    updateFn(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleAddPlayerQuickly = (team: Team) => {
    const isHome = team === Team.HOME;
    const roster = isHome ? homeRoster : awayRoster;
    const data = isHome ? manualHome : manualAway;
    if (!data.name || !data.number) return;
    if (roster.some(p => p.number === data.number)) { toast.error(`Player #${data.number} already exists on this roster.`); return; }
    const p: Player = { number: data.number, name: normalizeName(data.name), position: data.pos || 'F', line: data.line };
    if (isHome) { setHomeRoster(sortByNumber([...homeRoster, p])); setManualHome({ number: '', name: '', pos: 'F', line: '1' }); }
    else { setAwayRoster(sortByNumber([...awayRoster, p])); setManualAway({ number: '', name: '', pos: 'F', line: '1' }); }
  };

  const handleLogoUpload = (team: Team, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (team === Team.HOME) setHomeLogo(result);
      else setAwayLogo(result);
    };
    reader.readAsDataURL(file);
  };

  const handleAISync = async (team: Team) => {
    const isHome = team === Team.HOME;
    const teamName = isHome ? homeName : awayName;
    const rosterUrl = isHome ? homeRosterUrl : awayRosterUrl;
    const setSyncing = isHome ? setIsSyncingHome : setIsSyncingAway;
    const setRoster = isHome ? setHomeRoster : setAwayRoster;
    const setSources = isHome ? setHomeSources : setAwaySources;
    if (!teamName || teamName === "HOME" || teamName === "AWAY") { alert("Please enter a valid team name before syncing."); return; }
    setSyncing(true);
    try {
      const response = await fetchRosterByAI({ teamName, rosterUrl: rosterUrl || undefined });
      if (response.status === 'OK' && response.players.length > 0) {
        setRoster(sortByNumber(response.players.map((p: any) => ({ ...p, name: normalizeName(p.name) }))));
        if (response.sources) setSources(response.sources);
      } else { alert(`AI Sync Error: ${response.reason || 'Extraction failed'}`); }
    } catch (error: any) { alert(`Sync failed: ${error.message || 'Unknown error occurred.'}`); }
    finally { setSyncing(false); }
  };

  const orderedTeams = useMemo(() => isCurrentlySwapped ? [Team.AWAY, Team.HOME] : [Team.HOME, Team.AWAY], [isCurrentlySwapped]);

  // Handle terms/privacy links from AuthGate
  React.useEffect(() => {
    const showTerms = () => setLegalPage('terms');
    const showPrivacy = () => setLegalPage('privacy');
    window.addEventListener('tch_show_terms', showTerms);
    window.addEventListener('tch_show_privacy', showPrivacy);
    return () => {
      window.removeEventListener('tch_show_terms', showTerms);
      window.removeEventListener('tch_show_privacy', showPrivacy);
    };
  }, []);

  const handleLaunch = () => {
    sessionStorage.setItem('tch_launched', 'true');
    setShowLanding(false);
  };

  const handleBackToLanding = () => {
    sessionStorage.removeItem('tch_launched');
    setShowLanding(true);
  };

  // Intercept browser back button — go to landing page instead of previous site.
  // Scoped to the root path only, so it doesn't hijack normal back-navigation
  // on standalone pages like /about or /manual.
  React.useEffect(() => {
    if (showLanding) return;
    if (location.pathname !== '/') return;
    window.history.pushState({ tch: true }, '');
    const handlePopState = () => {
      sessionStorage.removeItem('tch_launched');
      setShowLanding(true);
      window.history.pushState({ tch: true }, '');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showLanding, location.pathname]);

  // Standalone public pages — accessible regardless of landing/auth/subscription
  // state, so Google (and anonymous visitors) can actually reach them instead
  // of hitting the sign-in wall.
  if (location.pathname === '/about') {
    return <AboutPage onClose={() => navigate('/')} onContact={() => navigate('/contact')} />;
  }
  if (location.pathname === '/manual') {
    return <UserManual isOpen={true} onClose={() => navigate('/')} />;
  }
  if (location.pathname === '/contact') {
    return <ContactPage onClose={() => navigate('/')} />;
  }
  if (location.pathname === '/advertise' && ADS_ENABLED) {
    return <AdvertisePage isOpen={true} onClose={() => navigate('/')} />;
  }

  if (showLanding) return <LandingPage onLaunch={handleLaunch} onContact={() => navigate('/contact')} onAdvertise={ADS_ENABLED ? () => navigate('/advertise') : undefined} onAbout={() => navigate('/about')} />;

  // Show loading screen while Clerk is initialising — prevents blank page flash
  if (!authLoaded) return (
    <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center gap-4">
      <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-24 w-auto" />
      <div className="flex gap-2 mt-4">
        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
      </div>
    </div>
  );

  if (!isSignedIn) return <AuthGate onAuthenticated={() => setIsAuthenticated(true)} />;

  const ADMIN_EMAILS = [
    'colinzappia@gmail.com',
    'derekfroats19@gmail.com',
    'macopelo17@gmail.com',
    'marcodinardo24@gmail.com',
    'mmcnamee12@hotmail.com',
  ];
  const userEmail = currentUser?.primaryEmailAddress?.emailAddress?.toLowerCase() || user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';
  const isAdmin = ADMIN_EMAILS.includes(userEmail);

  if (checkingSubscription && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center gap-4">
        <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-24 w-auto" />
        <div className="flex gap-2 mt-4">
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
        </div>
        <p className="text-slate-500 text-sm">Verifying your subscription...</p>
      </div>
    );
  }

  if (!isSubscribed && !isAdmin) return <PricingGate onSubscribed={() => setIsSubscribed(true)} />;

  return (
    <ThemedBackground intensity="subtle" className="flex flex-col text-slate-200">
      {ADS_ENABLED && <AdBanner position="top" onContactClick={() => navigate('/advertise')} />}
      <Toaster position="top-center" richColors theme="dark" />

      {/* Session banner — shown when a live session is active */}
      {activeSession && mySessionRole && (
        <SessionBanner
          session={activeSession}
          myRole={mySessionRole}
          myUserId={user?.id || ''}
          onEndSession={handleEndSession}
          onLeaveSession={handleLeaveSession}
        />
      )}

      {/* Session setup / join modals */}
      {showSessionSetup && (
        <SessionSetup
          homeName={homeName}
          awayName={awayName}
          homeRoster={homeRoster}
          awayRoster={awayRoster}
          onSessionCreated={handleSessionCreated}
          onCancel={() => setShowSessionSetup(false)}
        />
      )}
      {showSessionJoin && (
        <SessionJoin
          onJoined={handleSessionJoined}
          onCancel={() => setShowSessionJoin(false)}
        />
      )}

      {/* Game history */}
      <GameHistory
        isOpen={showGameHistory}
        onClose={() => setShowGameHistory(false)}
        onLoadGame={() => {}}
        onDownloadReport={handleDownloadFromHistory}
      />

      {/* Event attachment panel */}
      {attachmentEvent && (
        <EventAttachmentPanel
          event={attachmentEvent}
          sessionId={activeSession?.id || null}
          onClose={() => setAttachmentEvent(null)}
        />
      )}

      {/* Team library */}
      <TeamLibrary
        isOpen={showTeamLibrary}
        onClose={() => setShowTeamLibrary(false)}
        onLoadTeam={handleLibraryTeamLoaded}
      />

      {/* Save team prompt — shown after roster import */}
      {savePrompt && (
        <SaveTeamPrompt
          teamName={savePrompt.teamName}
          roster={savePrompt.roster}
          logo={savePrompt.logo}
          onSaved={() => { setSavePrompt(null); toast.success('Team saved to library!'); }}
          onSkip={() => setSavePrompt(null)}
        />
      )}
      
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Header 
          leftTeam={leftTeamDisplay} rightTeam={rightTeamDisplay} period={currentPeriod}
          onOpenSetup={() => setShowSetup(true)} onOpenManual={() => navigate('/manual')}
          onOpenGameHistory={() => setShowGameHistory(true)}
          onSetPeriod={setCurrentPeriod} onSwapSides={() => setIsRosterSwapped(!isRosterSwapped)}
          onNewGame={handleNewGame} onEndGame={handleEndGame} onOpenAbout={() => navigate('/about')} onBackToLanding={handleBackToLanding}
          onOpenContact={() => navigate('/contact')}
        />

        {/* Session controls — shown when no session is active */}
        {!activeSession && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setShowSessionSetup(true)}
              style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(96,165,250,0.12)', border: '0.5px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}
            >
              ＋ Share this game live
            </button>
            <button
              onClick={() => setShowSessionJoin(true)}
              style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
            >
              Join session
            </button>
          </div>
        )}
        
        <main className="flex flex-col pb-20">
        {/* LIVE ROSTER LOGGING PANELS */}
        <div className={`flex w-full gap-px bg-white/5 border-b border-white/10 shrink-0 transition-all duration-500 ${showLineups ? 'h-[420px] sm:h-[460px] md:h-[520px] opacity-100' : 'h-0 opacity-0 border-none overflow-hidden'}`}>
          {orderedTeams.map(team => {
            const isHome = team === Team.HOME;
            const roster = isHome ? homeRoster : awayRoster;
            const name = isHome ? homeName : awayName;
            return (
              <div key={team} className={`flex-1 flex flex-col min-w-0 ${isHome ? 'bg-blue-900/10 border-r border-white/5' : 'bg-red-900/10'}`}>
                <div className={`px-3 py-2 ${isHome ? 'bg-blue-900/30' : 'bg-red-900/30'} flex flex-col gap-2 border-b border-white/10 shrink-0`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className={`w-2 h-2 rounded-full ${isHome ? 'bg-blue-500' : 'bg-red-500'} animate-pulse`}></div>
                      <span className={`text-[10px] md:text-xs font-black ${isHome ? 'text-blue-400' : 'text-red-400'} uppercase truncate tracking-widest`}>{name} LINEUP</span>
                    </div>
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{roster.length} Dressed</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-none p-1 space-y-0.5">
                  {/* Forward lines */}
                  {['1','2','3','4'].map(lineNum => (
                    <div key={`line-${lineNum}`}>
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <span className={`text-[6px] font-black w-3 shrink-0 ${isHome ? 'text-blue-600' : 'text-red-600'}`}>L{lineNum}</span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>
                      <div className="grid grid-cols-3 gap-0.5">
                        {['LW','C','RW'].map((pos, posIdx) => {
                          const playersOnLine = roster.filter(p => p.line === lineNum);
                          const playersInThisSlot = playersOnLine.filter(p => {
                            if (p.position === pos) return true;
                            if (p.position === 'F') { const fPlayers = playersOnLine.filter(pl => pl.position === 'F'); const idx = fPlayers.indexOf(p); return posIdx === 2 ? idx >= 2 : idx === posIdx; }
                            return false;
                          });
                          return (
                            <DroppableSlot key={pos} id={`line-${team}-${lineNum}-${pos}`} label={pos} cols={Math.max(1, playersInThisSlot.length)}>
                              {playersInThisSlot.map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} isHome={isHome} isSelected={playerNumber === p.number && activeTeam === team} onSelect={selectPlayer} />)}
                            </DroppableSlot>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Defense pairs */}
                  {['P1','P2','P3'].map(pairNum => (
                    <div key={`pair-${pairNum}`}>
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <span className={`text-[6px] font-black w-3 shrink-0 ${isHome ? 'text-blue-600' : 'text-red-600'}`}>{pairNum}</span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>
                      <div className="grid grid-cols-2 gap-0.5">
                        {['D1','D2'].map((pos, posIdx) => {
                          const playersOnPair = roster.filter(p => p.line === pairNum);
                          const playersInThisSlot = playersOnPair.filter(p => {
                            if (p.position === 'LD' && posIdx === 0) return true;
                            if (p.position === 'RD' && posIdx === 1) return true;
                            if (p.position === 'D') { const dPlayers = playersOnPair.filter(pl => pl.position === 'D'); const idx = dPlayers.indexOf(p); return posIdx === 1 ? idx >= 1 : idx === 0; }
                            return false;
                          });
                          return (
                            <DroppableSlot key={pos} id={`line-${team}-${pairNum}-${posIdx === 0 ? 'LD' : 'RD'}`} label={pos} cols={Math.max(1, playersInThisSlot.length)}>
                              {playersInThisSlot.map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} isHome={isHome} isSelected={playerNumber === p.number && activeTeam === team} onSelect={selectPlayer} />)}
                            </DroppableSlot>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Goalies */}
                  <div>
                    <div className="flex items-center gap-0.5 mb-0.5">
                      <span className={`text-[6px] font-black w-3 shrink-0 ${isHome ? 'text-blue-600' : 'text-red-600'}`}>G</span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>
                    <div className="grid grid-cols-2 gap-0.5">
                      {['G1','G2'].map(goalieNum => (
                        <DroppableSlot key={goalieNum} id={`line-${team}-${goalieNum}-G`} label={goalieNum === 'G1' ? 'S' : 'B'}>
                          {roster.filter(p => p.line === goalieNum).map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} isHome={isHome} isSelected={playerNumber === p.number && activeTeam === team} onSelect={selectPlayer} />)}
                        </DroppableSlot>
                      ))}
                    </div>
                  </div>
                  {/* Unassigned */}
                  {roster.filter(p => !['1','2','3','4','P1','P2','P3','G1','G2'].includes(p.line || '')).length > 0 && (
                    <DroppableSlot id={`line-${team}-unassigned`} label="?" cols={2}>
                      {roster.filter(p => !['1','2','3','4','P1','P2','P3','G1','G2'].includes(p.line || '')).map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} isHome={isHome} isSelected={playerNumber === p.number && activeTeam === team} onSelect={selectPlayer} />)}
                    </DroppableSlot>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Roster panel collapse handle — sits right on the seam it controls */}
        <div className="w-full flex justify-center relative z-10 -mb-px">
          <button
            onClick={() => setShowLineups(!showLineups)}
            className="px-4 py-1 bg-white/10 hover:bg-white/20 rounded-b-lg text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-200 border border-t-0 border-white/10 transition-all shadow-lg"
          >
            {showLineups ? '▲ Hide Rosters' : '▼ Show Rosters'}
          </button>
        </div>

        {/* RINK */}
        <div className="bg-black relative flex flex-col min-h-[420px] sm:min-h-[500px] md:min-h-[600px] shadow-inner">
          <div className="w-full px-2 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between gap-1 shadow-inner shrink-0">
            {/* Home shot counter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
              <div className="flex flex-col leading-tight">
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-wider truncate max-w-[60px]">{homeName}</span>
                <span className="text-lg font-black text-white italic leading-none">{stats.home.shots} <span className="text-[9px] font-bold text-slate-500">shots</span></span>
              </div>
            </div>

            {/* Home/Away — sets which team the next event belongs to, independent of picking a specific player */}
            <div className="flex items-center bg-white/5 p-0.5 rounded-xl border border-white/10 shrink-0 shadow-inner gap-0.5">
              <button onClick={() => setActiveTeam(Team.HOME)} className={`px-2.5 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase transition-all ${activeTeam === Team.HOME ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{homeName ? homeName.trim().split(' ').pop() : 'Home'}</button>
              <button onClick={() => setActiveTeam(Team.AWAY)} className={`px-2.5 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase transition-all ${activeTeam === Team.AWAY ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{awayName ? awayName.trim().split(' ').pop() : 'Away'}</button>
            </div>

            {/* Away shot counter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[8px] font-black text-red-500 uppercase tracking-wider truncate max-w-[60px]">{awayName}</span>
                <span className="text-lg font-black text-white italic leading-none">{stats.away.shots} <span className="text-[9px] font-bold text-slate-500">shots</span></span>
              </div>
              <div className="w-1 h-6 bg-red-600 rounded-full"></div>
            </div>
          </div>

          <div className="relative flex flex-col items-center justify-center p-3 sm:p-10 h-full gap-3">

            {/* Event toolbar — centred above the rink */}
            <div className="w-full max-w-6xl flex items-center justify-center gap-2 overflow-x-auto scrollbar-none">
              {!canLogEvents ? (
                <div style={{ padding: '7px 12px', background: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.2)', borderRadius: 10, fontSize: 11, color: '#fbbf24', whiteSpace: 'nowrap' }}>
                  👁 Viewer — watching live
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    {toolbarButtons.map(btn => (
                      <button key={btn.type} onClick={() => setMapPlotType(btn.type)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center shadow-lg active:scale-90 shrink-0 ${mapPlotType === btn.type ? `${btn.color} text-white ring-2 ring-white/20` : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>{btn.label}</button>
                    ))}
                    <button onClick={() => setMapPlotType(mapPlotType === EventType.FACEOFF_WIN || mapPlotType === EventType.FACEOFF_LOSS ? EventType.SHOT : EventType.FACEOFF_WIN)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center shadow-lg active:scale-90 border shrink-0 ${mapPlotType === EventType.FACEOFF_WIN || mapPlotType === EventType.FACEOFF_LOSS ? 'bg-yellow-500 text-black border-yellow-300 ring-2 ring-yellow-300/40' : 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-600/40'}`}>🏒 Faceoffs</button>
                    <button onClick={() => { const zoneEntryTypes = [EventType.ZONE_ENTRY_CARRY, EventType.ZONE_ENTRY_DUMP, EventType.ZONE_ENTRY_PASS, EventType.ZONE_ENTRY_DENIED]; setMapPlotType(zoneEntryTypes.includes(mapPlotType) ? EventType.SHOT : EventType.ZONE_ENTRY_CARRY); }} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center shadow-lg active:scale-90 border shrink-0 ${[EventType.ZONE_ENTRY_CARRY, EventType.ZONE_ENTRY_DUMP, EventType.ZONE_ENTRY_PASS, EventType.ZONE_ENTRY_DENIED].includes(mapPlotType) ? 'bg-indigo-500 text-white border-indigo-300 ring-2 ring-indigo-300/40' : 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600/40'}`}>⛸ Zone Entries</button>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {playerNumber && (
                      <div className={`px-2 py-1.5 rounded-xl text-[10px] font-black border transition-all shrink-0 ${activeTeam === Team.HOME ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'bg-red-600/20 border-red-500/40 text-red-300'}`}>#{playerNumber}</div>
                    )}
                    <button onClick={handleUndo} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 active:bg-white/20 transition-all shadow-lg shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    </button>
                  </div>
                </>
              )}
            </div>

            {(() => {
              const tagged = taggingEvent ? events.find(e => e.id === taggingEvent) : null;
              if (!tagged || tagged.type !== EventType.SHOT) return null;
              const onNet = tagged.metadata?.onNet !== false; // default true
              const shotStrength = tagged.metadata?.strength || 'ES';
              return (
                <div className="w-full px-3 py-2 flex items-center gap-3 animate-in slide-in-from-top duration-200 bg-black/30 border-b border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400 shrink-0">Shot:</span>
                  <div className="flex items-center gap-1">
                    {[{ key: true, label: 'On Net' }, { key: false, label: 'Attempt' }].map(({ key, label }) => {
                      const active = onNet === key;
                      return (
                        <button
                          key={label}
                          onClick={() => updateShotMeta(taggingEvent!, { onNet: key })}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-all border ${active ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}
                        >{label}</button>
                      );
                    })}
                  </div>
                  <span className="text-slate-700 shrink-0">·</span>
                  <div className="flex items-center gap-1">
                    {(['PP', 'PK'] as const).map(s => {
                      const active = shotStrength === s;
                      const activeClass = s === 'PP' ? 'bg-amber-500 text-black border-amber-300' : 'bg-pink-500 text-white border-pink-300';
                      return (
                        <button
                          key={s}
                          onClick={() => updateShotMeta(taggingEvent!, { strength: active ? 'ES' : s })}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-all border ${active ? activeClass : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}
                        >{s}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {taggingEvent && !playerTagDismissed && events.some(e => e.id === taggingEvent) && (
              <div className="w-full px-3 py-2.5 flex items-start gap-3 animate-in slide-in-from-top duration-200 bg-black/40 border-b border-white/10">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 shrink-0 pt-1.5">Tag:</span>

                <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                  {([Team.HOME, Team.AWAY] as const).map(team => {
                    const roster = team === Team.HOME ? homeRoster : awayRoster;
                    const taggedNum = events.find(e => e.id === taggingEvent)?.playerNumber;
                    const isHomeTeam = team === Team.HOME;
                    return (
                      <div
                        key={team}
                        className="rounded-lg p-1.5"
                        style={{
                          background: isHomeTeam ? 'rgba(37,99,235,0.10)' : 'rgba(220,38,38,0.10)',
                          border: `1px solid ${isHomeTeam ? 'rgba(37,99,235,0.25)' : 'rgba(220,38,38,0.25)'}`
                        }}
                      >
                        <p className={`text-[8px] font-black uppercase tracking-wider mb-1 px-0.5 ${isHomeTeam ? 'text-blue-400' : 'text-red-400'}`}>
                          {isHomeTeam ? homeName : awayName}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {roster.filter(p => p.position?.toUpperCase() !== 'G').map(p => {
                            const isTagged = taggedNum === p.number;
                            return (
                              <button
                                key={p.number}
                                onClick={() => confirmPlayerTag(taggingEvent, p.number, team)}
                                className={`w-9 h-8 rounded-md text-[11px] font-black transition-all border shrink-0 ${isTagged ? (isHomeTeam ? 'bg-blue-600 text-white border-blue-400' : 'bg-red-600 text-white border-red-400') : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10'}`}
                              >{p.number}</button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button onClick={() => setPlayerTagDismissed(true)} className="shrink-0 text-slate-500 hover:text-white text-sm font-bold px-1 pt-1.5">×</button>
              </div>
            )}

            <div className={`w-full max-w-6xl aspect-[200/85] transition-all duration-700 rounded-[5rem] sm:rounded-[8.5rem] p-2 shadow-2xl`}>
              <RinkChart events={events.filter(e => {
                if (e.period !== currentPeriod || !visibleTypes.includes(e.type)) return false;
                if (e.type === EventType.SHOT) {
                  if (shotResultFilter === 'onNet' && e.metadata?.onNet === false) return false;
                  if (shotResultFilter === 'attempt' && e.metadata?.onNet !== false) return false;
                  if (shotStrengthFilter === 'pp' && e.metadata?.strength !== 'PP') return false;
                  if (shotStrengthFilter === 'pk' && e.metadata?.strength !== 'PK') return false;
                }
                return true;
              })} leftLogo={leftTeamDisplay.logo} rightLogo={rightTeamDisplay.logo} onPlot={handlePlot} onMoveEvent={handleMoveEvent} activeEventType={mapPlotType} />
            </div>
          </div>
          {/* Player Stats — below rink on mobile, avoids overlap */}
          <div className="flex justify-end px-3 pb-2 sm:hidden">
            <button onClick={() => setShowPlayerStats(true)} className="flex items-center gap-2 bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-full shadow-xl border border-blue-400/30 transition-all active:scale-95">
              <span>📊</span><span>Player Stats</span>
            </button>
          </div>
          {/* Player Stats — floating on larger screens */}
          <button onClick={() => setShowPlayerStats(true)} className="hidden sm:flex absolute bottom-12 right-12 items-center gap-2 bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-full shadow-xl border border-blue-400/30 transition-all active:scale-95 backdrop-blur-sm">
            <span>📊</span><span>Player Stats</span>
          </button>
        </div>

        {/* MAP FILTERS */}
        <div className="w-full px-4 py-3 bg-black/40 border-b border-white/5 flex items-center justify-center gap-2 overflow-x-auto scrollbar-none shadow-inner">
          <button onClick={toggleAllFilters} className="shrink-0 px-4 py-2 rounded-xl bg-white/10 text-[9px] font-black uppercase text-slate-300 border border-white/10 active:scale-95 transition-all">
            {toolbarButtons.every(t => visibleTypes.includes(t.type)) ? 'Isolate' : 'Show All'}
          </button>
          <div className="flex items-center gap-2">
            {toolbarButtons.map(btn => {
              const isActive = visibleTypes.includes(btn.type);
              const isShot = btn.type === EventType.SHOT;
              return (
                <div key={`filter-${btn.type}`} className="relative shrink-0 flex items-center">
                  <button
                    onClick={() => {
                      toggleVisibleType(btn.type);
                      // Clicking Shot itself always means "show everything" —
                      // any active isolation (result and/or strength) resets.
                      if (isShot) { setShotResultFilter('ALL'); setShotStrengthFilter('ALL'); }
                    }}
                    className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border shadow-sm ${isShot ? 'pr-2 rounded-r-none' : ''} ${isActive ? 'bg-white/10 text-white border-white/20' : 'opacity-20 border-transparent bg-transparent'}`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: (btn as any).dotColor }} />
                    <span>{btn.label}</span>
                    {isShot && (shotResultFilter !== 'ALL' || shotStrengthFilter !== 'ALL') && (
                      <span className="text-[7px] font-black px-1 py-0.5 rounded bg-cyan-500/30 text-cyan-300">
                        {[
                          shotResultFilter === 'onNet' ? 'NET' : shotResultFilter === 'attempt' ? 'ATT' : null,
                          shotStrengthFilter !== 'ALL' ? shotStrengthFilter.toUpperCase() : null,
                        ].filter(Boolean).join('+')}
                      </span>
                    )}
                  </button>
                  {isShot && (
                    <button
                      onClick={() => setShotFilterExpanded(!shotFilterExpanded)}
                      className={`px-1.5 py-2.5 rounded-xl rounded-l-none border border-l-0 shadow-sm transition-all ${isActive ? 'bg-white/10 text-white border-white/20' : 'opacity-20 border-transparent bg-transparent'}`}
                    >
                      <span className={`inline-block transition-transform text-[10px] ${shotFilterExpanded ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {shotFilterExpanded && (
          <div className="w-full px-4 py-2.5 bg-black/30 border-b border-white/5 flex items-center justify-center gap-3 overflow-x-auto scrollbar-none animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 shrink-0">Result:</span>
              {([
                { key: 'onNet', label: 'On Net', color: '#06b6d4' },
                { key: 'attempt', label: 'Attempt', color: '#64748b' },
              ] as const).map(({ key, label, color }) => {
                const on = shotResultFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setShotResultFilter(on ? 'ALL' : key)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border"
                    style={{
                      background: on ? `${color}33` : 'rgba(255,255,255,0.03)',
                      borderColor: on ? color : 'rgba(255,255,255,0.08)',
                      color: on ? color : '#64748b'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <span className="text-slate-700 shrink-0">·</span>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 shrink-0">Strength:</span>
              {([
                { key: 'pp', label: 'PP', color: '#eab308' },
                { key: 'pk', label: 'PK', color: '#ec4899' },
              ] as const).map(({ key, label, color }) => {
                const on = shotStrengthFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setShotStrengthFilter(on ? 'ALL' : key)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border"
                    style={{
                      background: on ? `${color}33` : 'rgba(255,255,255,0.03)',
                      borderColor: on ? color : 'rgba(255,255,255,0.08)',
                      color: on ? color : '#64748b'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* DATA COMMAND CENTER */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 px-2 sm:px-4 md:px-6 mt-6">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)] animate-pulse"></div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-white italic">AI Coaching Intel</h3>
                  <button
                    onClick={() => setShowSetup(true)}
                    title="Change who you're tracking for"
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all ${myTeam === Team.HOME ? 'bg-blue-600/20 border-blue-500/30 text-blue-300' : myTeam === Team.AWAY ? 'bg-red-600/20 border-red-500/30 text-red-300' : 'bg-slate-600/20 border-slate-500/30 text-slate-300'}`}
                  >
                    {myTeam === 'NEUTRAL' ? 'Neutral View' : `For ${myTeam === Team.HOME ? homeName : awayName}`}
                  </button>
                </div>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 self-stretch sm:self-auto">
                  <button onClick={() => setBreakdownFilter(currentPeriod)} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${breakdownFilter === currentPeriod ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>LIVE PER.</button>
                  <button onClick={() => setBreakdownFilter('total')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${breakdownFilter === 'total' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>FULL GAME</button>
                </div>
              </div>
              <div className="p-8 flex-1 min-h-[250px] relative group">
                {isGeneratingInsights ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-4 py-12">
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                      <div className="absolute inset-0 border-t-4 border-cyan-400 rounded-full animate-spin"></div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-cyan-500 animate-pulse">Scanning Structural Data...</span>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none">
                    {summaries[breakdownFilter] ? (
                      <div className="text-sm font-medium leading-relaxed text-slate-300 whitespace-pre-line font-mono tracking-tight">{summaries[breakdownFilter]}</div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-12">
                        <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <p className="text-xs font-black uppercase tracking-widest">No Tactical Summary Prepared</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="p-6 bg-black/40 border-t border-white/5 flex flex-col xl:flex-row gap-3">
                <button onClick={handleGenerateInsights} disabled={isGeneratingInsights} className="flex-1 py-4 md:py-5 bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-[0.4em] transition-all active:scale-[0.98] shadow-lg shadow-cyan-900/20">{isGeneratingInsights ? 'Processing Broadcast Feed...' : 'Generate Live Tactical Intel'}</button>
                <div className="flex gap-2">
                  <button onClick={handleExportPDF} className="flex-1 sm:flex-none sm:w-40 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    PDF Report
                  </button>
                  <button onClick={handleExportExcel} className="flex-1 sm:flex-none sm:w-40 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Excel Data
                  </button>
                  <button onClick={handleExportHTML} className="flex-1 sm:flex-none sm:w-40 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                    HTML Report
                  </button>
                </div>
              </div>
            </div>
            {showFeed && (
              <div className="rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900/40 shadow-2xl">
                <PlayByPlay events={events} homeName={homeName} awayName={awayName} onRemoveEvent={handleRemoveEvent} onUpdateEvent={handleUpdateEvent} onAttachClip={setAttachmentEvent} />
              </div>
            )}
          </div>
          <div className="lg:col-span-4 flex flex-col gap-6">
            <CenterAnalytics events={events} rosters={{ home: homeRoster, away: awayRoster }} homeName={homeName} awayName={awayName} />
          </div>
        </div>
      </main>

      <DragOverlay>
        {activeDragPlayer ? (
          <div className={`h-16 w-32 rounded-2xl font-black flex flex-col items-center justify-center border shadow-2xl scale-110 ${activeDragPlayer.team === Team.HOME ? 'bg-blue-600 border-blue-400 text-white' : 'bg-red-600 border-red-400 text-white'}`}>
            <span className="text-base leading-none">#{activeDragPlayer.player.number}</span>
            <span className="text-[8px] uppercase font-bold truncate w-full px-1 text-center mt-1">{activeDragPlayer.player.name.split(' ').pop()}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>

    {/* ROSTER SETUP MODAL */}
    {showSetup && (
      <div className="fixed inset-0 z-[120] bg-black/98 backdrop-blur-3xl flex flex-col animate-in fade-in duration-300">
        <div className="px-6 py-6 sm:px-10 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-3xl sm:text-4xl font-black italic uppercase text-white tracking-tighter">Roster Setup</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Side-By-Side Team Management</p>
          </div>
          <button onClick={() => setShowSetup(false)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/5 active:scale-90">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* MY TEAM SELECTOR — tells the AI tactical intel whose side to advise */}
        <div className="px-6 sm:px-10 py-4 border-b border-white/10 bg-black/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Who Are You Tracking For?</p>
            <p className="text-[9px] text-slate-600 mt-0.5">Pick your team and the AI tactical intel will give advice for that bench. Tracking as a broadcaster, scout, or fan? Choose Neutral for a balanced two-team breakdown instead.</p>
          </div>
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setMyTeam(Team.HOME)}
              className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${myTeam === Team.HOME ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {homeName}
            </button>
            <button
              onClick={() => setMyTeam(Team.AWAY)}
              className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${myTeam === Team.AWAY ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {awayName}
            </button>
            <button
              onClick={() => setMyTeam('NEUTRAL')}
              className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${myTeam === 'NEUTRAL' ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Neutral
            </button>
          </div>
        </div>
        <div className="flex-1 flex overflow-x-auto scrollbar-none">
          {[Team.HOME, Team.AWAY].map(team => {
            const isHome = team === Team.HOME;
            const roster = isHome ? homeRoster : awayRoster;
            const sources = isHome ? homeSources : awaySources;
            const name = isHome ? homeName : awayName;
            const logo = isHome ? homeLogo : awayLogo;
            const url = isHome ? homeRosterUrl : awayRosterUrl;
            const isSyncing = isHome ? isSyncingHome : isSyncingAway;
            const manualData = isHome ? manualHome : manualAway;
            const setManualData = isHome ? setManualHome : setManualAway;
            return (
              <div key={`setup-pane-${team}`} className={`flex-1 min-w-[360px] flex flex-col border-r border-white/5 last:border-r-0 ${isHome ? 'bg-blue-900/5' : 'bg-red-900/5'}`}>
                <div className="px-8 py-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isHome ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                    <span className="text-[12px] font-black uppercase tracking-widest text-white">{team} LINEUP</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleLoadFromLibrary(isHome ? 'home' : 'away')} className="text-[9px] font-black text-cyan-500 hover:text-cyan-300 uppercase transition-colors">📚 Load from Library</button>
                    <button onClick={() => {
                      if (isHome) { setHomeRoster([]); setHomeRosterUrl(''); setHomeSources([]); setPasteRosterHome(''); setHomeName(''); setHomeLogo(''); }
                      else { setAwayRoster([]); setAwayRosterUrl(''); setAwaySources([]); setPasteRosterAway(''); setAwayName(''); setAwayLogo(''); }
                    }} className="text-[9px] font-black text-slate-700 hover:text-red-500 uppercase transition-colors">Clear Roster</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-10 scrollbar-none">
                  <section className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-6">
                      <div className={`w-24 h-24 rounded-[2.5rem] border-2 border-dashed flex items-center justify-center relative group transition-all shrink-0 bg-black/40 ${isHome ? 'border-blue-500/30' : 'border-red-500/30'}`}>
                        {logo ? <img src={logo} className="w-full h-full object-contain p-4" alt="" /> : <div className="text-3xl font-black text-slate-700">{name.charAt(0)}</div>}
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleLogoUpload(team, e.target.files?.[0] || null)} />
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Team Name</label>
                          <input className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-xs font-black text-white outline-none focus:border-white/20" value={name} onChange={e => isHome ? setHomeName(e.target.value) : setAwayName(e.target.value)} placeholder="E.G. BRUINS" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Logo URL</label>
                          <input className="w-full bg-black/60 border border-white/10 p-3 rounded-xl text-[10px] text-blue-400 font-bold outline-none focus:border-white/20" value={logo} onChange={e => isHome ? setHomeLogo(e.target.value) : setAwayLogo(e.target.value)} placeholder="HTTPS://IMAGE.URL/LOGO.PNG" />
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="space-y-4 p-5 bg-white/5 rounded-[2.5rem] border border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">📋 Paste Roster</h4>
                    <p className="text-[9px] text-slate-500 px-1">Go to any roster website, select and copy the player list, then paste it here.</p>
                    <textarea className="w-full bg-black/40 border border-white/10 p-3.5 rounded-xl text-[10px] text-slate-300 font-mono outline-none focus:border-cyan-500/40 resize-none" rows={6} placeholder="Paste copied roster text here..." value={isHome ? pasteRosterHome : pasteRosterAway} onChange={e => isHome ? setPasteRosterHome(e.target.value) : setPasteRosterAway(e.target.value)} />
                    <button onClick={() => handlePasteSync(team)} disabled={isPasteSyncing || !(isHome ? pasteRosterHome : pasteRosterAway).trim()} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isPasteSyncing || !(isHome ? pasteRosterHome : pasteRosterAway).trim() ? 'bg-slate-800 text-slate-600' : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg border border-cyan-400/30'}`}>
                      {isPasteSyncing ? <span className="flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'0ms'}}/><span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'150ms'}}/><span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'300ms'}}/></span> : '📋 Import Roster'}
                    </button>
                  </section>
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">Manual Player Entry</h4>
                    <div className="flex flex-col gap-3 p-5 bg-black/40 rounded-[2rem] border border-white/10 shadow-inner">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-1 space-y-1">
                          <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Number</label>
                          <input className="w-full bg-black/60 border border-white/10 rounded-xl py-3 text-center text-xs font-black text-white outline-none focus:border-white/30" placeholder="#" value={manualData.number} onChange={e => setManualData({...manualData, number: e.target.value})} />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Full Name</label>
                          <input className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white uppercase outline-none focus:border-white/30" placeholder="E.G. CONNOR MCDAVID" value={manualData.name} onChange={e => setManualData({...manualData, name: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-1 space-y-1">
                          <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Position</label>
                          <select className="w-full bg-black/60 border border-white/10 rounded-xl py-3 px-4 text-xs font-black text-slate-300 outline-none appearance-none cursor-pointer" value={manualData.pos} onChange={e => setManualData({...manualData, pos: e.target.value})}>
                            <option value="LW">LW</option><option value="RW">RW</option><option value="C">C</option><option value="D">D</option><option value="G">G</option>
                          </select>
                        </div>
                        <div className="col-span-1 space-y-1">
                          <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Line/Pair</label>
                          <select className="w-full bg-black/60 border border-white/10 rounded-xl py-3 px-4 text-xs font-black text-slate-300 outline-none appearance-none cursor-pointer" value={manualData.line} onChange={e => setManualData({...manualData, line: e.target.value})}>
                            <option value="1">Line 1</option><option value="2">Line 2</option><option value="3">Line 3</option><option value="4">Line 4</option>
                            <option value="P1">Pair 1</option><option value="P2">Pair 2</option><option value="P3">Pair 3</option>
                            <option value="G1">Goalie 1</option><option value="G2">Goalie 2</option>
                          </select>
                        </div>
                        <div className="col-span-2 flex flex-col justify-end">
                          <button onClick={() => handleAddPlayerQuickly(team)} className={`w-full py-3.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${isHome ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'} text-white shadow-lg active:scale-95`}>ADD PLAYER</button>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">Numerical Roster ({roster.length})</h4>
                    <div className="space-y-2">
                      {roster.map((p, idx) => (
                        <div key={`${team}-p-${idx}`} className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/5 hover:border-white/20 transition-all group">
                          <input className={`w-12 bg-black/40 border border-white/10 rounded-xl py-2 text-center text-[12px] font-black outline-none focus:border-white/30 ${isHome ? 'text-blue-400' : 'text-red-400'}`} value={p.number} onChange={e => handleUpdatePlayerInline(team, idx, 'number', e.target.value)} />
                          <input className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-white uppercase px-1" value={p.name} onChange={e => handleUpdatePlayerInline(team, idx, 'name', e.target.value)} placeholder="PLAYER NAME" />
                          <select className="bg-black/40 text-[9px] font-black text-slate-500 rounded-lg px-2 py-1.5 border-none appearance-none outline-none cursor-pointer" value={p.position} onChange={e => handleUpdatePlayerInline(team, idx, 'position', e.target.value)}>
                            <option value="LW">LW</option><option value="RW">RW</option><option value="C">C</option><option value="LD">LD</option><option value="RD">RD</option><option value="D">D</option><option value="G">G</option>
                          </select>
                          <select className="bg-black/40 text-[9px] font-black text-slate-500 rounded-lg px-2 py-1.5 border-none appearance-none outline-none cursor-pointer" value={p.line || '1'} onChange={e => handleUpdatePlayerInline(team, idx, 'line', e.target.value)}>
                            <option value="1">L1</option><option value="2">L2</option><option value="3">L3</option><option value="4">L4</option>
                            <option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option>
                            <option value="G1">G1</option><option value="G2">G2</option>
                          </select>
                          <button onClick={() => isHome ? setHomeRoster(prev => prev.filter((_, i) => i !== idx)) : setAwayRoster(prev => prev.filter((_, i) => i !== idx))} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-white hover:bg-red-600 transition-all opacity-40 group-hover:opacity-100 font-black text-sm shrink-0">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-8 sm:p-10 border-t border-white/10 bg-black/80 backdrop-blur-md flex justify-center shrink-0">
          <button onClick={() => setShowSetup(false)} className="w-full max-w-lg py-6 bg-white text-black rounded-2xl font-black uppercase tracking-[0.6em] text-[11px] shadow-2xl active:scale-95 transition-all hover:bg-slate-200">Commit Lineups</button>
        </div>
      </div>
    )}

    {ADS_ENABLED && <AdBanner position="bottom" onContactClick={() => navigate('/advertise')} />}
    
    {/* Footer */}
    <div className="flex flex-wrap items-center justify-center gap-3 py-3 bg-black/30 border-t border-white/10 px-4">
      <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Terms</a>
      <span className="text-slate-600">·</span>
      <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Privacy</a>
      <span className="text-slate-600">·</span>
      <button onClick={() => navigate('/contact')} className="text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors px-4 py-1.5 rounded-full">✉ Contact Us</button>
      <span className="text-slate-600">·</span>
      <button onClick={() => navigate('/about')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">About</button>
      <span className="text-slate-600">·</span>
      <button onClick={() => navigate('/advertise')} className="text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors">📢 Advertise</button>
      <span className="text-slate-600">·</span>
      {!isAdmin && (
        <button onClick={handleManageSubscription} className="text-xs font-bold text-slate-400 hover:text-white transition-colors px-4 py-1.5 rounded-full border border-white/10 hover:border-white/20">⚙ Manage Subscription</button>
      )}
    </div>

    {/* Goal line popup via portal */}
    {pendingGoal !== null && createPortal(
      <GoalLinePopup pendingGoal={pendingGoal} homeName={homeName} awayName={awayName} homeRoster={homeRoster} awayRoster={awayRoster} myTeam={myTeam} onConfirm={confirmGoal} onCancel={() => setPendingGoal(null)} />,
      document.body
    )}

    {/* Faceoff popup via portal */}
    {pendingFaceoff !== null && createPortal(
      <FaceoffPopup pendingFaceoff={pendingFaceoff} homeName={homeName} awayName={awayName} homeRoster={homeRoster} awayRoster={awayRoster} myTeam={myTeam} onConfirm={confirmFaceoff} onCancel={() => setPendingFaceoff(null)} />,
      document.body
    )}

    {/* Zone entry popup via portal */}
    {pendingEntry !== null && createPortal(
      <EntryPopup pendingEntry={pendingEntry} onConfirm={confirmEntry} onCancel={() => setPendingEntry(null)} />,
      document.body
    )}

    {/* Penalty popup via portal */}
    {pendingPenalty !== null && createPortal(
      <PenaltyPopup pendingPenalty={pendingPenalty} homeName={homeName} awayName={awayName} homeRoster={homeRoster} awayRoster={awayRoster} onConfirm={confirmPenalty} onCancel={() => setPendingPenalty(null)} />,
      document.body
    )}

    {/* New Game confirm */}
    {showNewGameConfirm && (
      <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
        <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="text-4xl mb-4">🔄</div>
          <h3 className="text-white font-black text-xl mb-2">Start a New Game?</h3>
          <p className="text-slate-400 text-sm mb-6">This will clear all events, rosters, and team names. Export your report first!</p>
          <div className="flex gap-3">
            <button onClick={() => setShowNewGameConfirm(false)} className="flex-1 py-3 border border-white/10 hover:border-white/20 text-white font-bold rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={confirmNewGame} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-sm transition-colors">Start New Game</button>
          </div>
        </div>
      </div>
    )}

    <PlayerStats isOpen={showPlayerStats} onClose={() => setShowPlayerStats(false)} events={events} homeRoster={homeRoster} awayRoster={awayRoster} homeName={homeName} awayName={awayName} />

    {/* End Game modal */}
    {showEndGame && (
      <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-sm flex items-center justify-center px-4">
        <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-white font-black text-2xl mb-2">End Game</h3>
            <p className="text-slate-400 text-sm">Here's your game summary</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">{homeName}</p>
              <p className="text-3xl font-black text-white">{events.filter(e => e.team === Team.HOME && e.type === EventType.GOAL).length}</p>
              <p className="text-xs text-slate-500">Goals</p>
              <p className="text-lg font-black text-blue-300 mt-1">{events.filter(e => e.team === Team.HOME && e.type === EventType.SHOT).length}</p>
              <p className="text-xs text-slate-500">Shots</p>
            </div>
            <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-3 text-center">
              <p className="text-xs text-red-400 font-bold uppercase tracking-wider mb-1">{awayName}</p>
              <p className="text-3xl font-black text-white">{events.filter(e => e.team === Team.AWAY && e.type === EventType.GOAL).length}</p>
              <p className="text-xs text-slate-500">Goals</p>
              <p className="text-lg font-black text-red-300 mt-1">{events.filter(e => e.team === Team.AWAY && e.type === EventType.SHOT).length}</p>
              <p className="text-xs text-slate-500">Shots</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-6 text-center">
            <div className="bg-white/5 rounded-xl p-2"><p className="text-lg font-black text-white">{events.length}</p><p className="text-xs text-slate-500">Total Events</p></div>
            <div className="bg-white/5 rounded-xl p-2"><p className="text-lg font-black text-white">{Math.floor(events.filter(e => e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS).length / 2)}</p><p className="text-xs text-slate-500">Faceoffs</p></div>
            <div className="bg-white/5 rounded-xl p-2"><p className="text-lg font-black text-white">{currentPeriod}</p><p className="text-xs text-slate-500">Periods</p></div>
          </div>
          {/* Export buttons */}
          <p className="text-xs text-slate-400 font-bold text-center mb-3">Download your reports:</p>
          <div className="flex gap-2 mb-4">
            <button onClick={handleExportPDF} className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white font-black rounded-xl text-xs transition-colors">📥 PDF</button>
            <button onClick={handleExportExcel} className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white font-black rounded-xl text-xs transition-colors">📊 Excel</button>
            <button onClick={handleExportHTML} className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white font-black rounded-xl text-xs transition-colors">🌐 HTML</button>
          </div>

          {/* Save to history */}
          <button
            onClick={() => handleSaveReport(false)}
            disabled={savingReport}
            className="w-full py-3 bg-blue-700/40 hover:bg-blue-600/50 border border-blue-500/30 text-blue-300 font-black rounded-xl text-sm transition-colors mb-4"
          >
            {savingReport ? 'Saving…' : '💾 Save game to history'}
          </button>

          {/* Warning */}
          <div className="bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-red-400 text-center font-bold">⚠️ Once you end the game, all tracking data will be cleared. Save or download your reports first!</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={() => setShowEndGame(false)} className="flex-1 py-3 border border-white/10 hover:border-white/20 text-white font-bold rounded-xl text-sm transition-colors">Keep Tracking</button>
            <button onClick={handleConfirmEndGame} className="flex-1 py-3 bg-red-700 hover:bg-red-600 text-white font-black rounded-xl text-sm transition-colors">End Game</button>
          </div>
        </div>
      </div>
    )}
  </ThemedBackground>
  );
};

export default App;
