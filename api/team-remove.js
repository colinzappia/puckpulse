import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ownerEmail, memberEmail } = req.body;
  if (!ownerEmail || !memberEmail) {
    return res.status(400).json({ error: 'Both ownerEmail and memberEmail are required' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Team remove error: SUPABASE_SERVICE_ROLE_KEY is not set in the environment.');
    return res.status(500).json({ error: 'Team management is not configured yet.' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('owner_email', ownerEmail.trim().toLowerCase())
      .eq('member_email', memberEmail.trim().toLowerCase());

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Team remove error:', err);
    return res.status(500).json({ error: 'Could not remove that person. Please try again.' });
  }
}
