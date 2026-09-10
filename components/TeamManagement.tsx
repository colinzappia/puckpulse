// ============================================================
// TeamManagement.tsx
// Shown to Team-plan owners (never invited members) to manage
// who shares their subscription — up to 4 additional people.
// ============================================================

import React, { useState, useEffect } from 'react';

interface Props {
  ownerEmail: string;
  onClose: () => void;
}

interface Member {
  member_email: string;
  invited_at: string;
}

const MAX_MEMBERS = 4;

export default function TeamManagement({ ownerEmail, onClose }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removingEmail, setRemovingEmail] = useState('');
  const [error, setError] = useState('');

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team-members?ownerEmail=${encodeURIComponent(ownerEmail)}`);
      const data = await res.json();
      if (res.ok) setMembers(data.members || []);
      else setError(data.error || 'Could not load your team.');
    } catch {
      setError('Could not load your team.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMembers(); }, [ownerEmail]);

  const handleInvite = async () => {
    const email = newEmail.trim();
    if (!email) return;
    setInviting(true);
    setError('');
    try {
      const res = await fetch('/api/team-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail, memberEmail: email }),
      });
      const data = await res.json();
      if (res.ok) { setNewEmail(''); await loadMembers(); }
      else setError(data.error || 'Could not add that person.');
    } catch {
      setError('Could not add that person. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberEmail: string) => {
    setRemovingEmail(memberEmail);
    setError('');
    try {
      const res = await fetch('/api/team-remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail, memberEmail }),
      });
      const data = await res.json();
      if (res.ok) await loadMembers();
      else setError(data.error || 'Could not remove that person.');
    } catch {
      setError('Could not remove that person. Please try again.');
    } finally {
      setRemovingEmail('');
    }
  };

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    panel: { background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 440, padding: 24, maxHeight: '85vh', overflowY: 'auto' as const },
    input: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' },
  };

  const slotsUsed = members.length;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>Manage your team</span>
          <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} onClick={onClose}>×</span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 20 }}>
          {slotsUsed} of {MAX_MEMBERS} additional seats used. Adding someone sends them an email explaining how to activate their access — no separate payment needed from them.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            style={S.input}
            type="email"
            placeholder="teammate@email.com"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleInvite(); }}
            disabled={inviting || slotsUsed >= MAX_MEMBERS}
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !newEmail.trim() || slotsUsed >= MAX_MEMBERS}
            style={{
              padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: inviting || slotsUsed >= MAX_MEMBERS ? 'rgba(255,255,255,0.06)' : 'rgba(96,165,250,0.15)',
              color: inviting || slotsUsed >= MAX_MEMBERS ? 'rgba(255,255,255,0.3)' : '#60a5fa',
              border: '0.5px solid rgba(96,165,250,0.3)', cursor: slotsUsed >= MAX_MEMBERS ? 'not-allowed' : 'pointer',
            }}
          >
            {inviting ? '...' : 'Add'}
          </button>
        </div>

        {slotsUsed >= MAX_MEMBERS && (
          <p style={{ color: '#fbbf24', fontSize: 11, marginBottom: 16 }}>You're at your team's limit — remove someone below to add a new person.</p>
        )}
        {error && (
          <p style={{ color: '#f87171', fontSize: 12, marginBottom: 16, background: 'rgba(248,113,113,0.08)', padding: '8px 12px', borderRadius: 8 }}>{error}</p>
        )}

        <div style={{ marginTop: 8 }}>
          {loading ? (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>Loading...</p>
          ) : members.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No team members added yet.</p>
          ) : (
            members.map(m => (
              <div key={m.member_email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#fff', fontSize: 13 }}>{m.member_email}</span>
                <button
                  onClick={() => handleRemove(m.member_email)}
                  disabled={removingEmail === m.member_email}
                  style={{ fontSize: 11, fontWeight: 700, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
                >
                  {removingEmail === m.member_email ? '...' : 'Remove'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
