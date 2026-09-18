// ============================================================
// LineupSheet.tsx
// Read-only display of a team's forward lines, D pairs, and
// goalies from a saved roster. Uses the same line/pair codes
// already stored per player ('1'-'4', 'P1'-'P3', 'G1'/'G2') —
// no new data, just surfaces what's already saved with every
// game report.
// ============================================================

import React from 'react';
import { Player } from '../types';

interface Props {
  roster: Player[];
  teamName: string;
  accent: string;
  // When provided, every player row becomes clickable — used to jump
  // straight from a lineup into scouting that player.
  onPlayerClick?: (p: Player) => void;
}

const FORWARD_LINES = ['1', '2', '3', '4'];
const D_PAIRS = ['P1', 'P2', 'P3'];

// ── Human-readable label for one player's line/pair code — reused
// anywhere a single player's line needs to show (not just the full
// sheet), e.g. in a scouting report's player header.
export function formatLineLabel(line?: string): string {
  if (!line) return '';
  if (line === 'G1') return 'Starter';
  if (line === 'G2') return 'Backup';
  if (line.startsWith('P')) return `Pair ${line.replace('P', '')}`;
  return `Line ${line}`;
}

function sortForwardSlot(a: Player, b: Player) {
  const order: Record<string, number> = { LW: 0, C: 1, RW: 2, F: 1 };
  const ao = order[a.position?.toUpperCase() || ''] ?? 3;
  const bo = order[b.position?.toUpperCase() || ''] ?? 3;
  return ao - bo;
}

export default function LineupSheet({ roster, teamName, accent, onPlayerClick }: Props) {
  const goalies = roster.filter(p => p.position?.toUpperCase() === 'G');
  const assignedLines = new Set([...FORWARD_LINES, ...D_PAIRS, 'G1', 'G2']);
  const unassigned = roster.filter(p => !assignedLines.has(p.line || ''));

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
    cursor: onPlayerClick ? 'pointer' : 'default',
    borderRadius: 6,
  };
  const numStyle: React.CSSProperties = { width: 22, fontSize: 11, fontWeight: 900, color: accent, flexShrink: 0 };
  const nameStyle: React.CSSProperties = { fontSize: 12, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const posStyle: React.CSSProperties = { fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 };
  const groupLabel: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 10, marginBottom: 4 };

  // One row, reused everywhere below instead of repeating the same
  // three spans four times over.
  const PlayerRow = ({ p, posLabel }: { p: Player; posLabel?: string }) => (
    <div
      style={rowStyle}
      onClick={onPlayerClick ? () => onPlayerClick(p) : undefined}
      onMouseEnter={onPlayerClick ? e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; } : undefined}
      onMouseLeave={onPlayerClick ? e => { e.currentTarget.style.background = 'transparent'; } : undefined}
    >
      <span style={numStyle}>#{p.number}</span>
      <span style={nameStyle}>{p.name}</span>
      <span style={posStyle}>{posLabel ?? p.position}</span>
    </div>
  );

  return (
    <div style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 4 }}>{teamName}</div>

      {FORWARD_LINES.map(lineNum => {
        const players = roster.filter(p => p.line === lineNum).sort(sortForwardSlot);
        if (players.length === 0) return null;
        return (
          <div key={`fwd-${lineNum}`}>
            <div style={groupLabel}>Line {lineNum}</div>
            {players.map(p => <PlayerRow key={p.number} p={p} />)}
          </div>
        );
      })}

      {D_PAIRS.map(pairNum => {
        const players = roster.filter(p => p.line === pairNum);
        if (players.length === 0) return null;
        return (
          <div key={`def-${pairNum}`}>
            <div style={groupLabel}>Pair {pairNum.replace('P', '')}</div>
            {players.map(p => <PlayerRow key={p.number} p={p} />)}
          </div>
        );
      })}

      {goalies.length > 0 && (
        <div>
          <div style={groupLabel}>Goalies</div>
          {goalies.map(p => (
            <PlayerRow key={p.number} p={p} posLabel={p.line === 'G1' ? 'Starter' : p.line === 'G2' ? 'Backup' : ''} />
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <div>
          <div style={groupLabel}>Unassigned</div>
          {unassigned.map(p => <PlayerRow key={p.number} p={p} />)}
        </div>
      )}
    </div>
  );
}
