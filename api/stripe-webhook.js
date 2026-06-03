import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
        console.log(`✅ New subscription: userId=${userId}, plan=${planName}`);
        // Store subscription status - in production you'd save to a database
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
