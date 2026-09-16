// ============================================================
// scoutingStats.ts
// Computes the auto-filled stat line for one player from the
// raw tracked events on a saved game report, and exposes the
// player's full raw event list for display. Pure computation —
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
  const playerEvents = getPlayerEvents(events, teamSide, playerNumber);

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

// ── Every raw event logged for one player, in the order it was
// tracked. Used to show a scout the full play-by-play for the
// player they're evaluating, not just the summarized percentages.
export function getPlayerEvents(
  events: GameEvent[],
  teamSide: Team,
  playerNumber: string
): GameEvent[] {
  return events.filter((e) => e.team === teamSide && e.playerNumber === playerNumber);
}

// ── Human-readable label for one event, for display in a list.
export function formatEventLabel(e: GameEvent): string {
  switch (e.type) {
    case EventType.GOAL:
      return 'Goal';
    case EventType.SHOT:
      return 'Shot';
    case EventType.SAVE:
      return 'Save';
    case EventType.MISS:
      return 'Missed shot';
    case EventType.HIT:
      return 'Hit';
    case EventType.FACEOFF_WIN:
      return 'Faceoff win';
    case EventType.FACEOFF_LOSS:
      return 'Faceoff loss';
    case EventType.PENALTY:
      return e.metadata?.penaltyType ? `Penalty (${e.metadata.penaltyType})` : 'Penalty';
    case EventType.GIVEAWAY:
      return 'Giveaway';
    case EventType.TAKEAWAY:
      return 'Takeaway';
    case EventType.BLOCK:
      return 'Blocked shot';
    case EventType.PP_SHOT_FOR:
      return 'PP shot for';
    case EventType.PP_SHOT_AGAINST:
      return 'PP shot against';
    case EventType.ZONE_ENTRY_CARRY:
      return 'Zone entry (carry)';
    case EventType.ZONE_ENTRY_DUMP:
      return 'Zone entry (dump)';
    case EventType.ZONE_ENTRY_PASS:
      return 'Zone entry (pass)';
    case EventType.ZONE_ENTRY_DENIED:
      return 'Zone entry denied';
    case EventType.BREAKOUT:
      return e.metadata?.breakoutResult === 'CONTROLLED' ? 'Breakout (controlled)' : 'Breakout (failed)';
    default:
      return e.type;
  }
}
