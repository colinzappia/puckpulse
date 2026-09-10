import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ownerEmail } = req.query;
  if (!ownerEmail || typeof ownerEmail !== 'string') {
    return res.status(400).json({ error: 'ownerEmail is required' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Team members error: SUPABASE_SERVICE_ROLE_KEY is not set in the environment.');
    return res.status(500).json({ error: 'Team management is not configured yet.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('team_members')
      .select('member_email, invited_at')
      .eq('owner_email', ownerEmail.trim().toLowerCase())
      .order('invited_at', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ members: data });
  } catch (err) {
    console.error('Team members error:', err);
    return res.status(500).json({ error: 'Could not load your team.' });
  }
}
