import React, { useState } from 'react';
import { GameEvent, EventType, Team, PenaltyType } from '../types';

interface PlayByPlayProps {
  events: GameEvent[];
  homeName: string;
  awayName: string;
  onRemoveEvent: (id: string) => void;
  onUpdateEvent: (id: string, updates: Partial<GameEvent>) => void;
  onAttachClip: (event: GameEvent) => void;
}

const PlayByPlay: React.FC<PlayByPlayProps> = ({ 
  events, 
  homeName, 
  awayName, 
  onRemoveEvent,
  onUpdateEvent,
  onAttachClip,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case EventType.GOAL: return '🥅';
      case EventType.SHOT: return '🏒';
      case EventType.GIVEAWAY: return '🔄';
      case EventType.TAKEAWAY: return '🎯';
      case EventType.HIT: return '💥';
      case EventType.PENALTY: return '🚨';
      case EventType.FACEOFF_WIN: return '⚪';
      case EventType.FACEOFF_LOSS: return '⚫';
      case EventType.ZONE_ENTRY_CARRY: return '▲';
      case EventType.ZONE_ENTRY_DUMP: return '■';
      case EventType.ZONE_ENTRY_PASS: return '◆';
      case EventType.ZONE_ENTRY_DENIED: return '✕';
      case EventType.BREAKOUT: return '🚀';
      default: return '📍';
    }
  };

  const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);

  const handleEditChange = (id: string, field: string, value: any) => {
    if (field === 'penaltyType' || field === 'notes') {
      const event = events.find(e => e.id === id);
      onUpdateEvent(id, {
        metadata: {
          ...event?.metadata,
          [field]: value
        }
      });
    } else {
      onUpdateEvent(id, { [field]: value });
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full bg-slate-900/40">
      <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">Tactical Feed</span>
        </div>
        <span className="text-[10px] font-black text-slate-500 bg-black/40 px-4 py-1.5 rounded-full border border-white/5">{events.length} Sequences</span>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-none p-2 space-y-1.5">
        {sortedEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
            <div className="text-5xl mb-4">🏒</div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tactical tracking active...</p>
          </div>
        ) : (
          sortedEvents.map((event) => {
            const isEditing = editingId === event.id;
            
            return (
              <div 
                key={event.id} 
                className={`group relative px-3 py-2 rounded-xl border transition-all duration-300 animate-in slide-in-from-bottom-2 ${
                  isEditing 
                  ? `${event.team === Team.HOME ? 'border-blue-500/50' : 'border-red-500/50'} bg-black/60 shadow-xl`
                  : `border-white/5 ${event.type === EventType.GOAL ? 'bg-green-600/10 border-green-500/20' : 'bg-white/5'}`
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer flex items-center gap-2.5" onClick={() => setEditingId(isEditing ? null : event.id)}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${event.team === Team.HOME ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                    
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-black/40 rounded border border-white/5 text-slate-500 shrink-0">P{event.period}</span>
                      <span className="text-lg shrink-0 scale-90">{getEventIcon(event.type)}</span>
                      
                      <div className="flex-1 min-w-0 flex items-baseline gap-2">
                        <span className="text-[11px] font-black text-white uppercase truncate tracking-tight">
                          {event.type.replace('_', ' ')} {event.playerNumber && <span className="text-blue-400 ml-0.5">#{event.playerNumber}</span>}
                        </span>

                        {event.type === EventType.SHOT && (
                          <span className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                            event.metadata?.strength === 'PP' ? 'bg-amber-500/20 text-amber-400' :
                            event.metadata?.strength === 'PK' ? 'bg-pink-500/20 text-pink-400' :
                            'bg-cyan-500/20 text-cyan-400'
                          }`}>
                            {event.metadata?.strength === 'PP' ? 'PP' : event.metadata?.strength === 'PK' ? 'PK' : 'ES'}
                            {event.metadata?.onNet === false ? ' ✕' : ' ✓'}
                          </span>
                        )}

                        {event.type === EventType.ZONE_ENTRY_DUMP && event.metadata?.retrieval && (
                          <span className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                            event.metadata.retrieval === 'FOR' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            RETR {event.metadata.retrieval === 'FOR' ? '✓' : '✕'}
                          </span>
                        )}

                        {event.type === EventType.BREAKOUT && (
                          <span className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                            event.metadata?.breakoutResult === 'FAILED' ? 'bg-red-500/20 text-red-400' : 'bg-lime-500/20 text-lime-400'
                          }`}>
                            {event.metadata?.breakoutResult === 'FAILED' ? 'FAILED ✕' : 'CONTROLLED ✓'}
                          </span>
                        )}
                        
                        <span className="text-[8px] font-black uppercase text-slate-600 tracking-tighter truncate opacity-60">
                          {event.team === Team.HOME ? homeName : awayName}
                        </span>
                        
                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest shrink-0">{event.zone}</span>
                        
                        {event.metadata?.notes && !isEditing && (
                          <span className="text-[9px] font-bold text-slate-500 italic truncate opacity-40 ml-auto max-w-[100px]">
                            {event.metadata.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onAttachClip(event)}
                      className="opacity-60 hover:opacity-100 p-2 hover:text-blue-400 transition-all text-slate-500"
                      title="Attach clip"
                    >
                      🎬
                    </button>
                    <button 
                      onClick={() => setEditingId(isEditing ? null : event.id)}
                      className={`p-2 rounded-lg transition-all ${isEditing ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white bg-black/20 opacity-60 hover:opacity-100'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => onRemoveEvent(event.id)}
                      className="opacity-60 hover:opacity-100 p-2 hover:text-red-500 transition-all text-slate-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-2 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-1">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="space-y-1">
                        <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest px-1">Player #</label>
                        <input 
                          type="text"
                          className="w-full bg-black/40 border border-white/10 p-2 rounded-lg text-[10px] font-black text-white outline-none focus:border-blue-500"
                          value={event.playerNumber || ''}
                          onChange={(e) => handleEditChange(event.id, 'playerNumber', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest px-1">Zone</label>
                        <div className="w-full bg-black/20 p-2 rounded-lg text-[9px] font-black text-slate-700 uppercase text-center border border-white/5">{event.zone}</div>
                      </div>
                    </div>

                    <div className="space-y-1 mb-2">
                      <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest px-1">Observation</label>
                      <textarea 
                        className="w-full bg-black/40 border border-white/10 p-2 rounded-lg text-[9px] font-bold text-slate-200 outline-none focus:border-blue-500 min-h-[50px] resize-none"
                        value={event.metadata?.notes || ''}
                        onChange={(e) => handleEditChange(event.id, 'notes', e.target.value)}
                        placeholder="Add coaching note..."
                      />
                    </div>

                    <button 
                      onClick={() => setEditingId(null)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                    >
                      Commit Note
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PlayByPlay;
