// ============================================================
// ScoutLineupModal.tsx
// Upload or edit a scouted lineup — a team's roster with line
// and pair assignments, tied to a specific opponent/date a
// scout watched. Reuses the same AI roster import (paste text
// or a photo) already used in Roster Setup, so a scout isn't
// hand-typing 20 names. Every saved lineup is visible to
// everyone on the plan automatically — no sharing toggle.
// ============================================================

import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Player } from '../types';
import {
  SavedScoutedLineup,
  saveScoutedLineup,
  updateScoutedLineup,
  deleteScoutedLineup,
} from '../services/scoutedLineupService';
import { fetchRosterByAI } from '../services/geminiService';
import { sortByNumber, normalizeName } from '../hooks/useTeamRoster';

interface Props {
  existing?: SavedScoutedLineup | null;
  onSaved: () => void;
  onClose: () => void;
}

const POSITIONS = ['LW', 'RW', 'C', 'LD', 'RD', 'D', 'G'];
const LINE_OPTIONS = [
  { value: '1', label: 'Line 1' },
  { value: '2', label: 'Line 2' },
  { value: '3', label: 'Line 3' },
  { value: '4', label: 'Line 4' },
  { value: 'P1', label: 'Pair 1' },
  { value: 'P2', label: 'Pair 2' },
  { value: 'P3', label: 'Pair 3' },
  { value: 'G1', label: 'Goalie 1' },
  { value: 'G2', label: 'Goalie 2' },
];

// Same downscale-before-upload approach as Roster Setup's photo import —
// a full camera photo is routinely 3-10MB, which risks blowing past
// serverless request-size limits before the image even reaches the AI.
function resizeImageForUpload(file: File, maxDimension = 1800, quality = 0.85): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Could not process image')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not load that image')); };
    img.src = objectUrl;
  });
}

export default function ScoutLineupModal({ existing, onSaved, onClose }: Props) {
  const { user } = useUser();
  const [teamName, setTeamName] = useState(existing?.teamName || '');
  const [opponent, setOpponent] = useState(existing?.opponent || '');
  const [gameDate, setGameDate] = useState(existing?.gameDate || '');
  const [roster, setRoster] = useState<Player[]>(existing?.roster || []);
  const [pasteText, setPasteText] = useState('');
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [manualNum, setManualNum] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPos, setManualPos] = useState('C');
  const [manualLine, setManualLine] = useState('1');

  const canSave = teamName.trim().length > 0 && roster.length > 0;

  const parsedToPlayers = (players: any[]): Player[] =>
    players.map((p: any) => ({
      number: p.number || '00',
      name: normalizeName(p.name),
      position: p.position || 'F',
      line: p.line || (p.position === 'G' ? 'G1' : p.position === 'D' ? 'P1' : '1'),
    }));

  const handlePasteImport = async () => {
    if (!pasteText.trim()) { alert('Paste a roster first.'); return; }
    if (!teamName.trim()) { alert('Enter a team name first.'); return; }
    setImporting(true);
    try {
      const result = await fetchRosterByAI({ teamName, rosterUrl: '', pasteText });
      if (result.status === 'ERROR') throw new Error(result.reason || 'Could not parse roster');
      const players = parsedToPlayers(result.players || []);
      if (players.length === 0) throw new Error('No players found in pasted text');
      setRoster(sortByNumber(players));
      setPasteText('');
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handlePhotoImport = async (file: File | null) => {
    if (!file) return;
    if (!teamName.trim()) { alert('Enter a team name first.'); return; }
    setImporting(true);
    try {
      const { base64, mediaType } = await resizeImageForUpload(file);
      const result = await fetchRosterByAI({ teamName, imageBase64: base64, imageMediaType: mediaType });
      if (result.status === 'ERROR') throw new Error(result.reason || 'Could not parse roster');
      const players = parsedToPlayers(result.players || []);
      if (players.length === 0) throw new Error('No players found in that photo — try a clearer, straighter shot.');
      setRoster(sortByNumber(players));
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const updatePlayer = (idx: number, field: 'number' | 'name' | 'position' | 'line', value: string) => {
    setRoster(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const removePlayer = (idx: number) => {
    setRoster(prev => prev.filter((_, i) => i !== idx));
  };

  const addManualPlayer = () => {
    if (!manualNum.trim() || !manualName.trim()) { alert('Enter a number and name.'); return; }
    setRoster(prev => sortByNumber([...prev, { number: manualNum.trim(), name: manualName.trim(), position: manualPos, line: manualLine }]));
    setManualNum('');
    setManualName('');
  };

  const handleSave = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      if (existing) {
        await updateScoutedLineup(existing.id, {
          teamName: teamName.trim(),
          opponent: opponent.trim(),
          gameDate,
          roster,
        });
      } else {
        await saveScoutedLineup(user.id, {
          teamName: teamName.trim(),
          opponent: opponent.trim() || undefined,
          gameDate: gameDate || undefined,
          roster,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save lineup.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm('Delete this lineup? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteScoutedLineup(existing.id);
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete lineup.');
    } finally {
      setDeleting(false);
    }
  };

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 360, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 361, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { flex: 1, overflowY: 'auto' as const, padding: 16 },
    sectionLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 },
    input: { width: '100%', background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 12 },
    btn: (color = '#60a5fa') => ({ padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}12`, color, width: '100%' } as React.CSSProperties),
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={S.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>←</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{existing ? 'Edit lineup' : 'Upload lineup'}</span>
          </div>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
        </div>

        <div style={S.body}>
          <div style={S.sectionLabel}>Team</div>
          <input style={S.input} value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Team name" />
          <input style={S.input} value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="Opponent (optional)" />
          <div style={S.sectionLabel}>Date seen (optional)</div>
          <input type="date" style={S.input} value={gameDate} onChange={e => setGameDate(e.target.value)} />

          {roster.length === 0 && (
            <>
              <div style={{ ...S.sectionLabel, marginTop: 16 }}>Import roster</div>
              <textarea
                style={{ ...S.input, minHeight: 80, resize: 'vertical' as const, fontFamily: 'monospace', fontSize: 11 }}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste a roster from any website…"
              />
              <button style={S.btn()} onClick={handlePasteImport} disabled={importing}>
                {importing ? 'Reading…' : '📋 Import pasted roster'}
              </button>
              <label style={{ ...S.btn('#94a3b8'), display: 'block', textAlign: 'center', marginTop: 8, cursor: 'pointer' }}>
                {importing ? 'Reading…' : '📷 Upload roster photo'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={importing}
                  style={{ display: 'none' }}
                  onChange={e => { handlePhotoImport(e.target.files?.[0] || null); e.target.value = ''; }}
                />
              </label>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 12 }}>
                Or add players one at a time below.
              </div>
            </>
          )}

          {roster.length > 0 && (
            <div style={{ ...S.sectionLabel, marginTop: 16 }}>Roster ({roster.length})</div>
          )}
          {roster.map((p, idx) => (
            <div
              key={idx}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 8, marginBottom: 6 }}
            >
              <input
                style={{ width: 36, background: 'transparent', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'center' }}
                value={p.number}
                onChange={e => updatePlayer(idx, 'number', e.target.value)}
              />
              <input
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: '#fff', fontSize: 12 }}
                value={p.name}
                onChange={e => updatePlayer(idx, 'name', e.target.value)}
              />
              <select
                style={{ background: '#0c1018', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 10, borderRadius: 6 }}
                value={p.position}
                onChange={e => updatePlayer(idx, 'position', e.target.value)}
              >
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
              <select
                style={{ background: '#0c1018', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 10, borderRadius: 6 }}
                value={p.line || '1'}
                onChange={e => updatePlayer(idx, 'line', e.target.value)}
              >
                {LINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span onClick={() => removePlayer(idx)} style={{ color: 'rgba(248,113,113,0.7)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</span>
            </div>
          ))}

          {roster.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 16 }}>
              <input
                style={{ width: 44, background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, color: '#fff', fontSize: 12, textAlign: 'center' }}
                placeholder="#"
                value={manualNum}
                onChange={e => setManualNum(e.target.value)}
              />
              <input
                style={{ flex: 1, minWidth: 0, background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, color: '#fff', fontSize: 12 }}
                placeholder="Player name"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
              />
              <select
                style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 11 }}
                value={manualPos}
                onChange={e => setManualPos(e.target.value)}
              >
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
              <select
                style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 11 }}
                value={manualLine}
                onChange={e => setManualLine(e.target.value)}
              >
                {LINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={addManualPlayer} style={{ ...S.btn('#34d399'), width: 'auto', padding: '8px 14px' }}>+</button>
            </div>
          )}

          <button style={S.btn()} onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Saving…' : existing ? 'Update lineup' : 'Save lineup'}
          </button>

          {existing && (
            <button style={{ ...S.btn('#f87171'), marginTop: 8 }} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete this lineup'}
            </button>
          )}

          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 12 }}>
            Visible to everyone on your plan automatically — there's no sharing toggle for lineups.
          </div>
        </div>
      </div>
    </div>
  );
}
