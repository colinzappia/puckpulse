import { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { GameEvent, Player } from '../types';
import {
  GameSession,
  SessionRole,
  endSession as endSessionDB,
  getActiveSessionForUser,
} from '../services/sessionService';
import { broadcastEvent, deleteEvent, loadSessionEvents, subscribeToSession } from '../services/syncService';

interface UseLiveSessionParams {
  user: { id: string } | null | undefined;
  isOnline: boolean;
  setEvents: Dispatch<SetStateAction<GameEvent[]>>;
  setHomeName: (v: string) => void;
  setAwayName: (v: string) => void;
  setHomeRoster: (v: Player[]) => void;
  setAwayRoster: (v: Player[]) => void;
  setCurrentPeriod: (v: number) => void;
}

// Everything to do with Live Sessions — creating/joining, real-time sync,
// the offline retry queue, and reconnect catch-up. Pulled out of App.tsx
// as its own subsystem since it's fairly self-contained (its only real
// external dependencies are passed in explicitly above), and was the
// most recently-built, most clearly-bounded piece of the giant
// component — a deliberately low-risk first extraction, not an attempt
// to restructure everything at once.
export function useLiveSession({
  user, isOnline, setEvents, setHomeName, setAwayName, setHomeRoster, setAwayRoster, setCurrentPeriod,
}: UseLiveSessionParams) {
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [mySessionRole, setMySessionRole] = useState<SessionRole | null>(null);
  const [showSessionSetup, setShowSessionSetup] = useState(false);
  const [showSessionJoin, setShowSessionJoin] = useState(false);
  const [resumableSession, setResumableSession] = useState<{ session: GameSession; role: SessionRole } | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Events logged during a Live Session that failed to reach the server —
  // kept here so they can be retried automatically the moment connectivity
  // returns, instead of being silently lost to other devices in the session.
  const [pendingSync, setPendingSync] = useState<GameEvent[]>(() => {
    try { const v = sessionStorage.getItem('tch_pendingSync'); return v ? JSON.parse(v) : []; } catch { return []; }
  });

  useEffect(() => {
    try { sessionStorage.setItem('tch_pendingSync', JSON.stringify(pendingSync)); } catch {}
  }, [pendingSync]);

  // Every place that syncs an event to a Live Session should call this
  // instead of broadcastEvent directly — logging itself never depends on
  // this succeeding (local state already updated before this runs), but a
  // failure here gets queued for automatic retry on reconnect rather than
  // silently dropped.
  const syncEvent = useCallback((event: GameEvent) => {
    if (!activeSession || !user) return;
    broadcastEvent(activeSession.id, event, user.id).catch(() => {
      setPendingSync(prev => prev.find(e => e.id === event.id) ? prev : [...prev, event]);
    });
  }, [activeSession, user]);

  // Reconnect handling for Live Sessions: retry anything that failed to
  // sync while offline, then re-fetch the full event list so anything
  // logged by OTHER devices during the outage gets caught up too —
  // without this, a dropped connection mid-session silently loses events
  // between devices with no way to recover.
  useEffect(() => {
    if (!isOnline || !activeSession || !user) return;

    if (pendingSync.length > 0) {
      const toRetry = pendingSync;
      setPendingSync([]);
      toRetry.forEach(ev => {
        broadcastEvent(activeSession.id, ev, user.id).catch(() => {
          setPendingSync(prev => prev.find(e => e.id === ev.id) ? prev : [...prev, ev]);
        });
      });
    }

    loadSessionEvents(activeSession.id).then(serverEvents => {
      setEvents(prev => {
        const knownIds = new Set(prev.map(e => e.id));
        const missed = serverEvents.filter(e => !knownIds.has(e.id));
        if (missed.length === 0) return prev;
        toast.success(`Caught up on ${missed.length} event${missed.length > 1 ? 's' : ''} from while you were offline.`);
        return [...prev, ...missed];
      });
    }).catch(console.error);
    // Only re-run when connectivity is regained, not on every pendingSync change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, activeSession?.id, user?.id]);

  const isSessionActive = !!activeSession;
  const canLogEvents = !isSessionActive || mySessionRole === 'admin' || mySessionRole === 'logger';

  const handleLeaveSession = useCallback(() => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    setActiveSession(null);
    setMySessionRole(null);
    setEvents([]);
  }, [setEvents]);

  // Subscribe to real-time updates when session is active
  useEffect(() => {
    if (!activeSession) return;

    loadSessionEvents(activeSession.id).then(loaded => {
      setEvents(loaded);
    });

    const unsub = subscribeToSession(activeSession.id, {
      onEventAdded: (event) => {
        setEvents(prev => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  const handleSessionCreated = useCallback((session: GameSession) => {
    setActiveSession(session);
    setMySessionRole('admin');
    setShowSessionSetup(false);
    toast.success(`Session ${session.code} created! Share the code with your team.`);
  }, []);

  const handleSessionJoined = useCallback((session: GameSession, role: SessionRole) => {
    setActiveSession(session);
    setMySessionRole(role);
    setShowSessionJoin(false);
    setHomeName(session.homeName);
    setAwayName(session.awayName);
    setHomeRoster(session.homeRoster);
    setAwayRoster(session.awayRoster);
    setCurrentPeriod(session.period);
    toast.success(`Joined session ${session.code} as ${role}`);
  }, [setHomeName, setAwayName, setHomeRoster, setAwayRoster, setCurrentPeriod]);

  // Auto-resume: if this user is already a member of a still-active
  // session (e.g. they created it on another device and just opened the
  // app fresh here), offer to resume instead of requiring the code to be
  // typed in again. Runs once per app load, only while nothing's active.
  useEffect(() => {
    if (!user || activeSession) return;
    let cancelled = false;
    getActiveSessionForUser(user.id).then(result => {
      if (!cancelled && result) setResumableSession(result);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [user, activeSession]);

  const handleResumeSession = useCallback(() => {
    setResumableSession(current => {
      if (!current) return current;
      const { session, role } = current;
      setActiveSession(session);
      setMySessionRole(role);
      setHomeName(session.homeName);
      setAwayName(session.awayName);
      setHomeRoster(session.homeRoster);
      setAwayRoster(session.awayRoster);
      setCurrentPeriod(session.period);
      toast.success(`Resumed session ${session.code}`);
      return null;
    });
  }, [setHomeName, setAwayName, setHomeRoster, setAwayRoster, setCurrentPeriod]);

  const handleEndSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      await endSessionDB(activeSession.id);
      toast.success('Session ended.');
    } catch (e) {
      console.error(e);
    }
    handleLeaveSession();
  }, [activeSession, handleLeaveSession]);

  return {
    activeSession,
    mySessionRole,
    showSessionSetup, setShowSessionSetup,
    showSessionJoin, setShowSessionJoin,
    resumableSession, setResumableSession,
    pendingSync,
    syncEvent,
    isSessionActive,
    canLogEvents,
    handleSessionCreated,
    handleSessionJoined,
    handleLeaveSession,
    handleResumeSession,
    handleEndSession,
    // Exposed for the few call sites (Undo, per-event delete, End Game
    // resets) that need to reach the raw sync primitives directly rather
    // than through the higher-level handlers above.
    deleteEvent,
  };
}
