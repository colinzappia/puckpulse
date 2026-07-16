import React, { useState, useEffect } from 'react';

interface Partner {
  name: string;
  tagline: string;
  logo?: string;        // URL to partner logo image
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  link: string;
}

// ============================================================
// EDIT YOUR PARTNERS HERE
// Add as many partners as you like.
// Each partner rotates automatically every 8 seconds.
// To use only one partner, just leave one entry in the array.
// ============================================================
const PARTNERS: Partner[] = [
  {
    name: "YOUR PARTNER HERE",
    tagline: "Contact us to advertise on Top Cheese Hockey",
    backgroundColor: "#0f1620",
    textColor: "#94a3b8",
    accentColor: "#e8a020",
    link: "mailto:hello@topcheesehockey.com",
  },
];

interface AdBannerProps {
  position: 'top' | 'bottom';
  onContactClick?: () => void;
}

const AdBanner: React.FC<AdBannerProps> = ({ position, onContactClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (PARTNERS.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % PARTNERS.length);
        setVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const partner = PARTNERS[currentIndex];

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (partner.link.startsWith('mailto') && onContactClick) {
      onContactClick();
    } else if (partner.link.startsWith('http')) {
      window.open(partner.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={handleClick}
      className="block w-full transition-all duration-300"
      style={{ opacity: visible ? 1 : 0, cursor: partner.link ? 'pointer' : 'default' }}
    >
      <div
        className="w-full flex items-center justify-between px-6 py-4 border-white/5"
        style={{
          backgroundColor: partner.backgroundColor,
          borderTopWidth: position === 'bottom' ? '1px' : '0',
          borderBottomWidth: position === 'top' ? '1px' : '0',
          borderStyle: 'solid',
          borderColor: 'rgba(255,255,255,0.05)',
        }}
      >
        {/* Left — Partner label */}
        <span
          className="text-[10px] font-black uppercase tracking-[0.2em] shrink-0"
          style={{ color: partner.accentColor, opacity: 0.7 }}
        >
          Partner
        </span>

        {/* Center — Partner info */}
        <div className="flex items-center gap-3 mx-4 overflow-hidden">
          {partner.logo && (
            <img
              src={partner.logo}
              alt={partner.name}
              className="h-6 w-auto object-contain shrink-0"
            />
          )}
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className="text-base font-black uppercase tracking-wider shrink-0"
              style={{ color: partner.textColor }}
            >
              {partner.name}
            </span>
            <span className="text-white/10 shrink-0">·</span>
            <span
              className="text-sm truncate"
              style={{ color: partner.textColor, opacity: 0.6 }}
            >
              {partner.tagline}
            </span>
          </div>
        </div>

        {/* Right — CTA */}
        <span
          className="text-xs font-black uppercase tracking-wider shrink-0 px-4 py-1.5 rounded-full border"
          style={{
            color: partner.accentColor,
            borderColor: partner.accentColor,
            opacity: 0.9,
          }}
        >
          {partner.link.startsWith('mailto') ? 'Advertise Here' : 'Learn More'}
        </span>
      </div>
    </div>
  );
};

export default AdBanner;
