// ============================================================
// GameHistory.tsx
// Full-screen panel showing all saved game reports.
// Two tabs: My Games (private) and Shared (plan-wide).
// Tap any game to view stats summary and re-download reports.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  SavedGameReport,
  loadMyReports,
  loadSharedReports,
  deleteGameReport,
  toggleReportShared,
} from '../services/gameReportService';
import { GameEvent, EventType, Team } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoadGame: (report: SavedGameReport) => void;
  onDownloadReport: (report: SavedGameReport, format: 'pdf' | 'excel' | 'html') => void;
}

function getStats(events: GameEvent[], team: Team) {
  const te = events.filter(e => e.team === team);
  return {
    goals: te.filter(e => e.type === EventType.GOAL).length,
    shots: te.filter(e => e.type === EventType.SHOT || e.type === EventType.GOAL).length,
    penalties: te.filter(e => e.type === EventType.PENALTY).length,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function GameHistory({ isOpen, onClose, onLoadGame, onDownloadReport }: Props) {
  const { user } = useUser();
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');
  const [myReports, setMyReports] = useState<SavedGameReport[]>([]);
  const [sharedReports, setSharedReports] = useState<SavedGameReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SavedGameReport | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);
    Promise.all([loadMyReports(user.id), loadSharedReports()])
      .then(([mine, shared]) => {
        setMyReports(mine);
        setSharedReports(shared.filter(r => r.userId !== user.id));
      })
      .finally(() => setLoading(false));
  }, [isOpen, user]);

  const handleDelete = async (report: SavedGameReport) => {
    if (!confirm(`Delete this game report? This cannot be undone.`)) return;
    setDeleting(report.id);
    await deleteGameReport(report.id);
    setMyReports(prev => prev.filter(r => r.id !== report.id));
    if (selected?.id === report.id) setSelected(null);
    setDeleting(null);
  };

  const handleToggleShared = async (report: SavedGameReport) => {
    setToggling(report.id);
    const newVal = !report.isShared;
    await toggleReportShared(report.id, newVal);
    setMyReports(prev => prev.map(r => r.id === report.id ? { ...r, isShared: newVal } : r));
    if (selected?.id === report.id) setSelected({ ...selected, isShared: newVal });
    setToggling(null);
  };

  if (!isOpen) return null;

  const reports = tab === 'mine' ? myReports : sharedReports;

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 350, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 351, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    tabBar: { display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: '#0c1018', flexShrink: 0 },
    tab: (active: boolean) => ({ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const, color: active ? '#60a5fa' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent' } as React.CSSProperties),
    body: { flex: 1, overflowY: 'auto' as const, padding: '0 16px 24px' },
    card: { background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.15s' },
    btn: (color = '#60a5fa') => ({ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}12`, color } as React.CSSProperties),
  };

  // Detail view
  if (selected) {
    const homeStats = getStats(selected.events, Team.HOME);
    const awayStats = getStats(selected.events, Team.AWAY);
    const canEdit = selected.userId === user?.id;

    return (
      <>
        <div style={S.overlay} onClick={() => setSelected(null)} />
        <div style={S.panel}>
          <div style={S.topbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span onClick={() => setSelected(null)} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>←</span>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Game report</span>
            </div>
            <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {/* Score card */}
            <div style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>{formatDate(selected.playedAt)}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  {selected.homeLogo && <img src={selected.homeLogo} alt="" style={{ width: 40, height: 40, objectFit: 'contain', margin: '0 auto 6px', display: 'block' }} />}
                  <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600, marginBottom: 4 }}>{selected.homeName}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#fff' }}>{selected.homeScore}</div>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', fontWeight: 700, padding: '0 12px' }}>vs</div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  {selected.awayLogo && <img src={selected.awayLogo} alt="" style={{ width: 40, height: 40, objectFit: 'contain', margin: '0 auto 6px', display: 'block' }} />}
                  <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600, marginBottom: 4 }}>{selected.awayName}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#fff' }}>{selected.awayScore}</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Shots', home: homeStats.shots, away: awayStats.shots },
                { label: 'Goals', home: homeStats.goals, away: awayStats.goals },
                { label: 'Penalties', home: homeStats.penalties, away: awayStats.penalties },
              ].map(s => (
                <div key={s.label} style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>{s.home}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>–</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#f87171' }}>{s.away}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
              {selected.events.length} events logged · {selected.periods} periods
            </div>

            {/* Download buttons */}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>Download report</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['pdf', 'excel', 'html'] as const).map(fmt => (
                <button key={fmt} style={S.btn()} onClick={() => onDownloadReport(selected, fmt)}>
                  {fmt === 'pdf' ? '📄 PDF' : fmt === 'excel' ? '📊 Excel' : '🌐 HTML'}
                </button>
              ))}
            </div>

            {/* Share toggle (own reports only) */}
            {canEdit && (
              <div onClick={() => handleToggleShared(selected)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: `0.5px solid ${selected.isShared ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`, marginBottom: 12, cursor: 'pointer', opacity: toggling === selected.id ? 0.5 : 1 }}>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: selected.isShared ? '#34d399' : 'rgba(255,255,255,0.15)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: selected.isShared ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: selected.isShared ? '#34d399' : '#fff' }}>Share with plan</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{selected.isShared ? 'Visible to everyone on your plan' : 'Only you can see this report'}</div>
                </div>
              </div>
            )}

            {/* Delete */}
            {canEdit && (
              <button onClick={() => handleDelete(selected)}
                style={{ width: '100%', padding: 11, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '0.5px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', opacity: deleting === selected.id ? 0.5 : 1 }}>
                {deleting === selected.id ? 'Deleting…' : 'Delete this report'}
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  // List view
  return (
    <>
      <div style={S.overlay} onClick={onClose} />
      <div style={S.panel}>
        <div style={S.topbar}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Game History</span>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>×</span>
        </div>

        <div style={S.tabBar}>
          <button style={S.tab(tab === 'mine')} onClick={() => setTab('mine')}>
            My Games {myReports.length > 0 && `(${myReports.length})`}
          </button>
          <button style={S.tab(tab === 'shared')} onClick={() => setTab('shared')}>
            Shared {sharedReports.length > 0 && `(${sharedReports.length})`}
          </button>
        </div>

        <div style={S.body}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Loading…</div>
          ) : reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.7 }}>
              {tab === 'mine' ? 'No saved games yet.\nTap "Save game" after your next game.' : 'No shared reports yet.'}
            </div>
          ) : (
            reports.map(r => {
              const homeWon = r.homeScore > r.awayScore;
              const tied = r.homeScore === r.awayScore;
              return (
                <div key={r.id} style={{ ...S.card }} onClick={() => setSelected(r)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {r.homeLogo && <img src={r.homeLogo} alt="" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.homeName} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>vs</span> {r.awayName}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{formatDate(r.playedAt)} · {r.events.length} events</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: tied ? 'rgba(255,255,255,0.5)' : homeWon ? '#60a5fa' : '#f87171' }}>
                        {r.homeScore}–{r.awayScore}
                      </div>
                      {r.isShared && <div style={{ fontSize: 9, color: '#34d399', fontWeight: 600 }}>shared</div>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
