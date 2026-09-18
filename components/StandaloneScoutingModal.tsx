// ============================================================
// StandaloneScoutingModal.tsx
// A scouting report with no tracked game behind it at all — the
// scout types in the player and team by hand. No auto-filled
// stats, since there's no tracked data to pull from. Works for
// both creating a new standalone report and editing an existing
// one (pass `existing`).
// ============================================================

import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  SavedScoutingReport,
  ScoutRatings,
  saveScoutingReport,
  updateScoutingReport,
  deleteScoutingReport,
} from '../services/scoutingReportService';

import { downloadScoutingReportPDF, emailScoutingReport } from '../utils/scoutingExport';
import LeagueGamePicker from './LeagueGamePicker';

interface Props {
  existing?: SavedScoutingReport | null;
  // Every standalone report already loaded in the hub — used only to warn
  // on a likely duplicate player name before creating a new one.
  existingReports?: SavedScoutingReport[];
  // Seeds a brand-new report's fields (from a scouted lineup's player,
  // say) without pretending it's an already-saved record — unlike
  // `existing`, this never shows a Delete button and never treats the
  // save as an update. Ignored when `existing` is set.
  prefill?: { playerName?: string; playerNumber?: string; position?: string; teamName?: string; gameDate?: string };
  onSaved: () => void;
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

export default function StandaloneScoutingModal({ existing, existingReports, prefill, onSaved, onClose }: Props) {
  const { user } = useUser();
  const [playerName, setPlayerName] = useState(existing?.playerName || prefill?.playerName || '');
  const [playerNumber, setPlayerNumber] = useState(existing?.playerNumber || prefill?.playerNumber || '');
  const [position, setPosition] = useState(existing?.position || prefill?.position || '');
  const [teamName, setTeamName] = useState(existing?.teamName || prefill?.teamName || '');
  const [gameDate, setGameDate] = useState(existing?.gameDate || prefill?.gameDate || '');
  const [ratings, setRatings] = useState<ScoutRatings>(existing?.ratings || {});
  const [notes, setNotes] = useState(existing?.notes || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);

  const canSave = playerName.trim().length > 0;

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm('Delete this scouting report? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteScoutingReport(existing.id);
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete report.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!user || !canSave) return;

    // Only warn about a likely duplicate when creating a new report — not
    // when editing an existing one, which would always "match itself."
    if (!existing) {
      const trimmedName = playerName.trim().toLowerCase();
      const possibleDupe = (existingReports || []).some(
        r => r.isStandalone && r.playerName.trim().toLowerCase() === trimmedName
      );
      if (possibleDupe && !confirm(`You already have a standalone report for "${playerName.trim()}". Save another one anyway?`)) {
        return;
      }
    }

    setSaving(true);
    try {
      if (existing) {
        await updateScoutingReport(existing.id, {
          playerName: playerName.trim(),
          position: position.trim() || undefined,
          teamName: teamName.trim() || undefined,
          gameDate: gameDate || undefined,
          ratings,
          notes,
        });
      } else {
        await saveScoutingReport(user.id, {
          playerName: playerName.trim(),
          playerNumber: playerNumber.trim() || undefined,
          position: position.trim() || undefined,
          teamName: teamName.trim() || undefined,
          gameDate: gameDate || undefined,
          isStandalone: true,
          ratings,
          notes,
          isShared: false,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save report.');
    } finally {
      setSaving(false);
    }
  };

  const handleEmail = async () => {
    const copied = await emailScoutingReport({
      playerName: playerName.trim() || 'Untitled player',
      meta: [teamName, gameDate].filter(Boolean).join(' · ') || 'No team or date noted',
      ratings,
      notes,
    });
    if (copied) {
      alert('Report copied to your clipboard — paste it into a new email.\n\n(If you have a default mail app set up on this computer, it may have also opened a new message for you.)');
    } else {
      alert("Couldn't copy the report automatically — please use Download PDF instead and attach it to your email manually.");
    }
  };

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 360, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 361, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { flex: 1, overflowY: 'auto' as const, padding: 16 },
    sectionLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 },
    input: { width: '100%', background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 12 },
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
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{existing ? 'Edit report' : 'New scouting report'}</span>
          </div>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
        </div>

        <div style={S.body}>
          <div style={S.sectionLabel}>Player</div>
          <input
            style={S.input}
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Player name"
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              style={{ ...S.input, marginBottom: 0, width: 90, flexShrink: 0 }}
              value={playerNumber}
              onChange={e => setPlayerNumber(e.target.value)}
              placeholder="#"
            />
            <input
              style={{ ...S.input, marginBottom: 0, flex: 1 }}
              value={position}
              onChange={e => setPosition(e.target.value)}
              placeholder="Position (e.g. C, LW, D)"
            />
          </div>
          <input
            style={S.input}
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="Team (optional)"
          />
          <div style={S.sectionLabel}>Date seen (optional)</div>
          <input
            type="date"
            style={S.input}
            value={gameDate}
            onChange={e => setGameDate(e.target.value)}
          />

          {!existing && (
            <button
              style={{ ...S.btn('#34d399'), marginBottom: 12 }}
              onClick={() => setShowGamePicker(true)}
            >
              📅 Pick from OHL schedule
            </button>
          )}

          <div style={{ marginTop: 8, marginBottom: 4 }}>
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

          <button style={S.btn()} onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Saving…' : existing ? 'Update report' : 'Save report'}
          </button>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              style={{ ...S.btn('#94a3b8'), flex: 1 }}
              disabled={!canSave}
              onClick={async () => {
                try {
                  await downloadScoutingReportPDF({
                    playerName: playerName.trim() || 'Untitled player',
                    meta: [teamName, gameDate].filter(Boolean).join(' · ') || 'No team or date noted',
                    ratings,
                    notes,
                  });
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Could not generate the PDF.');
                }
              }}
            >
              ⬇ Download PDF
            </button>
            <button style={{ ...S.btn('#94a3b8'), flex: 1 }} disabled={!canSave} onClick={handleEmail}>
              ✉ Email
            </button>
          </div>

          {existing && (
            <button
              style={{ ...S.btn('#f87171'), marginTop: 8 }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete this report'}
            </button>
          )}
        </div>
      </div>

      {showGamePicker && (
        <LeagueGamePicker
          onPickOne={result => {
            setTeamName(result.teamName);
            setGameDate(result.gameDate);
          }}
          onClose={() => setShowGamePicker(false)}
        />
      )}
    </div>
  );
}
