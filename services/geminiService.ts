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
  imageBase64?: string;
  imageMediaType?: string;
}

export async function fetchRosterByAI({ teamName, rosterUrl, pasteText, imageBase64, imageMediaType }: SyncParams): Promise<AIRosterResponse> {
  if (!navigator.onLine) return { status: 'ERROR', players: [], reason: 'Roster sync requires an internet connection. Please add players manually while offline.' };
  try {
    const response = await fetch('/api/ai-roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamName, rosterUrl, pasteText, imageBase64, imageMediaType })
    });

    // The server can be rejected before our own handler code even runs
    // (e.g. a request-size limit on serverless functions) — that comes
    // back as a plain-text error, not JSON. Detect that case specifically
    // rather than letting a raw JSON.parse failure surface to the user.
    if (response.status === 413) {
      return { status: 'ERROR', players: [], reason: 'That image is too large to upload. Try a smaller photo, or crop it closer to just the roster.' };
    }
    const raw = await response.text();
    let data: AIRosterResponse;
    try {
      data = JSON.parse(raw);
    } catch {
      return { status: 'ERROR', players: [], reason: `Server returned an unexpected response (${response.status}). Try again, or use a smaller image.` };
    }
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
