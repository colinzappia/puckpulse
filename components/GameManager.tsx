import React, { useState, useEffect, useCallback } from 'react';

const SAVE_KEY = 'tch_game_v1';

interface SavedGame {
  savedAt: string;
  homeName: string;
  awayName: string;
  eventCount: number;
  period: number;
}

interface GameManagerProps {
  isActive: boolean; // only run when user is logged in and subscribed
}

// This component floats independently — reads/writes localStorage
// and communicates with the app via custom browser events
const GameManager: React.FC<GameManagerProps> = ({ isActive }) => {
  const [savedGame, setSavedGame] = useState<SavedGame | null>(null);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);

  // Check for saved game on mount
  useEffect(() => {
    if (!isActive) return;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.eventCount > 0 || (data?.homeName && data.homeName !== 'HOME')) {
        setSavedGame(data);
        setShowRestoreBanner(true);
      }
    } catch {}
  }, [isActive]);

  // Listen for game state changes from App
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: CustomEvent) => {
      try {
        const { events, homeName, awayName, homeRoster, awayRoster, currentPeriod } = e.detail;
        if (!events) return;
        const snapshot = {
          savedAt: new Date().toISOString(),
          homeName: homeName || 'HOME',
          awayName: awayName || 'AWAY',
          eventCount: events.length,
          period: currentPeriod || 1,
          events,
          homeRoster,
          awayRoster,
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 1200);
      } catch {}
    };
    window.addEventListener('tch_game_state' as any, handler);
    return () => window.removeEventListener('tch_game_state' as any, handler);
  }, [isActive]);

  // Listen for New Game button click from Header
  useEffect(() => {
    if (!isActive) return;
    const handler = () => setShowNewGameConfirm(true);
    window.addEventListener('tch_new_game_request', handler);
    return () => window.removeEventListener('tch_new_game_request', handler);
  }, [isActive]);

  const handleRestore = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      window.dispatchEvent(new CustomEvent('tch_restore_game', { detail: data }));
    } catch {}
    setShowRestoreBanner(false);
    setSavedGame(null);
  };

  const handleDismiss = () => {
    localStorage.removeItem(SAVE_KEY);
    setShowRestoreBanner(false);
    setSavedGame(null);
  };

  const handleConfirmNewGame = () => {
    window.dispatchEvent(new CustomEvent('tch_confirm_new_game'));
    localStorage.removeItem(SAVE_KEY);
    setSavedGame(null);
    setShowNewGameConfirm(false);
  };

  if (!isActive) return null;

  return (
    <>
      {/* Auto-save indicator */}
      {saveIndicator && (
        <div className="fixed bottom-20 right-4 z-50 bg-green-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
          ✓ Saved
        </div>
      )}

      {/* Restore banner */}
      {showRestoreBanner && savedGame && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-sm">💾</span>
            <span className="text-yellow-300 text-xs font-bold">
              Saved game: {savedGame.homeName} vs {savedGame.awayName} — {savedGame.eventCount} events · {new Date(savedGame.savedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleRestore} className="px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black rounded-lg transition-colors">
              Restore
            </button>
            <button onClick={handleDismiss} className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* New Game confirm dialog */}
      {showNewGameConfirm && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-4">🏒</div>
            <h3 className="text-white font-black text-xl mb-2">Start a New Game?</h3>
            <p className="text-slate-400 text-sm mb-6">
              This will clear all events, rosters, and team names. Make sure you've exported your report first!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewGameConfirm(false)}
                className="flex-1 py-3 border border-white/10 hover:border-white/20 text-white font-bold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmNewGame}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-colors"
              >
                Start New Game
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GameManager;
