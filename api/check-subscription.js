import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// The three Scout-tier plan names (set as each Stripe Price's own
// metadata.planName, same mechanism the existing Basic/Pro/Team plans
// already use) — checked against this list to know whether someone's
// subscription is a Scout tier specifically, regardless of which of
// the three sizes it is.
const SCOUT_PLANS = ['ScoutIndividual', 'ScoutTeam', 'ScoutOrg'];

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
      const isScout = SCOUT_PLANS.includes(planName);
      return res.status(200).json({
        isSubscribed: true,
        // A Scout subscriber gets full Pro-level app access (per an
        // explicit decision — Scout is priced and positioned as its own
        // product, not a restricted one), reported as plain "Pro" so
        // every other Pro-gated check elsewhere in the app already
        // handles it correctly, with no need to know about Scout plan
        // names specifically. hasScoutAccess below is the one thing
        // that's actually new and different for them.
        plan: isScout ? 'Pro' : planName,
        status: ownSub.status,
        trialEnd: ownSub.trial_end,
        // Only a real Scout-tier subscription unlocks the Games tab in
        // Scouts Portal (CHL/AAA schedules, auto-populated and uploaded
        // lineups) — every coach tier (Basic/Pro/Team) still gets the
        // rest of Scouts Portal (writing reports, including from a
        // tracked game), just not this specifically.
        hasScoutAccess: isScout,
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
            // A regular Team plan invite is still a regular coach —
            // this alone never grants Games-tab access, only an actual
            // Scout subscription (own or via scout_org_members below)
            // does.
            hasScoutAccess: false,
          });
        }
      }

      // Same pattern, completely separate list: invited onto someone
      // else's Scout subscription (a Scout Team or Scout Organization
      // plan). Kept as its own table rather than sharing team_members,
      // so a coaching team's roster and a scouting group's roster can
      // never overlap or get confused with each other.
      const { data: scoutMembership } = await supabaseAdmin
        .from('scout_org_members')
        .select('owner_email')
        .eq('member_email', email.trim().toLowerCase())
        .maybeSingle();

      if (scoutMembership?.owner_email) {
        const ownerSub = await getSubForEmail(scoutMembership.owner_email);
        const ownerPlan = ownerSub?.metadata?.planName || null;
        if (ownerSub && SCOUT_PLANS.includes(ownerPlan)) {
          return res.status(200).json({
            isSubscribed: true,
            plan: 'Pro',
            status: ownerSub.status,
            trialEnd: ownerSub.trial_end,
            viaScoutOrg: true,
            hasScoutAccess: true,
          });
        }
      }

      // Association access is fundamentally different from the checks
      // above — it was never a Stripe subscription to begin with, just
      // a one-time payment, so there's no live Stripe status to ask
      // about at all. The association's own season_start/season_end
      // (set once, at purchase, in stripe-webhook.js) is the entire
      // source of truth for whether this membership is currently
      // valid — checked fresh on every request, same as everything
      // else here, so access turns off on its own once the season
      // ends, with nothing manual required.
      const { data: assocMembership } = await supabaseAdmin
        .from('association_members')
        .select('associations(association_name, season_start, season_end)')
        .eq('member_email', email.trim().toLowerCase())
        .maybeSingle();

      const association = assocMembership?.associations;
      if (association) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const inSeason = todayStr >= association.season_start && todayStr <= association.season_end;
        if (inSeason) {
          return res.status(200).json({
            isSubscribed: true,
            plan: 'Pro',
            status: 'active',
            viaAssociation: true,
            associationName: association.association_name,
            // An association is a coaching product, not a scouting
            // one — its coaches get the same access as any other
            // coach tier, Games tab included only with an actual
            // Scout subscription of their own.
            hasScoutAccess: false,
          });
        }
      }
    }

    return res.status(200).json({ isSubscribed: false, plan: null, hasScoutAccess: false });
  } catch (err) {
    console.error('Subscription check error:', err);
    return res.status(500).json({ error: err.message });
  }
}
