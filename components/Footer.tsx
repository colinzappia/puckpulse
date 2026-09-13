import React from 'react';
import { Link } from 'react-router-dom';
import { ADS_ENABLED } from '../data/siteConfig';

// The one footer used across every marketing/info page — Landing, About,
// Contact, and Advertise — so they all match. Originally the landing
// page had its own copy and the other pages either had a stripped-down
// version or none at all; this component is the single shared source of
// truth so that never drifts apart again, the same way data/goalieNet.ts,
// data/companyInfo.js, and data/manualContent.js keep other duplicated
// content in sync.
const Footer: React.FC = () => (
  <footer className="px-6 py-8 text-center text-slate-600 text-sm border-t border-white/5 bg-black/30 backdrop-blur-sm">
    <div className="flex items-center justify-center gap-3 mb-4">
      <a
        href="https://instagram.com/topcheesehkyapp"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Top Cheese Hockey on Instagram"
        className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </a>
      <a
        href="https://x.com/topcheesehkyapp"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Top Cheese Hockey on X"
        className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.9 2H22.5L14.9 10.6L23.8 22H16.8L11.3 14.9L5.1 22H1.4L9.5 12.8L1 2H8.2L13.1 8.5L18.9 2ZM17.7 20H19.6L7.2 3.9H5.1L17.7 20Z" />
        </svg>
      </a>
      <a
        href="https://tiktok.com/@topcheesehkyapp"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Top Cheese Hockey on TikTok"
        className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.6 2H13.8V15.4C13.8 16.9 12.6 18.1 11.1 18.1C9.6 18.1 8.4 16.9 8.4 15.4C8.4 13.9 9.6 12.7 11.1 12.7C11.4 12.7 11.6 12.7 11.9 12.8V9.9C11.6 9.9 11.4 9.8 11.1 9.8C8 9.8 5.5 12.3 5.5 15.4C5.5 18.5 8 21 11.1 21C14.2 21 16.7 18.5 16.7 15.4V8.4C17.8 9.2 19.1 9.7 20.5 9.7V6.9C18.3 6.9 16.6 5.2 16.6 3V2Z" />
        </svg>
      </a>
    </div>
    © 2026 Top Cheese Hockey · Built for hockey people, by hockey people
    <span className="mx-2">·</span>
    {ADS_ENABLED && (
      <>
        <Link to="/advertise" className="hover:text-slate-300 transition-colors">📢 Advertise With Us</Link>
        <span className="mx-2">·</span>
      </>
    )}
    <Link to="/contact" className="hover:text-slate-400 transition-colors">Contact Us</Link>
    <span className="mx-2">·</span>
    <Link to="/about" className="hover:text-slate-300 transition-colors">About</Link>
    <span className="mx-2">·</span>
    <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Terms</a>
    <span className="mx-2">·</span>
    <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Privacy</a>
  </footer>
);

export default Footer;
