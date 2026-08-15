// ============================================================
// storageService.ts
// Uploads team logos to Supabase Storage and returns a public
// URL, instead of converting them to base64 and embedding the
// full image bytes directly in database rows.
//
// Why this matters: every saved game report used to carry a
// full copy of both team logos inline. Since the same team's
// logo doesn't change game to game, that meant the exact same
// ~100KB+ image was being duplicated in full across every
// single saved game — the single biggest contributor to
// database size at scale. Storing the image once in Storage
// and saving just a short URL reference in each report cuts
// that duplication out entirely.
// ============================================================
 
import { supabase } from '../lib/supabaseClient';
 
const LOGO_BUCKET = 'team-logos';
 
// ── Upload a logo file, return its public URL ────────────────
export async function uploadLogo(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
 
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { cacheControl: '31536000', upsert: false });
 
  if (uploadError) throw new Error(`Failed to upload logo: ${uploadError.message}`);
 
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
 
