// ============================================================
// ScoutLineupModal.tsx
// Upload or edit a scouted lineup. Both teams show side by side,
// styled and behaving exactly like the live tracking screen's own
// roster panels — same drag-and-drop, same visual language — so
// a scout moving from tracking a game to scouting one sees the
// same thing. Uploading and editing use the same two-panel view;
// editing a saved lineup also loads its paired opponent (if one
// was saved) into the second panel, fully editable, not read-only.
// Every saved lineup is visible to everyone on the plan
// automatically — no sharing toggle.
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
import { findChlLineup, chlLineupSideToPlayers } from '../services/chlLineupsService';
import { sortByNumber, normalizeName } from '../hooks/useTeamRoster';
import LeagueGamePicker from './LeagueGamePicker';
import StandaloneScoutingModal from './StandaloneScoutingModal';

interface Props {
  existing?: SavedScoutedLineup | null;
  // Every lineup already loaded in the hub — used to find this one's
  // opponent (another saved lineup naming this team as its own
  // opponent, same date) so both sides of the same game load together,
  // and also to check whether a game picked from the OHL schedule was
  // already uploaded by someone else.
  allLineups?: SavedScoutedLineup[];
  // Fires instead of the normal create flow when the OHL game picked
  // turns out to already have a saved lineup — hands that lineup back
  // up to the hub so it can reopen this whole modal in edit mode for
  // the real saved data, rather than showing empty import boxes for a
  // game someone already scouted.
  onOpenExisting?: (lineup: SavedScoutedLineup) => void;
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

// ── Draggable player chip — identical classes to the live tracking
// screen's own DraggablePlayer, so a scouted lineup looks and behaves
// exactly like the rink page's roster panel. The only difference: a
// tap here opens a scouting report instead of arming an event for
// that player, since there's no game being logged in this screen.
const DraggablePlayer: React.FC<{ p: Player; team: Team; isHome: boolean; onPlayerClick?: (p: Player) => void }> = ({ p, team, isHome, onPlayerClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `player-${team}-${p.number}` });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onPlayerClick?.(p)}
      className="relative h-10 rounded-xl font-black flex flex-col items-center justify-center transition-all border group active:scale-95 touch-none bg-black/30 border-white/5 text-slate-400 hover:bg-white/10 cursor-pointer"
    >
      <span className="text-[11px] font-black leading-none truncate w-full text-center px-1">
        #{p.number} {p.name.split(' ').pop()}
      </span>
      <div className={`absolute top-0.5 right-0.5 px-0.5 rounded text-[5px] font-black border ${p.position === 'C' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500' : 'bg-black/40 border-white/5 text-slate-600'}`}>
        {p.position}
      </div>
    </button>
  );
};

// ── Drop target — identical classes and drop-id scheme to the live
// tracking screen's own DroppableSlot.
const DroppableSlot: React.FC<{ id: string; children: React.ReactNode; label: string; cols?: number }> = ({ id, children, label, cols = 1 }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`relative min-h-10 rounded-xl transition-all border border-dashed ${isOver ? 'bg-white/10 border-white/30 ring-2 ring-white/10' : 'bg-black/20 border-white/5'}`}
    >
      <div className="grid gap-0.5 p-0.5 h-full" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {children}
      </div>
      {!React.Children.count(children) && !isOver && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <span className="text-[6px] font-black uppercase tracking-widest text-slate-600">{label}</span>
        </div>
      )}
    </div>
  );
};

// ── Forward lines, D pairs, and goalies — same layout and slot logic
// as the live tracking screen's roster panel, minus the "starting
// goalie" swap control, which is specific to a game actually being
// tracked and doesn't apply to a standalone scouted lineup.
function RosterGrid({ team, roster, isHome, onPlayerClick }: { team: Team; roster: Player[]; isHome: boolean; onPlayerClick?: (p: Player) => void }) {
  return (
    <div className="space-y-0.5">
      {['1', '2', '3', '4'].map(lineNum => (
        <div key={`line-${lineNum}`}>
          <div className="flex items-center gap-0.5 mb-0.5">
            <span className={`text-[6px] font-black w-3 shrink-0 ${isHome ? 'text-blue-600' : 'text-red-600'}`}>L{lineNum}</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            {['LW', 'C', 'RW'].map((pos, posIdx) => {
              const playersOnLine = roster.filter(p => p.line === lineNum);
              const playersInThisSlot = playersOnLine.filter(p => {
                if (p.position === pos) return true;
                if (p.position === 'F') { const fPlayers = playersOnLine.filter(pl => pl.position === 'F'); const idx = fPlayers.indexOf(p); return posIdx === 2 ? idx >= 2 : idx === posIdx; }
                return false;
              });
              return (
                <DroppableSlot key={pos} id={`line-${team}-${lineNum}-${pos}`} label={pos} cols={Math.max(1, playersInThisSlot.length)}>
                  {playersInThisSlot.map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} isHome={isHome} onPlayerClick={onPlayerClick} />)}
                </DroppableSlot>
              );
            })}
          </div>
        </div>
      ))}
      {['P1', 'P2', 'P3'].map(pairNum => (
        <div key={`pair-${pairNum}`}>
          <div className="flex items-center gap-0.5 mb-0.5">
            <span className={`text-[6px] font-black w-3 shrink-0 ${isHome ? 'text-blue-600' : 'text-red-600'}`}>{pairNum}</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <div className="grid grid-cols-2 gap-0.5">
            {['D1', 'D2'].map((pos, posIdx) => {
              const playersOnPair = roster.filter(p => p.line === pairNum);
              const playersInThisSlot = playersOnPair.filter(p => {
                if (p.position === 'LD' && posIdx === 0) return true;
                if (p.position === 'RD' && posIdx === 1) return true;
                if (p.position === 'D') { const dPlayers = playersOnPair.filter(pl => pl.position === 'D'); const idx = dPlayers.indexOf(p); return posIdx === 1 ? idx >= 1 : idx === 0; }
                return false;
              });
              return (
                <DroppableSlot key={pos} id={`line-${team}-${pairNum}-${posIdx === 0 ? 'LD' : 'RD'}`} label={pos} cols={Math.max(1, playersInThisSlot.length)}>
                  {playersInThisSlot.map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} isHome={isHome} onPlayerClick={onPlayerClick} />)}
                </DroppableSlot>
              );
            })}
          </div>
        </div>
      ))}
      <div>
        <div className="flex items-center gap-0.5 mb-0.5">
          <span className={`text-[6px] font-black w-3 shrink-0 ${isHome ? 'text-blue-600' : 'text-red-600'}`}>G</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>
        <div className="grid grid-cols-2 gap-0.5">
          {['G1', 'G2'].map(goalieNum => (
            <DroppableSlot key={goalieNum} id={`line-${team}-${goalieNum}-G`} label={goalieNum === 'G1' ? 'Starter' : 'Backup'}>
              {roster.filter(p => p.line === goalieNum).map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} isHome={isHome} onPlayerClick={onPlayerClick} />)}
            </DroppableSlot>
          ))}
        </div>
      </div>
      {roster.filter(p => !ASSIGNED_LINES.has(p.line || '')).length > 0 && (
        <div>
          <div className="flex items-center gap-0.5 mb-0.5">
            <span className="text-[6px] font-black w-3 shrink-0 text-slate-600">?</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <DroppableSlot id={`line-${team}-unassigned`} label="Unassigned" cols={2}>
            {roster.filter(p => !ASSIGNED_LINES.has(p.line || '')).map(p => <DraggablePlayer key={`${team}-${p.number}`} p={p} team={team} isHome={isHome} onPlayerClick={onPlayerClick} />)}
          </DroppableSlot>
        </div>
      )}
    </div>
  );
}

// ── One team's full pane — name field, import (paste/photo/drag-drop)
// before a roster exists, then the same-styled roster panel as the
// rink page, plus a compact editable list underneath (for number/name
// typo fixes and removal — the rink page doesn't need this since
// roster corrections happen in its separate Roster Setup screen,
// which has no equivalent here).
function TeamEntryPane({
  team, isHome, teamName, onTeamNameChange, roster, onRosterChange, placeholder, onPlayerClick,
}: {
  team: Team;
  isHome: boolean;
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

  const accent = isHome ? '#60a5fa' : '#f87171';

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
    <div className={`flex-1 flex flex-col min-w-[280px] ${isHome ? 'bg-blue-900/10' : 'bg-red-900/10'} rounded-2xl overflow-hidden border border-white/5`}>
      <div className={`px-3 py-2 ${isHome ? 'bg-blue-900/30' : 'bg-red-900/30'} border-b border-white/10 shrink-0`}>
        <input
          className={`w-full bg-transparent border-none outline-none text-[11px] font-black uppercase tracking-widest ${isHome ? 'text-blue-400' : 'text-red-400'} placeholder:text-slate-600`}
          value={teamName}
          onChange={e => onTeamNameChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-2">
        {roster.length === 0 ? (
          <div className="space-y-2">
            <textarea
              className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-[10px] text-slate-300 font-mono outline-none focus:border-white/20 resize-none"
              rows={4}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste roster text…"
            />
            <button
              onClick={handlePasteImport}
              disabled={importing}
              className="w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-wide bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all disabled:opacity-40"
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
              className={`relative text-center p-3 rounded-lg text-[10px] font-black uppercase tracking-wide border-2 border-dashed transition-all ${dragOver ? 'border-white/40 bg-white/10 text-white' : 'border-white/15 bg-white/5 text-slate-400'} ${importing ? '' : 'cursor-pointer'}`}
            >
              {importing ? 'Reading…' : dragOver ? 'Drop photo to import' : '📷 Drag a roster photo here, or tap to browse'}
              <input
                type="file"
                accept="image/*"
                disabled={importing}
                className="absolute inset-0 opacity-0"
                style={{ cursor: importing ? 'default' : 'pointer' }}
                onChange={e => { handlePhotoImport(e.target.files?.[0] || null); e.target.value = ''; }}
              />
            </div>

            <button
              onClick={() => onRosterChange([{ number: '', name: '', position: 'C', line: '1' }])}
              className="w-full py-1.5 rounded-lg text-[9px] font-bold text-slate-500 hover:text-slate-300 transition-all"
            >
              Start with an empty roster instead
            </button>
          </div>
        ) : (
          <>
            <RosterGrid team={team} roster={roster} isHome={isHome} onPlayerClick={onPlayerClick} />

            <div className="mt-3 mb-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wide">
              Edit roster ({roster.length})
            </div>
            <div className="max-h-40 overflow-y-auto scrollbar-none space-y-1">
              {roster.map((p, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-black/30 border border-white/5 rounded-lg p-1">
                  <input className="w-7 bg-transparent border-none text-white text-[10px] font-black text-center outline-none" value={p.number} onChange={e => updatePlayer(idx, 'number', e.target.value)} />
                  <input className="flex-1 min-w-0 bg-transparent border-none text-white text-[10px] outline-none" value={p.name} onChange={e => updatePlayer(idx, 'name', e.target.value)} placeholder="Name" />
                  <select className="bg-black/40 text-slate-400 text-[9px] rounded border-none outline-none" value={p.position} onChange={e => updatePlayer(idx, 'position', e.target.value)}>
                    {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                  <select className="bg-black/40 text-slate-400 text-[9px] rounded border-none outline-none" value={p.line || '1'} onChange={e => updatePlayer(idx, 'line', e.target.value)}>
                    {LINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span onClick={() => removePlayer(idx)} className="text-red-400/70 cursor-pointer text-xs px-1">✕</span>
                </div>
              ))}
            </div>

            <div className="flex gap-1 mt-1.5">
              <input className="w-8 bg-black/30 border border-white/10 rounded-lg p-1.5 text-white text-[10px] text-center outline-none" placeholder="#" value={manualNum} onChange={e => setManualNum(e.target.value)} />
              <input className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg p-1.5 text-white text-[10px] outline-none" placeholder="Name" value={manualName} onChange={e => setManualName(e.target.value)} />
              <select className="bg-black/30 border border-white/10 rounded-lg text-white text-[9px] outline-none" value={manualPos} onChange={e => setManualPos(e.target.value)}>
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
              <select className="bg-black/30 border border-white/10 rounded-lg text-white text-[9px] outline-none" value={manualLine} onChange={e => setManualLine(e.target.value)}>
                {LINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={addManualPlayer} className="w-7 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-black">+</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ScoutLineupModal({ existing, allLineups, onOpenExisting, onSaved, onClose }: Props) {
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
  const [teamAName, setTeamAName] = useState(existing?.teamName || '');
  const [teamBName, setTeamBName] = useState(pairedLineup?.teamName || '');
  const [rosterA, setRosterA] = useState<Player[]>(existing?.roster || []);
  const [rosterB, setRosterB] = useState<Player[]>(pairedLineup?.roster || []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [scoutingPrefill, setScoutingPrefill] = useState<{ playerName: string; playerNumber: string; position: string; teamName: string; gameDate: string } | null>(null);

  const openScoutingReportFor = (p: Player, teamNameForPlayer: string) => {
    setScoutingPrefill({ playerName: p.name, playerNumber: p.number, position: p.position || '', teamName: teamNameForPlayer, gameDate });
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
  const hasB = teamBName.trim().length > 0 && rosterB.length > 0;

  const handleSave = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      if (existing) {
        await updateScoutedLineup(existing.id, {
          teamName: teamAName.trim(),
          opponent: hasB ? teamBName.trim() : undefined,
          gameDate,
          roster: rosterA,
        });
        if (pairedLineup) {
          // The paired side may have been dragged/edited too — keep it
          // in sync, or drop the pairing if its name was cleared out.
          await updateScoutedLineup(pairedLineup.id, {
            teamName: teamBName.trim() || pairedLineup.teamName,
            opponent: teamAName.trim(),
            gameDate,
            roster: rosterB,
          });
        } else if (hasB) {
          // A second team was filled in that didn't exist before —
          // save it as a new paired lineup.
          await saveScoutedLineup(user.id, {
            teamName: teamBName.trim(),
            opponent: teamAName.trim(),
            gameDate: gameDate || undefined,
            roster: rosterB,
          });
        }
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
    if (!confirm(pairedLineup ? 'Delete this lineup? The opponent lineup will be kept separately. This cannot be undone.' : 'Delete this lineup? This cannot be undone.')) return;
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

  return (
    <div className="fixed inset-0 z-[360] bg-black/98 backdrop-blur-3xl flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">←</button>
          <span className="text-white text-sm font-black uppercase tracking-widest">{existing ? 'Edit lineup' : 'Upload lineup'}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">×</button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-3">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Date seen</span>
          <input
            type="date"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
            value={gameDate}
            onChange={e => setGameDate(e.target.value)}
          />
          <button
            className="ml-auto text-[10px] font-black uppercase tracking-wide px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
            onClick={() => setShowGamePicker(true)}
          >
            📅 Pick from CHL schedule
          </button>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2" style={{ minHeight: 480 }}>
            <TeamEntryPane
              team={Team.HOME}
              isHome={true}
              teamName={teamAName}
              onTeamNameChange={setTeamAName}
              roster={rosterA}
              onRosterChange={setRosterA}
              placeholder="Team name"
              onPlayerClick={p => openScoutingReportFor(p, teamAName)}
            />
            <TeamEntryPane
              team={Team.AWAY}
              isHome={false}
              teamName={teamBName}
              onTeamNameChange={setTeamBName}
              roster={rosterB}
              onRosterChange={setRosterB}
              placeholder="Opponent name (optional)"
              onPlayerClick={p => openScoutingReportFor(p, teamBName)}
            />
          </div>
        </DndContext>

        <button
          className="w-full mt-3 py-3 rounded-xl text-sm font-black uppercase tracking-wide border border-blue-500/40 bg-blue-500/15 text-blue-400 disabled:opacity-40"
          onClick={handleSave}
          disabled={saving || !canSave}
        >
          {saving ? 'Saving…' : existing ? 'Update lineup' : 'Save lineup'}
        </button>

        {existing && (
          <button
            className="w-full mt-2 py-3 rounded-xl text-sm font-black uppercase tracking-wide border border-red-500/40 bg-red-500/15 text-red-400 disabled:opacity-40"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete this lineup'}
          </button>
        )}

        <div className="text-[10px] text-slate-600 text-center mt-3">
          Visible to everyone on your plan automatically — there's no sharing toggle for lineups.
          {!hasB && !pairedLineup && ' Filling in both teams saves them as two paired lineups.'}
        </div>
      </div>

      {showGamePicker && (
        <LeagueGamePicker
          onPickBoth={async game => {
            // If either team's lineup for this exact game was already
            // uploaded by anyone, hand off to that saved lineup instead
            // of starting a blank one — same game, so the same lineup.
            const already = allLineups?.find(l =>
              l.gameDate === game.gameDate &&
              ((l.teamName === game.homeTeam && l.opponent === game.awayTeam) ||
               (l.teamName === game.awayTeam && l.opponent === game.homeTeam))
            );
            if (already && onOpenExisting) {
              setShowGamePicker(false);
              onOpenExisting(already);
              return;
            }

            setTeamAName(game.homeTeam);
            setTeamBName(game.awayTeam);
            setGameDate(game.gameDate);

            // No manually-entered lineup exists yet — check whether the
            // CHL scraper already found this game's real lineup (posted
            // roughly an hour before puck drop). If so, both rosters
            // come pre-filled with the actual real lines, no manual
            // entry needed at all.
            const scraped = await findChlLineup(game.league, game.externalGameId);
            if (scraped) {
              setRosterA(chlLineupSideToPlayers(scraped.homeLines));
              setRosterB(chlLineupSideToPlayers(scraped.awayLines));
            }
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
