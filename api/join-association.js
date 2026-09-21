import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Lets a coach join an association using the code its admin shared
// with them. The purchased team cap is enforced softly, not as a hard
// wall — the join still succeeds even over the limit, since blocking
// a coach outright over their association's own admin needing to
// upgrade is a worse experience than flagging it. overLimit in the
// response is what the frontend uses to show that heads-up.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server is not configured for database writes (missing service role key).' });
  }

  const { joinCode, email, teamName } = req.body;
  if (!joinCode || !email || !teamName) {
    return res.status(400).json({ error: 'Join code, email, and team name are all required.' });
  }

  const normalizedCode = joinCode.trim().toUpperCase();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedTeamName = teamName.trim();

  try {
    const { data: association, error: assocError } = await supabaseAdmin
      .from('associations')
      .select('id, association_name, teams_allowed')
      .eq('join_code', normalizedCode)
      .maybeSingle();

    if (assocError) throw assocError;
    if (!association) {
      return res.status(404).json({ error: 'That code doesn\'t match any association. Double-check it and try again.' });
    }

    // Upsert rather than insert — a coach re-entering the same code
    // (e.g. on a new device) should just confirm their existing
    // membership, not fail on the table's own unique constraint.
    const { error: upsertError } = await supabaseAdmin
      .from('association_members')
      .upsert(
        { association_id: association.id, member_email: normalizedEmail, team_name: normalizedTeamName },
        { onConflict: 'association_id,member_email' }
      );
    if (upsertError) throw upsertError;

    // The cap is on distinct teams, not individual coaches — several
    // coaches on the same team (head coach + assistant, say) shouldn't
    // count against it multiple times.
    const { data: allMembers, error: membersError } = await supabaseAdmin
      .from('association_members')
      .select('team_name')
      .eq('association_id', association.id);
    if (membersError) throw membersError;

    const distinctTeams = new Set((allMembers || []).map(m => m.team_name).filter(Boolean));
    const overLimit = distinctTeams.size > association.teams_allowed;

    return res.status(200).json({
      success: true,
      associationName: association.association_name,
      overLimit,
      teamsUsed: distinctTeams.size,
      teamsAllowed: association.teams_allowed,
    });
  } catch (err) {
    console.error('join-association error:', err);
    return res.status(500).json({ error: err.message });
  }
}
