import React, { useState } from 'react';

interface AdvertisePageProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdvertisePage: React.FC<AdvertisePageProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [tier, setTier] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const tiers = [
    {
      name: 'Basic Banner',
      price: '$200',
      period: '/ month CAD',
      color: 'border-white/20',
      badge: '',
      features: [
        'Logo + tagline in sponsor banner',
        'Link to your website',
        'Visible to all app users',
        'Monthly performance report',
      ],
    },
    {
      name: 'Featured Sponsor',
      price: '$500',
      period: '/ month CAD',
      color: 'border-yellow-400',
      badge: 'Most Popular',
      features: [
        'Everything in Basic',
        'Logo on exported scouting reports',
        '"Official Sponsor" designation',
        'Featured placement on landing page',
        'Priority support',
      ],
    },
    {
      name: 'Title Sponsor',
      price: '$1,000+',
      period: '/ month CAD',
      color: 'border-white/20',
      badge: '',
      features: [
        'Everything in Featured',
        '"Powered by [Brand]" throughout app',
        'Exclusive category — no competitors',
        'Custom banner colors matching your brand',
        'Logo on landing page hero section',
        'Quarterly strategy call',
      ],
    },
  ];

  const handleSubmit = async () => {
    if (!name || !email || !company || !tier) {
      setError('Please fill in all required fields.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message: `ADVERTISING INQUIRY\n\nCompany: ${company}\nTier of Interest: ${tier}\n\n${message}`,
        }),
      });
      const data = await response.json();
      if (data.success) setSent(true);
      else setError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Could not send. Please email us at hello@topcheesehockey.com');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Advertise With Us</h2>
          <p className="text-xs text-slate-500 mt-0.5">Reach hockey coaches across Canada</p>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg font-bold transition-colors">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 max-w-5xl mx-auto w-full">
        {sent ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
            <div className="text-5xl">🏒</div>
            <h3 className="text-2xl font-black text-white">Thanks {name}!</h3>
            <p className="text-slate-400">We'll be in touch at {email} within 2 business days.</p>
            <button onClick={onClose} className="mt-4 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-colors">Back to App</button>
          </div>
        ) : (
          <>
            {/* Intro */}
            <div className="text-center mb-10">
              <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                Top Cheese Hockey puts your brand in front of hockey coaches at every level — from minor hockey to junior professional teams across Canada.
              </p>
              <div className="flex justify-center gap-8 mt-6">
                {[
                  { label: 'Active Coaches', value: 'Growing' },
                  { label: 'Games Tracked', value: 'Daily' },
                  { label: 'Audience', value: 'Canada' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-xl font-black text-yellow-400">{s.value}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing tiers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
              {tiers.map(t => (
                <div
                  key={t.name}
                  onClick={() => setTier(t.name)}
                  className={`relative rounded-2xl p-6 border cursor-pointer transition-all ${tier === t.name ? 'bg-white/10 border-cyan-400 ring-2 ring-cyan-400/30' : `bg-[#0f1620] ${t.color} hover:border-white/30`}`}
                >
                  {t.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-[#05070a] text-xs font-black px-3 py-1 rounded-full whitespace-nowrap">{t.badge}</div>
                  )}
                  {tier === t.name && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-black">✓</div>
                  )}
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t.name}</p>
                  <p className="text-3xl font-black text-white mb-1">{t.price}</p>
                  <p className="text-xs text-slate-400 mb-4 pb-4 border-b border-white/10">{t.period}</p>
                  <ul className="space-y-2">
                    {t.features.map(f => (
                      <li key={f} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-yellow-400 font-bold shrink-0">✓</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Contact form */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-xl mx-auto">
              <h3 className="text-white font-black text-lg mb-5">Get in touch</h3>

              {error && <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Your Name *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500/40" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Company *</label>
                    <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Sports" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500/40" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Email Address *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500/40" />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sponsorship Tier *</label>
                  <select value={tier} onChange={e => setTier(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500/40">
                    <option value="">Select a tier...</option>
                    {tiers.map(t => <option key={t.name} value={t.name}>{t.name} — {t.price}/month</option>)}
                    <option value="Custom">Custom / Not sure yet</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Message (optional)</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us about your brand and any questions you have..." rows={4} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500/40 resize-none" />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={sending}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${sending ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
                >
                  {sending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                    </span>
                  ) : 'Send Inquiry →'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdvertisePage;
