import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, email } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Find customer by email
    const customers = await stripe.customers.list({ email, limit: 5 });
    
    if (customers.data.length === 0) {
      return res.status(200).json({ isSubscribed: false, plan: null });
    }

    // Check all customers with this email for active subscriptions
    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 5,
      });

      // Also check trialing subscriptions
      const trialSubs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'trialing',
        limit: 5,
      });

      const allSubs = [...subscriptions.data, ...trialSubs.data];

      if (allSubs.length > 0) {
        const sub = allSubs[0];
        const planName = sub.metadata?.planName || 'Basic';
        return res.status(200).json({ 
          isSubscribed: true, 
          plan: planName,
          status: sub.status,
          trialEnd: sub.trial_end,
        });
      }
    }

    return res.status(200).json({ isSubscribed: false, plan: null });
  } catch (err) {
    console.error('Subscription check error:', err);
    return res.status(500).json({ error: err.message });
  }
}
