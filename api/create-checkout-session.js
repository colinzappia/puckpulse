import Stripe from 'stripe';
 
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  const { priceId, userId, planName, couponCode, email, associationName } = req.body;
 
  if (!priceId || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
 
  try {
    // Read the price's own type directly from Stripe, rather than
    // hardcoding which specific price IDs are one-time vs recurring —
    // this way, adding a new Association tier later (or changing an
    // existing one) never needs a matching code change here, as long
    // as the price itself is set up correctly on Stripe's side.
    const price = await stripe.prices.retrieve(priceId);
    const isOneTime = price.type === 'one_time';

    const sessionParams = {
      mode: isOneTime ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId, planName },
      allow_promotion_codes: false,
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      ...(email ? { customer_email: email } : {}),
      // Association purchases land on a dedicated success screen that
      // looks up their new join code using the Checkout session ID —
      // everything else keeps landing on the main app as before.
      success_url: isOneTime
        ? `${process.env.VITE_APP_URL || 'https://topcheesehockey.com'}/association-welcome?session_id={CHECKOUT_SESSION_ID}`
        : `${process.env.VITE_APP_URL || 'https://topcheesehockey.com'}?subscribed=true`,
      cancel_url: `${process.env.VITE_APP_URL || 'https://topcheesehockey.com'}?cancelled=true`,
    };

    // subscription_data (trial days, recurring-specific metadata) only
    // makes sense in subscription mode; a one-time payment uses
    // payment_intent_data for the equivalent metadata attachment
    // instead — Stripe rejects subscription_data outright in payment
    // mode, so these can't just both be set unconditionally.
    if (isOneTime) {
      sessionParams.payment_intent_data = { metadata: { userId, planName, associationName: associationName || '' } };
      sessionParams.metadata = { userId, planName, associationName: associationName || '' };
    } else {
      sessionParams.subscription_data = couponCode
        ? { metadata: { userId, planName } }
        : { trial_period_days: 30, metadata: { userId, planName } };
    }
 
    // Apply coupon if provided, otherwise allow promotion codes — this
    // part of Stripe's API works the same shape in both modes, so it's
    // unchanged either way.
    if (couponCode) {
      try {
        let validCoupon = null;
        try { validCoupon = await stripe.coupons.retrieve(couponCode); } catch {}
        if (!validCoupon) { try { validCoupon = await stripe.coupons.retrieve(couponCode.toUpperCase()); } catch {} }
        if (!validCoupon) { try { validCoupon = await stripe.coupons.retrieve(couponCode.toLowerCase()); } catch {} }
        
        if (validCoupon) {
          sessionParams.discounts = [{ coupon: validCoupon.id }];
          delete sessionParams.allow_promotion_codes;
          // If 100% off, don't require payment method
          const isFullDiscount = validCoupon.percent_off === 100 || 
            (validCoupon.amount_off && validCoupon.currency);
          if (isFullDiscount) {
            sessionParams.payment_method_collection = 'if_required';
          }
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
