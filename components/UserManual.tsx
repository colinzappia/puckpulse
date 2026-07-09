import React, { useState } from 'react';
import ThemedBackground from './ThemedBackground';

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
        title: 'Paste Roster Import',
        content: 'The fastest and most reliable way to load a roster. Go to any league website (Pointstreak, HockeyDB, your league site, etc.), select the roster table with your finger or mouse, and copy it. Then in Roster Setup, paste the text into the paste area and tap Import Roster. The AI reads the raw text and builds your lineup in seconds. Works on any device, any league, any website.'
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
        content: '1. Select the active team using the Home / Away toggle.\n2. Tap a player from the lineup grid — their name will highlight to confirm selection.\n3. Select the event type from the toolbar: SHOT, GOAL, SAVE, MISS, etc.\n4. Tap the location on the rink diagram where the event occurred. The event dot appears instantly.'
      },
      {
        title: 'Moving an event dot',
        content: 'Plotted in the wrong spot? No problem. Press and hold any event dot on the rink for a moment, then drag it to the correct location and release. This works with both your finger on a tablet and a mouse on a computer. The event updates instantly in the play-by-play log as well.'
      },
      {
        title: 'Quick logging tips',
        content: 'The app is designed for speed during live games:\n\n• Your selected player stays active between events — no need to re-tap after each log\n• Your selected event type (SHOT, GOAL, etc.) also stays selected\n• Watch for the green flash on the rink — it confirms your event was logged\n• Use the ↺ REPEAT button in the toolbar to instantly log the same event again for the same player\n• The active player badge in the toolbar shows who is currently selected'
      },
      {
        title: 'Logging a penalty',
        content: 'Select the penalized player, tap PENALTY from the event toolbar, then tap the location on ice. You\'ll be prompted to select the infraction type and duration.'
      },
      {
        title: 'Logging a faceoff',
        content: 'Tap the 🏒 Faceoffs floating button on the bottom left of the rink to open the Faceoff Hub panel. Select the centre for each team using the player buttons, then tap WIN or LOSS. The event is logged instantly for both teams.\n\nSwitch to the Breakdown tab to see live win percentages, zone stats, and head-to-head matchup data between specific centres.'
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
    id: 'endgame',
    icon: '🏆',
    title: 'Ending the Game',
    subsections: [
      {
        title: 'End Game button',
        content: 'When the final buzzer sounds, tap the red End Game button in the header. A summary screen appears showing the final score, shots, total events, and faceoffs tracked.\n\nTap "Download Report" to automatically generate and download your PDF game summary report. You can also download Excel and HTML versions from the same screen.'
      },
      {
        title: 'Player Stats',
        content: 'Tap the 📊 Player Stats floating button on the bottom right of the rink at any time to see a per-player breakdown for both teams. Stats include goals, shots, hits, penalties, faceoff wins/losses, and blocks. The top performer is highlighted with a ⭐.'
      },
      {
        title: 'Starting a new game',
        content: 'Tap the green New Game button in the header to clear all events, rosters, and team names and start fresh. You will be asked to confirm before anything is cleared — make sure you have exported your report first!'
      },
    ]
  },
  {
    id: 'exports',
    icon: '📊',
    title: 'Exporting Reports',
    subsections: [
      {
        title: 'PDF Game Summary Report',
        content: 'Tap "Export PDF" to generate a print-ready game summary report. It includes a game summary, shot charts, player stats, faceoff results, and the AI coaching notes. Great for sharing with your staff or filing for the season.'
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
    id: 'sessions',
    icon: '📡',
    title: 'Live Sessions',
    subsections: [
      {
        title: 'What is a Live Session?',
        content: 'A Live Session lets up to 5 users share the same game in real time. One person creates the session and gets a unique code — everyone else joins using that code. All events, scores, and roster changes sync instantly across every device in the session.'
      },
      {
        title: 'Creating a session',
        content: 'Tap "Share this game live" below the header. Review the game details (home and away teams must be set up first), then tap "Create session & get code." You\'ll receive a unique 7-character code like TCH-4829. Share this code — or the link — with your team before the game starts.'
      },
      {
        title: 'Joining a session',
        content: 'Tap "Join session" below the header and enter the code provided by the session admin. Your role (Logger or Viewer) will be assigned automatically. You\'ll land directly in the live game view — no additional setup needed.'
      },
      {
        title: 'Roles explained',
        content: 'There are three roles in a Live Session:\n\n• Admin — the person who created the session. Full control: can log events, manage roles, and end the session for everyone.\n\n• Logger — can log game events. Everything they log syncs in real time to all other users.\n\n• Viewer — read-only. Sees the live event feed and rink map update in real time but cannot log events.'
      },
      {
        title: 'Changing roles during the game',
        content: 'The admin can change any user\'s role at any time during the game. Tap the ⋯ button in the Live Session banner at the top of the screen. You\'ll see a list of everyone in the session — tap Logger or Viewer next to any user to change their role instantly. The change takes effect on their device immediately, no refresh needed.'
      },
      {
        title: 'Ending or leaving a session',
        content: 'Tap the ⋯ button in the session banner:\n\n• "Leave session" — removes you from the session but keeps it running for everyone else.\n\n• "End session for everyone" (admin only) — closes the session for all users. All events that were logged are preserved and can still be exported.'
      }
    ]
  },
    subsections: [
      {
        title: 'Before the game',
        content: 'Load your roster before the game using the Paste Roster feature. Go to your league website, copy the roster, and paste it into the app. Confirm jersey numbers match your actual lineup — coaches often make changes from the official roster.'
      },
      {
        title: 'During the game',
        content: 'Assign one person to do the logging so the head coach can focus on the bench. Log events immediately — it\'s easy to forget the exact location after a whistle. Don\'t worry about perfection; approximate locations are still valuable.'
      },
      {
        title: 'After the game',
        content: 'Generate the AI game summary while the game is fresh. Export your reports before closing the app. If you were in a Live Session, all events were saved to the server automatically — but export your report to keep a permanent copy for your records. Review shot location patterns with your staff before the next practice.'
      }
    ]
  }
];

const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState('setup');

  if (!isOpen) return null;

  const current = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <div className="fixed inset-0 z-[200] flex flex-col animate-in fade-in duration-300">
      {/* Themed background sits behind everything */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <ThemedBackground className="absolute inset-0" />
      </div>
      
      {/* Header */}
      <div className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
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
      <div className="relative z-10 flex flex-1 overflow-hidden">

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
