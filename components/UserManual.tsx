import React, { useState } from 'react';
import ThemedBackground from './ThemedBackground';
import { usePageMeta } from '../hooks/usePageMeta';

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
        content: 'Tap the "Roster Setup" button in the top right corner. Enter your home and away team names. The app automatically displays the team nickname (last word of the name) on the rink screen — so a team entered as "City Nickname" will display just the nickname on the toggle buttons and shot counters. You can also upload team logos by tapping the logo placeholder and selecting an image from your device.'
      },
      {
        title: 'Paste Roster Import',
        content: 'The fastest and most reliable way to load a roster. Go to any league website (Pointstreak, HockeyDB, your league site, etc.), select the roster table with your finger or mouse, and copy it. Then in Roster Setup, paste the text into the paste area and tap Import Roster. The AI reads the raw text and builds your lineup in seconds. Works on any device, any league, any website.\n\nNames are automatically normalized to "First Last" order even if the source listed them as "Last, First" — you never need to manually fix that.\n\nAfter importing, you\'ll be prompted to save the roster to your Team Library for quick reuse in future games.'
      },
      {
        title: 'Importing from a roster link (including PDF lineup sheets)',
        content: 'Instead of pasting text, you can paste a direct link to a team\'s roster page or a game lineup sheet PDF (like the ones many leagues publish before each game). The AI reads the actual document — including jersey numbers, positions, and names — and builds the lineup automatically. Works well for official league lineup PDFs specifically, since it reads the real jersey number column rather than confusing it with a row/listing order.'
      },
      {
        title: 'Manual roster entry',
        content: 'You can also add players one at a time. Tap "Add Player", enter their jersey number, full name, and position. Assign them to a line or pairing (1–4 for forwards, P1–P3 for defense, G1–G2 for goalies).'
      },
      {
        title: 'Loading from Team Library',
        content: 'Tap "📚 Load from Library" in either team\'s roster header to browse previously saved rosters. Choose from My Teams (your private rosters) or Shared (rosters saved by anyone on your plan). Tap "Load this roster" to instantly populate the lineup — no re-entry needed.'
      }
    ]
  },
  {
    id: 'library',
    icon: '📚',
    title: 'Team Library',
    subsections: [
      {
        title: 'What is the Team Library?',
        content: 'The Team Library stores your rosters in the cloud so you never have to re-enter them. Once a roster is saved, it\'s available on any device, for any game, instantly. Teams can be kept private (My Teams) or shared with everyone on your plan (Shared).'
      },
      {
        title: 'Saving a roster',
        content: 'After importing a roster via paste, a prompt slides up asking if you\'d like to save it. Enter or confirm the team name, pick a league (optional), and toggle "Share with all users" if you want others on your plan to be able to load it too. Tap "Save to library" to confirm.\n\nYou can skip saving and the roster will still be active for the current game — saving just makes it reusable.'
      },
      {
        title: 'My Teams vs Shared',
        content: '• My Teams — private to you. Rosters only you can see and load.\n\n• Shared — visible to everyone on your plan. If one user saves the Ottawa 67\'s roster and marks it shared, no one else ever has to enter it again.\n\nYou can only delete rosters you created yourself.'
      },
      {
        title: 'Managing saved teams',
        content: 'Open the Team Library by tapping "📚 Load from Library" in roster setup. Use the search bar to find teams by name or league.\n\nTap "Edit" on any of your own teams to update it — you can change the name, logo URL, league, add or remove individual players, and toggle shared on or off. Tap "Save changes" to update it in the library.\n\nTap the ✕ on any of your own teams to delete it. Shared teams created by others can be loaded but not edited or deleted by you.'
      }
    ]
  },
  {
    id: 'tracking',
    icon: '🏒',
    title: 'Tracking Events',
    subsections: [
      {
        title: 'Logging a shot, hit, block, giveaway, or takeaway',
        content: 'These all work the same fast way:\n\n1. Select the event type from the toolbar — SHOT, HIT, BLOCK, GIVE, or TAKE.\n2. Tap the location on the rink diagram. The dot appears instantly — nothing holds it up.\n3. A small bar slides in showing both team\'s rosters as number chips. Tap a number to attribute the event to that player, or just ignore it and keep tracking — attribution is always optional and can be added later from the Tactical Feed.\n\nYou don\'t need to pre-select a player or team before tapping the ice. The Home/Away toggle above the rink still sets which team a new event defaults to, but tapping any player\'s number in the bar afterward — even from the other team — will correctly move the event to that team if needed.'
      },
      {
        title: 'Shot detail — On Net, Attempt, PP, PK',
        content: 'Every shot also gets its own quick-select strip alongside the player bar, letting you mark:\n\n• Result — On Net or Attempt (missed/blocked). Defaults to On Net.\n• Strength — PP (power play) or PK (penalty kill). Leave both off for even strength.\n\nEach shot dot on the rink shows this at a glance: dot color is cyan for even strength, gold for PP, pink for PK, and a small checkmark (✓) or X (✕) inside the dot shows whether it reached the net. None of this blocks logging the next shot — tap the ice again any time and the strip updates for the new shot.'
      },
      {
        title: 'Goal popup — logging who was on ice',
        content: 'Tapping GOAL and then the rink opens a popup for that goal:\n\n1. Strength — pick ES, PP, SH, EN, or PS at the top. Defaults to ES.\n2. On-ice group — pick a forward line and/or a defense pair; both combine into one 5-player group (e.g. "Line 1 + Pair 2"). You don\'t have to pick both — just a line, just a pair, or both.\n3. Tap "Override players on ice" any time to hand-pick the exact players instead of using the preset line, useful for double shifts or a line change mid-shift. This works whether you\'re tracking one team or both.\n4. If tracking both teams, you\'ll also pick which defending players were on ice against, after the scoring team\'s group is confirmed.\n\nTap "Skip" on the first screen to log the goal with no line detail at all.'
      },
      {
        title: 'Canceling a popup',
        content: 'Tapped the wrong button, or want to back out of a Goal, Faceoff, Zone Entry, or Penalty popup entirely? Press Escape on a keyboard, or tap anywhere outside the popup (on the dark background) on a phone or tablet. Nothing gets logged — it\'s a clean cancel.'
      },
      {
        title: 'Moving an event dot',
        content: 'Plotted in the wrong spot? Press and hold any event dot on the rink for a moment, then drag it to the correct location and release. The event updates instantly in the play-by-play log as well.'
      },
      {
        title: 'Quick logging tips',
        content: 'The app is designed for speed during live games:\n\n• Shots, hits, blocks, giveaways, and takeaways log the instant you tap the ice — player attribution is a fast optional follow-up, never a requirement\n• Your selected event type stays selected between taps, so you can log the same thing repeatedly without re-selecting it\n• The event toolbar scrolls horizontally — swipe to reveal all event types\n• Goals, faceoffs, zone entries, and penalties each open a popup for their extra detail — tap the ice first, fill in the popup after'
      },
      {
        title: 'Logging a penalty',
        content: 'Tap PENALTY, then tap the location on the rink — a popup opens with three quick picks:\n\n1. Who took it — tap their number. If you already had a player selected in the lineup grid, they\'re pre-filled.\n2. Infraction — tap one of the 10 standard infractions, or tap "Other…" to type in a custom one.\n3. Duration — 2, 4, 5, or 10 minutes, or GM for a game misconduct.\n\nTap "Log Penalty" to confirm. Penalty minutes shown in team stats now reflect the actual duration you picked, not a flat assumption.'
      },
      {
        title: 'Logging a faceoff',
        content: 'Tap the 🏒 Faceoffs button in the event toolbar to arm the faceoff tool — the faceoff circles on the rink brighten to show they\'re ready. Tap anywhere inside the circle where the draw took place (the whole circle is clickable, not just the centre dot).\n\nA popup appears: pick each team\'s centre, then choose which team won the draw. If you\'re only tracking one team, the opposing centre is optional — you can leave it blank and still log the draw. Tap "Log Faceoff" and the event is logged instantly for both teams. Tap the Faceoffs button again to disarm it.\n\nSwitch to the Breakdown tab to see live win percentages, zone stats, and head-to-head matchup data between specific centres.'
      },
      {
        title: 'Logging a zone entry',
        content: 'Tap the ⛸ Zone Entries button in the event toolbar to arm the tool — both blue lines highlight to show they\'re ready. Tap near either blue line where the entry happened. It snaps to that blue line but keeps your exact up-ice/down-ice position, so entries through the middle vs. down the wall are still captured accurately.\n\nA popup appears asking how the entry happened: Carry-in, Dump-in, Pass, or Denied. If you pick Dump-in, an optional row unfolds to specify the type — Cross-corner, Soft chip, High on glass, or Rim around boards. Tap "Log Entry" to save it, or tap the Zone Entries button again to disarm the tool.\n\nEach entry type has its own shape on the rink map so you can tell them apart at a glance: ▲ carry-in, ■ dump-in, ◆ pass, ✕ denied.'
      },
      {
        title: 'Attaching a video clip to an event',
        content: 'Every logged event in the Tactical Feed can have a video clip and notes attached to it.\n\n1. In the Tactical Feed, hover over or long-press any event — a 🎬 button appears.\n2. Tap it to open the Clips & Notes panel for that event.\n3. Tap "+ Add clip" to attach a clip via:\n   • Paste URL — paste a link from Hudl, Catapult, YouTube, or any video platform\n   • Upload file — select a video file directly from your device\n4. Add an optional text note for context.\n5. Tap "Save clip" to attach it.\n\nClips are visible to all users on your plan. YouTube links embed and play directly in the panel. Hudl and Catapult links open in your browser. Only the person who attached a clip can delete it.'
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
        content: 'Each event is a color-coded dot. Away-team events get a white ring around the dot so you can tell teams apart at a glance even when colors overlap. A few event types have their own shape instead of a plain circle: zone entries show as ▲ carry-in, ■ dump-in, ◆ pass, or ✕ denied. Shot dots show a small ✓ (on net) or ✕ (missed/blocked) inside them, and their color tells you the strength — cyan for even strength, gold for power play, pink for penalty kill.'
      },
      {
        title: 'Using filters',
        content: 'The filter bar below the rink lets you show or hide each event type independently. Tap "Isolate" to hide everything at once, then tap individual event types back on one at a time — or "Show All" to bring everything back.\n\nThe SHOT filter has an extra ▾ next to it — tap it to slide out two more rows: Result (On Net / Attempt) and Strength (PP / PK). These combine, so you can isolate something specific like "PP shots that missed" by tapping both at once. Tapping SHOT itself always resets both back to showing every shot.'
      },
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
        content: 'Look for the small tab sitting right on the seam between the roster panels and the rink — it reads "▲ Hide Rosters" or "▼ Show Rosters" depending on the current state. Tap it to collapse the lineup grid and free up screen space, or bring it back when you need to select a player.'
      },
      {
        title: 'Team nickname display',
        content: 'The rink screen shows your team\'s nickname (the last word of the team name) on the Home/Away toggle buttons and shot counters to keep the layout clean on mobile. For example, a team named "City Nickname" would display as "Nickname". The full team name still appears everywhere else in the app.'
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
        content: 'Tap the 📊 Player Stats button (below the rink on mobile, floating on tablet/desktop) at any time to see a per-player breakdown for both teams. Columns include goals, shots broken out by SOG (on net), MISS (missed/blocked attempts), PP and PK shots, hits, penalties, faceoff wins/losses, blocks, and +/-.\n\n+/- only counts even-strength and shorthanded goals — power play, empty-net, and penalty-shot goals never affect it, matching standard convention. The table is wider now with all these columns, so swipe sideways on a phone to see everything. The top performer on each team (by combined activity) is highlighted with a ⭐.'
      },
      {
        title: 'Starting a new game',
        content: 'Tap the green New Game button in the header to clear all events, rosters, and team names and start fresh. You will be asked to confirm before anything is cleared — make sure you have exported your report first!'
      }
    ]
  },
  {
    id: 'history',
    icon: '📁',
    title: 'Game History',
    subsections: [
      {
        title: 'What is Game History?',
        content: 'Game History saves your completed game data to the cloud so you can access it anytime — no need to keep files on your device. Every saved game stores the full event log, rosters, scores, and team logos so reports can be regenerated on demand.'
      },
      {
        title: 'Saving a game',
        content: 'At the end of a game, tap "💾 Save game to history" on the end game screen. The game is saved to your account instantly. You can still download reports separately if you want a file copy.'
      },
      {
        title: 'Viewing past games',
        content: 'Tap "📁 Game History" in the menu (accessible from the ⋯ button in the header). This opens a panel with two tabs:\n\n• My Games — your own saved games, newest first\n• Shared — games shared by anyone on your plan\n\nEach card shows the teams, final score, date, and number of events logged. Tap any game to open the full stats summary.'
      },
      {
        title: 'Re-downloading reports',
        content: 'Tap any saved game to open its detail view. From there you can download a fresh PDF, Excel, or HTML report at any time — even weeks after the game was played.'
      },
      {
        title: 'Sharing a game report',
        content: 'In the game detail view, toggle "Share with plan" to make the report visible to everyone on your plan in the Shared tab. Toggle it off to make it private again. Only the person who saved the game can share or delete it.'
      }
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
        content: 'The admin can change any user\'s role at any time during the game. Tap the ⋯ button in the Live Session banner at the top of the screen. You\'ll see a list of everyone in the session by name — tap Logger or Viewer next to any user to change their role instantly. The change takes effect on their device immediately, no refresh needed.'
      },
      {
        title: 'Ending or leaving a session',
        content: 'Tap the ⋯ button in the session banner:\n\n• "Leave session" — removes you from the session but keeps it running for everyone else.\n\n• "End session for everyone" (admin only) — closes the session for all users. All events that were logged are preserved and can still be exported.'
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
        content: 'Load your roster before the game using the Paste Roster feature or the Team Library. Confirm jersey numbers match your actual lineup — coaches often make changes from the official roster. Set up your Live Session code and share it with your team before puck drop so everyone is connected and ready.'
      },
      {
        title: 'During the game',
        content: 'Assign one person to do the logging so the head coach can focus on the bench. Log events immediately — it\'s easy to forget the exact location after a whistle. Don\'t worry about perfection; approximate locations are still valuable. Use the goal popup to track which lines are on ice for every goal — this powers your plus/minus data.'
      },
      {
        title: 'After the game',
        content: 'Generate the AI game summary while the game is fresh. Tap "💾 Save game to history" before ending so your data is safely stored in the cloud. Export your reports for a permanent file copy. If you were in a Live Session, all events were already saved automatically. Attach any video clips to key events while the game is still fresh in your mind. Review shot location patterns with your staff before the next practice.'
      },
      {
        title: 'Navigation tip',
        content: 'If you tap your phone\'s back button while on the rink tracking screen, the app will return to the home page rather than leaving the site entirely. To get back to the rink, simply launch the app again from the home page.'
      }
    ]
  }
];

const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState('setup');

  usePageMeta(
    'User Manual | Top Cheese Hockey',
    'Everything you need to know to use Top Cheese Hockey: setup, live game tracking, faceoffs, zone entries, stats, and exporting game reports.'
  );

  if (!isOpen) return null;

  const current = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <div className="fixed inset-0 z-[200] flex flex-col animate-in fade-in duration-300">
      {/* Themed background sits behind everything */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <ThemedBackground className="absolute inset-0" />
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-white/10 bg-black/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-4">
          <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-12 w-auto" />
          <div>
            <h2 className="text-2xl sm:text-3xl font-black italic uppercase text-white tracking-tighter">User Manual</h2>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em] mt-0.5">Top Cheese Hockey Elite Suite</p>
          </div>
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
        <div className="w-48 sm:w-56 shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-sm overflow-y-auto py-4">
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
                <div key={i} className="bg-black/60 border border-white/10 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">{sub.title}</h4>
                  <div className="text-white/90 text-sm leading-relaxed whitespace-pre-line">{sub.content}</div>
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
