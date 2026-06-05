
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { GameEvent, TeamStats, Player, PeriodSummary } from "../types";

interface SyncParams {
  teamName: string;
  rosterUrl?: string;
  pasteText?: string;
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
function getAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export async function fetchRosterByAI({ teamName, rosterUrl, pasteText }: SyncParams): Promise<AIRosterResponse> {
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

  // If paste text provided, use it directly
  if (pasteText) {
    const pastePrompt = `You are a hockey roster parser. Extract ALL players from the following pasted roster text for the team "${teamName}".
RULES: Only extract players from the text below. Do not add any players not mentioned. Extract jersey number, full name, and position. Position: map to C, LW, RW, D, or G. Line: Forwards get 1,2,3,4. Defense get P1,P2,P3. Goalies get G1,G2. If jersey number missing use "00". No duplicates.
PASTED TEXT:
${pasteText}
Respond with ONLY this JSON, no other text: {"status":"OK","players":[{"number":"15","name":"Player Name","position":"C","line":"1"}]}`;

    try {
      const ai = getAI();
      if (!ai) return { status: "ERROR", players: [], reason: "API Key not configured." };
      const response = await callWithRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: pastePrompt,
      })) as GenerateContentResponse;
      const text = response.text;
      if (!text) return { status: "ERROR", players: [], reason: "No response text." };
      let parsed: any = null;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]); } catch {} }
      if (!parsed) return { status: "ERROR", players: [], reason: "Could not parse roster response." };
      return { status: "OK", players: parsed.players || [], sources: [] };
    } catch (err: any) {
      return { status: "ERROR", players: [], reason: err.message };
    }
  }

  const finalPrompt = `
    You are a hockey roster expert. Today is ${new Date().toDateString()}.
    
    TASK: Return the most current active roster for "${teamName}" for the ${season} season.
    Use this as a reference: ${rosterUrl.trim()}
    Also search for "${teamName} roster ${season}" to find the most up to date information.
    
    IMPORTANT GUIDELINES:
    - Focus on players currently on the active roster in ${season}.
    - Prefer players from this season over previous seasons.
    - If a player was traded or released this season, exclude them if you can confirm it.
    - Do your best — if you are unsure about a player, include them rather than refusing.
    - Never refuse to answer. Always return as many current players as you can find.
    - A typical NHL/junior roster has 20-25 players. Return ALL you can find.
    - No duplicate players.
    
    EXTRACTION REQUIREMENTS:
    1. Jersey Number — as currently assigned. If unknown, use "00".
    2. Full Name — correct spelling.
    3. Position — C, LW, RW, D, or G.
    4. Line — Forwards: 1, 2, 3, or 4. Defense: P1, P2, P3. Goalies: G1 or G2.
    
    You MUST always respond with ONLY this exact JSON format, no other text, no explanation:
    {"status":"OK","players":[{"number":"15","name":"Player Name","position":"C","line":"1"}]}
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: finalPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    })) as GenerateContentResponse;

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = groundingChunks?.map((chunk: any) => ({
      uri: chunk.web?.uri || "",
      title: chunk.web?.title || "Search Result"
    })).filter((s: any) => s.uri) || [];

    const text = response.text;
    if (!text) return { status: "ERROR", players: [], reason: "No response text." };
    
    // Try multiple strategies to extract JSON
    let parsed: any = null;
    
    // Strategy 1: Find JSON block between curly braces
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch {}
    }
    
    // Strategy 2: Strip markdown code fences and try again
    if (!parsed) {
      const stripped = text.replace(/```json|```/g, '').trim();
      try { parsed = JSON.parse(stripped); } catch {}
    }
    
    // Strategy 3: Find the largest JSON-like block
    if (!parsed) {
      const blocks = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];
      for (const block of blocks.sort((a, b) => b.length - a.length)) {
        try { parsed = JSON.parse(block); break; } catch {}
      }
    }
    
    if (!parsed) {
      console.error("Raw AI response:", text);
      // Return first 500 chars of response in error so we can debug
      const preview = text.substring(0, 300).replace(/[\n\r]/g, ' ');
      return { status: "ERROR", players: [], reason: `Unexpected format. AI said: "${preview}..."` };
    }
    
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
