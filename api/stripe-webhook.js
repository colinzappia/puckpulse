import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// A short, human-typeable code (letters and digits, excluding easily
// confused characters like 0/O and 1/I/L) — this is what association
// members will actually type in to join, so it needs to be easy to
// read off an email and enter by hand, not just technically unique.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateJoinCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// Retries on the rare chance of a genuine collision (the unique
// constraint on join_code is the real safety net; this just avoids
// surfacing that as an error to the customer when it's actually
// harmless and immediately resolvable by trying again).
async function createAssociationWithUniqueCode(row) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const join_code = generateJoinCode();
    const { data, error } = await supabaseAdmin
      .from('associations')
      .insert({ ...row, join_code })
      .select()
      .single();
    if (!error) return data;
    // 23505 = Postgres unique_violation — only worth retrying that
    // specific failure, not any other kind of insert error.
    if (error.code !== '23505') throw error;
  }
  throw new Error('Could not generate a unique join code after 5 attempts.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const planName = session.metadata?.planName;

        // A one-time payment (mode: 'payment') is an Association season
        // pass — everything else (mode: 'subscription') is Basic/Pro/
        // Team/Scout, which this app already handles by checking Stripe
        // directly on each request rather than needing anything saved
        // here, so there's nothing further to do for those.
        if (session.mode === 'payment') {
          if (!supabaseAdmin) {
            console.error('Association purchase completed but SUPABASE_SERVICE_ROLE_KEY is not configured — cannot save it.');
            break;
          }

          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          const priceId = lineItems.data[0]?.price?.id;
          const price = priceId ? await stripe.prices.retrieve(priceId) : null;
          const teamsAllowed = parseInt(price?.metadata?.teamsAllowed, 10);

          if (!teamsAllowed) {
            console.error(`Association purchase completed but the Stripe price is missing teamsAllowed metadata (price: ${priceId}).`);
            break;
          }

          const adminEmail = session.customer_details?.email || session.customer_email;
          const associationName = session.metadata?.associationName?.trim() || 'Unnamed Association';

          // Season runs Sept 1 through Mar 31 — spanning the calendar
          // year boundary, so the year used for each date depends on
          // when the purchase actually happens: buying in, say, July
          // 2026 means the season is Sept 2026–Mar 2027, but buying in
          // January 2027 (mid-season) still means the *same* season,
          // Sept 2026–Mar 2027, not a new one starting that January.
          const now = new Date();
          const purchaseYear = now.getUTCFullYear();
          const seasonStartYear = now.getUTCMonth() >= 8 /* Sept = index 8 */ ? purchaseYear : purchaseYear - 1;
          const season_start = `${seasonStartYear}-09-01`;
          const season_end = `${seasonStartYear + 1}-03-31`;

          const association = await createAssociationWithUniqueCode({
            admin_email: adminEmail,
            association_name: associationName,
            teams_allowed: teamsAllowed,
            season_start,
            season_end,
            stripe_payment_id: session.payment_intent || session.id,
          });

          console.log(`✅ Association created: ${association.association_name} (${association.join_code}), ${teamsAllowed} teams, admin=${adminEmail}`);
        } else {
          console.log(`✅ New subscription: userId=${userId}, plan=${planName}`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log(`❌ Subscription cancelled: ${subscription.id}`);
        break;
      }
      case 'customer.updated': {
        const customer = event.data.object;
        console.log(`🔄 Customer updated: ${customer.id}`);
        break;
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: err.message });
  }
}

export const config = {
  api: { bodyParser: false },
};
