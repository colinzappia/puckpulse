import React from 'react';

interface UserManualProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections = [
    {
      title: "1. Initial Setup",
      content: "Before the puck drops, tap the 'ROSTER SETUP' button in the top right to open team management. Here you can set team names, upload logos, and manage rosters. Use the 'AI Sync' feature by entering a team name or a specific roster URL to automatically pull player data using Gemini AI."
    },
    {
      title: "2. Logging Events",
      content: "The logging toolbar is located directly below the shot counter. To log an event: \n1. Select the active team (Home/Away).\n2. Tap a player from the lineup grid (or use 'SHOW ROSTERS' to reveal them if hidden).\n3. Select the event type (SHOT, GOAL, etc.) from the center of the toolbar.\n4. Tap the location on the rink map to plot the event."
    },
    {
      title: "3. Faceoff Hub & Utility",
      content: "The 'F.O. HUB' button is grouped with the team selectors. Tap it to manage faceoffs. Select a center for each team. When you plot a faceoff on the rink, it will automatically record a win for the active team and a loss for the opponent."
    },
    {
      title: "4. AI Coaching Intel",
      content: "As you log events, tap 'Generate Live Tactical Intel' in the Coaching Intel section. Gemini AI will analyze the spatial data, shot volume, and game flow to provide professional coaching insights and tactical adjustments."
    },
    {
      title: "5. Map Filters & Isolation",
      content: "The filter bar is now located directly below the rink diagram. Use these buttons to toggle visibility of specific event types on the map. Use 'Isolate' to quickly focus on a single type for pattern analysis."
    },
    {
      title: "6. Tactical Feed Review",
      content: "Review every sequence in the tightened 'Tactical Feed' below the Coaching Intel. Each event is recorded on a single high-speed line. Tap any item to add specific scouting notes or adjust player details."
    },
    {
      title: "7. Exporting Reports",
      content: "At any time, use the export buttons to generate professional scouting reports. \n- PDF: A high-fidelity print-ready report.\n- Excel: Raw data for deep statistical analysis.\n- HTML: A standalone interactive web report."
    }
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
      <div className="px-6 py-6 sm:px-10 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex flex-col">
          <h2 className="text-3xl sm:text-4xl font-black italic uppercase text-white tracking-tighter">User Manual</h2>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.3em] mt-1">Master the Top Cheese Hockey Elite Suite</p>
        </div>
        <button 
          onClick={onClose} 
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/5 active:scale-90"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 sm:p-12 scrollbar-none">
        <div className="max-w-4xl mx-auto space-y-12 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {sections.map((section, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 hover:border-blue-500/30 transition-all group">
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4 group-hover:text-blue-400 transition-colors">
                  {section.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line font-medium">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-blue-600/10 border border-blue-500/20 rounded-[3rem] p-10 text-center">
            <h4 className="text-sm font-black text-blue-400 uppercase tracking-[0.4em] mb-4">Pro Tip</h4>
            <p className="text-slate-300 text-sm italic">
              "Use the 'Numerical Roster' view in setup to quickly edit player numbers and positions during warmups. Accurate rosters lead to better AI narrative generation."
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 border-t border-white/10 bg-black/80 backdrop-blur-md flex justify-center shrink-0">
        <button 
          onClick={onClose} 
          className="w-full max-w-lg py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-[0.6em] text-[11px] shadow-2xl active:scale-95 transition-all"
        >
          Got it, Coach
        </button>
      </div>
    </div>
  );
};

export default UserManual;
