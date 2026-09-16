// ============================================================
// ScoutingReportModal.tsx
// Full-screen panel for entering a scouting evaluation on one
// player from a saved game report. Auto-fills tracked stats
// (zone entries, faceoffs, breakouts) from the game's raw
// events, then lets the scout add ratings and notes on top.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { SavedGameReport } from '../services/gameReportService';
import {
  SavedScoutingReport,
  ScoutRatings,
  loadReportsForGame,
  saveScoutingReport,
  updateScoutingReport,
} from '../services/scoutingReportService';
import { computePlayerStats } from '../utils/scoutingStats';
import { Team } from '../types';

interface Props {
  report: SavedGameReport;
  team: Team;
  playerNumber: string;
  onClose: () => void;
}

const RATING_FIELDS: { key: keyof ScoutRatings; label: string }[] = [
  { key: 'skating', label: 'Skating' },
  { key: 'hockeySense', label: 'Hockey sense' },
  { key: 'compete', label: 'Compete' },
  { key: 'puckSkills', label: 'Puck skills' },
  { key: 'projection', label: 'Projection' },
];

export default function ScoutingReportModal({ report, team, playerNumber, onClose }: Props) {
  const { user } = useUser();
  const roster = team === Team.HOME ? report.homeRoster : report.awayRoster;
  const player = roster.find(p => p.number === playerNumber);
  const teamSide: 'home' | 'away' = team === Team.HOME ? 'home' : 'away';

  const stats = computePlayerStats(report.events, team, playerNumber);

  const [existing, setExisting] = useState<SavedScoutingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ratings, setRatings] = useState<ScoutRatings>({});
  const [notes, setNotes] = useState('');
  const [isShared, setIsShared] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    loadReportsForGame(report.id)
      .then(all => {
        const mine = all.find(
          r => r.scoutUserId === user.id && r.teamSide === teamSide && r.playerNumber === playerNumber
        );
        if (mine) {
          setExisting(mine);
          setRatings(mine.ratings);
          setNotes(mine.notes);
          setIsShared(mine.isShared);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id, user, teamSide, playerNumber]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (existing) {
        await updateScoutingReport(existing.id, { ratings, notes, isShared });
      } else {
        await saveScoutingReport(user.id, {
          gameReportId: report.id,
          teamSide,
          playerNumber,
          playerName: player?.name || '',
          ratings,
          notes,
          isShared,
        });
      }
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save report.');
    } finally {
      setSaving(false);
    }
  };

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
    <>
      <div style={S.overlay} onClick={onClose} />
      <div style={S.panel}>
        <div style={S.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>←</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
              Scouting report {existing ? '(editing)' : ''}
            </span>
          </div>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
        </div>

        <div style={S.body}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              <div style={S.card}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                  {player?.name || `#${playerNumber}`}
                </div>
                <div style={{ fontSize: 11, color: accent, fontWeight: 600 }}>
                  #{playerNumber} · {player?.position || ''} · {teamSide === 'home' ? report.homeName : report.awayName}
                </div>
              </div>

              <div style={{ marginBottom: 4 }}>
                <div style={S.sectionLabel}>Auto-filled from live tracking</div>
                <div style={S.statGrid}>
                  <div style={S.stat}>
                    <div style={S.statLabel}>Zone entries</div>
                    <div style={S.statValue}>
                      {stats.zoneEntries.successPct !== null ? `${stats.zoneEntries.successPct}%` : '—'}
                    </div>
                  </div>
                  <div style={S.stat}>
                    <div style={S.statLabel}>Faceoffs</div>
                    <div style={S.statValue}>
                      {stats.faceoffs.winPct !== null ? `${stats.faceoffs.winPct}%` : '—'}
                    </div>
                  </div>
                  <div style={S.stat}>
                    <div style={S.statLabel}>Breakouts</div>
                    <div style={S.statValue}>
                      {stats.breakouts.successPct !== null ? `${stats.breakouts.successPct}%` : '—'}
                    </div>
                  </div>
                </div>
                {stats.zoneEntries.total === 0 && stats.faceoffs.total === 0 && stats.breakouts.total === 0 && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
                    No tracked events found for this player in this game — they may not have been tagged during tracking.
                  </div>
                )}
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
                        onChange={e =>
                          setRatings(prev => ({ ...prev, [f.key]: e.target.value ? Number(e.target.value) : undefined }))
                        }
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
                <textarea
                  style={S.textarea}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="What stood out? What would you want to see more of?"
                />
              </div>

              <div
                onClick={() => setIsShared(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: `0.5px solid ${isShared ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`, marginBottom: 16, cursor: 'pointer' }}
              >
                <div style={{ width: 36, height: 20, borderRadius: 10, background: isShared ? '#34d399' : 'rgba(255,255,255,0.15)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: isShared ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isShared ? '#34d399' : '#fff' }}>Share with plan</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {isShared ? 'Visible to everyone on your plan' : 'Only you can see this report'}
                  </div>
                </div>
              </div>

              <button style={S.btn()} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : existing ? 'Update report' : 'Save report'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
