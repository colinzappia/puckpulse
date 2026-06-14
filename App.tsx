import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GameEvent, EventType, Team, TeamStats, Zone, Player, PenaltyType } from './types';
import Header from './components/Header';
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
import { useAuth, UserButton, useClerk, useUser } from '@clerk/clerk-react';
import { generateNarrative, fetchRosterByAI } from './services/geminiService';
import { downloadPDFReport, downloadExcelReport, downloadHTMLExport } from './services/exportService';
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
interface GoalLinePopupProps {
  pendingGoal: { team: any; playerNumber: string; x: number; y: number };
  homeName: string;
  awayName: string;
  onConfirm: (line?: string) => void;
}

const GoalLinePopup: React.FC<GoalLinePopupProps> = ({ pendingGoal, homeName, awayName, onConfirm }) => {
  const scoringTeamName = pendingGoal.team === Team.HOME ? homeName : awayName;
  const isHome = pendingGoal.team === Team.HOME;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#0f1620', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '1.25rem', padding: '1.75rem', width: '100%', maxWidth: '380px', boxShadow: '0 30px 60px rgba(0,0,0,0.9)' }}>
        
        {/* Spinning red light */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', width: '72px', height: '72px', margin: '0 auto 0.875rem' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#dc2626', opacity: 0.35, animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }} />
            <div style={{ position: 'absolute', inset: '5px', borderRadius: '50%', background: '#ef4444', animation: 'spin 0.75s linear infinite' }} />
            <div style={{ position: 'absolute', inset: '14px', borderRadius: '50%', background: '#fca5a5' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white' }} />
            </div>
          </div>
          <div style={{ color: 'white', fontWeight: 900, fontSize: '1.5rem', marginBottom: '0.375rem', letterSpacing: '-0.02em' }}>GOAL!</div>
          <div style={{ display: 'inline-block', padding: '0.25rem 1rem', borderRadius: '999px', background: isHome ? '#2563eb' : '#dc2626', color: 'white', fontSize: '0.8rem', fontWeight: 900, marginBottom: '0.625rem' }}>
            {scoringTeamName}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Which {scoringTeamName} line was on ice?</div>
        </div>

        {/* Forward lines */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
          {['Line 1', 'Line 2', 'Line 3', 'Line 4'].map(line => (
            <button key={line} onClick={() => onConfirm(`${scoringTeamName} ${line}`)}
              style={{ padding: '1rem 0.5rem', background: 'rgba(21,128,61,0.25)', border: '1px solid rgba(34,197,94,0.35)', color: 'white', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.875rem', cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
              {scoringTeamName} {line}
            </button>
          ))}
        </div>

        {/* Defense pairings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.625rem', marginBottom: '0.875rem' }}>
          {['Pair 1', 'Pair 2', 'Pair 3'].map(pair => (
            <button key={pair} onClick={() => onConfirm(`${scoringTeamName} ${pair}`)}
              style={{ padding: '0.875rem 0.25rem', background: 'rgba(29,78,216,0.25)', border: '1px solid rgba(59,130,246,0.35)', color: 'white', fontWeight: 900, borderRadius: '0.875rem', fontSize: '0.75rem', cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
              {pair}
            </button>
          ))}
        </div>

        {/* Skip */}
        <button onClick={() => onConfirm(undefined)}
          style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontWeight: 700, borderRadius: '0.875rem', fontSize: '0.875rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
          Skip — log without line info
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [showLanding, setShowLanding] = useState(() => {
    return sessionStorage.getItem('tch_launched') !== 'true';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showAdvertise, setShowAdvertise] = useState(false);
  const [showPlayerStats, setShowPlayerStats] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showFaceoffPanel, setShowFaceoffPanel] = useState(false);
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

  const { isSignedIn, userId } = useAuth();
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
  const [fowHomeCenter, setFowHomeCenter] = useState<string>('');
  const [fowAwayCenter, setFowAwayCenter] = useState<string>('');
  const [visibleTypes, setVisibleTypes] = useState<EventType[]>([
    EventType.GOAL, EventType.SHOT, EventType.TURNOVER, EventType.PENALTY,
    EventType.BLOCK, EventType.FACEOFF_WIN, EventType.FACEOFF_LOSS,
    EventType.PP_SHOT_FOR, EventType.PP_SHOT_AGAINST,
    EventType.HIT
  ]);
  const [homeName, setHomeName] = useState(() => {
    try { return sessionStorage.getItem('tch_homeName') || 'HOME'; } catch { return 'HOME'; }
  });
  const [awayName, setAwayName] = useState(() => {
    try { return sessionStorage.getItem('tch_awayName') || 'AWAY'; } catch { return 'AWAY'; }
  });
  const [homeLogo, setHomeLogo] = useState("");
  const [awayLogo, setAwayLogo] = useState("");
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
  const [isRosterSwapped, setIsRosterSwapped] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);

  const toolbarButtons = useMemo(() => [
    { type: EventType.SHOT, label: 'SHOT', color: 'bg-cyan-600', dotColor: '#06b6d4' },
    { type: EventType.GOAL, label: 'GOAL', color: 'bg-green-600', dotColor: '#22c55e' },
    { type: EventType.BLOCK, label: 'BLOCK', color: 'bg-slate-600', dotColor: '#94a3b8' },
    { type: EventType.PP_SHOT_FOR, label: 'PP SHOT', color: 'bg-yellow-500', dotColor: '#eab308' },
    { type: EventType.PP_SHOT_AGAINST, label: 'PK SHOT', color: 'bg-pink-500', dotColor: '#ec4899' },
    { type: EventType.TURNOVER, label: 'TO', color: 'bg-orange-600', dotColor: '#f97316' },
    { type: EventType.PENALTY, label: 'PIM', color: 'bg-red-600', dotColor: '#ef4444' },
    { type: EventType.HIT, label: 'HIT', color: 'bg-purple-600', dotColor: '#a855f7' },
  ], []);

  useEffect(() => {
    if (!visibleTypes.includes(mapPlotType)) setVisibleTypes(prev => [...prev, mapPlotType]);
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
    try {
      sessionStorage.setItem('tch_homeName', homeName);
      sessionStorage.setItem('tch_awayName', awayName);
    } catch {}
  }, [homeName, awayName]);

  const sortByNumber = (roster: Player[]) => [...roster].sort((a, b) => {
    const aIsG = a.position?.toUpperCase() === 'G' ? 0 : 1;
    const bIsG = b.position?.toUpperCase() === 'G' ? 0 : 1;
    if (aIsG !== bIsG) return aIsG - bIsG;
    return (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0);
  });

  const centers = useMemo(() => ({
    home: homeRoster.filter(p => p.position?.toUpperCase().includes('C')),
    away: awayRoster.filter(p => p.position?.toUpperCase().includes('C'))
  }), [homeRoster, awayRoster]);

  const getStatsForRange = useCallback((team: Team, periodFilter?: number | 'total'): TeamStats & { turnovers: number, faceoffLosses: number, penaltiesCount: number } => {
    const teamEvents = events.filter(e => e.team === team && (periodFilter === 'total' || periodFilter === undefined || e.period === periodFilter));
    return {
      name: team === Team.HOME ? homeName : awayName,
      goals: teamEvents.filter(e => e.type === EventType.GOAL).length,
      shots: teamEvents.filter(e => e.type === EventType.SHOT || e.type === EventType.GOAL || e.type === EventType.PP_SHOT_FOR).length,
      saves: teamEvents.filter(e => e.type === EventType.SAVE).length,
      hits: teamEvents.filter(e => e.type === EventType.HIT).length,
      pim: teamEvents.filter(e => e.type === EventType.PENALTY).length * 2,
      faceoffWins: teamEvents.filter(e => e.type === EventType.FACEOFF_WIN).length,
      faceoffLosses: teamEvents.filter(e => e.type === EventType.FACEOFF_LOSS).length,
      turnovers: teamEvents.filter(e => e.type === EventType.TURNOVER).length,
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

  const confirmGoal = useCallback((lineOnIce?: string) => {
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
      metadata: { shotQuality: quality, lineOnIce }
    };
    setEvents(prev => [...prev, newEvent]);
    setLastEvent({ type: EventType.GOAL, playerNumber: pNum, team });
    setPendingGoal(null);
  }, [pendingGoal, currentPeriod, getTeamZone]);

  const handlePlot = useCallback((x: number, y: number) => {
    if (mapPlotType === EventType.FACEOFF_WIN || mapPlotType === EventType.FACEOFF_LOSS) {
      if (!fowHomeCenter || !fowAwayCenter) {
        toast.error("Please select centers in the Faceoff Hub before plotting.");
        return;
      }
      // WIN = active team wins, LOSS = active team loses
      const homeWins = (activeTeam === Team.HOME && mapPlotType === EventType.FACEOFF_WIN) || (activeTeam === Team.AWAY && mapPlotType === EventType.FACEOFF_LOSS);
      setEvents(prev => [...prev,
        { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), gameTime: '20:00', period: currentPeriod, type: homeWins ? EventType.FACEOFF_WIN : EventType.FACEOFF_LOSS, team: Team.HOME, zone: getTeamZone(Team.HOME, x), playerNumber: fowHomeCenter, coordinates: { x, y } },
        { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() + 1, gameTime: '20:00', period: currentPeriod, type: homeWins ? EventType.FACEOFF_LOSS : EventType.FACEOFF_WIN, team: Team.AWAY, zone: getTeamZone(Team.AWAY, x), playerNumber: fowAwayCenter, coordinates: { x, y } }
      ]);
      // Keep panel open for quick successive faceoffs — user can close manually
      return;
    }

    if (mapPlotType === EventType.GOAL) {
      setPendingGoal({ x, y, team: activeTeam, playerNumber: playerNumber || '' });
      return;
    }

    const quality = mapPlotType === EventType.SHOT ? getShotQuality(x, y, activeTeam) : undefined;
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
      metadata: quality ? { shotQuality: quality } : undefined
    };
    setEvents(prev => [...prev, newEvent]);
    setLastEvent({ type: mapPlotType, playerNumber: playerNumber, team: activeTeam });
  }, [mapPlotType, fowHomeCenter, fowAwayCenter, activeTeam, playerNumber, currentPeriod, getTeamZone]);

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
    try { ['tch_homeRoster','tch_awayRoster','tch_homeName','tch_awayName'].forEach(k => sessionStorage.removeItem(k)); } catch {}
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
        number: p.number || '00', name: p.name, position: p.position || 'F',
        line: p.line || (p.position === 'G' ? 'G1' : p.position === 'D' ? 'P1' : '1'),
      }));
      if (players.length === 0) throw new Error('No players found in pasted text');
      if (isHome) { setHomeRoster(sortByNumber(players)); setPasteRosterHome(''); }
      else { setAwayRoster(sortByNumber(players)); setPasteRosterAway(''); }
      setSyncMessage('');
      alert(`✅ ${players.length} players imported successfully!`);
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
    try { ['tch_homeRoster','tch_awayRoster','tch_homeName','tch_awayName'].forEach(k => sessionStorage.removeItem(k)); } catch {}
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

  const handleUndo = () => setEvents(prev => prev.slice(0, -1));
  const handleRemoveEvent = (id: string) => setEvents(prev => prev.filter(e => e.id !== id));
  const handleUpdateEvent = (id: string, updates: Partial<GameEvent>) => setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  const selectPlayer = (num: string, team: Team) => { setActiveTeam(team); setPlayerNumber(num === playerNumber && activeTeam === team ? '' : num); };
  const toggleVisibleType = (type: EventType) => setVisibleTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  const toggleAllFilters = () => {
    const allTrackedTypes = [...toolbarButtons.map(b => b.type), EventType.FACEOFF_WIN];
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
    const p: Player = { number: data.number, name: data.name, position: data.pos || 'F', line: data.line };
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
        setRoster(sortByNumber(response.players));
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

  if (showLanding) return <LandingPage onLaunch={handleLaunch} onContact={() => { handleLaunch(); setTimeout(() => setShowContact(true), 100); }} onAdvertise={() => { handleLaunch(); setTimeout(() => setShowAdvertise(true), 100); }} onAbout={() => { handleLaunch(); setTimeout(() => setShowAbout(true), 100); }} />;
  if (!isSignedIn) return <AuthGate onAuthenticated={() => setIsAuthenticated(true)} />;

  const ADMIN_EMAILS = ['colinzappia@gmail.com'];
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
    <div className="flex flex-col min-h-screen bg-[#05070a] text-slate-200">
      <AdBanner position="top" onContactClick={() => setShowAdvertise(true)} />
      <Toaster position="top-center" richColors theme="dark" />
      
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Header 
          leftTeam={leftTeamDisplay} rightTeam={rightTeamDisplay} period={currentPeriod}
          onOpenSetup={() => setShowSetup(true)} onOpenManual={() => setShowManual(true)}
          onSetPeriod={setCurrentPeriod} onSwapSides={() => setIsRosterSwapped(!isRosterSwapped)}
          onNewGame={handleNewGame} onEndGame={handleEndGame} onOpenAbout={() => setShowAbout(true)} onBackToLanding={handleBackToLanding}
        />
        
        <main className="flex flex-col pb-20">
        {/* LIVE ROSTER LOGGING PANELS */}
        <div className={`flex w-full gap-px bg-white/5 border-b border-white/10 shrink-0 transition-all duration-500 overflow-hidden ${showLineups ? 'h-[420px] sm:h-[460px] md:h-[520px] opacity-100' : 'h-0 opacity-0 border-none'}`}>
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
                            if (p.position === 'F') { const fPlayers = playersOnLine.filter(pl => pl.position === 'F'); return fPlayers.indexOf(p) === posIdx; }
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
                            if (p.position === 'D') { const dPlayers = playersOnPair.filter(pl => pl.position === 'D' || pl.position === 'LD' || pl.position === 'RD'); return dPlayers.indexOf(p) === posIdx; }
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

        {/* RINK */}
        <div className="bg-black relative flex flex-col min-h-[420px] sm:min-h-[500px] md:min-h-[600px] shadow-inner overflow-hidden">
          <div className="w-full px-2 py-2 bg-white/5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 shadow-inner shrink-0">
            {/* Shot counters */}
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.5)]"></div>
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider">{homeName}</span>
                <span className="text-2xl sm:text-3xl font-black text-white italic leading-none">{stats.home.shots} <span className="text-[10px] font-bold text-slate-500">shots</span></span>
              </div>
            </div>

            {/* Home/Away/Hide Rosters */}
            <div className="flex flex-wrap items-center bg-white/5 p-1 rounded-xl border border-white/10 shrink-0 shadow-inner gap-1">
              <div className="flex">
                <button onClick={() => setActiveTeam(Team.HOME)} className={`px-4 sm:px-6 md:px-8 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-black uppercase transition-all ${activeTeam === Team.HOME ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{homeName}</button>
                <button onClick={() => setActiveTeam(Team.AWAY)} className={`px-4 sm:px-6 md:px-8 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-black uppercase transition-all ${activeTeam === Team.AWAY ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{awayName}</button>
              </div>
              <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />
              <button onClick={() => setShowLineups(!showLineups)} className={`px-4 md:px-6 py-2.5 md:py-3 rounded-lg text-[10px] md:text-xs font-black uppercase transition-all border ${showLineups ? 'bg-blue-600 text-white border-blue-400 shadow-lg' : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10'}`}>
                {showLineups ? 'HIDE ROSTERS' : 'SHOW ROSTERS'}
              </button>
            </div>

            {/* Away shot counter */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-wider">{awayName}</span>
                <span className="text-2xl sm:text-3xl font-black text-white italic leading-none">{stats.away.shots} <span className="text-[10px] font-bold text-slate-500">shots</span></span>
              </div>
              <div className="w-1.5 h-8 bg-red-600 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.5)]"></div>
            </div>
          </div>

          <div className="w-full px-2 py-3 bg-white/5 border-b border-white/10 flex flex-wrap items-center justify-center gap-3 shadow-2xl shrink-0">
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3">
              {toolbarButtons.map(btn => (
                <button key={btn.type} onClick={() => setMapPlotType(btn.type)} className={`px-3 sm:px-6 md:px-8 py-2.5 md:py-3 rounded-xl text-[10px] sm:text-[11px] md:text-xs font-black uppercase transition-all flex items-center justify-center shadow-lg active:scale-90 ${mapPlotType === btn.type ? `${btn.color} text-white ring-2 ring-white/20` : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>{btn.label}</button>
              ))}
              <button onClick={() => setShowFaceoffPanel(true)} className={`px-3 sm:px-6 md:px-8 py-2.5 md:py-3 rounded-xl text-[10px] sm:text-[11px] md:text-xs font-black uppercase transition-all flex items-center justify-center shadow-lg active:scale-90 bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-600/40`}>Faceoff Hub</button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {playerNumber && (
                <div className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${activeTeam === Team.HOME ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'bg-red-600/20 border-red-500/40 text-red-300'}`}>#{playerNumber}</div>
              )}

              <button onClick={handleUndo} className="p-3 md:p-4 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 active:bg-white/20 transition-all shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center p-3 sm:p-10 h-full">
            <div className={`w-full max-w-6xl aspect-[200/85] transition-all duration-700 rounded-[5rem] sm:rounded-[8.5rem] p-2 border-4 shadow-2xl ${activeTeam === Team.HOME ? 'border-blue-500/20' : 'border-red-500/20'}`}>
              <RinkChart events={events.filter(e => e.period === currentPeriod && visibleTypes.includes(e.type))} leftLogo={leftTeamDisplay.logo} rightLogo={rightTeamDisplay.logo} onPlot={handlePlot} onMoveEvent={handleMoveEvent} activeEventType={mapPlotType} />
            </div>
            <button onClick={() => setShowPlayerStats(true)} className="absolute bottom-4 right-4 sm:bottom-12 sm:right-12 flex items-center gap-2 bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-full shadow-xl border border-blue-400/30 transition-all active:scale-95 backdrop-blur-sm">
              <span>📊</span><span>Player Stats</span>
            </button>

          </div>
        </div>

        {/* FACEOFF INLINE PANEL */}
        {showFaceoffPanel && (
          <div className="w-full bg-[#0a0e14] border-b border-yellow-500/20 animate-in slide-in-from-top duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-yellow-400 font-black text-sm">🏒 Faceoff</span>
                <span className="text-xs text-slate-500">Select centres, choose WIN or LOSS, then tap a dot on the rink</span>
              </div>
              <button onClick={() => { setShowFaceoffPanel(false); if (mapPlotType === EventType.FACEOFF_WIN || mapPlotType === EventType.FACEOFF_LOSS) setMapPlotType(EventType.SHOT); }} className="text-slate-500 hover:text-white text-lg font-bold px-2">×</button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              {/* Home centre */}
              <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3">
                <p className="text-xs font-black text-blue-400 uppercase tracking-wider mb-2">{homeName} Centre</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {homeRoster.filter(p => p.position?.toUpperCase() === 'C').map(p => (
                    <button key={p.number} onClick={() => setFowHomeCenter(p.number)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all border ${fowHomeCenter === p.number ? 'bg-blue-600 text-white border-blue-400' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}>
                      #{p.number} {p.name.split(' ').pop()}
                    </button>
                  ))}
                  {homeRoster.filter(p => p.position?.toUpperCase() === 'C').length === 0 && (
                    <span className="text-xs text-slate-600">No centres found</span>
                  )}
                </div>
                {homeRoster.filter(p => p.position?.toUpperCase() !== 'C' && p.position?.toUpperCase() !== 'G').length > 0 && (
                  <select
                    onChange={e => e.target.value && setFowHomeCenter(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-400 outline-none"
                    value=""
                  >
                    <option value="">Other player...</option>
                    {homeRoster.filter(p => p.position?.toUpperCase() !== 'C' && p.position?.toUpperCase() !== 'G').map(p => (
                      <option key={p.number} value={p.number}>#{p.number} {p.name} ({p.position})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* WIN / LOSS — sets plot type then user taps rink */}
              <div className="flex flex-col gap-3 items-center">
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => { setMapPlotType(EventType.FACEOFF_WIN); }}
                    className={`py-4 font-black rounded-xl text-sm transition-all active:scale-95 shadow-lg border ${mapPlotType === EventType.FACEOFF_WIN ? 'bg-yellow-500 text-white border-yellow-300 ring-2 ring-yellow-300/40' : 'bg-yellow-600/30 text-yellow-300 border-yellow-500/30 hover:bg-yellow-600/50'}`}
                  >✓ {activeTeam === Team.HOME ? homeName : awayName} WIN</button>
                  <button
                    onClick={() => { setMapPlotType(EventType.FACEOFF_LOSS); }}
                    className={`py-4 font-black rounded-xl text-sm transition-all active:scale-95 shadow-lg border ${mapPlotType === EventType.FACEOFF_LOSS ? 'bg-slate-500 text-white border-slate-300 ring-2 ring-slate-300/40' : 'bg-slate-700/50 text-slate-300 border-slate-500/30 hover:bg-slate-600/50'}`}
                  >✗ {activeTeam === Team.HOME ? homeName : awayName} LOSS</button>
                </div>
                {(mapPlotType === EventType.FACEOFF_WIN || mapPlotType === EventType.FACEOFF_LOSS) && (
                  <p className="text-xs text-yellow-400 animate-pulse text-center">👆 Now tap a faceoff dot on the rink</p>
                )}
                {(!fowHomeCenter || !fowAwayCenter) && (
                  <p className="text-xs text-slate-600 text-center">Select both centres first</p>
                )}
              </div>

              {/* Away centre */}
              <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-3">
                <p className="text-xs font-black text-red-400 uppercase tracking-wider mb-2">{awayName} Centre</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {awayRoster.filter(p => p.position?.toUpperCase() === 'C').map(p => (
                    <button key={p.number} onClick={() => setFowAwayCenter(p.number)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all border ${fowAwayCenter === p.number ? 'bg-red-600 text-white border-red-400' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}>
                      #{p.number} {p.name.split(' ').pop()}
                    </button>
                  ))}
                  {awayRoster.filter(p => p.position?.toUpperCase() === 'C').length === 0 && (
                    <span className="text-xs text-slate-600">No centres found</span>
                  )}
                </div>
                {awayRoster.filter(p => p.position?.toUpperCase() !== 'C' && p.position?.toUpperCase() !== 'G').length > 0 && (
                  <select
                    onChange={e => e.target.value && setFowAwayCenter(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-400 outline-none"
                    value=""
                  >
                    <option value="">Other player...</option>
                    {awayRoster.filter(p => p.position?.toUpperCase() !== 'C' && p.position?.toUpperCase() !== 'G').map(p => (
                      <option key={p.number} value={p.number}>#{p.number} {p.name} ({p.position})</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MAP FILTERS */}
        <div className="w-full px-4 py-3 bg-black/40 border-b border-white/5 flex items-center justify-center gap-2 overflow-x-auto scrollbar-none shadow-inner">
          <button onClick={toggleAllFilters} className="shrink-0 px-4 py-2 rounded-xl bg-white/10 text-[9px] font-black uppercase text-slate-300 border border-white/10 active:scale-95 transition-all">
            {toolbarButtons.every(t => visibleTypes.includes(t.type)) ? 'Isolate' : 'Show All'}
          </button>
          <div className="flex items-center gap-2">
            {toolbarButtons.map(btn => {
              const isActive = visibleTypes.includes(btn.type);
              return (
                <button key={`filter-${btn.type}`} onClick={() => toggleVisibleType(btn.type)} className={`shrink-0 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border shadow-sm ${isActive ? 'bg-white/10 text-white border-white/20' : 'opacity-20 border-transparent bg-transparent'}`}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: (btn as any).dotColor }} />
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* DATA COMMAND CENTER */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 px-2 sm:px-4 md:px-6 mt-6">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)] animate-pulse"></div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-white italic">AI Coaching Intel</h3>
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
                <PlayByPlay events={events} homeName={homeName} awayName={awayName} onRemoveEvent={handleRemoveEvent} onUpdateEvent={handleUpdateEvent} />
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
                  <button onClick={() => {
                    if (isHome) { setHomeRoster([]); setHomeRosterUrl(''); setHomeSources([]); setPasteRosterHome(''); }
                    else { setAwayRoster([]); setAwayRosterUrl(''); setAwaySources([]); setPasteRosterAway(''); }
                  }} className="text-[9px] font-black text-slate-700 hover:text-red-500 uppercase transition-colors">Clear Roster</button>
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

    <UserManual isOpen={showManual} onClose={() => setShowManual(false)} />
    <AdBanner position="bottom" onContactClick={() => setShowAdvertise(true)} />
    
    {/* Footer */}
    <div className="flex flex-wrap items-center justify-center gap-3 py-3 bg-black/30 border-t border-white/10 px-4">
      <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Terms</a>
      <span className="text-slate-600">·</span>
      <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Privacy</a>
      <span className="text-slate-600">·</span>
      <button onClick={() => setShowContact(true)} className="text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors px-4 py-1.5 rounded-full">✉ Contact Us</button>
      <span className="text-slate-600">·</span>
      <button onClick={() => setShowAbout(true)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">About</button>
      <span className="text-slate-600">·</span>
      <button onClick={() => setShowAdvertise(true)} className="text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors">📢 Advertise</button>
      <span className="text-slate-600">·</span>
      {!isAdmin && (
        <button onClick={handleManageSubscription} className="text-xs font-bold text-slate-400 hover:text-white transition-colors px-4 py-1.5 rounded-full border border-white/10 hover:border-white/20">⚙ Manage Subscription</button>
      )}
    </div>

    {/* Goal line popup via portal */}
    {pendingGoal !== null && createPortal(
      <GoalLinePopup pendingGoal={pendingGoal} homeName={homeName} awayName={awayName} onConfirm={confirmGoal} />,
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
    {showContact && createPortal(<ContactPage onClose={() => setShowContact(false)} />, document.body)}
    {showAdvertise && createPortal(<AdvertisePage isOpen={showAdvertise} onClose={() => setShowAdvertise(false)} />, document.body)}
    {showAbout && createPortal(<AboutPage onClose={() => setShowAbout(false)} onContact={() => { setShowAbout(false); setShowContact(true); }} />, document.body)}

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
          <p className="text-xs text-slate-400 font-bold text-center mb-3">Download your reports before ending:</p>
          <div className="flex gap-2 mb-4">
            <button onClick={handleExportPDF} className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white font-black rounded-xl text-xs transition-colors">📥 PDF</button>
            <button onClick={handleExportExcel} className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white font-black rounded-xl text-xs transition-colors">📊 Excel</button>
            <button onClick={handleExportHTML} className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white font-black rounded-xl text-xs transition-colors">🌐 HTML</button>
          </div>

          {/* Warning */}
          <div className="bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-red-400 text-center font-bold">⚠️ Once you end the game, all tracking data will be cleared and cannot be recovered. Download your reports first!</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={() => setShowEndGame(false)} className="flex-1 py-3 border border-white/10 hover:border-white/20 text-white font-bold rounded-xl text-sm transition-colors">Keep Tracking</button>
            <button onClick={handleConfirmEndGame} className="flex-1 py-3 bg-red-700 hover:bg-red-600 text-white font-black rounded-xl text-sm transition-colors">End Game</button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};

export default App;
