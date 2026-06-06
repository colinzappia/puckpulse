import React from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';

interface Plan {
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  priceId: string;
  featured: boolean;
}

const plans: Plan[] = [
  {
    name: 'Basic',
    price: '$9.99',
    period: '/ month',
    desc: 'Perfect for individual coaches tracking one team.',
    features: ['Live rink event tracking', 'Paste roster import', 'Basic play-by-play log', 'Faceoff Hub', 'PDF & Excel exports'],
    priceId: import.meta.env.VITE_STRIPE_BASIC_PRICE_ID,
    featured: false,
  },
  {
    name: 'Pro',
    price: '$14.99',
    period: '/ month',
    desc: 'Full AI power for the serious coaching staff.',
    features: ['Everything in Basic', 'Live AI Tactical Intel', 'HTML report exports', 'Line management tools', 'Priority support'],
    priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
    featured: true,
  },
  {
    name: 'Team',
    price: '$29.99',
    period: '/ month',
    desc: 'Up to 5 users — ideal for full organizations.',
    features: ['Everything in Pro', 'Up to 5 user accounts', 'Season stats dashboard', 'Custom branding on reports', 'Early access to new features'],
    priceId: import.meta.env.VITE_STRIPE_TEAM_PRICE_ID,
    featured: false,
  },
];

interface PricingGateProps {
  onSubscribed: () => void;
}

const PricingGate: React.FC<PricingGateProps> = ({ onSubscribed }) => {
  const { userId } = useAuth();
  const { user } = useUser();
  const [loading, setLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [couponCode, setCouponCode] = React.useState('');

  const handleSubscribe = async (plan: Plan) => {
    setLoading(plan.name);
    setError('');
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          userId,
          planName: plan.name,
          couponCode: couponCode.trim().toUpperCase(),
          email: user?.primaryEmailAddress?.emailAddress || '',
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center px-4 py-12">
      <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-24 w-auto mb-6" />
      
      <h2 className="text-3xl font-black text-white tracking-tight mb-2">Choose your plan</h2>
      <p className="text-slate-400 mb-2">7-day free trial on all plans. No credit card surprises.</p>
      <p className="text-xs text-slate-600 mb-8">Cancel any time.</p>

      {/* Coupon code */}
      <div className="flex gap-2 w-full max-w-sm mb-6">
        <input
          type="text"
          placeholder="Have a promo code?"
          value={couponCode}
          onChange={e => setCouponCode(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/40"
        />
        {couponCode && (
          <div className="flex items-center px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-xl">
            <span className="text-green-400 text-xs font-bold">✓ Applied</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6 max-w-sm text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-4xl">
        {plans.map(plan => (
          <div
            key={plan.name}
            className={`rounded-2xl p-6 flex flex-col relative border ${plan.featured ? 'border-yellow-400 bg-[#0f1620]' : 'border-white/10 bg-[#0f1620]'}`}
          >
            {plan.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-[#05070a] text-xs font-black px-3 py-1 rounded-full whitespace-nowrap">
                Most popular
              </div>
            )}
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{plan.name}</p>
            <p className="text-3xl font-black text-white mb-1">
              {plan.price} <span className="text-base font-normal text-slate-400">{plan.period}</span>
            </p>
            <p className="text-slate-400 text-sm mb-4 pb-4 border-b border-white/10">{plan.desc}</p>
            <ul className="flex flex-col gap-2 mb-6 flex-1">
              {plan.features.map(f => (
                <li key={f} className="text-sm flex gap-2 text-slate-300">
                  <span className="text-yellow-400 font-bold shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe(plan)}
              disabled={!!loading}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                plan.featured
                  ? 'bg-yellow-400 text-[#05070a] hover:bg-yellow-300'
                  : 'border border-white/10 text-white hover:border-white/20 hover:bg-white/5'
              } ${loading === plan.name ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading === plan.name ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                </span>
              ) : 'Start 7-day free trial →'}
            </button>
          </div>
        ))}
      </div>

      <p className="text-slate-600 text-xs mt-8">
        © 2026 Top Cheese Hockey · Built for hockey people, by hockey people
      </p>
    </div>
  );
};

export default PricingGate;
