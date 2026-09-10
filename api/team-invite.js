import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MAX_MEMBERS = 4; // plus the owner = 5 total, matching the Team plan

// Confirms the given email has its own active (or trialing) Team-plan
// Stripe subscription — the same lookup check-subscription.js does,
// duplicated here rather than shared, matching this codebase's existing
// pattern of self-contained API routes.
async function getOwnPlan(email) {
  const customers = await stripe.customers.list({ email, limit: 5 });
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 5 });
    const trialSubs = await stripe.subscriptions.list({ customer: customer.id, status: 'trialing', limit: 5 });
    const allSubs = [...subs.data, ...trialSubs.data];
    if (allSubs.length > 0) return allSubs[0].metadata?.planName || 'Basic';
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ownerEmail, memberEmail } = req.body;
  if (!ownerEmail || !memberEmail) {
    return res.status(400).json({ error: 'Both ownerEmail and memberEmail are required' });
  }
  const normalizedMember = memberEmail.trim().toLowerCase();
  const normalizedOwner = ownerEmail.trim().toLowerCase();

  if (normalizedMember === normalizedOwner) {
    return res.status(400).json({ error: "You're already covered by your own subscription — no need to invite yourself." });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Team invite error: SUPABASE_SERVICE_ROLE_KEY is not set in the environment.');
    return res.status(500).json({ error: 'Team management is not configured yet.' });
  }

  try {
    // Only an active Team-plan subscriber can invite anyone at all.
    const ownerPlan = await getOwnPlan(normalizedOwner);
    if (ownerPlan !== 'Team') {
      return res.status(403).json({ error: 'Only Team plan subscribers can invite team members.' });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('team_members')
      .select('member_email')
      .eq('owner_email', normalizedOwner);

    if (fetchError) throw fetchError;

    if (existing.some(m => m.member_email === normalizedMember)) {
      return res.status(400).json({ error: 'That person is already on your team.' });
    }

    if (existing.length >= MAX_MEMBERS) {
      return res.status(400).json({ error: `Your Team plan supports up to ${MAX_MEMBERS + 1} people total (you + ${MAX_MEMBERS}). You're at the limit — remove someone first to add a new person.` });
    }

    // A person can only ever be on one team at a time — if they're
    // already a member elsewhere, they'd need to be removed from that
    // team first. Prevents someone quietly riding two teams' billing.
    const { data: elsewhere, error: elsewhereError } = await supabaseAdmin
      .from('team_members')
      .select('owner_email')
      .eq('member_email', normalizedMember);

    if (elsewhereError) throw elsewhereError;
    if (elsewhere.length > 0) {
      return res.status(400).json({ error: 'That email is already part of a different team.' });
    }

    const { error: insertError } = await supabaseAdmin
      .from('team_members')
      .insert({ owner_email: normalizedOwner, member_email: normalizedMember });

    if (insertError) throw insertError;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Team invite error:', err);
    return res.status(500).json({ error: 'Could not add that person to your team. Please try again.' });
  }
}
