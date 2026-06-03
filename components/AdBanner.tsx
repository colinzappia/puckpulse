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

  const handleClick = () => {
    if (sponsor.link.startsWith('mailto') || sponsor.link.startsWith('http')) {
      window.open(sponsor.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={handleClick}
      className="block w-full transition-all duration-300"
      style={{ opacity: visible ? 1 : 0, cursor: sponsor.link ? 'pointer' : 'default' }}
    >
      <div
        className="w-full flex items-center justify-between px-6 py-3 border-white/5"
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
          className="text-[10px] font-black uppercase tracking-[0.2em] shrink-0"
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
              className="text-sm font-black uppercase tracking-wider shrink-0"
              style={{ color: sponsor.textColor }}
            >
              {sponsor.name}
            </span>
            <span className="text-white/10 shrink-0">·</span>
            <span
              className="text-xs truncate"
              style={{ color: sponsor.textColor, opacity: 0.6 }}
            >
              {sponsor.tagline}
            </span>
          </div>
        </div>

        {/* Right — CTA */}
        <span
          className="text-xs font-black uppercase tracking-wider shrink-0 px-4 py-1.5 rounded-full border"
          style={{
            color: sponsor.accentColor,
            borderColor: sponsor.accentColor,
            opacity: 0.9,
          }}
        >
          {sponsor.link.startsWith('mailto') ? 'Advertise Here' : 'Learn More'}
        </span>
      </div>
    </div>
  );
};

export default AdBanner;
