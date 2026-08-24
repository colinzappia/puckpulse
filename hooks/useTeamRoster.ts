import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Team, Player } from '../types';
import { uploadLogo } from '../services/storageService';

// Pure helpers — no dependency on component state, so they're exported
// directly for other code (like the paste-roster AI-import flow, which
// stays in App.tsx for now) to keep using without duplicating the logic.
export function sortByNumber(roster: Player[]): Player[] {
  return [...roster].sort((a, b) => {
    const aIsG = a.position?.toUpperCase() === 'G' ? 0 : 1;
    const bIsG = b.position?.toUpperCase() === 'G' ? 0 : 1;
    if (aIsG !== bIsG) return aIsG - bIsG;
    return (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0);
  });
}

// Converts "Last, First" (and "Last, First Middle") into "First Last" order.
// Backstops the AI prompt for roster imports, and also cleans up names
// typed directly in "Last, First" form via the quick-add field.
export function normalizeName(raw: string): string {
  const name = (raw || '').trim();
  if (!name.includes(',')) return name;
  const [last, rest] = name.split(',', 2).map(s => s.trim());
  if (!last || !rest) return name;
  return `${rest} ${last}`.replace(/\s+/g, ' ').trim();
}

interface UseTeamRosterParams {
  user: { id: string } | null | undefined;
}

export function useTeamRoster({ user }: UseTeamRosterParams) {
  const [homeName, setHomeName] = useState(() => {
    try { return sessionStorage.getItem('tch_homeName') || 'HOME'; } catch { return 'HOME'; }
  });
  const [awayName, setAwayName] = useState(() => {
    try { return sessionStorage.getItem('tch_awayName') || 'AWAY'; } catch { return 'AWAY'; }
  });
  const [homeNickname, setHomeNickname] = useState(() => {
    try { return sessionStorage.getItem('tch_homeNickname') || ''; } catch { return ''; }
  });
  const [awayNickname, setAwayNickname] = useState(() => {
    try { return sessionStorage.getItem('tch_awayNickname') || ''; } catch { return ''; }
  });
  const [homeLogo, setHomeLogo] = useState(() => {
    try { return sessionStorage.getItem('tch_homeLogo') || ''; } catch { return ''; }
  });
  const [awayLogo, setAwayLogo] = useState(() => {
    try { return sessionStorage.getItem('tch_awayLogo') || ''; } catch { return ''; }
  });
  const [logoUploading, setLogoUploading] = useState<{ home: boolean; away: boolean }>({ home: false, away: false });
  const [startingGoalieHome, setStartingGoalieHome] = useState(() => {
    try { return sessionStorage.getItem('tch_startingGoalieHome') || ''; } catch { return ''; }
  });
  const [startingGoalieAway, setStartingGoalieAway] = useState(() => {
    try { return sessionStorage.getItem('tch_startingGoalieAway') || ''; } catch { return ''; }
  });
  const [goalieHistoryHome, setGoalieHistoryHome] = useState<{ number: string; since: number }[]>(() => {
    try { const v = sessionStorage.getItem('tch_goalieHistoryHome'); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [goalieHistoryAway, setGoalieHistoryAway] = useState<{ number: string; since: number }[]>(() => {
    try { const v = sessionStorage.getItem('tch_goalieHistoryAway'); return v ? JSON.parse(v) : []; } catch { return []; }
  });
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
    try { sessionStorage.setItem('tch_startingGoalieHome', startingGoalieHome); } catch {}
  }, [startingGoalieHome]);

  useEffect(() => {
    try { sessionStorage.setItem('tch_startingGoalieAway', startingGoalieAway); } catch {}
  }, [startingGoalieAway]);

  useEffect(() => {
    try { sessionStorage.setItem('tch_goalieHistoryHome', JSON.stringify(goalieHistoryHome)); } catch {}
  }, [goalieHistoryHome]);

  useEffect(() => {
    try { sessionStorage.setItem('tch_goalieHistoryAway', JSON.stringify(goalieHistoryAway)); } catch {}
  }, [goalieHistoryAway]);

  useEffect(() => {
    try {
      sessionStorage.setItem('tch_homeName', homeName);
      sessionStorage.setItem('tch_awayName', awayName);
    } catch {}
  }, [homeName, awayName]);

  useEffect(() => {
    try {
      sessionStorage.setItem('tch_homeNickname', homeNickname);
      sessionStorage.setItem('tch_awayNickname', awayNickname);
    } catch {}
  }, [homeNickname, awayNickname]);

  // "Nickname" = the manual override if the coach has set one, otherwise
  // everything after the first word of the team name (not just the last
  // word). The automatic guess can't know a city/region name has multiple
  // words (e.g. "Ottawa West") — that's exactly what the override is for.
  const teamNickname = useCallback((fullName: string, override: string, fallback: string) => {
    if (override.trim()) return override.trim();
    const trimmed = fullName?.trim();
    if (!trimmed) return fallback;
    const parts = trimmed.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  }, []);

  const handleLogoUpload = useCallback(async (team: Team, file: File | null) => {
    if (!file || !user) return;
    const key = team === Team.HOME ? 'home' : 'away';
    setLogoUploading(prev => ({ ...prev, [key]: true }));
    try {
      const url = await uploadLogo(user.id, file);
      if (team === Team.HOME) setHomeLogo(url);
      else setAwayLogo(url);
    } catch (err) {
      console.error(err);
      toast.error('Logo upload failed — try again.');
    } finally {
      setLogoUploading(prev => ({ ...prev, [key]: false }));
    }
  }, [user]);

  const handleUpdatePlayerInline = useCallback((team: Team, index: number, field: keyof Player, value: string) => {
    const updateFn = team === Team.HOME ? setHomeRoster : setAwayRoster;
    updateFn(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }, []);

  // Deliberately NOT wrapped in useCallback — the original was a plain
  // function too, redefined every render, which is exactly what lets it
  // always see the current homeRoster/awayRoster/manualHome/manualAway
  // without needing a dependency array or refs to avoid staleness.
  const handleAddPlayerQuickly = (team: Team) => {
    const isHome = team === Team.HOME;
    const roster = isHome ? homeRoster : awayRoster;
    const data = isHome ? manualHome : manualAway;
    if (!data.name || !data.number) return;
    if (roster.some(p => p.number === data.number)) { toast.error(`Player #${data.number} already exists on this roster.`); return; }
    const p: Player = { number: data.number, name: normalizeName(data.name), position: data.pos || 'F', line: data.line };
    if (isHome) { setHomeRoster(sortByNumber([...roster, p])); setManualHome({ number: '', name: '', pos: 'F', line: '1' }); }
    else { setAwayRoster(sortByNumber([...roster, p])); setManualAway({ number: '', name: '', pos: 'F', line: '1' }); }
  };

  // Full reset for New Game / End Game — only touches the state this hook
  // owns. App.tsx still separately resets the state it kept (netMarks,
  // shotsFor, etc.) alongside calling this.
  const resetTeamData = useCallback(() => {
    setHomeName('HOME');
    setAwayName('AWAY');
    setHomeNickname('');
    setAwayNickname('');
    setHomeRoster([]);
    setAwayRoster([]);
    setHomeLogo('');
    setAwayLogo('');
    setStartingGoalieHome('');
    setStartingGoalieAway('');
    setGoalieHistoryHome([]);
    setGoalieHistoryAway([]);
    setHomeSources([]);
    setAwaySources([]);
    try {
      ['tch_homeRoster', 'tch_awayRoster', 'tch_homeName', 'tch_awayName', 'tch_homeNickname', 'tch_awayNickname', 'tch_homeLogo', 'tch_awayLogo', 'tch_startingGoalieHome', 'tch_startingGoalieAway', 'tch_goalieHistoryHome', 'tch_goalieHistoryAway'].forEach(k => sessionStorage.removeItem(k));
    } catch {}
  }, []);

  return {
    homeName, setHomeName,
    awayName, setAwayName,
    homeNickname, setHomeNickname,
    awayNickname, setAwayNickname,
    homeLogo, setHomeLogo,
    awayLogo, setAwayLogo,
    logoUploading,
    startingGoalieHome, setStartingGoalieHome,
    startingGoalieAway, setStartingGoalieAway,
    goalieHistoryHome, setGoalieHistoryHome,
    goalieHistoryAway, setGoalieHistoryAway,
    homeRoster, setHomeRoster,
    awayRoster, setAwayRoster,
    homeSources, setHomeSources,
    awaySources, setAwaySources,
    manualHome, setManualHome,
    manualAway, setManualAway,
    teamNickname,
    handleLogoUpload,
    handleUpdatePlayerInline,
    handleAddPlayerQuickly,
    resetTeamData,
  };
}
