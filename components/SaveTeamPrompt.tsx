// ============================================================
// SaveTeamPrompt.tsx
// Shown after a roster is successfully imported.
// Lets the user name the team, pick a league, and choose
// whether to save privately or share with all users.
// ============================================================

import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { saveTeam } from '../services/teamLibraryService';
import { Player } from '../types';

interface Props {
  teamName: string;
  roster: Player[];
  onSaved: () => void;
  onSkip: () => void;
}

const LEAGUES = ['NHL', 'AHL', 'OHL', 'WHL', 'QMJHL', 'Junior A', 'Junior B', 'Other'];

export default function SaveTeamPrompt({ teamName, roster, onSaved, onSkip }: Props) {
  const { user } = useUser();
  const [name, setName] = useState(teamName);
  const [league, setLeague] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await saveTeam(user.id, name.trim(), league, roster, isShared);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 env(safe-area-inset-bottom)' },
    sheet: { background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 24 },
    label: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' as const },
    input: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none', marginBottom: 14 },
    btn: (color = '#60a5fa') => ({ width: '100%', padding: 13, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}18`, color, marginBottom: 8 } as React.CSSProperties),
  };

  return (
    <div style={S.overlay}>
      <div style={S.sheet}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Save to team library?</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{roster.length} players loaded</div>
          </div>
          <span onClick={onSkip} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', lineHeight: 1 }}>×</span>
        </div>

        <label style={S.label}>Team name</label>
        <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ottawa 67's" />

        <label style={S.label}>League (optional)</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {LEAGUES.map(l => (
            <button key={l} onClick={() => setLeague(league === l ? '' : l)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid rgba(255,255,255,0.1)', background: league === l ? 'rgba(96,165,250,0.2)' : 'transparent', color: league === l ? '#60a5fa' : 'rgba(255,255,255,0.4)' }}>
              {l}
            </button>
          ))}
        </div>

        <div onClick={() => setIsShared(!isShared)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: `0.5px solid ${isShared ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`, marginBottom: 20, cursor: 'pointer' }}>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: isShared ? '#34d399' : 'rgba(255,255,255,0.15)', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: isShared ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: isShared ? '#34d399' : '#fff' }}>Share with all users</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{isShared ? 'Everyone on your plan can load this roster' : 'Only you can see this team'}</div>
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{error}</div>}

        <button style={{ ...S.btn(), opacity: !name.trim() || saving ? 0.4 : 1 }} onClick={handleSave} disabled={!name.trim() || saving}>
          {saving ? 'Saving…' : '💾 Save to library'}
        </button>
        <button style={S.btn('rgba(255,255,255,0.3)')} onClick={onSkip}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
