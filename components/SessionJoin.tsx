// ============================================================
// SessionJoin.tsx
// Non-admin users enter a session code to join a live game.
// Their role is determined by what the admin assigned them,
// or defaults to Viewer if they're joining cold.
// ============================================================

import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { joinSession, GameSession, SessionRole } from '../services/sessionService';

interface Props {
  onJoined: (session: GameSession, role: SessionRole) => void;
  onCancel: () => void;
}

export default function SessionJoin({ onJoined, onCancel }: Props) {
  const { user } = useUser();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (!user || !code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { session, role } = await joinSession(user.id, code);
      onJoined(session, role);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const S = {
    overlay: {
      position: 'fixed' as const, inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    },
    panel: {
      background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)',
      borderRadius: 16, width: '100%', maxWidth: 380, padding: 24,
    },
    btn: (color = '#60a5fa') => ({
      width: '100%', padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600,
      cursor: 'pointer', border: `0.5px solid ${color}40`,
      background: `${color}18`, color, marginBottom: 8,
    } as React.CSSProperties),
  };

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Join game session</span>
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} onClick={onCancel}>×</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, display: 'block' }}>
            Enter session code
          </label>
          <input
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: `0.5px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 10, padding: '14px 16px', color: '#60a5fa',
              fontSize: 24, fontWeight: 800, letterSpacing: '0.15em',
              textAlign: 'center', outline: 'none', textTransform: 'uppercase',
              marginBottom: 8,
            }}
            placeholder="ABC-1234"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            maxLength={8}
            autoFocus
          />
          {error && (
            <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>{error}</div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 20, textAlign: 'center', lineHeight: 1.6 }}>
          Get the code from whoever created the session. Your role (Logger or Viewer) will be assigned automatically.
        </div>

        <button
          style={{ ...S.btn(), opacity: !code.trim() || loading ? 0.4 : 1 }}
          onClick={handleJoin}
          disabled={!code.trim() || loading}
        >
          {loading ? 'Joining…' : 'Join session →'}
        </button>
        <button style={S.btn('rgba(255,255,255,0.3)')} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
