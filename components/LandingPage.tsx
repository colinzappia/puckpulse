import React from 'react';
import ThemedBackground from './ThemedBackground';

interface LandingPageProps {
  onLaunch: () => void;
  onContact?: () => void;
  onAdvertise?: () => void;
  onAbout?: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunch, onContact, onAdvertise, onAbout }) => {
  const handleLaunch = () => {
    window.scrollTo({ top: 0 });
    onLaunch();
  };
  return (
    <ThemedBackground className="text-slate-200 flex flex-col">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-14 w-auto" />
        <button
          onClick={handleLaunch}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
        >
          Launch App →
        </button>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-6 flex flex-col items-center text-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(200,232,245,0.05)_0%,transparent_70%)] pointer-events-none" />
        
        <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-[32rem] w-auto mb-8" />
        
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-blue-300 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          AI-Powered Live Hockey Analytics
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight mb-6">
          The coaching edge<br />
          your bench <span className="tch-gradient-text">deserves</span>
        </h1>

        <p className="text-lg text-slate-400 max-w-xl mb-6">
          Track. Analyze. Win. Live game tracking, instant roster management, and powerful hockey insights—all in one place.
        </p>

        <div className="w-36 h-1 rounded-full mb-8 tch-ice-line" />

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-10">
          <button
            onClick={handleLaunch}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-10 py-4 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-red-900/30 tch-red-pulse"
          >
            Launch App →
          </button>
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="border border-white/10 hover:border-white/20 text-slate-300 font-semibold text-lg px-10 py-4 rounded-xl transition-all hover:bg-white/5"
          >
            See features
          </button>
        </div>

        {/* Scrolling feature ticker */}
        <div className="w-full max-w-[780px] overflow-hidden border-t border-b border-white/10 py-3.5 bg-white/[0.03]" style={{ WebkitMaskImage: 'linear-gradient(90deg,transparent,black 10%,black 90%,transparent)', maskImage: 'linear-gradient(90deg,transparent,black 10%,black 90%,transparent)' }}>
          <div className="flex gap-4 whitespace-nowrap text-xs font-extrabold tracking-wider text-slate-300 tch-ticker-track">
            {Array(2).fill(0).map((_, dupe) => (
              <React.Fragment key={dupe}>
                <span>🏒 LIVE SHOT TRACKING</span><span className="text-yellow-400/60">//</span>
                <span>🎯 FACEOFF ANALYTICS</span><span className="text-yellow-400/60">//</span>
                <span>🤖 AI TACTICAL INTEL</span><span className="text-yellow-400/60">//</span>
                <span>📋 LINE MANAGEMENT</span><span className="text-yellow-400/60">//</span>
                <span>📊 SCOUTING REPORTS</span><span className="text-yellow-400/60">//</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .tch-gradient-text {
          background: linear-gradient(110deg, #60a5fa, #facc15, #f87171, #60a5fa);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: tchGradientSweep 4s ease-in-out infinite;
        }
        @keyframes tchGradientSweep { 0%{background-position:0% 50%;} 50%{background-position:100% 50%;} 100%{background-position:0% 50%;} }
        .tch-ice-line {
          background: linear-gradient(90deg,transparent,#60a5fa,#facc15,#f87171,transparent);
          background-size: 200% 100%;
          animation: tchGradientSweep 3s linear infinite;
          box-shadow: 0 0 20px rgba(96,165,250,0.6);
        }
        .tch-red-pulse { animation: tchRedGlowPulse 2.4s ease-in-out infinite; }
        @keyframes tchRedGlowPulse {
          0%,100% { box-shadow:0 10px 30px rgba(127,29,29,0.3); }
          50% { box-shadow:0 16px 46px rgba(220,38,38,0.6); }
        }
        .tch-ticker-track { animation: tchTickerScroll 22s linear infinite; }
        @keyframes tchTickerScroll { 0%{transform:translateX(0);} 100%{transform:translateX(-50%);} }
        .tch-divider { height:2px; background:linear-gradient(90deg,transparent,rgba(96,165,250,0.5),rgba(250,204,21,0.5),transparent); position:relative; }
      `}</style>

      {/* FEATURES */}
      <section id="features" className="px-6 py-20 max-w-6xl mx-auto w-full">
        <p className="text-xs font-bold tracking-widest text-yellow-400 uppercase mb-3">Features</p>
        <h2 className="text-4xl font-black tracking-tight mb-4">Everything your coaching staff needs</h2>
        <p className="text-slate-400 text-lg max-w-lg mb-12">Built for real benches, real games, real decisions — not spreadsheets after the fact.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: '🏒', title: 'Interactive Rink Map', desc: 'Tap anywhere on a live rink diagram to log shots, goals, penalties, and faceoffs in real time.' },
            { icon: '🤖', title: 'AI Roster Sync', desc: 'Paste any team URL and your full roster populates in seconds — jersey numbers, positions, line assignments included.' },
            { icon: '⚡', title: 'Live Tactical Intel', desc: 'Get AI-generated coaching insights mid-game based on shot patterns, zone pressure, and game flow.' },
            { icon: '📊', title: 'Scouting Reports', desc: 'Export professional-grade reports as PDF, Excel, or HTML after any game.' },
            { icon: '🎯', title: 'Faceoff Hub', desc: 'Track faceoff wins and losses by zone and centre. Know your percentage before the third period.' },
            { icon: '📋', title: 'Line Management', desc: 'Drag and drop players between lines and pairings. Build your groups exactly the way you draw them up.' },
          ].map((f) => (
            <div key={f.title} className="bg-black/30 backdrop-blur-sm border border-white/8 rounded-xl p-6 hover:border-blue-400/40 hover:-translate-y-1 transition-all">
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-base mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="tch-divider max-w-6xl mx-auto w-full" />

      {/* COACH'S WHITEBOARD QUOTE */}
      <section className="px-6 py-20 max-w-6xl mx-auto w-full text-center">
        <div className="max-w-3xl mx-auto px-8 sm:px-10 py-12 rounded-3xl border border-dashed border-white/15 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.1),transparent_70%)]">
          <svg viewBox="0 0 400 160" className="w-56 h-auto mx-auto mb-6 opacity-80">
            <circle cx="60" cy="40" r="16" fill="none" stroke="#3b82f6" strokeWidth="2" />
            <circle cx="340" cy="120" r="16" fill="none" stroke="#3b82f6" strokeWidth="2" />
            <path d="M150 60 L172 82 M172 60 L150 82" stroke="#ef4444" strokeWidth="2.5" />
            <path d="M260 100 L282 122 M282 100 L260 122" stroke="#ef4444" strokeWidth="2.5" />
            <path d="M76 40 L150 64" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,5" />
            <path d="M172 71 L260 105" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,5" />
            <path d="M282 111 L324 120" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,5" />
          </svg>
          <p className="text-xl sm:text-2xl font-bold text-white italic leading-relaxed mb-5">
            "I built this because I know what a coach needs between whistles — not a complicated system, something fast enough to use with one hand on the bench."
          </p>
          <p className="text-xs font-bold tracking-wide text-yellow-400">
            — Colin Zappia, Founder · 12 Years Coaching Minor &amp; Junior A/B Hockey · 10 Seasons as Colour Analyst, Ottawa 67's on Rogers TV
          </p>
        </div>
      </section>

      <div className="tch-divider max-w-6xl mx-auto w-full" />

      {/* BUILT FOR */}
      <section className="px-6 py-20 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <p className="text-xs font-black text-cyan-400 uppercase tracking-[0.3em] mb-3">Built For</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">Every seat in the rink.</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            'Minor Hockey',
            'Junior A/B',
            'Senior & Rec',
            'Semi-Pro',
            'Broadcasters',
          ].map(level => (
            <div key={level} className="bg-black/30 backdrop-blur-sm border border-white/5 rounded-2xl p-5 text-center hover:border-blue-400/40 hover:-translate-y-1 transition-all flex items-center justify-center min-h-[72px]">
              <p className="text-white font-black text-sm">{level}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="tch-divider max-w-6xl mx-auto w-full" />

      {/* HOW IT WORKS */}
      <section className="px-6 py-20 bg-black/20 backdrop-blur-sm border-y border-white/5 w-full">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-bold tracking-widest text-yellow-400 uppercase mb-3">How it works</p>
          <h2 className="text-4xl font-black tracking-tight mb-12">Up and running before puck drop</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { num: '1', title: 'Sync your roster', desc: 'Paste your team URL and AI pulls the full roster automatically.' },
              { num: '2', title: 'Track the game live', desc: 'Tap the rink map to log every event as it happens.' },
              { num: '3', title: 'Get AI insights', desc: 'Receive real coaching adjustments based on your live game data.' },
              { num: '4', title: 'Export your report', desc: 'Download a pro scouting report in PDF, Excel, or HTML.' },
            ].map((s) => (
              <div key={s.num} className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-600 text-white font-black text-xl flex items-center justify-center mx-auto mb-4">{s.num}</div>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-slate-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="px-6 py-20 max-w-6xl mx-auto w-full">
        <p className="text-xs font-bold tracking-widest text-yellow-400 uppercase mb-3">Pricing</p>
        <h2 className="text-4xl font-black tracking-tight mb-4">Simple, honest pricing</h2>
        <p className="text-slate-400 text-lg mb-4">No contracts, no surprises. Cancel any time.</p>

        <p className="text-slate-400 text-sm mb-10 italic">★ All plans include a free 30-day trial. No credit card required to start. ★</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl">
          {[
            {
              name: 'Basic', price: '$9.99', period: '/ month', desc: 'Perfect for individual coaches tracking one team.',
              features: ['Live rink event tracking', 'Manual roster entry', 'Basic play-by-play log', 'Faceoff Hub', 'PDF & Excel exports'],
              featured: false,
            },
            {
              name: 'Pro', price: '$14.99', period: '/ month', desc: 'Full AI power for the serious coaching staff.',
              features: ['Everything in Basic', 'AI Roster Sync', 'Live AI Tactical Intel', 'HTML report exports', 'Line management tools', 'Priority support'],
              featured: true,
            },
            {
              name: 'Team', price: '$29.99', period: '/ month', desc: 'Up to 5 users — ideal for full organizations.',
              features: ['Everything in Pro', 'Up to 5 user accounts', 'Season stats dashboard', 'Custom branding on reports', 'Early access to new features'],
              featured: false,
            },
          ].map((p) => (
            <div key={p.name} className={`rounded-2xl p-7 flex flex-col relative border backdrop-blur-sm ${p.featured ? 'border-2 border-yellow-400 bg-black/40 tch-gold-pulse scale-[1.02]' : 'border-white/10 bg-black/30'}`}>
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-[#05070a] text-xs font-black px-3 py-1 rounded-full whitespace-nowrap">Most popular</div>
              )}
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{p.name}</p>
              <p className="text-4xl font-black mb-1">{p.price} <span className="text-base font-normal text-slate-400">{p.period}</span></p>
              <p className="text-slate-400 text-sm mb-5 pb-5 border-b border-white/10">{p.desc}</p>
              <ul className="flex flex-col gap-2 mb-8 flex-1">
                {p.features.map(f => <li key={f} className="text-sm flex gap-2"><span className="text-yellow-400 font-bold">✓</span>{f}</li>)}
              </ul>
              <button
                onClick={handleLaunch}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${p.featured ? 'bg-yellow-400 text-[#05070a] hover:bg-yellow-300' : 'border border-white/10 hover:border-white/20 hover:bg-white/5'}`}
              >
                Start 30-day free trial →
              </button>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .tch-gold-pulse { animation: tchGoldGlowPulse 3s ease-in-out infinite; }
        @keyframes tchGoldGlowPulse {
          0%,100% { box-shadow:0 16px 40px rgba(250,204,21,0.12); }
          50% { box-shadow:0 22px 60px rgba(250,204,21,0.32); }
        }
      `}</style>

      {/* CTA */}
      <section className="px-6 py-24 text-center bg-black/20 backdrop-blur-sm border-t border-white/5 w-full relative overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: '#1d4ed8', opacity: 0.16, filter: 'blur(100px)' }} />
        <h2 className="text-4xl font-black tracking-tight mb-4 relative z-10">Ready to raise your game?</h2>
        <p className="text-slate-400 text-lg mb-8 relative z-10">Join coaches who are already using Top Cheese Hockey to gain the edge.</p>
        <button
          onClick={handleLaunch}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-12 py-4 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg relative z-10 tch-red-pulse"
        >
          Launch the app →
        </button>
      </section>

      {/* FOOTER */}
      <footer className="px-6 py-8 text-center text-slate-600 text-sm border-t border-white/5 bg-black/30 backdrop-blur-sm">
        © 2026 Top Cheese Hockey · Built for hockey people, by hockey people
        <span className="mx-2">·</span>
        <button onClick={() => onAdvertise && onAdvertise()} className="hover:text-slate-300 transition-colors bg-transparent border-none cursor-pointer text-inherit">📢 Advertise With Us</button>
        <span className="mx-2">·</span>
        <button onClick={() => onContact && onContact()} className="hover:text-slate-400 transition-colors bg-transparent border-none cursor-pointer text-inherit">Support</button>
        <span className="mx-2">·</span>
        <button onClick={() => onAbout && onAbout()} className="hover:text-slate-300 transition-colors bg-transparent border-none cursor-pointer text-inherit">About</button>
      </footer>
    </ThemedBackground>
  );
};

export default LandingPage;
