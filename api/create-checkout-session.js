import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { priceId, userId, planName, couponCode } = req.body;

  if (!priceId || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Build session params
    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId, planName },
      },
      metadata: { userId, planName },
      allow_promotion_codes: false,
      success_url: `${process.env.VITE_APP_URL || 'https://topcheesehockey.com'}?subscribed=true`,
      cancel_url: `${process.env.VITE_APP_URL || 'https://topcheesehockey.com'}?cancelled=true`,
    };

    // Apply coupon if provided, otherwise allow promotion codes
    if (couponCode) {
      try {
        let validCoupon = null;
        try { validCoupon = await stripe.coupons.retrieve(couponCode); } catch {}
        if (!validCoupon) { try { validCoupon = await stripe.coupons.retrieve(couponCode.toUpperCase()); } catch {} }
        if (!validCoupon) { try { validCoupon = await stripe.coupons.retrieve(couponCode.toLowerCase()); } catch {} }
        
        if (validCoupon) {
          sessionParams.discounts = [{ coupon: validCoupon.id }];
          delete sessionParams.allow_promotion_codes;
        } else {
          return res.status(400).json({ error: `Invalid promo code: ${couponCode}` });
        }
      } catch {
        return res.status(400).json({ error: `Invalid promo code: ${couponCode}` });
      }
    } else {
      sessionParams.allow_promotion_codes = true;
      delete sessionParams.discounts;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
}
