// ============================================================
// EventAttachmentPanel.tsx
// Slide-up panel for attaching videos and notes to a
// logged event. Supports file upload and external URLs
// (Hudl, Catapult, YouTube, etc.)
// Visible to all users on the plan.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  EventAttachment,
  fetchAttachments,
  saveAttachment,
  deleteAttachment,
  uploadVideoFile,
} from '../services/attachmentService';
import { GameEvent, EventType } from '../types';

interface Props {
  event: GameEvent;
  sessionId: string | null;
  onClose: () => void;
}

function getEventLabel(type: EventType): string {
  const labels: Partial<Record<EventType, string>> = {
    [EventType.GOAL]: '🥅 Goal',
    [EventType.SHOT]: '🏒 Shot',
    [EventType.PENALTY]: '⚠️ Penalty',
    [EventType.GIVEAWAY]: '🔄 Giveaway',
    [EventType.TAKEAWAY]: '🎯 Takeaway',
    [EventType.HIT]: '💥 Hit',
    [EventType.ZONE_ENTRY_CARRY]: '▲ Carry-in',
    [EventType.ZONE_ENTRY_DUMP]: '■ Dump-in',
    [EventType.ZONE_ENTRY_PASS]: '◆ Pass entry',
    [EventType.ZONE_ENTRY_DENIED]: '✕ Denied entry',
  };
  return labels[type] || type;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url);
}

function getEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Hudl — return as-is (Hudl links open in browser)
  return null;
}

export default function EventAttachmentPanel({ event, sessionId, onClose }: Props) {
  const { user } = useUser();
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'view' | 'add'>('view');

  // Add form state
  const [addMode, setAddMode] = useState<'upload' | 'url'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAttachments(event.id)
      .then(setAttachments)
      .finally(() => setLoading(false));
  }, [event.id]);

  const handleUrlSave = async () => {
    if (!user) return;
    if (!urlInput.trim() && !note.trim()) return;
    setUploading(true);
    setError('');
    try {
      const attachment = await saveAttachment(
        event.id, sessionId, urlInput.trim() || null, note, user.id
      );
      setAttachments(prev => [...prev, attachment]);
      setUrlInput('');
      setNote('');
      setTab('view');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setUploadProgress('Uploading video…');
    setError('');
    try {
      const url = await uploadVideoFile(file, user.id);
      setUploadProgress('Saving…');
      const attachment = await saveAttachment(event.id, sessionId, url, note, user.id);
      setAttachments(prev => [...prev, attachment]);
      setNote('');
      setTab('view');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this attachment?')) return;
    await deleteAttachment(id);
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
    sheet: { background: '#0c1018', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' as const },
    topbar: { padding: '16px 20px 0', flexShrink: 0 },
    tabBar: { display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.08)', margin: '12px 0 0', flexShrink: 0 },
    tab: (active: boolean) => ({ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const, color: active ? '#60a5fa' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent' } as React.CSSProperties),
    body: { flex: 1, overflowY: 'auto' as const, padding: '16px 20px 32px' },
    input: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', marginBottom: 12 } as React.CSSProperties,
    btn: (color = '#60a5fa') => ({ width: '100%', padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}18`, color, marginBottom: 8 } as React.CSSProperties),
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.topbar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Event Clips & Notes</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                {getEventLabel(event.type)} · P{event.period} · {event.gameTime}
              </div>
            </div>
            <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', lineHeight: 1 }}>×</span>
          </div>
          <div style={S.tabBar}>
            <button style={S.tab(tab === 'view')} onClick={() => setTab('view')}>
              Clips {attachments.length > 0 && `(${attachments.length})`}
            </button>
            <button style={S.tab(tab === 'add')} onClick={() => setTab('add')}>
              + Add clip
            </button>
          </div>
        </div>

        <div style={S.body}>
          {tab === 'view' && (
            <>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Loading…</div>
              ) : attachments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.7 }}>
                  No clips attached yet.<br />
                  <span onClick={() => setTab('add')} style={{ color: '#60a5fa', cursor: 'pointer' }}>Add a clip or note</span>
                </div>
              ) : (
                attachments.map(a => {
                  const embedUrl = a.videoUrl ? getEmbedUrl(a.videoUrl) : null;
                  const isDirectVideo = a.videoUrl ? isVideoUrl(a.videoUrl) : false;
                  const isHudl = a.videoUrl?.includes('hudl.com');
                  const isCatapult = a.videoUrl?.includes('catapult') || a.videoUrl?.includes('sportscode');
                  const canDelete = a.uploadedBy === user?.id;

                  return (
                    <div key={a.id} style={{ background: '#0f1620', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      {/* Video embed */}
                      {embedUrl && (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000' }}>
                          <iframe
                            src={embedUrl}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                            allowFullScreen
                            title="Event clip"
                          />
                        </div>
                      )}
                      {isDirectVideo && a.videoUrl && (
                        <video
                          src={a.videoUrl}
                          controls
                          style={{ width: '100%', display: 'block', background: '#000', maxHeight: 240 }}
                        />
                      )}
                      {!embedUrl && !isDirectVideo && a.videoUrl && (
                        <a href={a.videoUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: isHudl ? 'rgba(255,102,0,0.15)' : isCatapult ? 'rgba(0,150,255,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                            {isHudl ? '🎬' : isCatapult ? '📡' : '🔗'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isHudl ? 'Hudl clip' : isCatapult ? 'Catapult clip' : 'External video'}
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.videoUrl}</div>
                          </div>
                          <span style={{ color: '#60a5fa', fontSize: 14 }}>↗</span>
                        </a>
                      )}

                      {/* Note */}
                      <div style={{ padding: '10px 14px' }}>
                        {a.note && (
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 8 }}>{a.note}</div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                            {new Date(a.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </div>
                          {canDelete && (
                            <button onClick={() => handleDelete(a.id)}
                              style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {tab === 'add' && (
            <>
              {/* Mode toggle */}
              <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.1)', marginBottom: 16 }}>
                <button onClick={() => setAddMode('url')} style={{ flex: 1, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: addMode === 'url' ? 'rgba(96,165,250,0.15)' : 'transparent', color: addMode === 'url' ? '#60a5fa' : 'rgba(255,255,255,0.35)' }}>
                  🔗 Paste URL
                </button>
                <button onClick={() => setAddMode('upload')} style={{ flex: 1, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: addMode === 'upload' ? 'rgba(96,165,250,0.15)' : 'transparent', color: addMode === 'upload' ? '#60a5fa' : 'rgba(255,255,255,0.35)' }}>
                  📁 Upload file
                </button>
              </div>

              {addMode === 'url' && (
                <>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>
                    Video URL (Hudl, Catapult, YouTube, etc.)
                  </label>
                  <input
                    style={S.input}
                    placeholder="https://www.hudl.com/video/..."
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                  />
                </>
              )}

              {addMode === 'upload' && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ ...S.btn(), marginBottom: 16, opacity: uploading ? 0.5 : 1 }}
                  >
                    {uploadProgress || '📁 Choose video file'}
                  </button>
                </>
              )}

              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>
                Note (optional)
              </label>
              <textarea
                style={{ ...S.input, minHeight: 80, resize: 'vertical' as const }}
                placeholder="Add context about this clip..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />

              {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{error}</div>}

              {addMode === 'url' && (
                <button
                  onClick={handleUrlSave}
                  disabled={uploading || (!urlInput.trim() && !note.trim())}
                  style={{ ...S.btn(), opacity: uploading || (!urlInput.trim() && !note.trim()) ? 0.4 : 1 }}
                >
                  {uploading ? 'Saving…' : 'Save clip'}
                </button>
              )}

              <button style={S.btn('rgba(255,255,255,0.3)')} onClick={() => setTab('view')}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
