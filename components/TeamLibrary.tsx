// ============================================================
// TeamLibrary.tsx
// Full-screen panel for browsing and loading saved rosters.
// Two tabs: My Teams (private) and Shared (org-wide).
// Admin can delete their own teams; shared teams can be
// deleted by the user who created them.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { SavedTeam, loadMyTeams, loadSharedTeams, deleteTeam } from '../services/teamLibraryService';
import { Player } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoadTeam: (name: string, roster: Player[], logo: string) => void;
}

const LEAGUE_COLORS: Record<string, string> = {
  NHL: '#34d399', AHL: '#fbbf24', OHL: '#f87171',
  WHL: '#a5b4fc', QMJHL: '#f472b6', 'Junior A': '#60a5fa',
  'Junior B': '#94a3b8', Other: '#94a3b8',
};

export default function TeamLibrary({ isOpen, onClose, onLoadTeam }: Props) {
  const { user } = useUser();
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');
  const [myTeams, setMyTeams] = useState<SavedTeam[]>([]);
  const [sharedTeams, setSharedTeams] = useState<SavedTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);
    Promise.all([loadMyTeams(user.id), loadSharedTeams()])
      .then(([mine, shared]) => {
        setMyTeams(mine);
        // Filter shared to exclude ones already in mine
        setSharedTeams(shared.filter(s => s.userId !== user.id));
      })
      .finally(() => setLoading(false));
  }, [isOpen, user]);

  const handleDelete = async (team: SavedTeam) => {
    if (!confirm(`Delete "${team.name}"? This cannot be undone.`)) return;
    setDeleting(team.id);
    try {
      await deleteTeam(team.id);
      setMyTeams(prev => prev.filter(t => t.id !== team.id));
      setSharedTeams(prev => prev.filter(t => t.id !== team.id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  const teams = tab === 'mine' ? myTeams : sharedTeams;
  const filtered = search.trim()
    ? teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.league.toLowerCase().includes(search.toLowerCase()))
    : teams;

  if (!isOpen) return null;

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 350, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 351, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    tabBar: { display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: '#0c1018', flexShrink: 0 },
    tab: (active: boolean) => ({ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const, borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent', color: active ? '#60a5fa' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent' } as React.CSSProperties),
  };

  return (
    <>
      <div style={S.overlay} onClick={onClose} />
      <div style={S.panel}>
        <div style={S.topbar}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Team Library</span>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', lineHeight: 1 }}>×</span>
        </div>

        <div style={S.tabBar}>
          <button style={S.tab(tab === 'mine')} onClick={() => setTab('mine')}>
            My Teams {myTeams.length > 0 && `(${myTeams.length})`}
          </button>
          <button style={S.tab(tab === 'shared')} onClick={() => setTab('shared')}>
            Shared {sharedTeams.length > 0 && `(${sharedTeams.length})`}
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <input
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 14px', color: '#fff', fontSize: 13, outline: 'none' }}
            placeholder="Search teams..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Team list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.7 }}>
              {tab === 'mine'
                ? 'No saved teams yet.\nImport a roster and save it to build your library.'
                : 'No shared teams yet.\nSave a team and toggle "Share with all users" to add it here.'}
            </div>
          ) : (
            filtered.map(team => {
              const lc = LEAGUE_COLORS[team.league] || '#94a3b8';
              const canDelete = team.userId === user?.id;
              return (
                <div key={team.id} style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    {team.logo ? (
                      <img src={team.logo} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, background: 'rgba(255,255,255,0.05)', padding: 3, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🏒</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {team.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {team.league && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: `${lc}18`, color: lc, border: `0.5px solid ${lc}30` }}>
                            {team.league}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {team.roster.length} players
                        </span>
                        {team.isShared && (
                          <span style={{ fontSize: 10, color: '#34d399' }}>· shared</span>
                        )}
                      </div>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(team)}
                        disabled={deleting === team.id}
                        style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}
                      >
                        {deleting === team.id ? '…' : '✕'}
                      </button>
                    )}
                  </div>

                  {/* Roster preview */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {team.roster.slice(0, 8).map(p => (
                      <span key={p.number} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                        #{p.number} {p.name.split(' ').pop()}
                      </span>
                    ))}
                    {team.roster.length > 8 && (
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>+{team.roster.length - 8} more</span>
                    )}
                  </div>

                  <button
                    onClick={() => { onLoadTeam(team.name, team.roster, team.logo || ''); onClose(); }}
                    style={{ width: '100%', padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(96,165,250,0.12)', border: '0.5px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}
                  >
                    Load this roster
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
