// ============================================================
// ScoutLineupModal.tsx
// Upload or edit a scouted lineup. Creating a new one shows two
// teams side by side, each with the same paste/photo AI import
// coaches already use in Roster Setup, plus drag-and-drop line
// assignment — identical interaction to the live tracking
// screen's lineup panel, just built standalone here since that
// version lives inline in App.tsx and isn't reusable directly.
// Editing an existing lineup shows just that one team. Every
// saved lineup is visible to everyone on the plan automatically
// — no sharing toggle.
// ============================================================

import React, { useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useUser } from '@clerk/clerk-react';
import { Player, Team } from '../types';
import {
  SavedScoutedLineup,
  saveScoutedLineup,
  updateScoutedLineup,
  deleteScoutedLineup,
} from '../services/scoutedLineupService';
import { fetchRosterByAI } from '../services/geminiService';
import { sortByNumber, normalizeName } from '../hooks/useTeamRoster';
import LeagueGamePicker from './LeagueGamePicker';
import StandaloneScoutingModal from './StandaloneScoutingModal';
import LineupSheet from './LineupSheet';

interface Props {
  existing?: SavedScoutedLineup | null;
  // Every lineup already loaded in the hub — used only to find this
  // one's opponent (another saved lineup referencing this team as its
  // own opponent, for the same date) so both sides of the same game
  // can be shown together instead of requiring a separate click back
  // to the list to see the other team.
  allLineups?: SavedScoutedLineup[];
  onSaved: () => void;
  onClose: () => void;
}

const POSITIONS = ['LW', 'RW', 'C', 'LD', 'RD', 'D', 'G'];
const LINE_OPTIONS = [
  { value: '1', label: 'Line 1' },
  { value: '2', label: 'Line 2' },
  { value: '3', label: 'Line 3' },
  { value: '4', label: 'Line 4' },
  { value: 'P1', label: 'Pair 1' },
  { value: 'P2', label: 'Pair 2' },
  { value: 'P3', label: 'Pair 3' },
  { value: 'G1', label: 'Goalie 1' },
  { value: 'G2', label: 'Goalie 2' },
];
const ASSIGNED_LINES = new Set(['1', '2', '3', '4', 'P1', 'P2', 'P3', 'G1', 'G2']);

// Same downscale-before-upload approach as Roster Setup's photo import.
function resizeImageForUpload(file: File, maxDimension = 1800, quality = 0.85): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Could not process image')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not load that image')); };
    img.src = objectUrl;
  });
}

// ── Draggable player chip — same drag-id scheme as the live tracking
// screen's lineup panel (player-{team}-{number}), just restyled with
// inline styles to match the rest of the Scouting portal instead of
// Tailwind classes.
const DraggablePlayer: React.FC<{ p: Player; team: Team; accent: string; onPlayerClick?: (p: Player) => void }> = ({ p, team, accent, onPlayerClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `player-${team}-${p.number}` });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    height: 38,
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: `0.5px solid ${accent}40`,
    background: `${accent}15`,
    color: '#fff',
    touchAction: 'none',
    cursor: onPlayerClick ? 'pointer' : 'grab',
    padding: '2px 4px',
    overflow: 'hidden',
  };
  // A short tap still fires this onClick normally — dnd-kit only starts
  // an actual drag once the pointer moves past its activation distance,
  // so click-to-scout and drag-to-reassign coexist on the same chip.
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => onPlayerClick?.(p)}>
      <span style={{ fontSize: 10, fontWeight: 900, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        #{p.number} {p.name.split(' ').pop()}
      </span>
      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{p.position}</span>
    </div>
  );
};

// ── Drop target for one slot (a forward position on a line, a D-pair
// side, or a goalie slot) — same drop-id scheme as the live tracking
// screen: line-{team}-{lineOrPair}-{position}.
const DroppableSlot: React.FC<{ id: string; children: React.ReactNode; label: string; cols?: number }> = ({ id, children, label, cols = 1 }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hasChildren = React.Children.count(children) > 0;
  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'relative',
        minHeight: 42,
        borderRadius: 10,
        border: `1px dashed ${isOver ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
        background: isOver ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 3, padding: 3, height: '100%' }}>
        {children}
      </div>
      {!hasChildren && !isOver && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, pointerEvents: 'none' }}>
          <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
        </div>
      )}
    </div>
  );
};

// ── The visual line/pair/goalie grid for one team — drag players
// between slots to reassign them, same behavior as the live
// tracking screen.
function RosterGrid({ team, roster, accent, onPlayerClick }: { team: Team; roster: Player[]; accent: string; onPlayerClick?: (p: Player) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {['1', '2', '3', '4'].map(lineNum => (
        <div key={`line-${lineNum}`}>
          <div style={{ fontSize: 8, fontWeight: 900, color: accent, marginBottom: 2 }}>LINE {lineNum}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {['LW', 'C', 'RW'].map((pos, posIdx) => {
              const playersOnLine = roster.filter(p => p.line === lineNum);
              const playersInSlot = playersOnLine.filter(p => {
                if (p.position === pos) return true;
                if (p.position === 'F') {
                  const fPlayers = playersOnLine.filter(pl => pl.position === 'F');
                  const idx = fPlayers.indexOf(p);
                  return posIdx === 2 ? idx >= 2 : idx === posIdx;
                }
                return false;
              });
              return (
                <DroppableSlot key={pos} id={`line-${team}-${lineNum}-${pos}`} label={pos} cols={Math.max(1, playersInSlot.length)}>
                  {playersInSlot.map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} accent={accent} onPlayerClick={onPlayerClick} />)}
                </DroppableSlot>
              );
            })}
          </div>
        </div>
      ))}
      {['P1', 'P2', 'P3'].map(pairNum => (
        <div key={`pair-${pairNum}`}>
          <div style={{ fontSize: 8, fontWeight: 900, color: accent, marginBottom: 2 }}>PAIR {pairNum.replace('P', '')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}>
            {['D1', 'D2'].map((pos, posIdx) => {
              const playersOnPair = roster.filter(p => p.line === pairNum);
              const playersInSlot = playersOnPair.filter(p => {
                if (p.position === 'LD' && posIdx === 0) return true;
                if (p.position === 'RD' && posIdx === 1) return true;
                if (p.position === 'D') {
                  const dPlayers = playersOnPair.filter(pl => pl.position === 'D');
                  const idx = dPlayers.indexOf(p);
                  return posIdx === 1 ? idx >= 1 : idx === 0;
                }
                return false;
              });
              return (
                <DroppableSlot key={pos} id={`line-${team}-${pairNum}-${posIdx === 0 ? 'LD' : 'RD'}`} label={pos} cols={Math.max(1, playersInSlot.length)}>
                  {playersInSlot.map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} accent={accent} onPlayerClick={onPlayerClick} />)}
                </DroppableSlot>
              );
            })}
          </div>
        </div>
      ))}
      <div>
        <div style={{ fontSize: 8, fontWeight: 900, color: accent, marginBottom: 2 }}>GOALIES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}>
          {['G1', 'G2'].map(goalieNum => (
            <DroppableSlot key={goalieNum} id={`line-${team}-${goalieNum}-G`} label={goalieNum === 'G1' ? 'Starter' : 'Backup'}>
              {roster.filter(p => p.line === goalieNum).map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} accent={accent} onPlayerClick={onPlayerClick} />)}
            </DroppableSlot>
          ))}
        </div>
      </div>
      {roster.filter(p => !ASSIGNED_LINES.has(p.line || '')).length > 0 && (
        <div>
          <div style={{ fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>UNASSIGNED</div>
          <DroppableSlot id={`line-${team}-unassigned`} label="?" cols={2}>
            {roster.filter(p => !ASSIGNED_LINES.has(p.line || '')).map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} accent={accent} onPlayerClick={onPlayerClick} />)}
          </DroppableSlot>
        </div>
      )}
    </div>
  );
}

// ── One team's full entry pane: name field, import (paste or photo)
// before a roster exists, then the drag grid plus a compact editable
// list (for number/name typo fixes and removal) plus manual add.
function TeamEntryPane({
  team, accent, teamName, onTeamNameChange, roster, onRosterChange, placeholder, onPlayerClick,
}: {
  team: Team;
  accent: string;
  teamName: string;
  onTeamNameChange: (v: string) => void;
  roster: Player[];
  onRosterChange: (r: Player[]) => void;
  placeholder: string;
  onPlayerClick?: (p: Player) => void;
}) {
  const [pasteText, setPasteText] = useState('');
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [manualNum, setManualNum] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPos, setManualPos] = useState('C');
  const [manualLine, setManualLine] = useState('1');

  const parsedToPlayers = (players: any[]): Player[] =>
    players.map((p: any) => ({
      number: p.number || '00',
      name: normalizeName(p.name),
      position: p.position || 'F',
      line: p.line || (p.position === 'G' ? 'G1' : p.position === 'D' ? 'P1' : '1'),
    }));

  const handlePasteImport = async () => {
    if (!pasteText.trim()) { alert('Paste a roster first.'); return; }
    if (!teamName.trim()) { alert('Enter a team name first.'); return; }
    setImporting(true);
    try {
      const result = await fetchRosterByAI({ teamName, rosterUrl: '', pasteText });
      if (result.status === 'ERROR') throw new Error(result.reason || 'Could not parse roster');
      const players = parsedToPlayers(result.players || []);
      if (players.length === 0) throw new Error('No players found in pasted text');
      onRosterChange(sortByNumber(players));
      setPasteText('');
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handlePhotoImport = async (file: File | null) => {
    if (!file) return;
    if (!teamName.trim()) { alert('Enter a team name first.'); return; }
    setImporting(true);
    try {
      const { base64, mediaType } = await resizeImageForUpload(file);
      const result = await fetchRosterByAI({ teamName, imageBase64: base64, imageMediaType: mediaType });
      if (result.status === 'ERROR') throw new Error(result.reason || 'Could not parse roster');
      const players = parsedToPlayers(result.players || []);
      if (players.length === 0) throw new Error('No players found in that photo — try a clearer, straighter shot.');
      onRosterChange(sortByNumber(players));
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const updatePlayer = (idx: number, field: 'number' | 'name' | 'position' | 'line', value: string) => {
    onRosterChange(roster.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const removePlayer = (idx: number) => {
    onRosterChange(roster.filter((_, i) => i !== idx));
  };

  const addManualPlayer = () => {
    if (!manualNum.trim() || !manualName.trim()) { alert('Enter a number and name.'); return; }
    onRosterChange(sortByNumber([...roster, { number: manualNum.trim(), name: manualName.trim(), position: manualPos, line: manualLine }]));
    setManualNum('');
    setManualName('');
  };

  return (
    <div style={{ flex: '1 1 300px', minWidth: 280 }}>
      <input
        style={{ width: '100%', background: '#0f1620', border: `0.5px solid ${accent}40`, borderRadius: 10, padding: '10px 12px', color: accent, fontSize: 13, fontWeight: 700, marginBottom: 8, boxSizing: 'border-box' as const }}
        value={teamName}
        onChange={e => onTeamNameChange(e.target.value)}
        placeholder={placeholder}
      />

      {roster.length === 0 ? (
        <div style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 10 }}>
          <textarea
            style={{ width: '100%', background: '#0c1018', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, color: '#fff', fontSize: 10, fontFamily: 'monospace', minHeight: 60, resize: 'vertical' as const, marginBottom: 6, boxSizing: 'border-box' as const }}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder="Paste roster text…"
          />
          <button
            onClick={handlePasteImport}
            disabled={importing}
            style={{ width: '100%', padding: 8, borderRadius: 8, fontSize: 11, fontWeight: 700, border: `0.5px solid ${accent}40`, background: `${accent}15`, color: accent, cursor: 'pointer', marginBottom: 6 }}
          >
            {importing ? 'Reading…' : '📋 Import pasted roster'}
          </button>
          <div
            onDragOver={e => { e.preventDefault(); if (!importing) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              if (importing) return;
              const file = e.dataTransfer.files?.[0];
              if (file) handlePhotoImport(file);
            }}
            style={{
              position: 'relative',
              textAlign: 'center',
              padding: 14,
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              border: `1.5px dashed ${dragOver ? accent : 'rgba(255,255,255,0.15)'}`,
              background: dragOver ? `${accent}15` : 'rgba(255,255,255,0.05)',
              color: dragOver ? accent : 'rgba(255,255,255,0.6)',
              cursor: importing ? 'default' : 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {importing ? 'Reading…' : dragOver ? 'Drop photo to import' : '📷 Drag a roster photo here, or tap to browse'}
            <input
              type="file"
              accept="image/*"
              disabled={importing}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: importing ? 'default' : 'pointer' }}
              onChange={e => { handlePhotoImport(e.target.files?.[0] || null); e.target.value = ''; }}
            />
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 8 }}>
            Or skip import — enter a team name above, then add players manually once the roster area appears.
          </div>
          <button
            onClick={() => onRosterChange([{ number: '', name: '', position: 'C', line: '1' }])}
            style={{ width: '100%', marginTop: 6, padding: 6, borderRadius: 8, fontSize: 10, fontWeight: 600, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
          >
            Start with an empty roster instead
          </button>
        </div>
      ) : (
        <>
          <RosterGrid team={team} roster={roster} accent={accent} onPlayerClick={onPlayerClick} />

          <div style={{ marginTop: 10, marginBottom: 6, fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Edit roster ({roster.length})
          </div>
          <div style={{ maxHeight: 160, overflowY: 'auto' as const }}>
            {roster.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 5, marginBottom: 4 }}>
                <input style={{ width: 28, background: 'transparent', border: 'none', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'center' as const }} value={p.number} onChange={e => updatePlayer(idx, 'number', e.target.value)} />
                <input style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: '#fff', fontSize: 10 }} value={p.name} onChange={e => updatePlayer(idx, 'name', e.target.value)} placeholder="Name" />
                <select style={{ background: '#0c1018', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 9, borderRadius: 4 }} value={p.position} onChange={e => updatePlayer(idx, 'position', e.target.value)}>
                  {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
                <select style={{ background: '#0c1018', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 9, borderRadius: 4 }} value={p.line || '1'} onChange={e => updatePlayer(idx, 'line', e.target.value)}>
                  {LINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span onClick={() => removePlayer(idx)} style={{ color: 'rgba(248,113,113,0.7)', cursor: 'pointer', fontSize: 12, padding: '0 3px' }}>✕</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <input style={{ width: 32, background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 6, color: '#fff', fontSize: 10, textAlign: 'center' as const }} placeholder="#" value={manualNum} onChange={e => setManualNum(e.target.value)} />
            <input style={{ flex: 1, minWidth: 0, background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 6, color: '#fff', fontSize: 10 }} placeholder="Name" value={manualName} onChange={e => setManualName(e.target.value)} />
            <select style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 9 }} value={manualPos} onChange={e => setManualPos(e.target.value)}>
              {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
            </select>
            <select style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 9 }} value={manualLine} onChange={e => setManualLine(e.target.value)}>
              {LINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={addManualPlayer} style={{ width: 26, borderRadius: 6, border: '0.5px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.15)', color: '#34d399', fontWeight: 900, cursor: 'pointer' }}>+</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ScoutLineupModal({ existing, allLineups, onSaved, onClose }: Props) {
  const { user } = useUser();

  // The other team from the same game, if it was saved too — matched by
  // each referencing the other as its opponent, on the same date.
  const pairedLineup = existing
    ? allLineups?.find(l =>
        l.id !== existing.id &&
        l.teamName === existing.opponent &&
        l.opponent === existing.teamName &&
        l.gameDate === existing.gameDate
      ) || null
    : null;
  const [gameDate, setGameDate] = useState(existing?.gameDate || '');
  const [opponent, setOpponent] = useState(existing?.opponent || '');
  const [teamAName, setTeamAName] = useState(existing?.teamName || '');
  const [teamBName, setTeamBName] = useState('');
  const [rosterA, setRosterA] = useState<Player[]>(existing?.roster || []);
  const [rosterB, setRosterB] = useState<Player[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [scoutingPrefill, setScoutingPrefill] = useState<{ playerName: string; teamName: string; gameDate: string } | null>(null);

  const openScoutingReportFor = (p: Player, teamNameForPlayer: string) => {
    setScoutingPrefill({ playerName: p.name, teamName: teamNameForPlayer, gameDate });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const [, activeTeam, activeNumber] = (active.id as string).split('-');
    const [, overTeam, overLine, overPos] = (over.id as string).split('-');
    if (activeTeam !== overTeam) return;
    const isTeamA = activeTeam === Team.HOME;
    const roster = isTeamA ? rosterA : rosterB;
    const setRoster = isTeamA ? setRosterA : setRosterB;
    setRoster(roster.map(p => {
      if (p.number !== activeNumber) return p;
      const updates: Partial<Player> = { line: overLine };
      if (overPos) updates.position = overPos;
      return { ...p, ...updates };
    }));
  };

  const canSave = teamAName.trim().length > 0 && rosterA.length > 0;

  const handleSave = async () => {
    if (!user || !canSave) return;
    const hasB = !existing && teamBName.trim().length > 0 && rosterB.length > 0;
    setSaving(true);
    try {
      if (existing) {
        await updateScoutedLineup(existing.id, {
          teamName: teamAName.trim(),
          opponent: opponent.trim(),
          gameDate,
          roster: rosterA,
        });
      } else {
        await saveScoutedLineup(user.id, {
          teamName: teamAName.trim(),
          opponent: hasB ? teamBName.trim() : undefined,
          gameDate: gameDate || undefined,
          roster: rosterA,
        });
        if (hasB) {
          await saveScoutedLineup(user.id, {
            teamName: teamBName.trim(),
            opponent: teamAName.trim(),
            gameDate: gameDate || undefined,
            roster: rosterB,
          });
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save lineup.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm('Delete this lineup? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteScoutedLineup(existing.id);
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete lineup.');
    } finally {
      setDeleting(false);
    }
  };

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 360, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 361, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { flex: 1, overflowY: 'auto' as const, padding: 16 },
    sectionLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 },
    input: { width: '100%', background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 12, boxSizing: 'border-box' as const },
    btn: (color = '#60a5fa') => ({ padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}12`, color, width: '100%' } as React.CSSProperties),
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={S.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>←</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{existing ? 'Edit lineup' : 'Upload lineup'}</span>
          </div>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
        </div>

        <div style={S.body}>
          <div style={S.sectionLabel}>Date seen (optional)</div>
          <input type="date" style={S.input} value={gameDate} onChange={e => setGameDate(e.target.value)} />

          {existing && (
            <>
              <div style={S.sectionLabel}>Opponent (optional)</div>
              <input style={S.input} value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="Opponent team name" />
            </>
          )}

          {!existing && (
            <button
              style={{ ...S.btn('#34d399'), marginBottom: 12 }}
              onClick={() => setShowGamePicker(true)}
            >
              📅 Pick from OHL schedule
            </button>
          )}

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {existing ? (
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto' as const, paddingBottom: 4 }}>
                <div style={{ flex: '1 1 300px', minWidth: 280 }}>
                  <TeamEntryPane
                    team={Team.HOME}
                    accent="#60a5fa"
                    teamName={teamAName}
                    onTeamNameChange={setTeamAName}
                    roster={rosterA}
                    onRosterChange={setRosterA}
                    placeholder="Team name"
                    onPlayerClick={p => openScoutingReportFor(p, teamAName)}
                  />
                </div>
                {pairedLineup && (
                  <div style={{ flex: '1 1 300px', minWidth: 280 }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 700 }}>
                      Opponent (view only — edit separately)
                    </div>
                    <LineupSheet roster={pairedLineup.roster} teamName={pairedLineup.teamName} accent="#f87171" />
                  </div>
                )}
              </div>
            ) : null}
            {existing && (
              <>
                {rosterA.length > 0 && (
                  <>
                    <div style={{ ...S.sectionLabel, marginTop: 16 }}>Scout a player from this lineup</div>
                    <select
                      defaultValue=""
                      onChange={e => {
                        if (!e.target.value) return;
                        const player = rosterA.find(p => p.number === e.target.value);
                        if (player) openScoutingReportFor(player, teamAName);
                        e.target.value = '';
                      }}
                      style={{ width: '100%', background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12, fontWeight: 600 }}
                    >
                      <option value="">Pick a player…</option>
                      {rosterA.map(p => (
                        <option key={p.number} value={p.number}>#{p.number} {p.name}</option>
                      ))}
                    </select>
                  </>
                )}
              </>
            )}
            {!existing && (
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto' as const, paddingBottom: 4 }}>
                <TeamEntryPane
                  team={Team.HOME}
                  accent="#60a5fa"
                  teamName={teamAName}
                  onTeamNameChange={setTeamAName}
                  roster={rosterA}
                  onRosterChange={setRosterA}
                  placeholder="Team name"
                />
                <TeamEntryPane
                  team={Team.AWAY}
                  accent="#f87171"
                  teamName={teamBName}
                  onTeamNameChange={setTeamBName}
                  roster={rosterB}
                  onRosterChange={setRosterB}
                  placeholder="Opponent name (optional)"
                />
              </div>
            )}
          </DndContext>

          <button style={{ ...S.btn(), marginTop: 16 }} onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Saving…' : existing ? 'Update lineup' : 'Save lineup'}
          </button>

          {existing && (
            <button style={{ ...S.btn('#f87171'), marginTop: 8 }} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete this lineup'}
            </button>
          )}

          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 12 }}>
            Visible to everyone on your plan automatically — there's no sharing toggle for lineups.
            {!existing && ' Filling in both teams saves them as two separate lineups.'}
          </div>
        </div>
      </div>

      {showGamePicker && (
        <LeagueGamePicker
          onPickBoth={game => {
            setTeamAName(game.homeTeam);
            setTeamBName(game.awayTeam);
            setGameDate(game.gameDate);
          }}
          onClose={() => setShowGamePicker(false)}
        />
      )}

      {scoutingPrefill && (
        <StandaloneScoutingModal
          prefill={scoutingPrefill}
          onSaved={() => setScoutingPrefill(null)}
          onClose={() => setScoutingPrefill(null)}
        />
      )}
    </div>
  );
}
