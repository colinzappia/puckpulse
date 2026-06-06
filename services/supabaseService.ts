// Supabase service - placeholder until package is properly installed
export interface GameState {
  home_name: string;
  away_name: string;
  current_period: number;
  events: any[];
  home_roster: any[];
  away_roster: any[];
}

export async function saveGameSession(userId: string, state: GameState): Promise<boolean> {
  return false;
}

export async function loadGameSession(userId: string): Promise<GameState | null> {
  return null;
}

export async function clearGameSession(userId: string): Promise<void> {
}
