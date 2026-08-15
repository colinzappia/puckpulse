import React, { useState } from 'react';

interface FirstRunTourProps {
  onFinish: () => void;
}

const SLIDES = [
  {
    icon: '🏒',
    title: 'Welcome to Top Cheese Hockey',
    body: "Takes the guesswork out of gut-feel coaching. Here's the whole workflow in about a minute — starting with getting a game set up.",
  },
  {
    icon: '📋',
    title: 'Paste in your roster',
    body: 'Copy your team\'s roster from wherever you have it and paste it in during Roster Setup — no need to type every player by hand. The app will do its best to sort out names and numbers automatically.',
  },
  {
    icon: '✂️',
    title: 'Remove any extra players',
    body: "If the pasted roster includes players who aren't dressing for this particular game, just remove them from the list before you start tracking — keeps your stats accurate to who actually played.",
  },
  {
    icon: '🧩',
    title: 'Set your lines and D-pairings',
    body: 'Arrange your forward lines and defensive pairings in Roster Setup so they\'re ready to go before puck drop.',
  },
  {
    icon: '🥅',
    title: 'Choose your starting goalie',
    body: 'Tap the ★ next to a goalie in Roster Setup to set them as the starter. You can swap goalies mid-game later too — their stats split automatically at the moment you swap.',
  },
  {
    icon: '🎯',
    title: 'Pick what just happened',
    body: 'Once the game is set up, the toolbar across the top has every event type — Shot, Goal, Penalty, Faceoff, and more. Tap one to arm it.',
  },
  {
    icon: '👆',
    title: 'Tap the ice to log it',
    body: "Once an event type is armed, tap the exact spot on the rink where it happened. That's it — logged instantly, no forms to fill out.",
  },
  {
    icon: '📊',
    title: 'Check stats anytime',
    body: 'Player Stats and the Goalie Hub are always one tap away, live, the whole game — not just after you export a report.',
  },
];

const FirstRunTour: React.FC<FirstRunTourProps> = ({ onFinish }) => {
  const [step, setStep] = useState(0);
  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  return (
    <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center px-4">
      <div className="bg-[#0f1620] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
        <div className="text-5xl mb-5">{slide.icon}</div>
        <h3 className="text-white font-black text-xl mb-3">{slide.title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed mb-7">{slide.body}</p>

        <div className="flex items-center justify-center gap-1.5 mb-6 flex-wrap">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-cyan-400' : 'w-1.5 bg-white/15'}`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 border border-white/10 hover:border-white/20 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={() => (isLast ? onFinish() : setStep(s => s + 1))}
            className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-sm transition-colors"
          >
            {isLast ? "Let's go" : 'Next'}
          </button>
        </div>

        {!isLast && (
          <button onClick={onFinish} className="mt-4 text-slate-600 hover:text-slate-400 text-xs font-bold transition-colors">
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
};

export default FirstRunTour;
