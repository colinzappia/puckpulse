import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { SavedTeam, loadMyTeams, loadSharedTeams, deleteTeam, updateTeam } from '../services/teamLibraryService';
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
const LEAGUES = ['NHL', 'AHL', 'OHL', 'WHL', 'QMJHL', 'Junior A', 'Junior B', 'Other'];

export default function TeamLibrary({ isOpen, onClose, onLoadTeam }: Props) {
  const { user } = useUser();
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');
  const [myTeams, setMyTeams] = useState<SavedTeam[]>([]);
  const [sharedTeams, setSharedTeams] = useState<SavedTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SavedTeam | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editLeague, setEditLeague] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editRoster, setEditRoster] = useState<Player[]>([]);
  const [editShared, setEditShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ number: '', name: '', position: 'F', line: '1' });

  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);
    Promise.all([loadMyTeams(user.id), loadSharedTeams()])
      .then(([mine, shared]) => {
        setMyTeams(mine);
        setSharedTeams(shared.filter(s => s.userId !== user.id));
      })
      .finally(() => setLoading(false));
  }, [isOpen, user]);

  const openEdit = (team: SavedTeam) => {
    setEditing(team);
    setEditName(team.name);
    setEditLeague(team.league);
    setEditLogo(team.logo);
    setEditRoster([...team.roster]);
    setEditShared(team.isShared);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateTeam(editing.id, { name: editName, league: editLeague, logo: editLogo, roster: editRoster, isShared: editShared });
      const updated = { ...editing, name: editName, league: editLeague, logo: editLogo, roster: editRoster, isShared: editShared };
      setMyTeams(prev => prev.map(t => t.id === editing.id ? updated : t));
      setEditing(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (team: SavedTeam) => {
    if (!confirm(`Delete "${team.name}"? This cannot be undone.`)) return;
    setDeleting(team.id);
    try {
      await deleteTeam(team.id);
      setMyTeams(prev => prev.filter(t => t.id !== team.id));
      setSharedTeams(prev => prev.filter(t => t.id !== team.id));
    } catch (e) { console.error(e); }
    finally { setDeleting(null); }
  };

  const removePlayer = (number: string) => setEditRoster(prev => prev.filter(p => p.number !== number));
  const addPlayer = () => {
    if (!newPlayer.number.trim() || !newPlayer.name.trim()) return;
    setEditRoster(prev => [...prev, { ...newPlayer }]);
    setNewPlayer({ number: '', name: '', position: 'F', line: '1' });
  };

  if (!isOpen) return null;

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 350, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 351, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    tabBar: { display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: '#0c1018', flexShrink: 0 },
    tab: (active: boolean) => ({ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const, color: active ? '#60a5fa' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent' } as React.CSSProperties),
    body: { flex: 1, overflowY: 'auto' as const, padding: '0 16px 24px' },
    inp: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', marginBottom: 10 } as React.CSSProperties,
    lbl: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5, display: 'block' as const },
    btn: (c = '#60a5fa') => ({ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `0.5px solid ${c}40`, background: `${c}15`, color: c } as React.CSSProperties),
  };

  // ── Edit view ──────────────────────────────────────────────
  if (editing) {
    return (
      <>
        <div style={S.overlay} />
        <div style={S.panel}>
          <div style={S.topbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span onClick={() => setEditing(null)} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>←</span>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Edit team</span>
            </div>
            <button onClick={handleSaveEdit} disabled={saving} style={S.btn()}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          <div style={S.body}>
            <div style={{ paddingTop: 12 }}>
              <label style={S.lbl}>Team name</label>
              <input style={S.inp} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Team name" />

              <label style={S.lbl}>Logo URL</label>
              <input style={S.inp} value={editLogo} onChange={e => setEditLogo(e.target.value)} placeholder="https://..." />
              {editLogo && <img src={editLogo} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: 'rgba(255,255,255,0.05)', padding: 4, marginBottom: 12 }} />}

              <label style={S.lbl}>League</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {LEAGUES.map(l => (
                  <button key={l} onClick={() => setEditLeague(editLeague === l ? '' : l)}
                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid rgba(255,255,255,0.1)', background: editLeague === l ? 'rgba(96,165,250,0.2)' : 'transparent', color: editLeague === l ? '#60a5fa' : 'rgba(255,255,255,0.4)' }}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Shared toggle */}
              <div onClick={() => setEditShared(!editShared)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: `0.5px solid ${editShared ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`, marginBottom: 16, cursor: 'pointer' }}>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: editShared ? '#34d399' : 'rgba(255,255,255,0.15)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: editShared ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: editShared ? '#34d399' : '#fff' }}>
                  {editShared ? 'Shared with all users' : 'Private — only you'}
                </div>
              </div>

              {/* Roster */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...S.lbl, marginBottom: 0 }}>Roster ({editRoster.length} players)</label>
              </div>

              {/* Add player */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Add player</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input style={{ ...S.inp, width: 60, marginBottom: 0, textAlign: 'center' }} placeholder="#" value={newPlayer.number} onChange={e => setNewPlayer(p => ({ ...p, number: e.target.value }))} />
                  <input style={{ ...S.inp, flex: 1, marginBottom: 0 }} placeholder="Full name" value={newPlayer.name} onChange={e => setNewPlayer(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {['F', 'D', 'G'].map(pos => (
                    <button key={pos} onClick={() => setNewPlayer(p => ({ ...p, position: pos }))}
                      style={{ flex: 1, padding: '6px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid rgba(255,255,255,0.1)', background: newPlayer.position === pos ? 'rgba(96,165,250,0.2)' : 'transparent', color: newPlayer.position === pos ? '#60a5fa' : 'rgba(255,255,255,0.4)' }}>
                      {pos}
                    </button>
                  ))}
                </div>
                <button onClick={addPlayer} disabled={!newPlayer.number.trim() || !newPlayer.name.trim()}
                  style={{ ...S.btn(), width: '100%', textAlign: 'center', opacity: !newPlayer.number.trim() || !newPlayer.name.trim() ? 0.4 : 1 }}>
                  + Add player
                </button>
              </div>

              {/* Player list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {editRoster.map(p => (
                  <div key={p.number} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', width: 28, flexShrink: 0 }}>#{p.number}</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#fff' }}>{p.name}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginRight: 4 }}>{p.position}</span>
                    <button onClick={() => removePlayer(p.number)} style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── List view ──────────────────────────────────────────────
  const teams = tab === 'mine' ? myTeams : sharedTeams;
  const filtered = search.trim()
    ? teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.league.toLowerCase().includes(search.toLowerCase()))
    : teams;

  return (
    <>
      <div style={S.overlay} onClick={onClose} />
      <div style={S.panel}>
        <div style={S.topbar}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Team Library</span>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', lineHeight: 1 }}>×</span>
        </div>

        <div style={S.tabBar}>
          <button style={S.tab(tab === 'mine')} onClick={() => setTab('mine')}>My Teams {myTeams.length > 0 && `(${myTeams.length})`}</button>
          <button style={S.tab(tab === 'shared')} onClick={() => setTab('shared')}>Shared {sharedTeams.length > 0 && `(${sharedTeams.length})`}</button>
        </div>

        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <input style={{ ...S.inp, marginBottom: 0 }} placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div style={S.body}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.7 }}>
              {tab === 'mine' ? 'No saved teams yet.\nImport a roster and save it to build your library.' : 'No shared teams yet.'}
            </div>
          ) : (
            filtered.map(team => {
              const lc = LEAGUE_COLORS[team.league] || '#94a3b8';
              const canEdit = team.userId === user?.id;
              return (
                <div key={team.id} style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    {team.logo ? (
                      <img src={team.logo} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, background: 'rgba(255,255,255,0.05)', padding: 3, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🏒</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {team.league && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: `${lc}18`, color: lc, border: `0.5px solid ${lc}30` }}>{team.league}</span>}
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{team.roster.length} players</span>
                        {team.isShared && <span style={{ fontSize: 10, color: '#34d399' }}>· shared</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {canEdit && (
                        <button onClick={() => openEdit(team)} style={{ fontSize: 11, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Edit</button>
                      )}
                      {canEdit && (
                        <button onClick={() => handleDelete(team)} disabled={deleting === team.id} style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                          {deleting === team.id ? '…' : '✕'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {team.roster.slice(0, 8).map(p => (
                      <span key={p.number} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>#{p.number} {p.name.split(' ').pop()}</span>
                    ))}
                    {team.roster.length > 8 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>+{team.roster.length - 8} more</span>}
                  </div>

                  <button onClick={() => { onLoadTeam(team.name, team.roster, team.logo || ''); onClose(); }}
                    style={{ width: '100%', padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(96,165,250,0.12)', border: '0.5px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}>
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
