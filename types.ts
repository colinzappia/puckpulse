
 
export enum EventType {
  GOAL = 'GOAL',
  SHOT = 'SHOT',
  SAVE = 'SAVE',
  MISS = 'MISS',
  HIT = 'HIT',
  FACEOFF_WIN = 'FACEOFF_WIN',
  FACEOFF_LOSS = 'FACEOFF_LOSS',
  PENALTY = 'PENALTY',
  GIVEAWAY = 'GIVEAWAY',
  TAKEAWAY = 'TAKEAWAY',
  BLOCK = 'BLOCK',
  PP_SHOT_FOR = 'PP_SHOT_FOR',
  PP_SHOT_AGAINST = 'PP_SHOT_AGAINST'
}
 
export enum PenaltyType {
  TRIPPING = 'Tripping',
  SLASHING = 'Slashing',
  HOOKING = 'Hooking',
  DELAY_OF_GAME = 'Delay of Game',
  ROUGHING = 'Roughing',
  CROSS_CHECKING = 'Cross-checking',
  BOARDING = 'Boarding',
  SPEARING = 'Spearing',
  SLEW_FOOTING = 'Slew-footing',
  FIGHTING = 'Fighting'
}
 
export enum Team {
  HOME = 'HOME',
  AWAY = 'AWAY'
}
 
export enum Zone {
  DEFENSIVE = 'DEFENSIVE',
  NEUTRAL = 'NEUTRAL',
  OFFENSIVE = 'OFFENSIVE'
}
 
export interface Player {
  number: string;
  name: string;
  position: 'LW' | 'RW' | 'C' | 'LD' | 'RD' | 'D' | 'G' | string;
  line?: string; // e.g., '1', '2', '3', '4', 'P1', 'P2', 'P3', 'G1', 'G2'
}
 
export interface GameEvent {
  id: string;
  timestamp: number;
  gameTime: string;
  period: number; 
  type: EventType;
  team: Team;
  zone: Zone;
  playerNumber?: string;
  coordinates?: { x: number; y: number };
  metadata?: {
    penaltyType?: PenaltyType;
    isPowerPlay?: boolean;
    [key: string]: any;
  };
}
 
export interface TeamStats {
  name: string;
  goals: number;
  shots: number;
  saves: number;
  hits: number;
  pim: number;
  faceoffWins: number;
  blocks: number;
  roster: Player[];
}
 
export interface PeriodSummary {
  period: number;
  homeStats: Partial<TeamStats>;
  awayStats: Partial<TeamStats>;
  aiAnalysis: string;
}
