import React, { useState } from 'react';
import ThemedBackground from './ThemedBackground';
import { usePageMeta } from '../hooks/usePageMeta';
import { manualSections } from '../data/manualContent';

interface UserManualProps {
  isOpen: boolean;
  onClose: () => void;
  onReplayTour?: () => void;
}

interface ManualSubsection {
  title: string;
  content: string;
  videoId?: string; // YouTube video ID — optional, shows a "Watch demo" toggle when present
}
interface ManualCategory {
  id: string;
  icon: string;
  title: string;
  subsections: ManualSubsection[];
}

const sections: ManualCategory[] = manualSections;

// Collapsed by default so the manual stays text-first and fast to scan —
// tapping reveals an embedded YouTube player right in place. Nothing
// downloads or loads until the coach actually asks for it.
const VideoEmbed: React.FC<{ videoId: string }> = ({ videoId }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        🎥 {open ? 'Hide demo' : 'Watch demo'}
      </button>
      {open && (
        <div className="mt-2 rounded-xl overflow-hidden border border-white/10 aspect-video">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="Feature demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
};

const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose, onReplayTour }) => {
  const [activeSection, setActiveSection] = useState('setup');
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Switching sections should always start at the top of the new content,
  // not wherever the scroll happened to be left from the previous one.
  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeSection]);

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
        <div className="flex items-center gap-2">
          {onReplayTour && (
            <button
              onClick={onReplayTour}
              className="px-3 py-2 rounded-full bg-cyan-600/15 hover:bg-cyan-600/25 border border-cyan-500/30 text-cyan-400 text-xs font-bold transition-colors whitespace-nowrap"
            >
              🎬 Replay Tour
            </button>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-lg font-bold"
            aria-label="Close manual"
          >×</button>
        </div>
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
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 sm:px-10 py-8">
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
                  {sub.videoId && <VideoEmbed videoId={sub.videoId} />}
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
