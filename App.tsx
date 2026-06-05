import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GameEvent, EventType, Team, TeamStats, Zone, Player, PenaltyType } from './types';
import Header from './components/Header';
import RinkChart from './components/RinkChart';
import PlayByPlay from './components/PlayByPlay';
import CenterAnalytics from './components/CenterAnalytics';
import FaceoffSummary from './components/FaceoffSummary';
import UserManual from './components/UserManual';
import LandingPage from './components/LandingPage';
import AdBanner from './components/AdBanner';
import AuthGate from './components/AuthGate';
import PricingGate from './components/PricingGate';
import LegalPages from './components/LegalPages';
import ContactPage from './components/ContactPage';
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

export const getPeriodLabel = (p: number) => {
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
      className={`relative h-12 md:h-14 rounded-xl font-black flex flex-col items-center justify-center transition-all border group active:scale-95 touch-none ${isSelected ? (isHome ? 'bg-blue-600 border-blue-400 shadow-blue-500/40 shadow-xl' : 'bg-red-600 border-red-400 shadow-red-500/40 shadow-xl') : 'bg-black/30 border-white/5 text-slate-400 hover:bg-white/10'}`}
    >
      <span className="text-xs md:text-sm lg:text-base leading-none">#{p.number}</span>
      <span className="text-[6px] md:text-[7px] uppercase font-bold text-slate-500 truncate w-full px-1 text-center mt-0.5 group-hover:text-slate-300">
        {p.name.split(' ').pop()}
      </span>
      <div className={`absolute top-0.5 right-0.5 px-1 rounded-md text-[5px] font-black border ${p.position === 'C' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500' : 'bg-black/40 border-white/5 text-slate-600'}`}>
        {p.position}
      </div>
    </button>
  );
};

const DroppableSlot: React.FC<{ id: string, children: React.ReactNode, label: string, cols?: number, className?: string }> = ({ id, children, label, cols = 1, className = "" }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[6px] font-black text-slate-700 uppercase tracking-widest px-1">{label}</span>
      <div 
        ref={setNodeRef}
        className={`relative min-h-12 rounded-xl transition-all border border-dashed ${isOver ? 'bg-white/10 border-white/30 ring-2 ring-white/10' : 'bg-black/20 border-white/5'}`}
      >
        <div className={`grid gap-1 p-1 h-full`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {children}
        </div>
        {!React.Children.count(children) && !isOver && (
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <span className="text-[7px] font-black uppercase tracking-widest">{label}</span>
          </div>
        )}
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
  const { isSignedIn, userId } = useAuth();
  const { user } = useClerk();
  const { user: currentUser } = useUser();

  // Check subscription status when user signs in
  React.useEffect(() => {
    if (!isSignedIn || !user?.primaryEmailAddress?.emailAddress) return;
    
    // Check if returning from successful Stripe checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscribed') === 'true') {
      setIsSubscribed(true);
      setShowLanding(false);
      window.history.replaceState({}, '', '/');
      return;
    }

    // Verify subscription with Stripe
    const checkSub = async () => {
      setCheckingSubscription(true);
      try {
        const response = await fetch('/api/check-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            email: user.primaryEmailAddress.emailAddress,
          }),
        });
        const data = await response.json();
        if (data.isSubscribed) {
          setIsSubscribed(true);
        }
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
  const [breakdownFilter, setBreakdownFilter] = useState<number | 'total'>('total');
  
  const [summaries, setSummaries] = useState<Record<string, string>>({
    'total': "Game tracking active. Generate coaching analysis after logging more events."
  });
  
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
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: any) => {
    const { active } = event;
    const [type, team, number] = active.id.split('-');
    const roster = team === Team.HOME ? homeRoster : awayRoster;
    const player = roster.find(p => p.number === number);
    if (player) {
      setActiveDragPlayer({ player, team: team as Team });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragPlayer(null);
    const { active, over } = event;
    if (!over) return;

    const [activeType, activeTeam, activeNumber] = (active.id as string).split('-');
    const [overType, overTeam, overLine, overPos] = (over.id as string).split('-');

    // Only allow dragging within the same team's lineup
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

  const [showSetup, setShowSetup] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showFeed, setShowFeed] = useState(true);
  const [showLineups, setShowLineups] = useState(true);
  const [showFaceoffHub, setShowFaceoffHub] = useState(false); 

  const [fowHomeCenter, setFowHomeCenter] = useState<string>('');
  const [fowAwayCenter, setFowAwayCenter] = useState<string>('');
  
  const [visibleTypes, setVisibleTypes] = useState<EventType[]>([
    EventType.GOAL, 
    EventType.SHOT, 
    EventType.TURNOVER, 
    EventType.PENALTY, 
    EventType.BLOCK,
    EventType.FACEOFF_WIN, 
    EventType.FACEOFF_LOSS,
    EventType.PP_SHOT_FOR,
    EventType.PP_SHOT_AGAINST
  ]);
  
  const [homeName, setHomeName] = useState("HOME");
  const [awayName, setAwayName] = useState("AWAY");
  const [homeLogo, setHomeLogo] = useState("");
  const [awayLogo, setAwayLogo] = useState("");
  const [homeRosterUrl, setHomeRosterUrl] = useState("");
  const [awayRosterUrl, setAwayRosterUrl] = useState("");
  
  const [homeRoster, setHomeRoster] = useState<Player[]>([]);
  const [awayRoster, setAwayRoster] = useState<Player[]>([]);
  const [homeSources, setHomeSources] = useState<{ uri: string; title: string }[]>([]);
  const [awaySources, setAwaySources] = useState<{ uri: string; title: string }[]>([]);

  const [manualHome, setManualHome] = useState({ number: '', name: '', pos: 'F', line: '1' });
  const [manualAway, setManualAway] = useState({ number: '', name: '', pos: 'F', line: '1' });
  
  const [mapPlotType, setMapPlotType] = useState<EventType>(EventType.SHOT);
  const [isRosterSwapped, setIsRosterSwapped] = useState(false);

  const toolbarButtons = useMemo(() => [
    { type: EventType.SHOT, label: 'SHOT', color: 'bg-cyan-600', dotColor: '#06b6d4' },
    { type: EventType.GOAL, label: 'GOAL', color: 'bg-green-600', dotColor: '#22c55e' },
    { type: EventType.BLOCK, label: 'BLOCK', color: 'bg-slate-600', dotColor: '#94a3b8' },
    { type: EventType.PP_SHOT_FOR, label: 'PP SHOT', color: 'bg-yellow-500', dotColor: '#eab308' },
    { type: EventType.PP_SHOT_AGAINST, label: 'PK SHOT', color: 'bg-pink-500', dotColor: '#ec4899' },
    { type: EventType.TURNOVER, label: 'TO', color: 'bg-orange-600', dotColor: '#f97316' },
    { type: EventType.PENALTY, label: 'PIM', color: 'bg-red-600', dotColor: '#ef4444' },
  ], []);

  useEffect(() => {
    if (!visibleTypes.includes(mapPlotType)) {
      setVisibleTypes(prev => [...prev, mapPlotType]);
    }
  }, [mapPlotType]);

  const sortByNumber = (roster: Player[]) => {
    return [...roster].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
  };

  const centers = useMemo(() => ({
    home: homeRoster.filter(p => p.position?.toUpperCase().includes('C')),
    away: awayRoster.filter(p => p.position?.toUpperCase().includes('C'))
  }), [homeRoster, awayRoster]);

  const getStatsForRange = useCallback((team: Team, periodFilter?: number | 'total'): TeamStats & { turnovers: number, faceoffLosses: number, penaltiesCount: number } => {
    const teamEvents = events.filter(e => 
      e.team === team && (periodFilter === 'total' || periodFilter === undefined || e.period === periodFilter)
    );
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

  const stats = useMemo(() => ({
    home: getStatsForRange(Team.HOME),
    away: getStatsForRange(Team.AWAY)
  }), [getStatsForRange]);

  const handleManageSubscription = async () => {
    const email = currentUser?.primaryEmailAddress?.emailAddress;
    if (!email) return;
    try {
      const response = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Could not open subscription portal.');
      }
    } catch (err) {
      alert('Could not open subscription portal. Please contact support.');
    }
  };

  const handleNewGame = () => {
    const confirm = window.confirm('Start a new game? This will clear all current events and rosters. The current game will be saved for export first.');
    if (!confirm) return;
    // Clear game state
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
    sessionStorage.removeItem('tch_launched');
    sessionStorage.setItem('tch_launched', 'true');
  };

  const handleMoveEvent = (eventId: string, x: number, y: number) => {
    setEvents(prev => prev.map(e => 
      e.id === eventId 
        ? { ...e, coordinates: { x, y } }
        : e
    ));
  };

  const handlePasteSync = async (team: Team) => {
    const isHome = team === Team.HOME;
    const pasteText = isHome ? pasteRosterHome : pasteRosterAway;
    const teamName = isHome ? homeName : awayName;

    if (!pasteText.trim()) {
      alert('Please paste your roster text first.');
      return;
    }
    if (!teamName.trim()) {
      alert('Please enter a team name first.');
      return;
    }

    setIsPasteSyncing(true);
    setSyncMessage('Reading pasted roster...');
    try {
      const apiKey = (window as any).__GEMINI_API_KEY__ || process.env.GEMINI_API_KEY;
      const prompt = `You are a hockey roster parser.
      
Extract ALL players from the following pasted roster text for the team "${teamName}".

RULES:
- Only extract players from the text below. Do not add any players not mentioned.
- Extract jersey number, full name, and position for each player.
- Position: map to C, LW, RW, D, or G only.
- Line assignment: Forwards get 1,2,3,4. Defense get P1,P2,P3. Goalies get G1,G2.
- If jersey number is missing use "00".
- No duplicates.

PASTED TEXT:
${pasteText}

Respond with ONLY this JSON, no other text:
{"status":"OK","players":[{"number":"15","name":"Player Name","position":"C","line":"1"}]}`;

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
      });

      const text = response.text;
      if (!text) throw new Error('No response from AI');

      let parsed: any = null;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]); } catch {} }
      if (!parsed) { const stripped = text.replace(/\`\`\`json|\`\`\`/g, '').trim(); try { parsed = JSON.parse(stripped); } catch {} }
      if (!parsed) throw new Error('Could not parse response');

      const players: Player[] = (parsed.players || []).map((p: any) => ({
        number: p.number || '00',
        name: p.name,
        position: p.position || 'F',
        line: p.line || (p.position === 'G' ? 'G1' : p.position === 'D' ? 'P1' : '1'),
      }));

      if (players.length === 0) throw new Error('No players found in pasted text');

      if (isHome) {
        setHomeRoster(players);
        setPasteRosterHome('');
      } else {
        setAwayRoster(players);
        setPasteRosterAway('');
      }
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
      const narrative = await generateNarrative(breakdownFilter, hStats, aStats);
      setSummaries(prev => ({ ...prev, [breakdownFilter]: narrative }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const prepareExportData = () => {
    const maxPeriod = Math.max(...events.map(e => e.period), currentPeriod);
    return {
      homeName,
      awayName,
      homeLogo,
      awayLogo,
      events,
      stats: {
        home: getStatsForRange(Team.HOME),
        away: getStatsForRange(Team.AWAY)
      },
      summaries,
      maxPeriod
    };
  };

  const handleExportPDF = () => {
    downloadPDFReport(prepareExportData());
  };

  const handleExportExcel = () => {
    downloadExcelReport(prepareExportData());
  };

  const handleExportHTML = () => {
    downloadHTMLExport(prepareExportData());
  };

  const getPlayerFOStats = (num: string) => {
    const playerEvents = events.filter(e => e.playerNumber === num && (e.type === EventType.FACEOFF_WIN || e.type === EventType.FACEOFF_LOSS));
    const wins = playerEvents.filter(e => e.type === EventType.FACEOFF_WIN).length;
    const total = playerEvents.length;
    return total > 0 ? Math.round((wins / total) * 100) : 0;
  };

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

  const handlePlot = (x: number, y: number) => {
    const isHomeOnLeft = !isCurrentlySwapped;

    const getTeamZone = (team: Team, xCoord: number) => {
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
    };

    if (mapPlotType === EventType.FACEOFF_WIN || mapPlotType === EventType.FACEOFF_LOSS) {
      if (!fowHomeCenter || !fowAwayCenter) {
        toast.error("Please select centers in the Faceoff Hub before plotting.");
        return;
      }
      
      const isFowActive = mapPlotType === EventType.FACEOFF_WIN;
      const isHomeWin = (activeTeam === Team.HOME && isFowActive) || (activeTeam === Team.AWAY && !isFowActive);

      setEvents(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        gameTime: '20:00',
        period: currentPeriod,
        type: isHomeWin ? EventType.FACEOFF_WIN : EventType.FACEOFF_LOSS,
        team: Team.HOME,
        zone: getTeamZone(Team.HOME, x),
        playerNumber: fowHomeCenter,
        coordinates: { x, y }
      }, {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now() + 1,
        gameTime: '20:00',
        period: currentPeriod,
        type: isHomeWin ? EventType.FACEOFF_LOSS : EventType.FACEOFF_WIN,
        team: Team.AWAY,
        zone: getTeamZone(Team.AWAY, x),
        playerNumber: fowAwayCenter,
        coordinates: { x, y }
      }]);
      return;
    }

    setEvents(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      gameTime: '20:00',
      period: currentPeriod,
      type: mapPlotType,
      team: activeTeam,
      zone: getTeamZone(activeTeam, x),
      playerNumber: playerNumber || undefined,
      coordinates: { x, y }
    }]);
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
    
    // Prevent duplicate numbers
    if (roster.some(p => p.number === data.number)) {
      toast.error(`Player #${data.number} already exists on this roster.`);
      return;
    }

    const p: Player = { number: data.number, name: data.name, position: data.pos || 'F', line: data.line };
    if (isHome) {
      setHomeRoster(sortByNumber([...homeRoster, p]));
      setManualHome({ number: '', name: '', pos: 'F', line: '1' });
    } else {
      setAwayRoster(sortByNumber([...awayRoster, p]));
      setManualAway({ number: '', name: '', pos: 'F', line: '1' });
    }
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

    if (!teamName || teamName === "HOME" || teamName === "AWAY") {
        alert("Please enter a valid team name before syncing.");
        return;
    }

    setSyncing(true);
    try {
      const response = await fetchRosterByAI({ teamName, rosterUrl: rosterUrl || undefined });
      if (response.status === 'OK' && response.players.length > 0) {
        setRoster(sortByNumber(response.players));
        if (response.sources) setSources(response.sources);
      } else if (response.status === 'ERROR') {
        alert(`AI Sync Error: ${response.reason || 'Extraction failed'}`);
      } else {
        alert(`AI Sync failed: ${response.reason || 'Check logs for details'}`);
      }
    } catch (error: any) {
      console.error("Sync button error:", error);
      alert(`Sync failed: ${error.message || 'Unknown error occurred.'}`);
    } finally {
      clearInterval(msgInterval);
      setSyncMessage('');
      setSyncing(false);
    }
  };

  const orderedTeams = useMemo(() => {
    return isCurrentlySwapped ? [Team.AWAY, Team.HOME] : [Team.HOME, Team.AWAY];
  }, [isCurrentlySwapped]);

  // ── AUTO-SAVE GAME STATE ─────────────────────────────────
  const SAVE_KEY = 'tch_game_state';

  // Restore saved game on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.events?.length > 0 || state.homeName !== 'HOME') {
          const restore = window.confirm('You have a saved game in progress. Would you like to restore it?');
          if (restore) {
            if (state.events) setEvents(state.events);
            if (state.homeName) setHomeName(state.homeName);
            if (state.awayName) setAwayName(state.awayName);
            if (state.homeRoster) setHomeRoster(state.homeRoster);
            if (state.awayRoster) setAwayRoster(state.awayRoster);
            if (state.currentPeriod) setCurrentPeriod(state.currentPeriod);
          }
        }
      }
    } catch {}
  }, [isSubscribed]);

  // Auto-save whenever game state changes
  React.useEffect(() => {
    if (!isSubscribed && !isAdmin) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        events, homeName, awayName, homeRoster, awayRoster, currentPeriod,
        savedAt: new Date().toISOString()
      }));
    } catch {}
  }, [events, homeName, awayName, homeRoster, awayRoster, currentPeriod, isSubscribed]);

  React.useEffect(() => {
    const handlePopState = () => { sessionStorage.removeItem('tch_launched'); setShowLanding(true); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLaunch = () => {
    window.history.pushState({ page: 'app' }, '', '');
    sessionStorage.setItem('tch_launched', 'true');
    setShowLanding(false);
  };

  if (showLanding) {
    return <LandingPage onLaunch={handleLaunch} />;
  }

  if (!isSignedIn) {
    return <AuthGate onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  // Admin bypass — these emails skip the paywall
  const ADMIN_EMAILS = ['colinzappia@gmail.com'];
  const userEmail = currentUser?.primaryEmailAddress?.emailAddress?.toLowerCase() || 
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';
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

  if (!isSubscribed && !isAdmin) {
    return <PricingGate onSubscribed={() => setIsSubscribed(true)} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#05070a] text-slate-200 overflow-x-hidden">
      <AdBanner position="top" onContactClick={() => setShowContact(true)} />
      <Toaster position="top-center" richColors theme="dark" />
      
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Header 
          leftTeam={leftTeamDisplay} 
          rightTeam={rightTeamDisplay} 
          period={currentPeriod} 
          onOpenSetup={() => setShowSetup(true)} 
          onOpenManual={() => setShowManual(true)}
          onSetPeriod={setCurrentPeriod}
          onSwapSides={() => setIsRosterSwapped(!isRosterSwapped)}
          onNewGame={handleNewGame}
        />
        
        <main className="flex flex-col pb-20">
        
        {/* LIVE ROSTER LOGGING PANELS */}
        <div className={`flex w-full gap-px bg-white/5 border-b border-white/10 shrink-0 transition-all duration-500 overflow-hidden ${showLineups ? 'h-80 sm:h-80 md:h-96 lg:h-[420px] opacity-100' : 'h-0 opacity-0 border-none'}`}>
          {orderedTeams.map(team => {
            const isHome = team === Team.HOME;
            const roster = isHome ? homeRoster : awayRoster;
            const name = isHome ? homeName : awayName;

            return (
              <div key={team} className={`flex-1 flex flex-col min-w-0 ${isHome ? 'bg-blue-900/10 border-r border-white/5' : 'bg-red-900/10'}`}>
                <div className={`px-4 py-3 ${isHome ? 'bg-blue-900/30' : 'bg-red-900/30'} flex flex-col gap-3 border-b border-white/10 shrink-0`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className={`w-2 h-2 rounded-full ${isHome ? 'bg-blue-500' : 'bg-red-500'} animate-pulse`}></div>
                      <span className={`text-[10px] md:text-xs font-black ${isHome ? 'text-blue-400' : 'text-red-400'} uppercase truncate tracking-widest`}>
                        {name} LINEUP
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{roster.length} Dressed</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-none p-2 space-y-5">
                  {/* OFFENSIVE LINES */}
                  <div className="space-y-3">
                    <h5 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] px-1 border-b border-white/5 pb-1">Offensive Lines</h5>
                    {['1', '2', '3', '4'].map(lineNum => (
                      <div key={`line-${lineNum}`} className="space-y-0.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[7px] font-black text-slate-500 uppercase">Line {lineNum}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {['LW', 'C', 'RW'].map((pos, posIdx) => {
                            const playersOnLine = roster.filter(p => p.line === lineNum);
                            const playersInThisSlot = playersOnLine.filter(p => {
                              if (p.position === pos) return true;
                              if (p.position === 'F') {
                                const fPlayers = playersOnLine.filter(pl => pl.position === 'F');
                                return fPlayers.indexOf(p) === posIdx;
                              }
                              return false;
                            });
                            return (
                              <DroppableSlot key={pos} id={`line-${team}-${lineNum}-${pos}`} label={pos}>
                                {playersInThisSlot.map(p => (
                                  <DraggablePlayer 
                                    key={`${team}-${p.number}`} 
                                    p={p} 
                                    team={team} 
                                    isHome={isHome} 
                                    isSelected={playerNumber === p.number && activeTeam === team} 
                                    onSelect={selectPlayer}
                                  />
                                ))}
                              </DroppableSlot>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* DEFENSIVE PAIRINGS */}
                  <div className="space-y-3">
                    <h5 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] px-1 border-b border-white/5 pb-1">Defensive Pairings</h5>
                    {['P1', 'P2', 'P3'].map(pairNum => (
                      <div key={`pair-${pairNum}`} className="space-y-0.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[7px] font-black text-slate-500 uppercase">Pair {pairNum}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {['LD', 'RD'].map((pos, posIdx) => {
                            const playersOnPair = roster.filter(p => p.line === pairNum);
                            const playersInThisSlot = playersOnPair.filter(p => {
                              if (p.position === pos) return true;
                              if (p.position === 'D') {
                                const dPlayers = playersOnPair.filter(pl => pl.position === 'D');
                                return dPlayers.indexOf(p) === posIdx;
                              }
                              return false;
                            });
                            return (
                              <DroppableSlot key={pos} id={`line-${team}-${pairNum}-${pos}`} label={pos}>
                                {playersInThisSlot.map(p => (
                                  <DraggablePlayer 
                                    key={`${team}-${p.number}`} 
                                    p={p} 
                                    team={team} 
                                    isHome={isHome} 
                                    isSelected={playerNumber === p.number && activeTeam === team} 
                                    onSelect={selectPlayer}
                                  />
                                ))}
                              </DroppableSlot>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* GOALIES */}
                  <div className="space-y-3">
                    <h5 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] px-1 border-b border-white/5 pb-1">Goalies</h5>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['G1', 'G2'].map(goalieNum => (
                        <DroppableSlot 
                          key={goalieNum} 
                          id={`line-${team}-${goalieNum}-G`} 
                          label={goalieNum === 'G1' ? 'Starter' : 'Backup'}
                        >
                          {roster.filter(p => p.line === goalieNum).map(p => (
                            <DraggablePlayer 
                              key={`${team}-${p.number}`} 
                              p={p} 
                              team={team} 
                              isHome={isHome} 
                              isSelected={playerNumber === p.number && activeTeam === team} 
                              onSelect={selectPlayer}
                            />
                          ))}
                        </DroppableSlot>
                      ))}
                    </div>
                  </div>

                  {/* OTHERS / UNASSIGNED */}
                  {roster.filter(p => !['1', '2', '3', '4', 'P1', 'P2', 'P3', 'G1', 'G2'].includes(p.line || '')).length > 0 && (
                    <div className="space-y-1.5">
                      <h5 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] px-1 border-b border-white/5 pb-1">Others</h5>
                      <DroppableSlot id={`line-${team}-unassigned`} label="Bench" cols={2}>
                        {roster.filter(p => !['1', '2', '3', '4', 'P1', 'P2', 'P3', 'G1', 'G2'].includes(p.line || '')).map(p => (
                          <DraggablePlayer 
                            key={`${team}-${p.number}`} 
                            p={p} 
                            team={team} 
                            isHome={isHome} 
                            isSelected={playerNumber === p.number && activeTeam === team} 
                            onSelect={selectPlayer}
                          />
                        ))}
                      </DroppableSlot>
                    </div>
                  )}

                  {/* NO ROSTER PLACEHOLDER REMOVED */}
                </div>
              </div>
            );
          })}
        </div>

        {/* FACEOFF HUB */}
        {showFaceoffHub && (
          <div className="w-full px-4 py-6 bg-slate-900/60 border-b border-white/10 flex flex-col gap-6 animate-in slide-in-from-top duration-300">
            <div className="flex flex-col sm:flex-row gap-6 justify-center max-w-7xl mx-auto w-full">
              <div className="flex-1 flex flex-col gap-3 p-5 bg-black/40 border border-blue-500/20 rounded-[2.5rem] shadow-xl">
                <div className="flex justify-between items-center px-2">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                     <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">{homeName} CENTER</span>
                   </div>
                   {fowHomeCenter && <span className="text-[10px] font-black text-white italic tracking-tighter">{getPlayerFOStats(fowHomeCenter)}% WINS</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {centers.home.map(p => (
                    <button key={`fo-home-${p.number}`} onClick={() => setFowHomeCenter(p.number)} className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-all border active:scale-95 ${fowHomeCenter === p.number ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-500/20' : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10'}`}>#{p.number}</button>
                  ))}
                  <select className="flex-1 min-w-[120px] bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-black text-slate-300 outline-none" value={fowHomeCenter} onChange={(e) => setFowHomeCenter(e.target.value)}>
                    <option value="">OTHER...</option>
                    {homeRoster.filter(p => p.position?.toUpperCase() !== 'G').map(p => <option key={p.number} value={p.number}>#{p.number} {p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-5 px-4">
                <div className="flex bg-black/60 p-2 rounded-[2rem] border border-white/10 shadow-inner">
                  <button onClick={() => setMapPlotType(EventType.FACEOFF_WIN)} className={`px-8 py-4 rounded-2xl text-[11px] font-black uppercase transition-all active:scale-90 ${mapPlotType === EventType.FACEOFF_WIN ? 'bg-yellow-600 text-white shadow-[0_0_25px_rgba(202,138,4,0.5)] border border-yellow-400' : 'text-slate-600 hover:text-white'}`}>WIN</button>
                  <button onClick={() => setMapPlotType(EventType.FACEOFF_LOSS)} className={`px-8 py-4 rounded-2xl text-[11px] font-black uppercase transition-all active:scale-90 ${mapPlotType === EventType.FACEOFF_LOSS ? 'bg-purple-600 text-white shadow-[0_0_25px_rgba(147,51,234,0.5)] border border-purple-400' : 'text-slate-600 hover:text-white'}`}>LOSS</button>
                </div>
                <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 animate-pulse">Tap Rink to Plot</div>
              </div>

              <div className="flex-1 flex flex-col gap-3 p-5 bg-black/40 border border-red-500/20 rounded-[2.5rem] shadow-xl">
                <div className="flex justify-between items-center px-2">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-red-500"></div>
                     <span className="text-[10px] font-black uppercase text-red-400 tracking-widest">{awayName} CENTER</span>
                   </div>
                   {fowAwayCenter && <span className="text-[10px] font-black text-white italic tracking-tighter">{getPlayerFOStats(fowAwayCenter)}% WINS</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {centers.away.map(p => (
                    <button key={`fo-away-${p.number}`} onClick={() => setFowAwayCenter(p.number)} className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-all border active:scale-95 ${fowAwayCenter === p.number ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-500/20' : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10'}`}>#{p.number}</button>
                  ))}
                  <select className="flex-1 min-w-[120px] bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-black text-slate-300 outline-none" value={fowAwayCenter} onChange={(e) => setFowAwayCenter(e.target.value)}>
                    <option value="">OTHER...</option>
                    {awayRoster.filter(p => p.position?.toUpperCase() !== 'G').map(p => <option key={p.number} value={p.number}>#{p.number} {p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RINK */}
        <div className="bg-black relative flex flex-col min-h-[420px] sm:min-h-[500px] md:min-h-[600px] shadow-inner overflow-hidden">
          {/* SHOT COUNTER BAR */}
          <div className="w-full bg-black/40 border-b border-white/5 py-3 px-6 sm:px-12 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.4)]"></div>
                <div className="flex flex-col">
                   <span className="text-[8px] sm:text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">{homeName} SHOTS</span>
                   <span className="text-xl sm:text-3xl font-black text-white italic leading-none">{stats.home.shots}</span>
                </div>
             </div>
             
             <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                   <span className="text-[8px] sm:text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">{awayName} SHOTS</span>
                   <span className="text-xl sm:text-3xl font-black text-white italic leading-none">{stats.away.shots}</span>
                </div>
                <div className="w-1.5 h-8 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.4)]"></div>
             </div>
          </div>

          {/* LOGGING TOOLBAR */}
          <div className="w-full px-2 py-3 bg-white/5 border-b border-white/10 flex flex-wrap items-center justify-center gap-3 shadow-2xl shrink-0">
            <div className="flex flex-wrap items-center bg-white/5 p-1 rounded-xl border border-white/10 shrink-0 shadow-inner gap-1">
              <div className="flex">
                <button onClick={() => setActiveTeam(Team.HOME)} className={`px-4 sm:px-6 md:px-8 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-black uppercase transition-all ${activeTeam === Team.HOME ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{homeName}</button>
                <button onClick={() => setActiveTeam(Team.AWAY)} className={`px-4 sm:px-6 md:px-8 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-black uppercase transition-all ${activeTeam === Team.AWAY ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{awayName}</button>
              </div>
              
              <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />
              
              <button 
                onClick={() => setShowLineups(!showLineups)} 
                className={`px-4 md:px-6 py-2.5 md:py-3 rounded-lg text-[10px] md:text-xs font-black uppercase transition-all border ${showLineups ? 'bg-blue-600 text-white border-blue-400 shadow-lg' : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10'}`}
              >
                {showLineups ? 'HIDE ROSTERS' : 'SHOW ROSTERS'}
              </button>
              <button onClick={() => { setShowFaceoffHub(!showFaceoffHub); setMapPlotType(EventType.FACEOFF_WIN); }} className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all border ${showFaceoffHub ? 'bg-yellow-600 text-white border-yellow-400 shadow-[0_0_15px_rgba(202,138,4,0.3)]' : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10'}`}>F.O. HUB</button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 px-2 border-l border-r border-white/10">
              {toolbarButtons.map(btn => (
                <button key={btn.type} onClick={() => setMapPlotType(btn.type)} className={`px-3 sm:px-6 md:px-8 py-2.5 md:py-3 rounded-xl text-[10px] sm:text-[11px] md:text-xs font-black uppercase transition-all flex items-center justify-center shadow-lg active:scale-90 ${mapPlotType === btn.type ? `${btn.color} text-white ring-2 ring-white/20` : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>{btn.label}</button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleUndo} className="p-3 md:p-4 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 active:bg-white/20 transition-all shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
            </div>
          </div>

          <div className="relative flex items-center justify-center p-3 sm:p-10 h-full">
            <div className={`w-full max-w-6xl aspect-[200/85] transition-all duration-700 rounded-[5rem] sm:rounded-[8.5rem] p-2 border-4 shadow-2xl ${activeTeam === Team.HOME ? 'border-blue-500/20' : 'border-red-500/20'}`}>
              <RinkChart events={events.filter(e => e.period === currentPeriod && visibleTypes.includes(e.type))} leftLogo={leftTeamDisplay.logo} rightLogo={rightTeamDisplay.logo} onPlot={handlePlot} onMoveEvent={handleMoveEvent} activeEventType={mapPlotType} />
            </div>
          </div>
        </div>

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
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: (btn as any).dotColor || (btn as any).color?.replace('bg-', '') }} />
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
                    <button onClick={handleExportPDF} className="flex-1 sm:flex-none sm:w-40 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      PDF Report
                    </button>
                    <button onClick={handleExportExcel} className="flex-1 sm:flex-none sm:w-40 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Excel Data
                    </button>
                    <button onClick={handleExportHTML} className="flex-1 sm:flex-none sm:w-40 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      HTML Report
                    </button>
                  </div>
               </div>
            </div>

            <FaceoffSummary events={events} homeName={homeName} awayName={awayName} />
            
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
            <span className="text-[8px] uppercase font-bold truncate w-full px-1 text-center mt-1">
              {activeDragPlayer.player.name.split(' ').pop()}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>

    {showSetup && (
        <div className="fixed inset-0 z-[120] bg-black/98 backdrop-blur-3xl flex flex-col animate-in fade-in duration-300">
          <div className="px-6 py-6 sm:px-10 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
            <div className="flex flex-col">
              <h2 className="text-3xl sm:text-4xl font-black italic uppercase text-white tracking-tighter">Roster Setup</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Side-By-Side Team Management</p>
            </div>
            <button onClick={() => setShowSetup(false)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/5 active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
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
                  <div className={`px-8 py-4 border-b border-white/10 flex items-center justify-between bg-black/20`}>
                     <div className="flex items-center gap-3">
                       <div className={`w-3 h-3 rounded-full ${isHome ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                       <span className="text-[12px] font-black uppercase tracking-widest text-white">{team} LINEUP</span>
                     </div>
                     <button onClick={() => {
                       if (isHome) {
                         setHomeRoster([]);
                         setHomeRosterUrl('');
                         setHomeSources([]);
                         setPasteRosterHome('');
                       } else {
                         setAwayRoster([]);
                         setAwayRosterUrl('');
                         setAwaySources([]);
                         setPasteRosterAway('');
                       }
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
                      <div className="space-y-3">
                        <p className="text-[9px] text-slate-500 px-1">Go to any roster website, select and copy the player list, then paste it here. Works on any device, any league.</p>
                        <textarea
                          className="w-full bg-black/40 border border-white/10 p-3.5 rounded-xl text-[10px] text-slate-300 font-mono outline-none focus:border-cyan-500/40 resize-none"
                          rows={6}
                          placeholder="Paste copied roster text here... e.g. 15 John Smith C, 7 Mike Jones LW, 31 Dave Brown G"
                          value={isHome ? pasteRosterHome : pasteRosterAway}
                          onChange={e => isHome ? setPasteRosterHome(e.target.value) : setPasteRosterAway(e.target.value)}
                        />
                        <button
                          onClick={() => handlePasteSync(team)}
                          disabled={isPasteSyncing || !(isHome ? pasteRosterHome : pasteRosterAway).trim()}
                          className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isPasteSyncing || !(isHome ? pasteRosterHome : pasteRosterAway).trim() ? 'bg-slate-800 text-slate-600' : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg border border-cyan-400/30'}`}
                        >
                          {isPasteSyncing ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                            </span>
                          ) : '📋 Import Roster'}
                        </button>
                      </div>
                    </section>

                    {/* ADD PLAYER - ENHANCED POSITION SELECTOR */}
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
                            <select 
                              className="w-full bg-black/60 border border-white/10 rounded-xl py-3 px-4 text-xs font-black text-slate-300 outline-none appearance-none cursor-pointer hover:border-white/20 transition-all" 
                              value={manualData.pos} 
                              onChange={e => setManualData({...manualData, pos: e.target.value})}
                            >
                              <option value="LW">LW</option>
                              <option value="RW">RW</option>
                              <option value="C">C</option>
                              <option value="D">D</option>
                              <option value="G">G</option>
                            </select>
                          </div>
                          <div className="col-span-1 space-y-1">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Line/Pair</label>
                            <select 
                              className="w-full bg-black/60 border border-white/10 rounded-xl py-3 px-4 text-xs font-black text-slate-300 outline-none appearance-none cursor-pointer hover:border-white/20 transition-all" 
                              value={manualData.line} 
                              onChange={e => setManualData({...manualData, line: e.target.value})}
                            >
                              <option value="1">Line 1</option>
                              <option value="2">Line 2</option>
                              <option value="3">Line 3</option>
                              <option value="4">Line 4</option>
                              <option value="P1">Pair 1</option>
                              <option value="P2">Pair 2</option>
                              <option value="P3">Pair 3</option>
                              <option value="G1">Goalie 1</option>
                              <option value="G2">Goalie 2</option>
                            </select>
                          </div>
                          <div className="col-span-2 flex flex-col justify-end">
                            <button onClick={() => handleAddPlayerQuickly(team)} className={`w-full py-3.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${isHome ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'} text-white shadow-lg active:scale-95`}>ADD PLAYER</button>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex justify-between items-center px-1"><h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Numerical Roster ({roster.length})</h4></div>
                      <div className="space-y-2">
                        {roster.map((p, idx) => (
                          <div key={`${team}-p-${idx}`} className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/5 hover:border-white/20 transition-all group">
                             <input className={`w-12 bg-black/40 border border-white/10 rounded-xl py-2 text-center text-[12px] font-black outline-none focus:border-white/30 ${isHome ? 'text-blue-400' : 'text-red-400'}`} value={p.number} onChange={(e) => handleUpdatePlayerInline(team, idx, 'number', e.target.value)} />
                             <input className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-white uppercase px-1" value={p.name} onChange={(e) => handleUpdatePlayerInline(team, idx, 'name', e.target.value)} placeholder="PLAYER NAME" />
                             <select className="bg-black/40 text-[9px] font-black text-slate-500 rounded-lg px-2 py-1.5 border-none appearance-none outline-none cursor-pointer" value={p.position} onChange={(e) => handleUpdatePlayerInline(team, idx, 'position', e.target.value)}>
                               <option value="LW">LW</option>
                               <option value="RW">RW</option>
                               <option value="C">C</option>
                               <option value="LD">LD</option>
                               <option value="RD">RD</option>
                               <option value="D">D</option>
                               <option value="G">G</option>
                             </select>
                             <select className="bg-black/40 text-[9px] font-black text-slate-500 rounded-lg px-2 py-1.5 border-none appearance-none outline-none cursor-pointer" value={p.line || '1'} onChange={(e) => handleUpdatePlayerInline(team, idx, 'line', e.target.value)}>
                               <option value="1">L1</option>
                               <option value="2">L2</option>
                               <option value="3">L3</option>
                               <option value="4">L4</option>
                               <option value="P1">P1</option>
                               <option value="P2">P2</option>
                               <option value="P3">P3</option>
                               <option value="G1">G1</option>
                               <option value="G2">G2</option>
                             </select>
                             <button onClick={() => isHome ? setHomeRoster(prev => prev.filter((_, i) => i !== idx)) : setAwayRoster(prev => prev.filter((_, i) => i !== idx))} className="p-2 text-slate-700 hover:text-red-500 transition-colors opacity-40 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg></button>
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
      <AdBanner position="bottom" onContactClick={() => setShowContact(true)} />
      {/* Legal footer */}
      <div className="flex items-center justify-center gap-4 py-3 bg-black/30 border-t border-white/10">
        <button onClick={() => setLegalPage('terms')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Terms</button>
        <span className="text-slate-600">·</span>
        <button onClick={() => setLegalPage('privacy')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Privacy</button>
        <span className="text-slate-600">·</span>
        <button 
          onClick={() => setShowContact(true)} 
          className="text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors px-4 py-1.5 rounded-full"
        >✉ Contact Us</button>
        <span className="text-slate-600">·</span>
        {!isAdmin && (
          <button
            onClick={handleManageSubscription}
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors px-4 py-1.5 rounded-full border border-white/10 hover:border-white/20"
          >⚙ Manage Subscription</button>
        )}
      </div>
      {legalPage && <LegalPages page={legalPage} onClose={() => setLegalPage(null)} />}
      {showContact && <ContactPage onClose={() => setShowContact(false)} />}
    </div>
  );
};

export default App;
