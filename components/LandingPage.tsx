import React from 'react';

interface LandingPageProps {
  onLaunch: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunch }) => {
  const handleLaunch = () => {
    window.scrollTo({ top: 0 });
    onLaunch();
  };
  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 flex flex-col overflow-x-hidden">
      
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#05070a]/90 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-10 w-auto" />
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
          your bench <span className="text-yellow-400">deserves</span>
        </h1>

        <p className="text-lg text-slate-400 max-w-xl mb-10">
          Track. Analyze. Win. Live game tracking, instant roster management, and powerful hockey insights—all in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <button
            onClick={handleLaunch}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-10 py-4 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-red-900/30"
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
      </section>

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
            <div key={f.title} className="bg-[#0f1620] border border-white/8 rounded-xl p-6 hover:border-white/15 transition-colors">
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-base mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-20 bg-[#0a0e14] border-y border-white/5 w-full">
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

        <p className="text-slate-400 text-sm mb-10 italic">All plans include a free 7-day trial. No credit card required to start.</p>
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
            <div key={p.name} className={`rounded-2xl p-7 flex flex-col relative border ${p.featured ? 'border-yellow-400' : 'border-white/10 bg-[#0f1620]'}`}>
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
                Start 7-day free trial →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center bg-[#0a0e14] border-t border-white/5 w-full">
        <h2 className="text-4xl font-black tracking-tight mb-4">Ready to raise your game?</h2>
        <p className="text-slate-400 text-lg mb-8">Join coaches who are already using Top Cheese Hockey to gain the edge.</p>
        <button
          onClick={handleLaunch}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-12 py-4 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg"
        >
          Launch the app →
        </button>
      </section>

      {/* FOOTER */}
      <footer className="px-6 py-8 text-center text-slate-600 text-sm border-t border-white/5">
        © 2026 Top Cheese Hockey · Built for hockey people, by hockey people
      </footer>
    </div>
  );
};

export default LandingPage;
