// ============================================================
// scoutingStats.ts
// Computes the auto-filled stat line for one player from the
// raw tracked events on a saved game report. Pure computation —
// no Supabase calls here. Feed it events already loaded via
// gameReportService.
// ============================================================

import { GameEvent, EventType, Team } from '../types';

export interface PlayerGameStats {
  zoneEntries: { total: number; successPct: number | null };
  faceoffs: { total: number; winPct: number | null };
  breakouts: { total: number; successPct: number | null };
}

const ZONE_ENTRY_TYPES = [
  EventType.ZONE_ENTRY_CARRY,
  EventType.ZONE_ENTRY_DUMP,
  EventType.ZONE_ENTRY_PASS,
  EventType.ZONE_ENTRY_DENIED,
];

// successPct is null (not 0%) when there's no data of that kind for this
// player — a blank stat should read as "not tracked," not "failed every time."
export function computePlayerStats(
  events: GameEvent[],
  teamSide: Team,
  playerNumber: string
): PlayerGameStats {
  const playerEvents = events.filter(
    (e) => e.team === teamSide && e.playerNumber === playerNumber
  );

  const zoneEntryEvents = playerEvents.filter((e) => ZONE_ENTRY_TYPES.includes(e.type));
  const deniedEntries = zoneEntryEvents.filter(
    (e) => e.type === EventType.ZONE_ENTRY_DENIED
  ).length;
  const zoneEntryTotal = zoneEntryEvents.length;

  const faceoffWins = playerEvents.filter((e) => e.type === EventType.FACEOFF_WIN).length;
  const faceoffLosses = playerEvents.filter((e) => e.type === EventType.FACEOFF_LOSS).length;
  const faceoffTotal = faceoffWins + faceoffLosses;

  const breakoutEvents = playerEvents.filter((e) => e.type === EventType.BREAKOUT);
  const controlledBreakouts = breakoutEvents.filter(
    (e) => e.metadata?.breakoutResult === 'CONTROLLED'
  ).length;
  const breakoutTotal = breakoutEvents.length;

  return {
    zoneEntries: {
      total: zoneEntryTotal,
      successPct:
        zoneEntryTotal > 0
          ? Math.round(((zoneEntryTotal - deniedEntries) / zoneEntryTotal) * 100)
          : null,
    },
    faceoffs: {
      total: faceoffTotal,
      winPct: faceoffTotal > 0 ? Math.round((faceoffWins / faceoffTotal) * 100) : null,
    },
    breakouts: {
      total: breakoutTotal,
      successPct:
        breakoutTotal > 0 ? Math.round((controlledBreakouts / breakoutTotal) * 100) : null,
    },
  };
}
