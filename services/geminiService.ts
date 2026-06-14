// All AI calls go through server-side API routes — no API keys in the browser

export interface AIRosterResponse {
  status: 'OK' | 'ERROR';
  players: any[];
  sources?: any[];
  reason?: string;
}

interface SyncParams {
  teamName: string;
  rosterUrl?: string;
  pasteText?: string;
}

export async function fetchRosterByAI({ teamName, rosterUrl, pasteText }: SyncParams): Promise<AIRosterResponse> {
  if (!navigator.onLine) return { status: 'ERROR', players: [], reason: 'Roster sync requires an internet connection. Please add players manually while offline.' };
  try {
    const response = await fetch('/api/ai-roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamName, rosterUrl, pasteText })
    });
    const data = await response.json();
    return data;
  } catch (err: any) {
    return { status: 'ERROR', players: [], reason: err.message };
  }
}

export async function generateNarrative(
  periodFilter: number | 'total',
  homeStats: any,
  awayStats: any,
  richData?: any
): Promise<string> {
  if (!navigator.onLine) return 'AI Tactical Intel requires an internet connection. Your game tracking data is saved — generate insights when you reconnect.';
  try {
    const response = await fetch('/api/ai-narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        homeName: homeStats.name,
        awayName: awayStats.name,
        homeStats,
        awayStats,
        periodFilter,
        richData
      })
    });
    const data = await response.json();
    return data.narrative || 'Could not generate analysis.';
  } catch (err: any) {
    return 'AI analysis temporarily unavailable.';
  }
}
