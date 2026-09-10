import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

async function getSubForEmail(email) {
  const customers = await stripe.customers.list({ email, limit: 5 });
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 5 });
    const trialSubs = await stripe.subscriptions.list({ customer: customer.id, status: 'trialing', limit: 5 });
    const allSubs = [...subs.data, ...trialSubs.data];
    if (allSubs.length > 0) return allSubs[0];
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, email } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // First: does this email have its own direct subscription? This is
    // unchanged from before — the common case for Basic/Pro subscribers
    // and Team plan owners themselves.
    const ownSub = await getSubForEmail(email);
    if (ownSub) {
      const planName = ownSub.metadata?.planName || 'Basic';
      return res.status(200).json({
        isSubscribed: true,
        plan: planName,
        status: ownSub.status,
        trialEnd: ownSub.trial_end,
      });
    }

    // No subscription of their own — check whether they've been invited
    // onto someone else's Team plan. Access here is always re-derived
    // live from the owner's actual current Stripe status, never cached,
    // so if the owner's subscription lapses, invited members lose access
    // automatically along with them.
    if (supabaseAdmin) {
      const { data: membership } = await supabaseAdmin
        .from('team_members')
        .select('owner_email')
        .eq('member_email', email.trim().toLowerCase())
        .maybeSingle();

      if (membership?.owner_email) {
        const ownerSub = await getSubForEmail(membership.owner_email);
        const ownerPlan = ownerSub?.metadata?.planName || null;
        if (ownerSub && ownerPlan === 'Team') {
          return res.status(200).json({
            isSubscribed: true,
            plan: 'Team',
            status: ownerSub.status,
            trialEnd: ownerSub.trial_end,
            viaTeam: true,
          });
        }
      }
    }

    return res.status(200).json({ isSubscribed: false, plan: null });
  } catch (err) {
    console.error('Subscription check error:', err);
    return res.status(500).json({ error: err.message });
  }
}
