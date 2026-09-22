import React from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import JoinAssociation from './JoinAssociation';

interface Plan {
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  priceId: string;
  featured: boolean;
  isOneTime?: boolean;
}

const plans: Plan[] = [
  {
    name: 'Basic',
    price: '$9.99',
    period: '/ month',
    desc: 'Perfect for individual coaches tracking one team.',
    features: ['Live rink event tracking', 'AI Roster Sync (paste, photo & PDF import)', 'Basic play-by-play log', 'PDF & Excel exports'],
    priceId: import.meta.env.VITE_STRIPE_BASIC_PRICE_ID,
    featured: false,
  },
  {
    name: 'Pro',
    price: '$14.99',
    period: '/ month',
    desc: 'Full AI power for the serious coaching staff.',
    features: ['Everything in Basic', 'Faceoff Hub', 'Zone Entries & Breakouts tracking', 'Live AI Tactical Intel', 'HTML report exports', 'Line management tools', 'Priority support'],
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

const scoutPlans: Plan[] = [
  {
    name: 'Scout Individual',
    price: '$49.99',
    period: '/ month',
    desc: 'Full Pro-level access, plus CHL & AAA schedules with auto-populated lineups.',
    features: ['Everything in Pro', 'Scouts Portal Games tab', 'Auto-populated CHL lineups', 'Upload lineups for any league'],
    priceId: import.meta.env.VITE_STRIPE_SCOUT_INDIVIDUAL_PRICE_ID,
    featured: false,
  },
  {
    name: 'Scout Team',
    price: '$149.99',
    period: '/ month',
    desc: 'A small scouting group sharing one subscription.',
    features: ['Everything in Scout Individual', 'Invite your scouting group by email', 'Shared access, one bill'],
    priceId: import.meta.env.VITE_STRIPE_SCOUT_TEAM_PRICE_ID,
    featured: false,
  },
  {
    name: 'Scout Organization',
    price: '$299.99',
    period: '/ month',
    desc: 'For larger scouting departments.',
    features: ['Everything in Scout Team', 'Larger group size', 'Priority support'],
    priceId: import.meta.env.VITE_STRIPE_SCOUT_ORG_PRICE_ID,
    featured: false,
  },
];

const associationPlans: Plan[] = [
  {
    name: 'Association — 6 Teams',
    price: '$599',
    period: '/ season',
    desc: 'One payment covers your whole association, Sept 1 – Mar 31.',
    features: ['Up to 6 teams', 'Every coach gets full access', 'Self-service join code', 'One payment, whole season'],
    priceId: import.meta.env.VITE_STRIPE_ASSOC_6_PRICE_ID,
    featured: false,
    isOneTime: true,
  },
  {
    name: 'Association — 10 Teams',
    price: '$999',
    period: '/ season',
    desc: 'One payment covers your whole association, Sept 1 – Mar 31.',
    features: ['Up to 10 teams', 'Every coach gets full access', 'Self-service join code', 'One payment, whole season'],
    priceId: import.meta.env.VITE_STRIPE_ASSOC_10_PRICE_ID,
    featured: false,
    isOneTime: true,
  },
  {
    name: 'Association — 20 Teams',
    price: '$1,699',
    period: '/ season',
    desc: 'One payment covers your whole association, Sept 1 – Mar 31.',
    features: ['Up to 20 teams', 'Every coach gets full access', 'Self-service join code', 'One payment, whole season'],
    priceId: import.meta.env.VITE_STRIPE_ASSOC_20_PRICE_ID,
    featured: false,
    isOneTime: true,
  },
  {
    name: 'Association — 30 Teams',
    price: '$2,499',
    period: '/ season',
    desc: 'One payment covers your whole association, Sept 1 – Mar 31.',
    features: ['Up to 30 teams', 'Every coach gets full access', 'Self-service join code', 'One payment, whole season'],
    priceId: import.meta.env.VITE_STRIPE_ASSOC_30_PRICE_ID,
    featured: false,
    isOneTime: true,
  },
  {
    name: 'Association — 40 Teams',
    price: '$3,199',
    period: '/ season',
    desc: 'One payment covers your whole association, Sept 1 – Mar 31.',
    features: ['Up to 40 teams', 'Every coach gets full access', 'Self-service join code', 'One payment, whole season'],
    priceId: import.meta.env.VITE_STRIPE_ASSOC_40_PRICE_ID,
    featured: false,
    isOneTime: true,
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
  const [showJoinAssociation, setShowJoinAssociation] = React.useState(false);
  const [pendingAssociationPlan, setPendingAssociationPlan] = React.useState<Plan | null>(null);
  const [associationNameInput, setAssociationNameInput] = React.useState('');

  const handleSubscribe = async (plan: Plan, associationName?: string) => {
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
          ...(associationName ? { associationName } : {}),
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

  // Association purchases need a name to save against — collected here,
  // right before checkout starts, rather than adding a field Stripe
  // itself has no natural place for.
  const handlePlanClick = (plan: Plan) => {
    if (plan.isOneTime) {
      setAssociationNameInput('');
      setPendingAssociationPlan(plan);
    } else {
      handleSubscribe(plan);
    }
  };

  const renderPlanCard = (plan: Plan) => (
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
      <p className="text-[11px] text-slate-500 mb-3 -mt-1">CAD, plus applicable sales tax</p>
      <p className="text-slate-400 text-sm mb-4 pb-4 border-b border-white/10">{plan.desc}</p>
      <ul className="flex flex-col gap-2 mb-6 flex-1">
        {plan.features.map(f => (
          <li key={f} className="text-sm flex gap-2 text-slate-300">
            <span className="text-yellow-400 font-bold shrink-0">✓</span>{f}
          </li>
        ))}
      </ul>
      <button
        onClick={() => handlePlanClick(plan)}
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
        ) : plan.isOneTime ? 'Purchase Season Pass →' : 'Start 7-day free trial →'}
      </button>
    </div>
  );

  return (
    <>
    <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center px-4 py-12">
      <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-24 w-auto mb-6" />
      
      <h2 className="text-3xl font-black text-white tracking-tight mb-2">Choose your plan</h2>
      <p className="text-slate-400 mb-2">7-day free trial on all plans. No credit card surprises.</p>
      <p className="text-xs text-slate-600 mb-8">Cancel any time.</p>

      <button
        onClick={() => setShowJoinAssociation(true)}
        className="text-cyan-400 hover:text-cyan-300 text-xs font-bold underline mb-6"
      >
        Have an association join code?
      </button>

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
        {plans.map(renderPlanCard)}
      </div>

      <div className="w-full max-w-4xl mt-16">
        <h3 className="text-xl font-black text-white tracking-tight mb-1 text-center">Scouting</h3>
        <p className="text-slate-500 text-sm mb-6 text-center">Full Pro-level access, plus CHL & AAA schedules with auto-populated lineups.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {scoutPlans.map(renderPlanCard)}
        </div>
      </div>

      <div className="w-full max-w-6xl mt-16">
        <h3 className="text-xl font-black text-white tracking-tight mb-1 text-center">Association Season Passes</h3>
        <p className="text-slate-500 text-sm mb-6 text-center">One payment for your entire association, September through March.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          {associationPlans.map(renderPlanCard)}
        </div>
      </div>

      <p className="text-slate-500 text-xs mt-6 text-center max-w-md px-4">
        By subscribing you agree to our <a href="/terms.html" target="_blank" className="text-cyan-400 hover:text-cyan-300 underline">Terms of Service</a> and <a href="/privacy.html" target="_blank" className="text-cyan-400 hover:text-cyan-300 underline">Privacy Policy</a>. Cancel any time.
      </p>
      <p className="text-slate-600 text-xs mt-3">
        © 2026 Top Cheese Hockey · Built for hockey people, by hockey people
      </p>
    </div>

    {showJoinAssociation && (
      <JoinAssociation
        onClose={() => setShowJoinAssociation(false)}
        onJoined={() => { setShowJoinAssociation(false); onSubscribed(); }}
      />
    )}

    {pendingAssociationPlan && (
      <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setPendingAssociationPlan(null)}>
        <div className="max-w-sm w-full bg-[#0f1620] border border-white/10 rounded-3xl p-8" onClick={e => e.stopPropagation()}>
          <div className="text-white font-black text-lg uppercase tracking-widest mb-1">Name Your Association</div>
          <div className="text-slate-500 text-xs mb-6">This appears on your welcome page and is how your coaches will recognize it.</div>
          <input
            value={associationNameInput}
            onChange={e => setAssociationNameInput(e.target.value)}
            placeholder="e.g. Ottawa District Minor Hockey"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500/50 mb-4"
            autoFocus
          />
          <button
            onClick={() => {
              if (!associationNameInput.trim()) return;
              const plan = pendingAssociationPlan;
              setPendingAssociationPlan(null);
              handleSubscribe(plan, associationNameInput.trim());
            }}
            disabled={!associationNameInput.trim()}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest text-sm disabled:opacity-40 mb-2"
          >
            Continue to Payment
          </button>
          <button onClick={() => setPendingAssociationPlan(null)} className="w-full py-2 text-slate-500 text-xs uppercase tracking-widest">
            Cancel
          </button>
        </div>
      </div>
    )}
    </>
  );
};

export default PricingGate;
