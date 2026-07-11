// ============================================================
// attachmentService.ts
// Handles video attachments on logged events.
// Supports direct file upload (to Supabase Storage) and
// external URLs (Hudl, Catapult, YouTube, etc.)
// ============================================================
 
import { supabase } from '../lib/supabaseClient';
 
export interface EventAttachment {
  id: string;
  eventId: string;
  sessionId: string | null;
  videoUrl: string | null;
  note: string;
  uploadedBy: string;
  createdAt: string;
}
 
// ── Upload a video file to Supabase Storage ─────────────────
export async function uploadVideoFile(
  file: File,
  userId: string,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'mp4';
  const path = `${userId}/${Date.now()}.${ext}`;
 
  const { error } = await supabase.storage
    .from('event-videos')
    .upload(path, file, { upsert: false });
 
  if (error) throw new Error(`Upload failed: ${error.message}`);
 
  const { data } = supabase.storage.from('event-videos').getPublicUrl(path);
  return data.publicUrl;
}
 
// ── Save an attachment record ───────────────────────────────
export async function saveAttachment(
  eventId: string,
  sessionId: string | null,
  videoUrl: string | null,
  note: string,
  userId: string,
): Promise<EventAttachment> {
  const { data, error } = await supabase
    .from('event_attachments')
    .insert({
      event_id: eventId,
      session_id: sessionId,
      video_url: videoUrl || null,
      note: note.trim(),
      uploaded_by: userId,
    })
    .select()
    .single();
 
  if (error) throw new Error(`Failed to save attachment: ${error.message}`);
  return mapAttachment(data);
}
 
// ── Fetch all attachments for an event ──────────────────────
export async function fetchAttachments(eventId: string): Promise<EventAttachment[]> {
  const { data, error } = await supabase
    .from('event_attachments')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
 
  if (error) return [];
  return (data || []).map(mapAttachment);
}
 
// ── Delete an attachment ────────────────────────────────────
export async function deleteAttachment(attachmentId: string): Promise<void> {
  const { error } = await supabase
    .from('event_attachments')
    .delete()
    .eq('id', attachmentId);
 
  if (error) throw new Error(`Failed to delete attachment: ${error.message}`);
}
 
function mapAttachment(row: Record<string, unknown>): EventAttachment {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    sessionId: (row.session_id as string) || null,
    videoUrl: (row.video_url as string) || null,
    note: (row.note as string) || '',
    uploadedBy: row.uploaded_by as string,
    createdAt: row.created_at as string,
  };
}
 
