import React from 'react';

interface AboutPageProps {
  onClose: () => void;
  onContact: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onClose, onContact }) => {
  return (
    <div className="fixed inset-0 z-[300] bg-[#05070a] flex flex-col overflow-y-auto">

      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-lg font-bold"
      >×</button>

      {/* Hero */}
      <div className="relative bg-[#0a0e14] border-b border-white/5 px-6 sm:px-16 py-16 flex flex-col lg:flex-row items-center gap-12 max-w-6xl mx-auto w-full">
        <div className="flex-1">
          <p className="text-xs font-black text-cyan-400 uppercase tracking-[0.3em] mb-3">About Top Cheese Hockey</p>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-5">
            Built by a coach.<br/>
            <span className="text-cyan-400">For every coach.</span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
            Pro-level hockey analytics that belong on every bench — not just in NHL front offices.
          </p>
        </div>
        <div className="shrink-0">
          <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="w-48 sm:w-64 lg:w-72" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 sm:px-16 py-14 space-y-16">

        {/* Origin story */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-black text-cyan-400 uppercase tracking-[0.3em] mb-3">The Story</p>
            <h2 className="text-3xl font-black text-white mb-5">It started between the benches.</h2>
            <div className="space-y-4 text-slate-300 text-base leading-relaxed">
              <p>
                For the past 10 seasons I've been the colour analyst on Rogers TV for Ottawa 67's home telecasts — positioned right between the two benches, watching the game unfold up close from puck drop to final buzzer.
              </p>
              <p>
                Sitting that close to the action, I started thinking about how I could capture more meaningful data during games to make my broadcasts sharper. I built a basic tracking system for myself — and realized quickly that what I had was far more useful than just for TV commentary.
              </p>
              <p>
                I brought the idea to coaches across the OHL. The response was unanimous: this was exactly the kind of tool they needed on the bench, and nothing like it existed at an accessible price point.
              </p>
              <p>
                Top Cheese Hockey was born.
              </p>
            </div>
          </div>

          {/* Photo placeholder */}
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img src="/colin-67s.jpg" alt="Colin Zappia between the benches at Ottawa 67's" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-4 -right-4 bg-cyan-600 text-white text-xs font-black px-4 py-2 rounded-xl shadow-lg">
              10 Seasons · Ottawa 67's
            </div>
          </div>
        </section>

        {/* Coaching background */}
        <section className="bg-[#0a0e14] border border-white/5 rounded-3xl p-8 sm:p-12">
          <p className="text-xs font-black text-cyan-400 uppercase tracking-[0.3em] mb-3">The Credentials</p>
          <h2 className="text-3xl font-black text-white mb-8">12 years on the bench.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { num: '12', label: 'Years Coaching', sub: 'From minor hockey to junior' },
              { num: '6', label: 'Minor Hockey', sub: 'Novice through Midget levels' },
              { num: '6', label: 'Junior Hockey', sub: 'Competitive junior programs' },
              { num: '10', label: 'Seasons on TV', sub: 'Ottawa 67\'s colour analyst' },
            ].map(s => (
              <div key={s.label} className="text-center p-6 bg-white/3 rounded-2xl border border-white/5">
                <p className="text-5xl font-black text-cyan-400 italic mb-1">{s.num}</p>
                <p className="text-white font-black text-sm uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-slate-500 text-xs">{s.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mission */}
        <section className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-black text-cyan-400 uppercase tracking-[0.3em] mb-3">The Mission</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6 leading-tight">
            Every coach deserves the same information the pros have.
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            NHL teams spend millions on analytics. Minor hockey coaches track games on paper. Top Cheese Hockey bridges that gap — bringing live shot tracking, AI tactical intel, faceoff analytics, and professional scouting reports to any coach, at any level, on any device.
          </p>
        </section>

        {/* Built for */}
        <section>
          <p className="text-xs font-black text-cyan-400 uppercase tracking-[0.3em] mb-3 text-center">Built For</p>
          <h2 className="text-3xl font-black text-white mb-8 text-center">Every level of the game.</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { level: 'Minor Hockey', desc: 'Novice through Midget' },
              { level: 'Junior A/B', desc: 'OHL, WHL, QMJHL & more' },
              { level: 'Senior & Rec', desc: 'Competitive adult leagues' },
              { level: 'Semi-Pro', desc: 'ECHL, AHL & European' },
            ].map(l => (
              <div key={l.level} className="bg-[#0a0e14] border border-white/5 rounded-2xl p-5 text-center">
                <p className="text-white font-black text-sm mb-1">{l.level}</p>
                <p className="text-slate-500 text-xs">{l.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border border-cyan-500/20 rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-black text-white mb-3">Questions? Let's talk.</h2>
          <p className="text-slate-400 mb-6">Whether you're a coach, a sponsor, or just curious — I'd love to hear from you.</p>
          <button
            onClick={onContact}
            className="px-8 py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-colors shadow-lg"
          >
            Get in Touch →
          </button>
          <p className="text-slate-600 text-xs mt-4">hello@topcheesehockey.com</p>
        </section>

      </div>

      {/* Footer */}
      <div className="border-t border-white/5 py-6 text-center">
        <p className="text-slate-600 text-xs">© 2026 Top Cheese Hockey · topcheesehockey.com</p>
      </div>

    </div>
  );
};

export default AboutPage;
