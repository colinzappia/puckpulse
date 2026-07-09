// ============================================================
// SessionSetup.tsx
// Admin creates a game session, assigns Logger/Viewer roles
// to other users, then gets a shareable session code.
// ============================================================

import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { createSession, SessionRole, GameSession } from '../services/sessionService';
import { Player } from '../types';

interface Props {
  homeName: string;
  awayName: string;
  homeRoster: Player[];
  awayRoster: Player[];
  onSessionCreated: (session: GameSession) => void;
  onCancel: () => void;
}

// In a real app you'd fetch the org's users from Clerk.
// For now we show 4 blank invite slots the admin can fill
// with email addresses — those users see the session when they join.
const SLOT_COUNT = 4;

export default function SessionSetup({
  homeName, awayName, homeRoster, awayRoster,
  onSessionCreated, onCancel,
}: Props) {
  const { user } = useUser();
  const [step, setStep] = useState<'roles' | 'created'>('roles');
  const [slots, setSlots] = useState<{ email: string; role: SessionRole }[]>(
    Array.from({ length: SLOT_COUNT }, () => ({ email: '', role: 'viewer' })),
  );
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      // For now roles are keyed by email; once Clerk org is set up
      // this will use real user IDs. We pass an empty map for now
      // and let users self-assign roles when they join.
      const created = await createSession(
        user.id,
        homeName || 'Home',
        awayName || 'Away',
        homeRoster,
        awayRoster,
        {}, // member roles — expanded in Phase 2 with Clerk org users
      );
      setSession(created);
      setStep('created');
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
      borderRadius: 16, width: '100%', maxWidth: 420,
      maxHeight: '90vh', overflowY: 'auto' as const,
    },
    header: {
      padding: '16px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    body: { padding: 20 },
    label: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5, display: 'block' as const },
    sl: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 },
    card: { background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 12 },
    btn: (color = '#60a5fa') => ({
      width: '100%', padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600,
      cursor: 'pointer', border: `0.5px solid ${color}40`,
      background: `${color}18`, color, transition: 'all 0.15s',
    } as React.CSSProperties),
    input: {
      flex: 1, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12, outline: 'none',
    } as React.CSSProperties,
  };

  if (step === 'created' && session) {
    return (
      <div style={S.overlay}>
        <div style={S.panel}>
          <div style={S.header}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Session ready</span>
            <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} onClick={onCancel}>×</span>
          </div>
          <div style={S.body}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                Share this code with your team
              </div>
              <div style={{
                fontSize: 32, fontWeight: 900, letterSpacing: '0.15em', color: '#60a5fa',
                padding: '14px 20px', background: 'rgba(96,165,250,0.08)',
                borderRadius: 12, border: '0.5px solid rgba(96,165,250,0.2)', marginBottom: 8,
              }}>
                {session.code}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                topcheesehockey.com/join/{session.code}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.sl}>Game</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {session.homeName} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>vs</span> {session.awayName}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.sl}>Your role</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 600 }}>Admin</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Full control · can log events · can change roles</span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 16, lineHeight: 1.6 }}>
              Other users join by entering the code above. They'll be assigned as Viewer by default — you can change roles during the game.
            </div>

            <button style={S.btn()} onClick={() => onSessionCreated(session)}>
              Start tracking game →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Create game session</span>
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} onClick={onCancel}>×</span>
        </div>
        <div style={S.body}>

          {/* Game info */}
          <div style={S.card}>
            <div style={S.sl}>Game</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
              {homeName || 'Home'} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>vs</span> {awayName || 'Away'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {homeRoster.length} home players · {awayRoster.length} away players loaded
            </div>
          </div>

          {/* Role explanation */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={S.sl}>How roles work</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { role: 'Admin', color: '#60a5fa', desc: 'You. Full control, can log events, manage roles.' },
                { role: 'Logger', color: '#34d399', desc: 'Can log game events. Everything syncs in real time.' },
                { role: 'Viewer', color: '#fbbf24', desc: 'Read-only. Sees live updates but cannot log events.' },
              ].map(({ role, color, desc }) => (
                <div key={role} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${color}15`, color, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{role}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 16, lineHeight: 1.6 }}>
            Users join via the session code you'll get next. You can assign and change their roles at any time during the game.
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12, color: '#f87171' }}>
              {error}
            </div>
          )}

          <button
            style={{ ...S.btn(), opacity: loading ? 0.6 : 1 }}
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating session…' : 'Create session & get code'}
          </button>
          <button
            style={{ ...S.btn('rgba(255,255,255,0.3)'), marginTop: 8 }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
