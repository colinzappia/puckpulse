// ============================================================
// LiveScoutingModal.tsx
// Scout a player during a live, in-progress game — no saved
// game report exists yet, so nothing here touches Supabase.
// Ratings/notes are held in the parent's state (via onSave) and
// only persisted once the game itself is saved, same as every
// other piece of live game data (events, rosters, etc.).
// ============================================================

import React, { useState } from 'react';
import { GameEvent, Player, Team } from '../types';
import { ScoutRatings } from '../services/scoutingReportService';
import { computePlayerStats, getPlayerEvents, formatEventLabel } from '../utils/scoutingStats';

interface Props {
  events: GameEvent[];
  roster: Player[];
  team: Team;
  playerNumber: string;
  teamName: string;
  initial?: { ratings: ScoutRatings; notes: string };
  onSave: (ratings: ScoutRatings, notes: string) => void;
  onClose: () => void;
}

const RATING_FIELDS: { key: keyof ScoutRatings; label: string }[] = [
  { key: 'skating', label: 'Skating' },
  { key: 'shot', label: 'Shot' },
  { key: 'puckSkills', label: 'Puck skills' },
  { key: 'playmaking', label: 'Playmaking' },
  { key: 'ozHockeySense', label: 'OZ hockey sense' },
  { key: 'dzHockeySense', label: 'DZ hockey sense' },
  { key: 'compete', label: 'Compete' },
  { key: 'physicality', label: 'Physicality' },
];

export default function LiveScoutingModal({ events, roster, team, playerNumber, teamName, initial, onSave, onClose }: Props) {
  const player = roster.find(p => p.number === playerNumber);
  const playerEvents = getPlayerEvents(events, team, playerNumber);
  const stats = computePlayerStats(events, team, playerNumber);

  const [ratings, setRatings] = useState<ScoutRatings>(initial?.ratings || {});
  const [notes, setNotes] = useState(initial?.notes || '');

  const accent = team === Team.HOME ? '#60a5fa' : '#f87171';

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 360, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 361, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { flex: 1, overflowY: 'auto' as const, padding: 16 },
    card: { background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 12 },
    statGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
    stat: { background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' as const },
    statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase' as const, fontWeight: 700, letterSpacing: '0.04em' },
    statValue: { fontSize: 18, fontWeight: 900, color: '#fff' },
    sectionLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 },
    select: { width: '100%', background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, fontWeight: 600 },
    textarea: { width: '100%', background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, minHeight: 100, resize: 'vertical' as const, fontFamily: 'inherit' },
    btn: (color = '#60a5fa') => ({ padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}12`, color, width: '100%' } as React.CSSProperties),
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={S.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>←</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Scouting report (live)</span>
          </div>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
        </div>

        <div style={S.body}>
          <div style={S.card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
              {player?.name || `#${playerNumber}`}
            </div>
            <div style={{ fontSize: 11, color: accent, fontWeight: 600 }}>
              #{playerNumber} · {player?.position || ''} · {teamName}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={S.sectionLabel}>Events so far ({playerEvents.length})</div>
            {playerEvents.length === 0 ? (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Nothing logged for this player yet.</div>
            ) : (
              <div style={S.card}>
                {playerEvents.map((e, i) => (
                  <div
                    key={e.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i === 0 ? 'none' : '0.5px solid rgba(255,255,255,0.06)' }}
                  >
                    <span style={{ fontSize: 13, color: '#fff' }}>{formatEventLabel(e)}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>P{e.period} · {e.gameTime}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 4 }}>
            <div style={S.sectionLabel}>Auto-filled from live tracking</div>
            <div style={S.statGrid}>
              <div style={S.stat}>
                <div style={S.statLabel}>Zone entries</div>
                <div style={S.statValue}>{stats.zoneEntries.successPct !== null ? `${stats.zoneEntries.successPct}%` : '—'}</div>
              </div>
              <div style={S.stat}>
                <div style={S.statLabel}>Faceoffs</div>
                <div style={S.statValue}>{stats.faceoffs.winPct !== null ? `${stats.faceoffs.winPct}%` : '—'}</div>
              </div>
              <div style={S.stat}>
                <div style={S.statLabel}>Breakouts</div>
                <div style={S.statValue}>{stats.breakouts.successPct !== null ? `${stats.breakouts.successPct}%` : '—'}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, marginBottom: 4 }}>
            <div style={S.sectionLabel}>Your evaluation</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {RATING_FIELDS.map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{f.label}</div>
                  <select
                    style={S.select}
                    value={ratings[f.key] ?? ''}
                    onChange={e => setRatings(prev => ({ ...prev, [f.key]: e.target.value ? Number(e.target.value) : undefined }))}
                  >
                    <option value="">—</option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Notes</div>
            <textarea style={S.textarea} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button style={S.btn()} onClick={() => { onSave(ratings, notes); onClose(); }}>
            Save (kept until you save the game)
          </button>
        </div>
      </div>
    </div>
  );
}
