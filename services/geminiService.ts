
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { GameEvent, TeamStats, Player, PeriodSummary } from "../types";

interface SyncParams {
  teamName: string;
  rosterUrl?: string;
}

export interface AIRosterResponse {
  status: "OK" | "NEEDS_RENDERED_SOURCE" | "ERROR";
  players: Player[];
  reason?: string;
  notes?: string[];
  sources?: { uri: string; title: string }[];
}

/**
 * Utility for exponential backoff retries.
 * Handles transient 429 (Quota) and 5xx errors.
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isQuotaError = error?.message?.includes('429') || error?.status === 429;
      const isRetryableError = isQuotaError || error?.status >= 500;
      
      if (isRetryableError && i < maxRetries - 1) {
        const waitTime = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
        console.warn(`Gemini API error (attempt ${i + 1}). Retrying in ${Math.round(waitTime)}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Calculates the current active hockey season string (e.g., "2024-25").
 */
const getSeasonString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  if (month >= 6) { 
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

/**
 * Fetches the current season's roster using AI and Google Search grounding.
 */
export async function fetchRosterByAI({ teamName, rosterUrl }: SyncParams): Promise<AIRosterResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing. Check environment variables.");
    return { status: "ERROR", players: [], reason: "API Key not configured." };
  }
  const ai = new GoogleGenAI({ apiKey });
  const season = getSeasonString();
  
  const hasUrl = rosterUrl && rosterUrl.trim().startsWith('http');
  if (!hasUrl) {
    return { status: "ERROR", players: [], reason: "A valid roster URL is required for sync." };
  }

  const finalPrompt = `
    You are a world-class hockey scout and data analyst. 
    
    TASK: Find and extract the COMPLETE full active player roster for "${teamName}" for the ${season} season.
    Use this URL as a reference: ${rosterUrl.trim()}
    Also search for "${teamName} ${season} full roster" to ensure you have every single player.
    
    CRITICAL: A typical OHL/junior hockey roster has 20-25 players. You MUST return ALL of them.
    Do NOT stop after a few players. Include every forward, every defenseman, and every goalie.
    
    EXTRACTION REQUIREMENTS:
    1. Extract every active player's Jersey Number (if missing, use "00").
    2. Extract Full Names (ensure correct spelling).
    3. Extract Positions. Map them to: C, LW, RW, LD, RD, D, or G. Use LD/RD for defense if specified, otherwise D.
    4. Forwards: assign line 1, 2, 3, or 4. Defense: assign P1, P2, or P3. Goalies: G1 or G2.
    5. For defensemen on the same pairing, assign one LD and one RD where possible.
    6. Ensure NO DUPLICATE players are returned.
    
    You MUST respond with ONLY a valid JSON object in this exact format, no other text:
    {"status":"OK","players":[{"number":"15","name":"Player Name","position":"C","line":"1"},{"number":"7","name":"Player Name","position":"LW","line":"2"}]}
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: finalPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    })) as GenerateContentResponse;

    // Extract grounding sources as required
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = groundingChunks?.map((chunk: any) => ({
      uri: chunk.web?.uri || "",
      title: chunk.web?.title || "Search Result"
    })).filter((s: any) => s.uri) || [];

    const text = response.text;
    if (!text) return { status: "ERROR", players: [], reason: "No response text." };
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { status: "ERROR", players: [], reason: "Could not parse roster response." };
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Deduplicate by number
    const uniquePlayers = new Map<string, Player>();
    (parsed.players || []).forEach((p: any) => {
      const num = p.number || "00";
      if (!uniquePlayers.has(num)) {
        uniquePlayers.set(num, {
          number: num,
          name: p.name,
          position: p.position || "F",
          line: p.line || (p.position === 'G' ? 'G1' : (p.position === 'D' ? 'P1' : '1'))
        });
      }
    });
    
    return {
      status: parsed.status,
      players: Array.from(uniquePlayers.values()),
      reason: parsed.reason,
      notes: parsed.notes,
      sources
    };

  } catch (error: any) {
    console.error("AI Roster Sync Error:", error);
    let userMsg = error instanceof Error ? error.message : "Internal engine error.";
    if (userMsg.includes('429')) {
      userMsg = "Quota Limit: The API is currently overloaded. Please wait 60 seconds and try again.";
    }
    return { status: "ERROR", players: [], reason: userMsg };
  }
}

export async function generateNarrative(
  period: number | 'total',
  homeStats: TeamStats,
  awayStats: TeamStats
) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return "API Key not configured.";
  const ai = new GoogleGenAI({ apiKey });
  const isTotal = period === 'total';
  const label = isTotal ? "Full Game Scouting Report" : `Period ${period} Tactical Breakdown`;
  
  const prompt = `
    You are an elite professional hockey head coach and lead tactical analyst. 
    Analyze the following game data to provide a technical breakdown for the coaching staff: ${label}.
    
    Teams: ${homeStats.name} vs ${awayStats.name}
    Score: ${homeStats.goals} - ${awayStats.goals}
    
    Stats: 
    - ${homeStats.name}: ${homeStats.shots} Shots, ${homeStats.faceoffWins} Faceoff Wins, ${homeStats.pim} PIM
    - ${awayStats.name}: ${awayStats.shots} Shots, ${awayStats.faceoffWins} Faceoff Wins, ${awayStats.pim} PIM

    Please provide:
    1. A technical, data-driven summary of the team's structural performance (Zone exits, puck management, and puck possession).
    2. 3 specific coaching adjustments or scouting observations regarding the opposition's weaknesses or internal tactical shifts needed.
    
    Format the response with clear headers: "TECHNICAL SUMMARY" and "COACHING ADJUSTMENTS". Use a professional, direct tone.
  `;

  try {
    // Cast to GenerateContentResponse to fix property access errors on text
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt
    })) as GenerateContentResponse;
    return response.text || "Analyzing tactical data...";
  } catch (error) {
    return "Tactical analysis unavailable due to API limits. Please retry in a moment.";
  }
}

export async function generatePeriodSummary(
  period: number,
  periodEvents: GameEvent[],
  homeStats: TeamStats,
  awayStats: TeamStats
) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return "API Key not configured.";
  const ai = new GoogleGenAI({ apiKey });
  const label = period <= 3 ? `Period ${period}` : "Overtime";
  const prompt = `Provide a coaching summary for ${label}. Shots: ${homeStats.shots}-${awayStats.shots}. Focus on puck possession and zone time.`;
  
  // Cast to GenerateContentResponse to fix property access errors on text
  const response = await callWithRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt
  })) as GenerateContentResponse;
  return response.text;
}

export async function generateGameSummary(
  homeStats: TeamStats,
  awayStats: TeamStats,
  periodSummaries: PeriodSummary[]
) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return "API Key not configured.";
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Write a technical post-game scouting recap. ${homeStats.name} (${homeStats.goals}) vs ${awayStats.name} (${awayStats.goals}). Identify key structural successes.`;
  
  // Cast to GenerateContentResponse to fix property access errors on text
  const response = await callWithRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-lite', // Flash Lite is fastest
    contents: prompt
  })) as GenerateContentResponse;
  return response.text;
}
