// ============================================================
// GameHistory.tsx
// Full-screen panel showing all saved game reports.
// Tabs: My Games (private), Shared (plan-wide), Season, and
// Scouting (standalone reports with no tracked game behind
// them). Tap any game to view stats summary and re-download
// reports.
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
import { buildPlayerStats } from './playerstats';
import SeasonStats from './SeasonStats';
import PlayerShareCard from './PlayerShareCard';
import ScoutingReportModal from './ScoutingReportModal';
import LineupSheet from './LineupSheet';
import StandaloneScoutingModal from './StandaloneScoutingModal';
import { SavedScoutingReport, loadMyScoutingReports } from '../services/scoutingReportService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoadGame: (report: SavedGameReport) => void;
  onDownloadReport: (report: SavedGameReport, format: 'pdf' | 'excel' | 'html') => void;
}

function getStats(events: GameEvent[], roster: any[], team: Team) {
  const rows = buildPlayerStats(events, roster, team);
  const goals = rows.reduce((s, r) => s + r.goals, 0);
  const shotsOnNet = rows.reduce((s, r) => s + r.shotsOnNet, 0);
  const hits = rows.reduce((s, r) => s + r.hits, 0);
  const blocks = rows.reduce((s, r) => s + r.blocks, 0);
  const faceoffWins = rows.reduce((s, r) => s + r.faceoffWins, 0);
  const faceoffLosses = rows.reduce((s, r) => s + r.faceoffLosses, 0);
  const foTotal = faceoffWins + faceoffLosses;
  const teamEvents = events.filter(e => e.team === team);
  const pim = teamEvents.filter(e => e.type === EventType.PENALTY).reduce((s, e) => s + (Number(e.metadata?.minutes) || 0), 0);
  return {
    goals, shots: shotsOnNet, hits, blocks, pim,
    shootingPct: shotsOnNet > 0 ? (goals / shotsOnNet) * 100 : null,
    faceoffPct: foTotal > 0 ? (faceoffWins / foTotal) * 100 : null,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function GameHistory({ isOpen, onClose, onLoadGame, onDownloadReport }: Props) {
  const { user } = useUser();
  const [tab, setTab] = useState<'mine' | 'shared' | 'season' | 'scouting'>('mine');
  const [myReports, setMyReports] = useState<SavedGameReport[]>([]);
  const [sharedReports, setSharedReports] = useState<SavedGameReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SavedGameReport | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{ team: Team; number: string } | null>(null);
  const [scoutTarget, setScoutTarget] = useState<{ team: Team; number: string } | null>(null);
  const [standaloneReports, setStandaloneReports] = useState<SavedScoutingReport[]>([]);
  const [editingStandalone, setEditingStandalone] = useState<SavedScoutingReport | 'new' | null>(null);

  const refreshStandaloneReports = () => {
    if (!user) return;
    loadMyScoutingReports(user.id).then(all => {
      setStandaloneReports(all.filter(r => r.isStandalone));
    });
  };

  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);
    Promise.all([loadMyReports(user.id), loadSharedReports()])
      .then(([mine, shared]) => {
        setMyReports(mine);
        setSharedReports(shared.filter(r => r.userId !== user.id));
      })
      .finally(() => setLoading(false));
    refreshStandaloneReports();
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

  // Standalone editor takes over the whole screen, regardless of whether
  // a game happens to be selected underneath — it isn't tied to one.
  if (editingStandalone !== null) {
    return (
      <StandaloneScoutingModal
        existing={editingStandalone === 'new' ? null : editingStandalone}
        onSaved={refreshStandaloneReports}
        onClose={() => setEditingStandalone(null)}
      />
    );
  }

  const reports = tab === 'mine' ? myReports : sharedReports;

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 350, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 351, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    tabBar: { display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: '#0c1018', flexShrink: 0 },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    tab: (active: boolean) => ({ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const, color: active ? '#60a5fa' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent' } as React.CSSProperties),
    body: { flex: 1, overflowY: 'auto' as const, padding: '0 16px 24px' },
    card: { background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.15s' },
    btn: (color = '#60a5fa') => ({ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}12`, color } as React.CSSProperties),
  };

  // Detail view
  if (selected) {
    const homeStats = getStats(selected.events, selected.homeRoster, Team.HOME);
    const awayStats = getStats(selected.events, selected.awayRoster, Team.AWAY);
    const canEdit = selected.userId === user?.id;

    return (
      <>
        <div style={S.overlay} onClick={() => setSelected(null)} />
        <div style={S.panel}>
          <div style={S.topbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span onClick={() => setSelected(null)}
