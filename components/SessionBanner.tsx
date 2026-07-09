// ============================================================
// SessionBanner.tsx
// Shown at the top of the app during an active session.
// Displays session code, user's role, live indicator,
// and (for admins) a role management button.
// ============================================================

import React, { useState } from 'react';
import { GameSession, SessionRole, updateMemberRole, endSession } from '../services/sessionService';

interface Props {
  session: GameSession;
  myRole: SessionRole;
  onEndSession: () => void;
  onLeaveSession: () => void;
}

export default function SessionBanner({ session, myRole, onEndSession, onLeaveSession }: Props) {
  const [showMenu, setShowMenu] = useState(false);

  const roleColor = myRole === 'admin' ? '#60a5fa' : myRole === 'logger' ? '#34d399' : '#fbbf24';
  const roleBg = myRole === 'admin' ? 'rgba(59,130,246,0.15)' : myRole === 'logger' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)';

  return (
    <>
      <div style={{
        background: 'rgba(5,7,10,0.95)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        padding: '7px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        position: 'relative',
        zIndex: 40,
      }}>
        {/* Left — live indicator + code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: '#34d399',
            animation: 'tch-pulse 1.5s infinite',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Live session
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#60a5fa',
            background: 'rgba(96,165,250,0.1)', border: '0.5px solid rgba(96,165,250,0.2)',
            padding: '2px 8px', borderRadius: 6,
          }}>
            {session.code}
          </span>
        </div>

        {/* Right — role badge + menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 20,
            background: roleBg, color: roleColor, fontWeight: 600,
          }}>
            {myRole}
          </span>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'none',
              border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6,
              padding: '3px 8px', cursor: 'pointer',
            }}
          >
            ⋯
          </button>
        </div>
      </div>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          <div
            onClick={() => setShowMenu(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 48 }}
          />
          <div style={{
            position: 'fixed', top: 52, right: 12, zIndex: 49,
            background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 12, overflow: 'hidden', minWidth: 180,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Session code</div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', color: '#60a5fa' }}>{session.code}</div>
            </div>

            {myRole === 'viewer' && (
              <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                You are a Viewer.<br />Ask the admin to change your role to Logger to log events.
              </div>
            )}

            <button
              onClick={() => { setShowMenu(false); onLeaveSession(); }}
              style={{
                display: 'block', width: '100%', padding: '11px 14px',
                textAlign: 'left', fontSize: 13, color: 'rgba(255,255,255,0.6)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: myRole === 'admin' ? '0.5px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              Leave session
            </button>

            {myRole === 'admin' && (
              <button
                onClick={() => { setShowMenu(false); onEndSession(); }}
                style={{
                  display: 'block', width: '100%', padding: '11px 14px',
                  textAlign: 'left', fontSize: 13, color: '#f87171',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                End session for everyone
              </button>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes tch-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
