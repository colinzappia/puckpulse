import React, { useState, useEffect } from 'react';
import { GameSession, SessionRole, SessionMember, updateMemberRole, fetchSessionMembers } from '../services/sessionService';
import { supabase } from '../lib/supabaseClient';

interface Props {
  session: GameSession;
  myRole: SessionRole;
  myUserId: string;
  onEndSession: () => void;
  onLeaveSession: () => void;
}

export default function SessionBanner({ session, myRole, myUserId, onEndSession, onLeaveSession }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const roleColor = (r: SessionRole) => r === 'admin' ? '#60a5fa' : r === 'logger' ? '#34d399' : '#fbbf24';
  const roleBg = (r: SessionRole) => r === 'admin' ? 'rgba(59,130,246,0.15)' : r === 'logger' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)';

  useEffect(() => {
    if (!showMenu) return;
    fetchSessionMembers(session.id).then(setMembers);

    const channel = supabase
      .channel(`members-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_members', filter: `session_id=eq.${session.id}` },
        () => fetchSessionMembers(session.id).then(setMembers))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [showMenu, session.id]);

  const handleRoleChange = async (userId: string, newRole: SessionRole) => {
    setUpdatingRole(userId);
    try {
      await updateMemberRole(session.id, userId, newRole);
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m));
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingRole(null);
    }
  };

  return (
    <>
      <div style={{ background: 'rgba(5,7,10,0.95)', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'relative', zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', animation: 'tch-pulse 1.5s infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Live session</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '0.5px solid rgba(96,165,250,0.2)', padding: '2px 8px', borderRadius: 6 }}>
            {session.code}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: roleBg(myRole), color: roleColor(myRole), fontWeight: 600 }}>
            {myRole}
          </span>
          <button onClick={() => setShowMenu(!showMenu)} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'none', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
            ⋯
          </button>
        </div>
      </div>

      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 48 }} />
          <div style={{ position: 'fixed', top: 52, right: 12, zIndex: 49, background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', minWidth: 240, maxWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: '80vh', overflowY: 'auto' }}>

            <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Session code</div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', color: '#60a5fa' }}>{session.code}</div>
            </div>

            {members.length > 0 && (
              <div style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                <div style={{ padding: '8px 14px 4px', fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                  Users in session
                </div>
                {members.map(m => (
                  <div key={m.userId} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: m.userId === myUserId ? '#60a5fa' : '#fff' }}>
                        {m.displayName}{m.userId === myUserId ? ' (you)' : ''}
                      </div>
                    </div>
                    {myRole === 'admin' && m.userId !== myUserId ? (
                      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.1)' }}>
                        {(['logger', 'viewer'] as SessionRole[]).map(r => (
                          <button
                            key={r}
                            disabled={updatingRole === m.userId}
                            onClick={() => handleRoleChange(m.userId, r)}
                            style={{
                              padding: '3px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none',
                              background: m.role === r ? roleBg(r) : 'transparent',
                              color: m.role === r ? roleColor(r) : 'rgba(255,255,255,0.3)',
                              opacity: updatingRole === m.userId ? 0.5 : 1,
                            }}
                          >
                            {r === 'logger' ? 'Logger' : 'Viewer'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: roleBg(m.role), color: roleColor(m.role), fontWeight: 600 }}>
                        {m.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {myRole === 'viewer' && (
              <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                You are a Viewer. Ask the admin to change your role to Logger to log events.
              </div>
            )}

            <button onClick={() => { setShowMenu(false); onLeaveSession(); }} style={{ display: 'block', width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 13, color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: myRole === 'admin' ? '0.5px solid rgba(255,255,255,0.06)' : 'none' }}>
              Leave session
            </button>

            {myRole === 'admin' && (
              <button onClick={() => { setShowMenu(false); onEndSession(); }} style={{ display: 'block', width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 13, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>
                End session for everyone
              </button>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes tch-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </>
  );
}
