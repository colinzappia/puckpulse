import React, { useState, useEffect } from 'react';

interface Sponsor {
  name: string;
  tagline: string;
  logo?: string;        // URL to sponsor logo image
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  link: string;
}

// ============================================================
// EDIT YOUR SPONSORS HERE
// Add as many sponsors as you like.
// Each sponsor rotates automatically every 8 seconds.
// To use only one sponsor, just leave one entry in the array.
// ============================================================
const SPONSORS: Sponsor[] = [
  {
    name: "YOUR SPONSOR HERE",
    tagline: "Contact us to advertise on Top Cheese Hockey",
    backgroundColor: "#0f1620",
    textColor: "#94a3b8",
    accentColor: "#e8a020",
    link: "mailto:admin@topcheesehockey.com",
  },
];

interface AdBannerProps {
  position: 'top' | 'bottom';
}

const AdBanner: React.FC<AdBannerProps> = ({ position }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (SPONSORS.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % SPONSORS.length);
        setVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const sponsor = SPONSORS[currentIndex];

  return (
    <a
      href={sponsor.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full transition-all duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="w-full flex items-center justify-between px-4 py-2 border-white/5"
        style={{
          backgroundColor: sponsor.backgroundColor,
          borderTopWidth: position === 'bottom' ? '1px' : '0',
          borderBottomWidth: position === 'top' ? '1px' : '0',
          borderStyle: 'solid',
          borderColor: 'rgba(255,255,255,0.05)',
        }}
      >
        {/* Left — Sponsored label */}
        <span
          className="text-[8px] font-black uppercase tracking-[0.2em] shrink-0"
          style={{ color: sponsor.accentColor, opacity: 0.7 }}
        >
          Sponsored
        </span>

        {/* Center — Sponsor info */}
        <div className="flex items-center gap-3 mx-4 overflow-hidden">
          {sponsor.logo && (
            <img
              src={sponsor.logo}
              alt={sponsor.name}
              className="h-6 w-auto object-contain shrink-0"
            />
          )}
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className="text-[11px] font-black uppercase tracking-wider shrink-0"
              style={{ color: sponsor.textColor }}
            >
              {sponsor.name}
            </span>
            <span className="text-white/10 shrink-0">·</span>
            <span
              className="text-[10px] truncate"
              style={{ color: sponsor.textColor, opacity: 0.6 }}
            >
              {sponsor.tagline}
            </span>
          </div>
        </div>

        {/* Right — CTA */}
        <span
          className="text-[9px] font-black uppercase tracking-wider shrink-0 px-3 py-1 rounded-full border"
          style={{
            color: sponsor.accentColor,
            borderColor: sponsor.accentColor,
            opacity: 0.8,
          }}
        >
          Learn More
        </span>
      </div>
    </a>
  );
};

export default AdBanner;
