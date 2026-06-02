import React, { useState } from 'react';

interface UserManualProps {
  isOpen: boolean;
  onClose: () => void;
}

const sections = [
  {
    id: 'setup',
    icon: '⚙️',
    title: 'Getting Set Up',
    subsections: [
      {
        title: 'Setting team names',
        content: 'Tap the "Roster Setup" button in the top right corner. Enter your home and away team names. You can also upload team logos by tapping the logo placeholder and selecting an image from your device.'
      },
      {
        title: 'AI Roster Sync',
        content: 'The fastest way to load a roster. In Roster Setup, paste any team URL from sites like EliteProspects, HockeyDB, or your league\'s website into the AI Sync field. Tap "Sync" and the AI will pull every player\'s name, number, and position automatically. This usually takes 10–20 seconds.'
      },
      {
        title: 'Manual roster entry',
        content: 'You can also add players one at a time. Tap "Add Player", enter their jersey number, full name, and position. Assign them to a line or pairing (1–4 for forwards, P1–P3 for defense, G1–G2 for goalies).'
      }
    ]
  },
  {
    id: 'tracking',
    icon: '🏒',
    title: 'Tracking Events',
    subsections: [
      {
        title: 'Logging a shot or goal',
        content: '1. Select the active team using the Home / Away toggle.\n2. Tap a player from the lineup grid — their name will highlight to confirm selection.\n3. Select the event type from the toolbar: SHOT, GOAL, SAVE, MISS, etc.\n4. Tap the location on the rink diagram where the event occurred. The event is logged instantly.'
      },
      {
        title: 'Logging a penalty',
        content: 'Select the penalized player, tap PENALTY from the event toolbar, then tap the location on ice. You\'ll be prompted to select the infraction type and duration.'
      },
      {
        title: 'Logging a faceoff',
        content: 'Open the Faceoff Hub by tapping "F.O. HUB". Select the centre for each team, then tap the faceoff dot on the rink. The win is automatically recorded for the active team.'
      },
      {
        title: 'Undoing an event',
        content: 'Made a mistake? Tap the last event in the Tactical Feed and select "Delete" to remove it from the log and the rink map.'
      }
    ]
  },
  {
    id: 'ai',
    icon: '🤖',
    title: 'AI Features',
    subsections: [
      {
        title: 'Live Tactical Intel',
        content: 'At any point during the game, tap "Generate Live Tactical Intel" in the Coaching Intel panel. The AI analyzes your logged events — shot locations, zone pressure, faceoff results — and returns specific coaching adjustments you can act on right now. The more events you\'ve logged, the richer the insights.'
      },
      {
        title: 'Game Summary',
        content: 'After the final buzzer, tap "Generate Game Summary" to get a full narrative breakdown of the game — key moments, standout players, and areas to address in practice.'
      },
      {
        title: 'Tips for better AI results',
        content: 'Log events consistently throughout the game rather than in batches. The AI performs best when it has 20+ logged events to analyze. Make sure your roster is synced before the game so the AI knows which players are on the ice.'
      }
    ]
  },
  {
    id: 'rink',
    icon: '🗺️',
    title: 'Rink Map & Filters',
    subsections: [
      {
        title: 'Reading the rink map',
        content: 'Each event appears as a color-coded dot on the rink: red for home team events, blue for away. Goals are shown as larger filled circles. Hover over or tap any dot to see the player name, event type, and time.'
      },
      {
        title: 'Using filters',
        content: 'The filter bar below the rink lets you show or hide specific event types. Toggle SHOTS, GOALS, SAVES, MISSES, and PENALTIES independently. Use "Isolate" to show only one event type at a time — great for spotting shot location patterns.'
      },
      {
        title: 'Switching rink view',
        content: 'Tap the rink orientation button to flip between full rink, home zone, and away zone views depending on what you\'re analyzing.'
      }
    ]
  },
  {
    id: 'lines',
    icon: '📋',
    title: 'Line Management',
    subsections: [
      {
        title: 'Arranging lines',
        content: 'In the Lines panel, drag and drop players between line slots. Forward lines are numbered 1–4, defensive pairings are P1–P3, and goalies are G1–G2. Changes save automatically.'
      },
      {
        title: 'Showing rosters during the game',
        content: 'Tap "Show Rosters" to reveal the full lineup grid on screen. This is useful when you need to quickly select players without opening the full roster panel. Tap again to collapse it and free up screen space.'
      }
    ]
  },
  {
    id: 'exports',
    icon: '📊',
    title: 'Exporting Reports',
    subsections: [
      {
        title: 'PDF Scouting Report',
        content: 'Tap "Export PDF" to generate a print-ready scouting report. It includes a game summary, shot charts, player stats, faceoff results, and the AI coaching notes. Great for sharing with your staff or filing for the season.'
      },
      {
        title: 'Excel / Data Export',
        content: 'Tap "Export Excel" to download a spreadsheet with every logged event, timestamps, player names, and locations. Perfect for your own statistical analysis or feeding into a team database.'
      },
      {
        title: 'HTML Report',
        content: 'Tap "Export HTML" to save a standalone interactive report you can open in any browser and share via email or team messaging apps — no special software required.'
      }
    ]
  },
  {
    id: 'tips',
    icon: '💡',
    title: 'Tips & Best Practices',
    subsections: [
      {
        title: 'Before the game',
        content: 'Sync your roster at least 10 minutes before puck drop so you\'re not scrambling. Confirm jersey numbers match your actual lineup — coaches often swap lines from the official roster.'
      },
      {
        title: 'During the game',
        content: 'Assign one person to do the logging so the head coach can focus on the bench. Log events immediately — it\'s easy to forget the exact location after a whistle. Don\'t worry about perfection; approximate locations are still valuable.'
      },
      {
        title: 'After the game',
        content: 'Generate the AI game summary while the game is fresh. Export your reports before closing the app — session data is not automatically saved between visits. Review shot location patterns with your staff before the next practice.'
      }
    ]
  }
];

const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState('setup');

  if (!isOpen) return null;

  const current = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black italic uppercase text-white tracking-tighter">User Manual</h2>
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em] mt-0.5">Top Cheese Hockey Elite Suite</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-lg font-bold"
          aria-label="Close manual"
        >×</button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="w-48 sm:w-56 shrink-0 border-r border-white/10 bg-black/20 overflow-y-auto py-4">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-4 py-3 flex items-center gap-2.5 text-sm transition-colors ${
                activeSection === s.id
                  ? 'bg-blue-500/20 text-white border-r-2 border-blue-400'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <span>{s.icon}</span>
              <span className="font-medium leading-tight">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">{current.icon}</span>
              <h3 className="text-2xl font-black text-white">{current.title}</h3>
            </div>

            <div className="space-y-6">
              {current.subsections.map((sub, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">{sub.title}</h4>
                  <div className="text-white/80 text-sm leading-relaxed whitespace-pre-line">{sub.content}</div>
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
              {sections.findIndex(s => s.id === activeSection) > 0 ? (
                <button
                  onClick={() => setActiveSection(sections[sections.findIndex(s => s.id === activeSection) - 1].id)}
                  className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1"
                >
                  ← Previous
                </button>
              ) : <div />}
              {sections.findIndex(s => s.id === activeSection) < sections.length - 1 ? (
                <button
                  onClick={() => setActiveSection(sections[sections.findIndex(s => s.id === activeSection) + 1].id)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 font-semibold"
                >
                  Next →
                </button>
              ) : (
                <button onClick={onClose} className="text-sm text-green-400 hover:text-green-300 transition-colors font-semibold">
                  Done ✓
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManual;
