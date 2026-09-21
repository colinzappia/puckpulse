import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Looks up a just-purchased association by its Stripe Checkout session
// ID — used by the welcome page a buyer lands on right after paying.
// The webhook that actually creates the association row runs
// independently of the browser's own redirect, so there's a real
// (usually brief) window where the payment has succeeded but the
// association isn't saved yet — this returns "pending" rather than an
// error in that case, so the frontend can poll a few times instead of
// showing a false failure.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server is not configured for database reads (missing service role key).' });
  }

  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(200).json({ status: 'not_paid' });
    }

    // Matches the same fallback the webhook itself uses when saving —
    // payment_intent when one exists, otherwise the session's own ID.
    const stripePaymentId = session.payment_intent || session.id;

    const { data: association, error } = await supabaseAdmin
      .from('associations')
      .select('association_name, join_code, teams_allowed, season_start, season_end')
      .eq('stripe_payment_id', stripePaymentId)
      .maybeSingle();

    if (error) throw error;

    if (!association) {
      return res.status(200).json({ status: 'pending' });
    }

    return res.status(200).json({ status: 'ready', association });
  } catch (err) {
    console.error('get-association-by-session error:', err);
    return res.status(500).json({ error: err.message });
  }
}
